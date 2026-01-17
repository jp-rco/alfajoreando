import React from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ setProfile }) {
  const navigate = useNavigate();

  const pick = (p) => {
    localStorage.setItem("alf_profile", p);
    setProfile(p);
    navigate("/home", { replace: true });
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: "36px auto" }}>
        <div className="h2">Ingresar</div>
        <p className="p-muted">
          Elige el perfil con el que vas a registrar ventas.
        </p>

        <div className="spacer" />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => pick("JP")}>
            Entrar como JP
          </button>
          <button className="btn secondary" style={{ flex: 1 }} onClick={() => pick("Pau")}>
            Entrar como Pau
          </button>
        </div>

        <div className="spacer" />
        <p className="small">
          Este login es un selector. Si luego quieres autenticación real (Firebase Auth), se agrega fácilmente.
        </p>
      </div>
    </div>
  );
}
