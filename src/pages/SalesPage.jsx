import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { collection, onSnapshot, query, orderBy, doc, onSnapshot as onDocSnapshot } from "firebase/firestore";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function groupSales(sales) {
  const byFlavor = {};
  let qty = 0;
  let total = 0;
  for (const s of sales) {
    const f = s.flavor || "—";
    byFlavor[f] = (byFlavor[f] || 0) + (Number(s.qty) || 0);
    qty += Number(s.qty) || 0;
    total += Number(s.total) || 0;
  }
  const rows = Object.entries(byFlavor).sort((a, b) => b[1] - a[1]);
  return { rows, qty, total };
}

export default function SalesPage() {
  const [settings, setSettings] = useState(null);

  const [jpSales, setJpSales] = useState([]);
  const [pauSales, setPauSales] = useState([]);

  useEffect(() => {
    const ref = doc(db, "settings", "app");
    return onDocSnapshot(ref, (snap) => setSettings(snap.data() || null));
  }, []);

  useEffect(() => {
    const q1 = query(collection(db, "profiles", "JP", "sales"), orderBy("createdAt", "desc"));
    const q2 = query(collection(db, "profiles", "Pau", "sales"), orderBy("createdAt", "desc"));

    const u1 = onSnapshot(q1, (snap) => setJpSales(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(q2, (snap) => setPauSales(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    return () => { u1(); u2(); };
  }, []);

  const jp = useMemo(() => groupSales(jpSales), [jpSales]);
  const pau = useMemo(() => groupSales(pauSales), [pauSales]);

  const unitPrice = settings?.unitPrice ?? 4500;

  return (
    <div className="grid">
      <div className="card">
        <div className="h2">Ventas • JP</div>
        <p className="p-muted">Resumen por sabor (precio unitario actual: {money(unitPrice)}).</p>

        <div className="spacer" />
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-title">Alfajores vendidos</div>
            <div className="kpi-value">{jp.qty}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Ingresos (sin propinas)</div>
            <div className="kpi-value">{money(jp.total)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Sabores distintos</div>
            <div className="kpi-value">{jp.rows.length}</div>
          </div>
        </div>

        <div className="spacer" />
        <div className="card">
          <div className="label">Detalle</div>
          {jp.rows.length === 0 ? (
            <div className="small">Aún no hay ventas registradas para JP.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jp.rows.map(([flavor, qty]) => (
                <div className="flavor-item" key={flavor}>
                  <div className="flavor-left">
                    <div className="flavor-name">{flavor}</div>
                    <div className="flavor-stock">{qty} unidad(es)</div>
                  </div>
                  <div className="badge">{money(qty * unitPrice)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="h2">Ventas • Pau</div>
        <p className="p-muted">Resumen por sabor (precio unitario actual: {money(unitPrice)}).</p>

        <div className="spacer" />
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-title">Alfajores vendidos</div>
            <div className="kpi-value">{pau.qty}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Ingresos (sin propinas)</div>
            <div className="kpi-value">{money(pau.total)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Sabores distintos</div>
            <div className="kpi-value">{pau.rows.length}</div>
          </div>
        </div>

        <div className="spacer" />
        <div className="card">
          <div className="label">Detalle</div>
          {pau.rows.length === 0 ? (
            <div className="small">Aún no hay ventas registradas para Pau.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pau.rows.map(([flavor, qty]) => (
                <div className="flavor-item" key={flavor}>
                  <div className="flavor-left">
                    <div className="flavor-name">{flavor}</div>
                    <div className="flavor-stock">{qty} unidad(es)</div>
                  </div>
                  <div className="badge">{money(qty * unitPrice)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
