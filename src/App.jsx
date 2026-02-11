import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import FinancePage from "./pages/FinancePage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import TopNav from "./components/TopNav.jsx";

function BottomNav({ currentPath, onGo }) {
  return (
    <div className="bottomnav" role="navigation" aria-label="Navegación">
      <div className="bottomnav-inner">
        <button className={`tabbtn ${currentPath === "/home" ? "active" : ""}`} onClick={() => onGo("/home")}>
          🧾 <strong>Principal</strong>
        </button>
        <button className={`tabbtn ${currentPath === "/ventas" ? "active" : ""}`} onClick={() => onGo("/ventas")}>
          📦 <strong>Ventas</strong>
        </button>
        <button className={`tabbtn ${currentPath === "/finanzas" ? "active" : ""}`} onClick={() => onGo("/finanzas")}>
          💰 <strong>Finanzas</strong>
        </button>
        <button className={`tabbtn ${currentPath === "/inventario" ? "active" : ""}`} onClick={() => onGo("/inventario")}>
          🧮 <strong>Inventario</strong>
        </button>
        <button className={`tabbtn ${currentPath === "/historial" ? "active" : ""}`} onClick={() => onGo("/historial")}>
          🕘 <strong>Historial</strong>
        </button>
      </div>
    </div>
  );
}

function AppShell({ profile, setProfile }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile && location.pathname !== "/login") navigate("/login", { replace: true });
  }, [profile, location.pathname, navigate]);

  if (!profile && location.pathname !== "/login") return null;

  const showNav = profile && location.pathname !== "/login";

  return (
    <div className="app">
      {showNav && (
        <TopNav
          profile={profile}
          onLogout={() => {
            setProfile(null);
            localStorage.removeItem("alf_profile");
            navigate("/login", { replace: true });
          }}
          onGo={(path) => navigate(path)}
          currentPath={location.pathname}
        />
      )}

      <div className="container">
        <Routes>
          <Route path="/login" element={<LoginPage setProfile={setProfile} />} />
          <Route path="/" element={profile ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />
          <Route path="/home" element={<HomePage profile={profile} />} />
          <Route path="/ventas" element={<SalesPage />} />
          <Route path="/finanzas" element={<FinancePage />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/historial" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to={profile ? "/home" : "/login"} replace />} />
        </Routes>

        {showNav && <div className="bottomnav-spacer" />}
      </div>

      {showNav && <BottomNav currentPath={location.pathname} onGo={(path) => navigate(path)} />}
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState(() => localStorage.getItem("alf_profile"));
  const value = useMemo(() => ({ profile }), [profile]);

  return (
    <BrowserRouter>
      <AppShell profile={value.profile} setProfile={setProfile} />
    </BrowserRouter>
  );
}
