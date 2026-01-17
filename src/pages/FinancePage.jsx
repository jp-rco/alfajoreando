import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { doc, onSnapshot, collection, query, orderBy, updateDoc } from "firebase/firestore";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function sumField(list, field) {
  return (list || []).reduce((acc, x) => acc + (Number(x?.[field]) || 0), 0);
}

export default function FinancePage() {
  const [settings, setSettings] = useState(null);

  const [jpSales, setJpSales] = useState([]);
  const [pauSales, setPauSales] = useState([]);
  const [jpTips, setJpTips] = useState([]);
  const [pauTips, setPauTips] = useState([]);

  useEffect(() => {
    const ref = doc(db, "settings", "app");
    return onSnapshot(ref, (snap) => setSettings(snap.data() || null));
  }, []);

  useEffect(() => {
    const s1 = onSnapshot(query(collection(db, "profiles", "JP", "sales"), orderBy("createdAt", "desc")),
      (snap) => setJpSales(snap.docs.map((d) => d.data()))
    );
    const s2 = onSnapshot(query(collection(db, "profiles", "Pau", "sales"), orderBy("createdAt", "desc")),
      (snap) => setPauSales(snap.docs.map((d) => d.data()))
    );
    const t1 = onSnapshot(query(collection(db, "profiles", "JP", "tips"), orderBy("createdAt", "desc")),
      (snap) => setJpTips(snap.docs.map((d) => d.data()))
    );
    const t2 = onSnapshot(query(collection(db, "profiles", "Pau", "tips"), orderBy("createdAt", "desc")),
      (snap) => setPauTips(snap.docs.map((d) => d.data()))
    );

    return () => { s1(); s2(); t1(); t2(); };
  }, []);

  const unitPrice = settings?.unitPrice ?? 4500;
  const boxCost = settings?.boxCost ?? 188000;
  const boxesPurchased = settings?.boxesPurchased ?? 0;

  const jpRevenue = useMemo(() => sumField(jpSales, "total"), [jpSales]);
  const pauRevenue = useMemo(() => sumField(pauSales, "total"), [pauSales]);

  const jpTipsTotal = useMemo(() => sumField(jpTips, "amount"), [jpTips]);
  const pauTipsTotal = useMemo(() => sumField(pauTips, "amount"), [pauTips]);

  const revenueTotal = jpRevenue + pauRevenue;
  const tipsTotal = jpTipsTotal + pauTipsTotal;

  const costs = boxesPurchased * boxCost;
  const profit = (revenueTotal + tipsTotal) - costs;

  const updateBoxes = async (value) => {
    const num = Math.max(0, Number(value || 0));
    await updateDoc(doc(db, "settings", "app"), { boxesPurchased: num });
  };

  return (
    <div className="card">
      <div className="h2">Finanzas</div>
      <p className="p-muted">
        Precio unitario: <strong>{money(unitPrice)}</strong> • Costo por caja: <strong>{money(boxCost)}</strong>.
      </p>

      <div className="spacer" />

      <div className="grid">
        <div className="card">
          <div className="label">Cajas compradas (para calcular costos)</div>
          <input
            className="input"
            type="number"
            min="0"
            value={boxesPurchased}
            onChange={(e) => updateBoxes(e.target.value)}
          />
          <div className="small" style={{ marginTop: 6 }}>
            Se guarda en Firestore en <code>settings/app.boxesPurchased</code>.
          </div>

          <div className="spacer" />
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-title">Costos</div>
              <div className="kpi-value">{money(costs)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Ingresos (ventas)</div>
              <div className="kpi-value">{money(revenueTotal)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Propinas</div>
              <div className="kpi-value">{money(tipsTotal)}</div>
            </div>
          </div>

          <div className="spacer" />
          <div className="kpi">
            <div className="kpi-title">Ganancias (ingresos + propinas - costos)</div>
            <div className="kpi-value">{money(profit)}</div>
          </div>
        </div>

        <div className="card">
          <div className="h2">Desglose por perfil</div>
          <div className="spacer" />

          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-title">JP • Ingresos</div>
              <div className="kpi-value">{money(jpRevenue)}</div>
              <div className="small">Propinas JP: <strong>{money(jpTipsTotal)}</strong></div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Pau • Ingresos</div>
              <div className="kpi-value">{money(pauRevenue)}</div>
              <div className="small">Propinas Pau: <strong>{money(pauTipsTotal)}</strong></div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Total</div>
              <div className="kpi-value">{money(revenueTotal + tipsTotal)}</div>
              <div className="small">Ventas + propinas</div>
            </div>
          </div>

          <div className="spacer" />
          <div className="small">
            Si quieres que el costo se reparta por perfil (ej: proporcional a ventas), dímelo y lo ajustamos.
          </div>
        </div>
      </div>
    </div>
  );
}
