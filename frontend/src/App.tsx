import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api/client";
import { AnalysisPage } from "./pages/AnalysisPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DividendsPage } from "./pages/DividendsPage";
import { HoldingsPage } from "./pages/HoldingsPage";
import { SettingsPage } from "./pages/SettingsPage";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/holdings", label: "Holdings" },
  { to: "/dividends", label: "Dividends" },
  { to: "/analysis", label: "Analysis" },
  { to: "/settings", label: "Settings / Data" }
];

function Navigation(): JSX.Element {
  return (
    <nav className="app-nav">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) => (isActive ? "app-nav__link app-nav__link--active" : "app-nav__link")}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App(): JSX.Element {
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await api.getSettings();
        if (active) {
          setDemoModeEnabled(response.settings.enableDemoMode);
        }
      } catch {
        if (active) {
          setDemoModeEnabled(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        {demoModeEnabled ? (
          <div className="global-warning-banner">
            <strong>DEMO DATA</strong>
            <span>NOT REAL MARKET DATA</span>
          </div>
        ) : null}
        <div>
          <p className="eyebrow">Personal Use Portfolio Dashboard</p>
          <h1>Hong Kong ETF Portfolio</h1>
          <p className="muted">Read-only delayed quotes with manual refresh and local SQLite data.</p>
        </div>
      </header>

      <Navigation />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/holdings" element={<HoldingsPage />} />
          <Route path="/dividends" element={<DividendsPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
