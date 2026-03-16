import React, { useState, useEffect } from "react";

export default function DailyStockModal({
  isOpen,
  onClose,
  warehouseCounts,
  allFlavors,
  initialDailyCounts,
  otherDailyCounts,
  onSave,
  saving,
}) {
  const [localCounts, setLocalCounts] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLocalCounts(initialDailyCounts || {});
    }
  }, [isOpen, initialDailyCounts]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localCounts);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="h2">Stock del Día</div>
            <p className="p-muted">¿Cuántos vas a vender hoy? Máximo = Bodega - Stock del otro usuario.</p>
          </div>
          <button className="btn secondary" onClick={onClose} disabled={saving}>Cerrar</button>
        </div>

        <div className="divider" />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflow: "auto", paddingRight: 6 }}>
          {(allFlavors || []).map((flavor) => {
            const warehouseStock = Number(warehouseCounts?.[flavor] || 0);
            const otherStock = Number(otherDailyCounts?.[flavor] || 0);
            const maxAvailable = Math.max(0, warehouseStock - otherStock);
            
            return (
              <div className="flavor-item" key={flavor}>
                <div className="flavor-left">
                  <div className="flavor-name">{flavor}</div>
                  <div className="flavor-stock" style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', marginTop: '6px' }}>
                    <span>Bodega: <strong>{warehouseStock}</strong></span>
                    {otherStock > 0 && <span style={{ color: 'var(--c4)' }}>Otro usuario: <strong>{otherStock}</strong></span>}
                    <span>Máx asignable: <strong>{maxAvailable}</strong></span>
                  </div>
                </div>
                <div style={{ width: 140 }}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max={maxAvailable}
                    value={localCounts[flavor] ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        setLocalCounts((c) => ({ ...c, [flavor]: "" }));
                        return;
                      }
                      let val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 0) val = 0;
                      if (val > maxAvailable) val = maxAvailable;
                      setLocalCounts((c) => ({ ...c, [flavor]: val }));
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "") {
                        setLocalCounts((c) => ({ ...c, [flavor]: 0 }));
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
          {(!allFlavors || allFlavors.length === 0) && (
            <div className="small">No hay sabores configurados.</div>
          )}
        </div>

        <div className="divider" />

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Stock Diario"}
          </button>
        </div>
      </div>
    </div>
  );
}
