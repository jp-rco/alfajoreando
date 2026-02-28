import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
} from "firebase/firestore";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  // En caso de que venga como objeto raro
  if (ts?.seconds) return new Date(ts.seconds * 1000);
  return null;
}

function dateKey(d) {
  // YYYY-MM-DD (local)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateLabelFromKey(key) {
  // key: YYYY-MM-DD -> "8 feb 2026"
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function timeLabel(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function HistoryPage() {
  const [jpSales, setJpSales] = useState([]);
  const [pauSales, setPauSales] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const qJP = query(collection(db, "profiles", "JP", "sales"), orderBy("createdAt", "desc"));
    const qPau = query(collection(db, "profiles", "Pau", "sales"), orderBy("createdAt", "desc"));

    const u1 = onSnapshot(qJP, (snap) =>
      setJpSales(snap.docs.map((d) => ({ id: d.id, profile: "JP", ...d.data() })))
    );
    const u2 = onSnapshot(qPau, (snap) =>
      setPauSales(snap.docs.map((d) => ({ id: d.id, profile: "Pau", ...d.data() })))
    );

    return () => {
      u1();
      u2();
    };
  }, []);

  const allSales = useMemo(() => {
    const merged = [...jpSales, ...pauSales]
      .map((s) => {
        const dt = toDate(s.createdAt);
        return { ...s, _date: dt };
      })
      .filter((s) => s._date instanceof Date && !isNaN(s._date.getTime()))
      .sort((a, b) => b._date - a._date);
    return merged;
  }, [jpSales, pauSales]);

  const grouped = useMemo(() => {
    const map = new Map(); // key -> array
    for (const s of allSales) {
      const key = dateKey(s._date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    // ordenar keys desc
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return { map, keys };
  }, [allSales]);

  const deleteSale = async (sale) => {
    const ok = confirm(
      `¿Eliminar esta venta?\n\n${sale.profile} • ${sale.flavor} • ${sale.qty} • ${money(sale.total)}`
    );
    if (!ok) return;

    setDeletingId(sale.id);

    try {
      // ✅ Borra la venta y (recomendado) devuelve inventario en una transacción
      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "profiles", sale.profile, "sales", sale.id);
        const invRef = doc(db, "inventory", "current");

        const invSnap = await tx.get(invRef);
        const counts = invSnap.data()?.counts || {};

        const flavor = sale.flavor;
        const qty = Number(sale.qty || 0);

        // Si por alguna razón no hay sabor/qty, solo borra
        if (flavor && qty > 0) {
          const nextCounts = { ...counts };
          nextCounts[flavor] = Number(nextCounts[flavor] || 0) + qty;
          tx.update(invRef, { counts: nextCounts });
        }

        tx.delete(saleRef);
      });
    } catch (e) {
      alert("No se pudo eliminar. Revisa permisos/rules y vuelve a intentar.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card animate-fade-in-up">
      <div className="h2">Historial</div>
      <p className="p-muted">
        Ventas agrupadas por día. Puedes eliminar una venta (se borra de Firestore y se devuelve al inventario).
      </p>

      <div className="spacer" />

      {grouped.keys.length === 0 ? (
        <div className="card">
          <p className="p-muted">Aún no hay ventas registradas.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grouped.keys.map((key) => {
            const salesOfDay = grouped.map.get(key) || [];
            const dayQty = salesOfDay.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
            const dayTotal = salesOfDay.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

            return (
              <details key={key} className="history-day" open={false}>
                <summary className="history-summary">
                  <div className="history-summary-left">
                    <div className="history-date">{dateLabelFromKey(key)}</div>
                    <div className="history-meta">
                      {dayQty} alfajor(es) • {money(dayTotal)}
                    </div>
                  </div>
                  <div className="history-chevron">⌄</div>
                </summary>

                <div className="history-list">
                  {salesOfDay.map((s, i) => {
                    const delayClass = `delay-${Math.min(i + 1, 8)}`;
                    return (
                      <div className={`history-item animate-enter ${delayClass}`} key={`${s.profile}-${s.id}`}>
                        <div className="history-item-left">
                          <div className="history-row1">
                            <span className="history-time">{timeLabel(s._date)}</span>
                            <span className="history-pill">{s.profile}</span>
                          </div>
                          <div className="history-row2">
                            <strong>{s.flavor}</strong> • {Number(s.qty || 0)} unidad(es)
                          </div>
                        </div>

                        <div className="history-item-right">
                          <div className="history-price">{money(s.total)}</div>
                          <button
                            className="btn secondary"
                            style={{ minHeight: 44, padding: "10px 12px" }}
                            onClick={() => deleteSale(s)}
                            disabled={deletingId === s.id}
                          >
                            {deletingId === s.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
