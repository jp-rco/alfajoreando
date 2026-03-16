import React from "react";

export default function PaymentMethodModal({ isOpen, onClose, onSelectMethod }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in-up" onMouseDown={onClose} style={{ zIndex: 200 }}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(400px, 90vw)" }}>
        <div className="h2" style={{ textAlign: "center", marginBottom: "8px" }}>Método de Pago</div>
        <p className="p-muted" style={{ textAlign: "center", marginBottom: "20px" }}>
          ¿Cómo recibiste el pago de esta venta?
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            className="btn"
            style={{ 
              minHeight: "60px", 
              fontSize: "18px", 
              backgroundColor: "rgba(220, 20, 60, 0.4)" 
            }}
            onClick={() => onSelectMethod("Efectivo")}
          >
            💵 Efectivo
          </button>
          
          <button
            className="btn outline"
            style={{ 
              minHeight: "60px", 
              fontSize: "18px", 
              border: "1px solid rgba(255, 158, 162, 0.5)",
              backgroundColor: "rgba(0, 0, 0, 0.2)"
            }}
            onClick={() => onSelectMethod("Transferencia")}
          >
            📱 Transferencia
          </button>
        </div>

        <div className="spacer" />
        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: "8px" }}
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
