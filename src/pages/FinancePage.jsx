import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { doc, onSnapshot, collection, query, orderBy, updateDoc } from "firebase/firestore";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
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
    const s1 = onSnapshot(
      query(collection(db, "profiles", "JP", "sales"), orderBy("createdAt", "desc")),
      (snap) => setJpSales(snap.docs.map((d) => d.data()))
    );
    const s2 = onSnapshot(
      query(collection(db, "profiles", "Pau", "sales"), orderBy("createdAt", "desc")),
      (snap) => setPauSales(snap.docs.map((d) => d.data()))
    );

    const t1 = onSnapshot(
      query(collection(db, "profiles", "JP", "tips"), orderBy("createdAt", "desc")),
      (snap) => setJpTips(snap.docs.map((d) => d.data()))
    );
    const t2 = onSnapshot(
      query(collection(db, "profiles", "Pau", "tips"), orderBy("createdAt", "desc")),
      (snap) => setPauTips(snap.docs.map((d) => d.data()))
    );

    return () => {
      s1();
      s2();
      t1();
      t2();
    };
  }, []);

  // Settings
  const unitPrice = settings?.unitPrice ?? 4500;
  const boxCost = settings?.boxCost ?? 188000;
  const boxesPurchased = settings?.boxesPurchased ?? 0;

  // Revenue and tips by profile
  const jpRevenue = useMemo(() => sumField(jpSales, "total"), [jpSales]);
  const pauRevenue = useMemo(() => sumField(pauSales, "total"), [pauSales]);

  const jpTipsTotal = useMemo(() => sumField(jpTips, "amount"), [jpTips]);
  const pauTipsTotal = useMemo(() => sumField(pauTips, "amount"), [pauTips]);

  // Totals
  const revenueTotal = jpRevenue + pauRevenue;          // ventas
  const tipsTotal = jpTipsTotal + pauTipsTotal;         // propinas
  const grossTotal = revenueTotal + tipsTotal;          // ventas + propinas

  const costs = boxesPurchased * boxCost;               // costos totales
  const netToSplit = grossTotal - costs;                // lo que queda para repartir

  // Split equally regardless of who sold more
  const splitEach = netToSplit / 2;

  // Optional: show if negative (so they know they "van debiendo")
  const netLabel = netToSplit >= 0 ? "Neto a repartir" : "Neto (negativo) a repartir";

  const updateBoxes = async (value) => {
    const num = Math.max(0, Number(value || 0));
    await updateDoc(doc(db, "settings", "app"), { boxesPurchased: num });
  };

  return (
    <div className="card">
      <div className="h2">Finanzas</div>
      <p className="p-muted">
        Precio unitario: <strong>{money(unitPrice)}</strong> • Costo por caja:{" "}
        <strong>{money(boxCost)}</strong>.
      </p>

      <div className="spacer" />

      <div className="grid">
        {/* LEFT */}
        <div className="card">
          <div className="label">Cajas compradas (para calcular costos)</div>
          <input
            className="input"
            type="number"
            min="0"
            value={boxesPurchased}
            onChange={(e) => updateBoxes(e.target.value)}
          />

          <div className="spacer" />

          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-title">Ingresos (ventas)</div>
              <div className="kpi-value">{money(revenueTotal)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Propinas</div>
              <div className="kpi-value">{money(tipsTotal)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-title">Costos</div>
              <div className="kpi-value">{money(costs)}</div>
            </div>
          </div>

          <div className="spacer" />

          <div className="kpi">
            <div className="kpi-title">{netLabel} (ventas + propinas - costos)</div>
            <div className="kpi-value">{money(netToSplit)}</div>
          </div>

          <div className="spacer" />

          <div className="card">
            <div className="h2">¿Cuánto se le da a cada uno?</div>
            <p className="p-muted">
              Reparto en <strong>partes iguales</strong>, independiente de cuánto vendió cada uno.
            </p>

            <div className="spacer" />

            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-title">JP</div>
                <div className="kpi-value">{money(splitEach)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-title">Pau</div>
                <div className="kpi-value">{money(splitEach)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-title">Total repartido</div>
                <div className="kpi-value">{money(splitEach * 2)}</div>
              </div>
            </div>

            {netToSplit < 0 && (
              <div className="small" style={{ marginTop: 10 }}>
                ⚠️ El neto es negativo: con los costos actuales, aún no se cubren. Ese valor quedaría “en rojo”.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="card">
          <div className="h2">Desglose (solo informativo)</div>
          <p className="p-muted">
            Esto muestra lo que vendió/recibió cada perfil, pero el pago final se reparte 50/50.
          </p>

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
              <div className="kpi-title">Total (ventas + propinas)</div>
              <div className="kpi-value">{money(grossTotal)}</div>
              <div className="small">Antes de costos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
