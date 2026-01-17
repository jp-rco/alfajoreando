import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import FinancePage from "./pages/FinancePage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import TopNav from "./components/TopNav.jsx";

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
          <Route path="*" element={<Navigate to={profile ? "/home" : "/login"} replace />} />
        </Routes>
      </div>
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
