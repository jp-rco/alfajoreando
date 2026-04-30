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
import DailyStockModal from "../components/DailyStockModal.jsx";
import PaymentMethodModal from "../components/PaymentMethodModal.jsx";

const DEFAULTS = {
  unitPrice: 5000,
  totalCosts: 0,
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
  const [dailyInventory, setDailyInventory] = useState(null);

  const [quantities, setQuantities] = useState({});
  const [tip, setTip] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDailyStockOpen, setIsDailyStockOpen] = useState(false);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [hasCheckedDaily, setHasCheckedDaily] = useState(false);
  const [viewMode, setViewMode] = useState('stock');

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

  useEffect(() => {
    return onSnapshot(doc(db, "inventory", "daily"), (snap) => {
      setDailyInventory(snap.exists() ? snap.data() : { date: "", JP: { counts: {} }, Pau: { counts: {} } });
    });
  }, []);

  const otherProfile = profile === "JP" ? "Pau" : "JP";

  useEffect(() => {
    if (hasCheckedDaily) return;
    if (!dailyInventory || !inventory || !settings) return;

    const currentDate = new Date().toLocaleDateString('en-CA');
    const dbDate = dailyInventory.date;
    const myDaily = dailyInventory[profile]?.counts || null;

    if (dbDate !== currentDate || !myDaily) {
      setIsDailyStockOpen(true);
    }
    setHasCheckedDaily(true);
  }, [dailyInventory, inventory, settings, hasCheckedDaily, profile]);

  const saveDailyStock = async (countsMap) => {
    setSaving(true);
    try {
      const currentDate = new Date().toLocaleDateString('en-CA');
      
      const updateData = {
        date: currentDate,
        [profile]: { counts: countsMap }
      };

      await setDoc(doc(db, "inventory", "daily"), updateData, { merge: true });
      setIsDailyStockOpen(false);
    } catch (e) {
      alert("Error guardando stock.");
    } finally {
      setSaving(false);
    }
  };

  const unitPrice = settings?.unitPrice ?? DEFAULTS.unitPrice;
  const allFlavors = useMemo(() => settings?.allFlavors || [], [settings]);

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      allFlavors.forEach((f) => {
        if (typeof next[f] !== "number") next[f] = 0;
      });
      Object.keys(next).forEach((k) => {
        if (!allFlavors.includes(k)) delete next[k];
      });
      return next;
    });
  }, [allFlavors]);

  const totalQty = useMemo(
    () => Object.values(quantities).reduce((a, b) => a + (Number(b) || 0), 0),
    [quantities]
  );

  const totalValue = useMemo(() => totalQty * unitPrice, [totalQty, unitPrice]);

  const counts = inventory?.counts || {};
  
  const myCounts = dailyInventory?.[profile]?.counts || {};
  const otherCounts = dailyInventory?.[otherProfile]?.counts || {};

  const { totalMyStock, totalBodegaStock } = useMemo(() => {
    let my = 0;
    let bod = 0;
    allFlavors.forEach(f => {
      my += Number(myCounts[f] || 0);
      bod += Number(counts[f] || 0);
    });
    return { totalMyStock: my, totalBodegaStock: bod };
  }, [allFlavors, myCounts, counts]);

  const visibleFlavors = useMemo(() => {
    return allFlavors.filter((f) => {
      if (viewMode === 'stock') {
        return Number(myCounts[f] || 0) > 0;
      } else {
        return Number(counts[f] || 0) > 0;
      }
    });
  }, [allFlavors, viewMode, myCounts, counts]);

  const canSell = useMemo(() => {
    if (totalQty <= 0) return false;
    for (const f of visibleFlavors) {
      const want = Number(quantities[f] || 0);
      const have = Number(myCounts[f] || 0);
      if (want > have) return false;
    }
    return true;
  }, [visibleFlavors, quantities, myCounts, totalQty]);

  const onPlus = (flavor) => {
    const have = Number(myCounts?.[flavor] || 0);
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

  const sell = async (method) => {
    if (!canSell) return;

    setSaving(true);
    setIsPaymentMenuOpen(false);
    const safeTip = Number(String(tip).replaceAll(".", "").replaceAll(",", ".")) || 0;

    try {
      await runTransaction(db, async (tx) => {
        const invRef = doc(db, "inventory", "current");
        const invSnap = await tx.get(invRef);
        const dbCounts = invSnap.data()?.counts || {};

        const dailyRef = doc(db, "inventory", "daily");
        const dailySnap = await tx.get(dailyRef);
        const dailyDbData = dailySnap.data() || {};
        const dailyDbMyCounts = dailyDbData[profile]?.counts || {};

        for (const f of visibleFlavors) {
          const want = Number(quantities[f] || 0);
          const haveWarehouse = Number(dbCounts[f] || 0);
          const haveDaily = Number(dailyDbMyCounts[f] || 0);
          if (want > haveDaily) throw new Error(`Stock insuficiente para ${f}`);
          if (want > haveWarehouse) throw new Error(`Stock bodega insuficiente para ${f}`);
        }

        const newCounts = { ...dbCounts };
        const newDailyMyCounts = { ...dailyDbMyCounts };
        for (const f of visibleFlavors) {
          const want = Number(quantities[f] || 0);
          if (want > 0) {
             newCounts[f] = Number(newCounts[f] || 0) - want;
             newDailyMyCounts[f] = Number(newDailyMyCounts[f] || 0) - want;
          }
        }
        tx.update(invRef, { counts: newCounts });
        tx.set(dailyRef, { [profile]: { counts: newDailyMyCounts } }, { merge: true });

        const salesCol = collection(db, "profiles", profile, "sales");
        for (const f of visibleFlavors) {
          const qty = Number(quantities[f] || 0);
          if (qty <= 0) continue;

          const total = qty * unitPrice;
          const saleRef = doc(salesCol);
          tx.set(saleRef, {
            flavor: f,
            qty,
            unitPrice,
            total,
            method: method, // "Efectivo" or "Transferencia"
            notes: notes.trim(),
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
      setNotes("");
    } catch (e) {
      alert(e?.message || "Error vendiendo. Revisa stock e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (flavor) => {
    // Ya no se usa la visibilidad manual
  };

  const addFlavor = async (flavor) => {
    const clean = flavor.trim();
    if (!clean) return;

    const ref = doc(db, "settings", "app");
    const currAll = settings?.allFlavors || [];
    const currEnabled = settings?.enabledFlavors || [];
    if (currAll.includes(clean)) return;

    await updateDoc(ref, {
      allFlavors: [...currAll, clean]
    });

    const invRef = doc(db, "inventory", "current");
    const invSnap = await getDoc(invRef);
    const invCounts = invSnap.data()?.counts || {};
    if (invCounts[clean] == null) {
      await updateDoc(invRef, { counts: { ...invCounts, [clean]: 0 } });
    }
  };

  return (
    <div className="grid animate-fade-in-up">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2">Principal</div>
            <p className="p-muted">Alfajores • Ajusta cantidades por sabor y vende.</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn outline" onClick={() => setIsDailyStockOpen(true)}>
              Modificar Stock
            </button>
            <button className="btn secondary" onClick={() => setIsEditOpen(true)}>
              Añadir sabor
            </button>
          </div>
        </div>

        <div className="spacer" />

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "14px" }}>
            <button 
              className={`navbtn ${viewMode === 'stock' ? 'active' : ''}`} 
              onClick={() => setViewMode('stock')}
              style={viewMode === 'stock' ? { padding: "6px 12px" } : { border: "1px solid transparent", background: "transparent", padding: "6px 12px" }}
            >
              Mi Stock
            </button>
            <button 
              className={`navbtn ${viewMode === 'bodega' ? 'active' : ''}`} 
              onClick={() => setViewMode('bodega')}
              style={viewMode === 'bodega' ? { padding: "6px 12px" } : { border: "1px solid transparent", background: "transparent", padding: "6px 12px" }}
            >
              Bodega
            </button>
          </div>
          <div className="small">
            <strong>Total {viewMode === 'stock' ? 'Stock' : 'Bodega'}: </strong>
            <span style={{ color: "var(--c5)", fontWeight: "900", fontSize: "14px" }}>
              {viewMode === 'stock' ? totalMyStock : totalBodegaStock}
            </span>
          </div>
        </div>

        <div className="spacer" />

        <div className="flavor-list">
          {visibleFlavors.map((flavor, i) => {
            const delayClass = `delay-${Math.min(i + 1, 8)}`;
            const myStock = Number(myCounts[flavor] || 0);
            const otherStock = Number(otherCounts[flavor] || 0);
            const bodegaStock = Number(counts[flavor] || 0);
            const qty = Number(quantities[flavor] || 0);
            
            return (
              <FlavorCard
                key={flavor}
                name={flavor}
                bodega={bodegaStock}
                myStock={myStock}
                otherProfile={otherProfile}
                otherStock={otherStock}
                qty={qty}
                onMinus={() => onMinus(flavor)}
                onPlus={() => onPlus(flavor)}
                disabledMinus={qty <= 0}
                disabledPlus={qty >= myStock}
                delayClass={delayClass}
              />
            );
          })}
          {visibleFlavors.length === 0 && (
            <div className="small p-muted">
              No hay sabores con stock en bodega ni asignados para hoy.
            </div>
          )}
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

          <div className="label">Notas adicionales (opcional)</div>
          <textarea
            className="input"
            placeholder="Acá se pueden poner notas de la venta"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ minHeight: 60, resize: "vertical" }}
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

          <button className="btn" onClick={() => setIsPaymentMenuOpen(true)} disabled={!canSell || saving}>
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
        enabledFlavors={[]}
        onToggleEnabled={toggleEnabled}
        onAddFlavor={addFlavor}
      />

      <DailyStockModal
        isOpen={isDailyStockOpen}
        onClose={() => setIsDailyStockOpen(false)}
        warehouseCounts={counts}
        allFlavors={allFlavors}
        initialDailyCounts={myCounts}
        otherDailyCounts={otherCounts}
        onSave={saveDailyStock}
        saving={saving}
      />

      <PaymentMethodModal
        isOpen={isPaymentMenuOpen}
        onClose={() => setIsPaymentMenuOpen(false)}
        onSelectMethod={sell}
      />
    </div>
  );
}
