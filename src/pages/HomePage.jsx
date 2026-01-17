import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import FlavorCard from "../components/FlavorCard.jsx";
import EditFlavorsModal from "../components/EditFlavorsModal.jsx";

const DEFAULTS = {
  unitPrice: 4500,
  boxCost: 188000,
  boxesPurchased: 0,
  allFlavors: ["Arequipe", "Chocolate", "Frutos rojos", "Coco"],
  enabledFlavors: ["Arequipe", "Chocolate", "Frutos rojos", "Coco"],
};

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default function HomePage({ profile }) {
  const [settings, setSettings] = useState(null);
  const [inventory, setInventory] = useState(null);

  const [quantities, setQuantities] = useState({});
  const [tip, setTip] = useState("");
  const [saving, setSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);

  // Init settings if not exist
  useEffect(() => {
    const ref = doc(db, "settings", "app");
    (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, DEFAULTS);
      }
    })();
  }, []);

  // Listen settings
  useEffect(() => {
    const ref = doc(db, "settings", "app");
    return onSnapshot(ref, (snap) => setSettings(snap.data() || null));
  }, []);

  // Init inventory if not exist
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

  // Listen inventory
  useEffect(() => {
    const ref = doc(db, "inventory", "current");
    return onSnapshot(ref, (snap) => setInventory(snap.data() || null));
  }, []);

  const unitPrice = settings?.unitPrice ?? DEFAULTS.unitPrice;

  const enabledFlavors = useMemo(() => settings?.enabledFlavors || [], [settings]);
  const allFlavors = useMemo(() => settings?.allFlavors || [], [settings]);

  // Ensure quantities keys exist for enabled flavors
  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      enabledFlavors.forEach((f) => {
        if (typeof next[f] !== "number") next[f] = 0;
      });
      // Remove old keys that no longer exist (clean)
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

  const canSell = useMemo(() => {
    if (!inventory?.counts) return false;
    if (totalQty <= 0) return false;

    // validate stock
    for (const f of enabledFlavors) {
      const want = Number(quantities[f] || 0);
      const have = Number(inventory.counts[f] || 0);
      if (want > have) return false;
    }
    return true;
  }, [enabledFlavors, quantities, inventory, totalQty]);

  const onPlus = (flavor) => {
    const have = Number(inventory?.counts?.[flavor] || 0);
    setQuantities((q) => {
      const current = Number(q[flavor] || 0);
      if (current + 1 > have) return q; // don't exceed stock
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
      // Transaction: decrement inventory + write sales docs
      await runTransaction(db, async (tx) => {
        const invRef = doc(db, "inventory", "current");
        const invSnap = await tx.get(invRef);
        const counts = (invSnap.data()?.counts) || {};

        // Check stock again inside transaction
        for (const f of enabledFlavors) {
          const want = Number(quantities[f] || 0);
          const have = Number(counts[f] || 0);
          if (want > have) {
            throw new Error(`Stock insuficiente para ${f}`);
          }
        }

        // Update stock
        const newCounts = { ...counts };
        for (const f of enabledFlavors) {
          const want = Number(quantities[f] || 0);
          if (want > 0) newCounts[f] = Number(newCounts[f] || 0) - want;
        }
        tx.update(invRef, { counts: newCounts });

        // Create sales docs
        const salesCol = collection(db, "profiles", profile, "sales");
        for (const f of enabledFlavors) {
          const qty = Number(quantities[f] || 0);
          if (qty <= 0) continue;

          const total = qty * unitPrice;
          const saleRef = doc(salesCol); // auto id
          tx.set(saleRef, {
            flavor: f,
            qty,
            unitPrice,
            total,
            createdAt: serverTimestamp(),
          });
        }

        // Save tip separately if provided
        if (safeTip > 0) {
          const tipsCol = collection(db, "profiles", profile, "tips");
          const tipRef = doc(tipsCol);
          tx.set(tipRef, {
            amount: safeTip,
            createdAt: serverTimestamp(),
          });
        }
      });

      // Reset UI
      setQuantities((q) => {
        const reset = {};
        Object.keys(q).forEach((k) => (reset[k] = 0));
        return reset;
      });
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

    // Ensure inventory includes it
    const invRef = doc(db, "inventory", "current");
    const invSnap = await getDoc(invRef);
    const counts = invSnap.data()?.counts || {};
    if (counts[clean] == null) {
      await updateDoc(invRef, { counts: { ...counts, [clean]: 0 } });
    }
  };

  const counts = inventory?.counts || {};
  const listToShow = enabledFlavors;

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h2">Principal</div>
            <p className="p-muted">Subtítulo: <strong>Alfajores</strong>. Ajusta cantidades por sabor y presiona <strong>Vender</strong>.</p>
          </div>
          <button className="btn secondary" onClick={() => setIsEditOpen(true)}>
            Editar sabores
          </button>
        </div>

        <div className="spacer" />

        <div className="flavor-list">
          {listToShow.map((flavor) => {
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
          {listToShow.length === 0 && (
            <div className="small">
              No hay sabores visibles. Presiona <strong>Editar sabores</strong> y activa algunos.
            </div>
          )}
        </div>

        <div className="spacer" />

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">Propina (opcional, se guarda aparte)</div>
              <input
                className="input"
                placeholder="Ej: 2000"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
              />
              <div className="small" style={{ marginTop: 6 }}>
                Se guardará en Firestore dentro de <code>profiles/{profile}/tips</code>.
              </div>
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="kpi">
                <div className="kpi-title">Resumen de esta venta</div>
                <div className="kpi-value">{totalQty} alfajor(es)</div>
                <div className="small">Total: <strong>{money(totalValue)}</strong></div>
              </div>
            </div>
          </div>

          <div className="spacer" />
          <div className="footer-actions">
            <button className="btn" onClick={sell} disabled={!canSell || saving}>
              {saving ? "Vendiendo..." : "Vender"}
            </button>
          </div>

          {!canSell && totalQty > 0 && (
            <div className="small" style={{ marginTop: 10 }}>
              ⚠️ No se puede vender: revisa que no excedas el inventario de algún sabor.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="h2">Precios</div>
        <p className="p-muted">Automático: cada alfajor vale <strong>{money(unitPrice)}</strong>.</p>

        <div className="spacer" />

        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-title">Alfajores seleccionados</div>
            <div className="kpi-value">{totalQty}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Ingresos de esta venta</div>
            <div className="kpi-value">{money(totalValue)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Perfil</div>
            <div className="kpi-value">{profile}</div>
          </div>
        </div>

        <div className="spacer" />

        <div className="card">
          <div className="h2">Tips de uso</div>
          <p className="small">
            • Si hay muchos sabores, la lista tiene <strong>scroll</strong>. Si hay pocos, queda estática. <br />
            • El botón “+” no deja superar el inventario disponible. <br />
            • “Editar sabores” controla qué aparece en la pestaña principal.
          </p>
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
