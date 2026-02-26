import { NavLink, Route, Routes } from "react-router-dom";
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
  return (
    <div className="app-shell">
      <header className="app-header">
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
