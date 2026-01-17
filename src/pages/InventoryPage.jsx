import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { doc, onSnapshot, getDoc, setDoc, updateDoc } from "firebase/firestore";

export default function InventoryPage() {
  const [settings, setSettings] = useState(null);
  const [inventory, setInventory] = useState(null);

  const [localCounts, setLocalCounts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, "settings", "app");
    return onSnapshot(ref, (snap) => setSettings(snap.data() || null));
  }, []);

  useEffect(() => {
    const ref = doc(db, "inventory", "current");
    return onSnapshot(ref, (snap) => {
      const data = snap.data() || null;
      setInventory(data);
      setLocalCounts(data?.counts || {});
    });
  }, []);

  const allFlavors = useMemo(() => settings?.allFlavors || [], [settings]);

  // ensure all flavors exist in inventory
  useEffect(() => {
    if (!allFlavors.length) return;
    (async () => {
      const invRef = doc(db, "inventory", "current");
      const invSnap = await getDoc(invRef);
      if (!invSnap.exists()) {
        const baseCounts = {};
        allFlavors.forEach((f) => (baseCounts[f] = 0));
        await setDoc(invRef, { counts: baseCounts });
        return;
      }
      const counts = invSnap.data()?.counts || {};
      let changed = false;
      const next = { ...counts };
      allFlavors.forEach((f) => {
        if (next[f] == null) {
          next[f] = 0;
          changed = true;
        }
      });
      if (changed) await updateDoc(invRef, { counts: next });
    })();
  }, [allFlavors]);

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = {};
      allFlavors.forEach((f) => {
        const v = Math.max(0, Number(localCounts[f] || 0));
        cleaned[f] = v;
      });
      await updateDoc(doc(db, "inventory", "current"), { counts: cleaned });
    } catch (e) {
      alert("Error guardando inventario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="h2">Inventario</div>
      <p className="p-muted">
        Aquí defines cuántos alfajores llegaron por sabor. Se actualiza la pestaña Principal automáticamente.
      </p>

      <div className="spacer" />

      <div className="card">
        <div className="label">Editar cantidades</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "62vh", overflow: "auto", paddingRight: 6 }}>
          {allFlavors.map((flavor) => (
            <div className="flavor-item" key={flavor}>
              <div className="flavor-left">
                <div className="flavor-name">{flavor}</div>
                <div className="flavor-stock">
                  Actual en DB: <strong>{Number(inventory?.counts?.[flavor] || 0)}</strong>
                </div>
              </div>

              <div style={{ width: 140 }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={localCounts[flavor] ?? 0}
                  onChange={(e) =>
                    setLocalCounts((c) => ({
                      ...c,
                      [flavor]: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ))}

          {allFlavors.length === 0 && (
            <div className="small">
              No hay sabores en settings. Ve a Principal → Editar sabores → Agregar.
            </div>
          )}
        </div>

        <div className="spacer" />
        <div className="footer-actions">
          <button className="btn" onClick={save} disabled={saving || allFlavors.length === 0}>
            {saving ? "Guardando..." : "Actualizar inventario"}
          </button>
        </div>
      </div>

      <div className="spacer" />
      <div className="small">
        Consejo: si quieres que el inventario “sume” llegadas (en vez de reemplazar), lo ajustamos con un toggle “Sumar/Remplazar”.
      </div>
    </div>
  );
}
