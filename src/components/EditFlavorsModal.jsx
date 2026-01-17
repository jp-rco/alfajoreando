import React, { useMemo, useState } from "react";

export default function EditFlavorsModal({
  isOpen,
  onClose,
  allFlavors,
  enabledFlavors,
  onToggleEnabled,
  onAddFlavor,
}) {
  const [newFlavor, setNewFlavor] = useState("");

  const sorted = useMemo(() => {
    const s = [...(allFlavors || [])];
    s.sort((a, b) => a.localeCompare(b));
    return s;
  }, [allFlavors]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="h2">Editar sabores visibles</div>
            <p className="p-muted">Activa/desactiva sabores para la pestaña principal. También puedes agregar sabores nuevos.</p>
          </div>
          <button className="btn secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div className="divider" />

        <div className="grid">
          <div className="card">
            <div className="label">Agregar nuevo sabor</div>
            <div className="row">
              <input
                className="input"
                value={newFlavor}
                onChange={(e) => setNewFlavor(e.target.value)}
                placeholder="Ej: Arequipe, Chocolate, Coco..."
              />
              <button
                className="btn"
                onClick={() => {
                  const name = newFlavor.trim();
                  if (!name) return;
                  onAddFlavor(name);
                  setNewFlavor("");
                }}
              >
                Agregar
              </button>
            </div>
            <div className="spacer" />
            <div className="small">
              Tip: si agregas un sabor, también aparecerá en Inventario para asignar cantidades.
            </div>
          </div>

          <div className="card">
            <div className="label">Sabores visibles ahora</div>
            <div className="row">
              {(enabledFlavors || []).map((f) => (
                <span key={f} className="badge">✅ {f}</span>
              ))}
              {(!enabledFlavors || enabledFlavors.length === 0) && (
                <span className="small">No hay sabores visibles. Activa al menos uno.</span>
              )}
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="card">
          <div className="label">Todos los sabores</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "46vh", overflow: "auto", paddingRight: 6 }}>
            {sorted.map((f) => {
              const checked = (enabledFlavors || []).includes(f);
              return (
                <label
                  key={f}
                  className="flavor-item"
                  style={{ cursor: "pointer" }}
                >
                  <div className="flavor-left">
                    <div className="flavor-name">{f}</div>
                    <div className="flavor-stock">{checked ? "Visible en Principal" : "Oculto en Principal"}</div>
                  </div>

                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleEnabled(f)}
                    style={{ transform: "scale(1.2)" }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
