import React from "react";

export default function TopNav({ profile, onLogout, onGo, currentPath }) {
  return (
    <div className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <div className="brand-badge" />
          <div>
            <h1>Alfajores • Panel</h1>
            <p>Perfil activo: <strong>{profile}</strong></p>
          </div>
        </div>

        <div className="nav-actions">
          <button className={`navbtn ${currentPath === "/home" ? "active" : ""}`} onClick={() => onGo("/home")}>
            Principal
          </button>
          <button className={`navbtn ${currentPath === "/ventas" ? "active" : ""}`} onClick={() => onGo("/ventas")}>
            Ventas
          </button>
          <button className={`navbtn ${currentPath === "/finanzas" ? "active" : ""}`} onClick={() => onGo("/finanzas")}>
            Finanzas
          </button>
          <button className={`navbtn ${currentPath === "/inventario" ? "active" : ""}`} onClick={() => onGo("/inventario")}>
            Inventario
          </button>
          <button className={`navbtn ${currentPath === "/historial" ? "active" : ""}`} onClick={() => onGo("/historial")}>
            Historial
          </button>
          <button className="navbtn danger" onClick={onLogout}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
