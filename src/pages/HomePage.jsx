import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import FlavorCard from "../components/FlavorCard.jsx";
import EditFlavorsModal from "../components/EditFlavorsModal.jsx";

const DEFAULTS = {
  unitPrice: 4500,
  boxCost: 188000,
  boxesPurchased: 0,
  allFlavors: ["Snickers", "Red Velvet", "Limón", "Maracuyá", "Snowreo"],
  enabledFlavors: ["Snickers", "Red Velvet", "Limón", "Maracuyá", "Snowreo"],
};

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export default function HomePage({ profile }) {
  const [settings, setSettings] = useState(null);
  const [inventory, setInventory] = useState(null);

  const [quantities, setQuantities] = useState({});
  const [tip, setTip] = useState("");
  const [saving, setSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    const ref = doc(db, "settings", "app");
    (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) await setDoc(ref, DEFAULTS);
    })();
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "app"), (snap) => setSettings(snap.data() || null));
  }, []);

  useEffect(() => {
    const ref = doc(db, "inventory", "current");
    (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const baseCounts = {};
        (DEFAULTS.allFlavors || []).forEach((f) => (baseCounts[f] = 0));
        await setDoc(ref, { counts: baseCounts });
      }
    })();
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, "inventory", "current"), (snap) => setInventory(snap.data() || null));
  }, []);

  const unitPrice = settings?.unitPrice ?? DEFAULTS.unitPrice;
  const enabledFlavors = useMemo(() => settings?.enabledFlavors || [], [settings]);
  const allFlavors = useMemo(() => settings?.allFlavors || [], [settings]);

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      enabledFlavors.forEach((f) => {
        if (typeof next[f] !== "number") next[f] = 0;
      });
      Object.keys(next).forEach((k) => {
        if (!enabledFlavors.includes(k)) delete next[k];
      });
      return next;
    });
  }, [enabledFlavors]);

  const totalQty = useMemo(
    () => Object.values(quantities).reduce((a, b) => a + (Number(b) || 0), 0),
    [quantities]
  );

  const totalValue = useMemo(() => totalQty * unitPrice, [totalQty, unitPrice]);

  const counts = inventory?.counts || {};

  const canSell = useMemo(() => {
    if (totalQty <= 0) return false;
    for (const f of enabledFlavors) {
      const want = Number(quantities[f] || 0);
      const have = Number(counts[f] || 0);
      if (want > have) return false;
    }
    return true;
  }, [enabledFlavors, quantities, counts, totalQty]);

  const onPlus = (flavor) => {
    const have = Number(counts?.[flavor] || 0);
    setQuantities((q) => {
      const current = Number(q[flavor] || 0);
      if (current + 1 > have) return q;
      return { ...q, [flavor]: current + 1 };
    });
  };

  const onMinus = (flavor) => {
    setQuantities((q) => {
      const current = Number(q[flavor] || 0);
      return { ...q, [flavor]: Math.max(0, current - 1) };
    });
  };

  const sell = async () => {
    if (!canSell) return;

    setSaving(true);
    const safeTip = Number(String(tip).replaceAll(".", "").replaceAll(",", ".")) || 0;

    try {
      await runTransaction(db, async (tx) => {
        const invRef = doc(db, "inventory", "current");
        const invSnap = await tx.get(invRef);
        const dbCounts = invSnap.data()?.counts || {};

        for (const f of enabledFlavors) {
          const want = Number(quantities[f] || 0);
          const have = Number(dbCounts[f] || 0);
          if (want > have) throw new Error(`Stock insuficiente para ${f}`);
        }

        const newCounts = { ...dbCounts };
        for (const f of enabledFlavors) {
          const want = Number(quantities[f] || 0);
          if (want > 0) newCounts[f] = Number(newCounts[f] || 0) - want;
        }
        tx.update(invRef, { counts: newCounts });

        const salesCol = collection(db, "profiles", profile, "sales");
        for (const f of enabledFlavors) {
          const qty = Number(quantities[f] || 0);
          if (qty <= 0) continue;

          const total = qty * unitPrice;
          const saleRef = doc(salesCol);
          tx.set(saleRef, {
            flavor: f,
            qty,
            unitPrice,
            total,
            createdAt: serverTimestamp(),
          });
        }

        if (safeTip > 0) {
          const tipsCol = collection(db, "profiles", profile, "tips");
          const tipRef = doc(tipsCol);
          tx.set(tipRef, { amount: safeTip, createdAt: serverTimestamp() });
        }
      });

      setQuantities((q) => Object.fromEntries(Object.keys(q).map((k) => [k, 0])));
      setTip("");
    } catch (e) {
      alert(e?.message || "Error vendiendo. Revisa stock e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (flavor) => {
    const ref = doc(db, "settings", "app");
    const curr = settings?.enabledFlavors || [];
    const next = curr.includes(flavor) ? curr.filter((x) => x !== flavor) : [...curr, flavor];
    await updateDoc(ref, { enabledFlavors: next });
  };

  const addFlavor = async (flavor) => {
    const clean = flavor.trim();
    if (!clean) return;

    const ref = doc(db, "settings", "app");
    const currAll = settings?.allFlavors || [];
    const currEnabled = settings?.enabledFlavors || [];
    if (currAll.includes(clean)) return;

    await updateDoc(ref, {
      allFlavors: [...currAll, clean],
      enabledFlavors: [...currEnabled, clean],
    });

    const invRef = doc(db, "inventory", "current");
    const invSnap = await getDoc(invRef);
    const invCounts = invSnap.data()?.counts || {};
    if (invCounts[clean] == null) {
      await updateDoc(invRef, { counts: { ...invCounts, [clean]: 0 } });
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2">Principal</div>
            <p className="p-muted">Alfajores • Ajusta cantidades por sabor y vende.</p>
          </div>
          <button className="btn secondary" onClick={() => setIsEditOpen(true)}>
            Editar sabores
          </button>
        </div>

        <div className="spacer" />

        <div className="flavor-list">
          {enabledFlavors.map((flavor) => {
            const remaining = Number(counts[flavor] || 0);
            const qty = Number(quantities[flavor] || 0);
            return (
              <FlavorCard
                key={flavor}
                name={flavor}
                remaining={remaining}
                qty={qty}
                onMinus={() => onMinus(flavor)}
                onPlus={() => onPlus(flavor)}
                disabledMinus={qty <= 0}
                disabledPlus={qty >= remaining}
              />
            );
          })}
        </div>

        <div className="spacer" />

        {/* RESUMEN DE VENTA (DEBAJO, NO STICKY) */}
        <div className="card">
          <div className="label">Propina (opcional, se guarda aparte)</div>
          <input
            className="input"
            placeholder="Ej: 2000"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
          />

          <div className="spacer" />

          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-title">Seleccionados</div>
              <div className="kpi-value">{totalQty}</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Total venta</div>
              <div className="kpi-value">{money(totalValue)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Perfil</div>
              <div className="kpi-value">{profile}</div>
            </div>
          </div>

          <div className="spacer" />

          <button className="btn" onClick={sell} disabled={!canSell || saving}>
            {saving ? "Vendiendo..." : "Vender"}
          </button>

          {!canSell && totalQty > 0 && (
            <div className="small" style={{ marginTop: 10 }}>
              ⚠️ Revisa inventario: hay sabores con cantidad mayor a lo disponible.
            </div>
          )}
        </div>
      </div>

      <EditFlavorsModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        allFlavors={allFlavors}
        enabledFlavors={enabledFlavors}
        onToggleEnabled={toggleEnabled}
        onAddFlavor={addFlavor}
      />
    </div>
  );
}
