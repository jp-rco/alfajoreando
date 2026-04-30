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
  updateDoc,
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
  const [activeTab, setActiveTab] = useState("historial");

  const editNote = async (sale) => {
    const newNote = prompt("Editar nota (deja vacío para eliminarla):", sale.notes || "");
    if (newNote === null) return; // Cancelado por el usuario

    try {
      const saleRef = doc(db, "profiles", sale.profile, "sales", sale.id);
      await updateDoc(saleRef, { notes: newNote.trim() });
    } catch (e) {
      alert("Error al actualizar la nota.");
    }
  };

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

  const salesWithNotes = useMemo(() => {
    return allSales.filter((s) => s.notes && s.notes.trim().length > 0);
  }, [allSales]);

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
      // ✅ Borra la venta y devuelve inventario a bodega (y al stock del usuario) en una transacción
      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "profiles", sale.profile, "sales", sale.id);
        const invRef = doc(db, "inventory", "current");
        const dailyRef = doc(db, "inventory", "daily");

        const invSnap = await tx.get(invRef);
        const dailySnap = await tx.get(dailyRef);

        const counts = invSnap.data()?.counts || {};
        const dailyData = dailySnap.data() || {};

        const flavor = sale.flavor;
        const qty = Number(sale.qty || 0);

        // Si por alguna razón no hay sabor/qty, solo borra
        if (flavor && qty > 0) {
          const nextCounts = { ...counts };
          nextCounts[flavor] = Number(nextCounts[flavor] || 0) + qty;
          tx.update(invRef, { counts: nextCounts });

          // Siempre devolvemos el stock al usuario
          const prof = sale.profile;
          const profData = dailyData[prof] || {};
          const myCounts = profData.counts || {};
          
          const nextMyCounts = { ...myCounts };
          nextMyCounts[flavor] = Number(nextMyCounts[flavor] || 0) + qty;

          tx.set(dailyRef, { [prof]: { counts: nextMyCounts } }, { merge: true });
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
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          className={`btn ${activeTab === "historial" ? "primary" : "secondary"}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab("historial")}
        >
          Historial
        </button>
        <button
          className={`btn ${activeTab === "notas" ? "primary" : "secondary"}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab("notas")}
        >
          Notas
        </button>
      </div>

      {activeTab === "historial" && (
        <>
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

                const sums = {
                  JP: { Efectivo: 0, Transferencia: 0 },
                  Pau: { Efectivo: 0, Transferencia: 0 }
                };

                for (const s of salesOfDay) {
                  const m = s.method === "Transferencia" ? "Transferencia" : "Efectivo";
                  if (sums[s.profile]) {
                    sums[s.profile][m] += Number(s.total || 0);
                  }
                }

                return (
                  <details key={key} className="history-day" open={false}>
                    <summary className="history-summary">
                      <div className="history-summary-left" style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div className="history-date">{dateLabelFromKey(key)}</div>
                          <div className="history-date" style={{ color: "var(--c5)" }}>{money(dayTotal)}</div>
                        </div>
                        <div className="history-meta" style={{ marginBottom: "8px" }}>
                          {dayQty} alfajor(es) vendidos
                        </div>
                        
                        <div style={{ display: "flex",flexDirection: "column", gap: "4px", fontSize: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                          {(sums.JP.Efectivo > 0 || sums.JP.Transferencia > 0) && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                              <strong style={{ color: "var(--text)" }}>JP:</strong>
                              <span>Efectivo: <strong>{money(sums.JP.Efectivo)}</strong></span>
                              <span>Transf: <strong>{money(sums.JP.Transferencia)}</strong></span>
                            </div>
                          )}
                          {(sums.Pau.Efectivo > 0 || sums.Pau.Transferencia > 0) && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                              <strong style={{ color: "var(--text)" }}>Pau:</strong>
                              <span>Efectivo: <strong>{money(sums.Pau.Efectivo)}</strong></span>
                              <span>Transf: <strong>{money(sums.Pau.Transferencia)}</strong></span>
                            </div>
                          )}
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
                              <div className="p-muted small" style={{ marginTop: 2 }}>
                                Pago: {s.method === "Transferencia" ? "📱 Transferencia" : "💵 Efectivo"}
                              </div>
                              {s.notes && (
                                <div className="p-muted small" style={{ marginTop: 6, fontStyle: "italic" }}>
                                  Nota: {s.notes}
                                </div>
                              )}
                            </div>

                            <div className="history-item-right">
                              <div className="history-price">{money(s.total)}</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <button
                                  className="btn secondary"
                                  style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                                  onClick={() => editNote(s)}
                                >
                                  Notas
                                </button>
                                <button
                                  className="btn secondary"
                                  style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                                  onClick={() => deleteSale(s)}
                                  disabled={deletingId === s.id}
                                >
                                  {deletingId === s.id ? "Eliminar..." : "Eliminar"}
                                </button>
                              </div>
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
        </>
      )}

      {activeTab === "notas" && (
        <>
          <div className="h2">Notas</div>
          <p className="p-muted">
            Lista de todas las notas agregadas a las ventas.
          </p>

          <div className="spacer" />

          {salesWithNotes.length === 0 ? (
            <div className="card">
              <p className="p-muted">Nadie ha agregado notas aún.</p>
            </div>
          ) : (
            <div className="history-list">
              {salesWithNotes.map((s, i) => {
                const delayClass = `delay-${Math.min(i + 1, 8)}`;
                const dtLabel = dateLabelFromKey(dateKey(s._date));
                return (
                  <div className={`history-item animate-enter ${delayClass}`} key={`${s.profile}-${s.id}`}>
                    <div className="history-item-left">
                      <div className="history-row1">
                        <span className="history-time">{dtLabel} {timeLabel(s._date)}</span>
                        <span className="history-pill">{s.profile}</span>
                      </div>
                      <div className="history-row2">
                        <strong>{s.flavor}</strong> • {Number(s.qty || 0)} unidad(es)
                      </div>
                      <div className="p-muted small" style={{ marginTop: 6, fontStyle: "italic" }}>
                        Nota: {s.notes}
                      </div>
                    </div>

                    <div className="history-item-right">
                      <div className="history-price">{money(s.total)}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                          className="btn secondary"
                          style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                          onClick={() => editNote(s)}
                        >
                          Editar Nota
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
