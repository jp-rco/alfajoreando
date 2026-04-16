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
            <div className="h2">Añadir Sabor</div>
            <p className="p-muted">Añade nuevos sabores a tu catálogo. Su visibilidad será automática dependiendo de si hay unidades en el inventario.</p>
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
              El sabor se añadirá al inventario y a la aplicación.
            </div>
          </div>
          
          <div className="card">
            <div className="label">Sabores en el sistema</div>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {sorted.map((f) => (
                <span key={f} className="badge secondary">🍩 {f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
