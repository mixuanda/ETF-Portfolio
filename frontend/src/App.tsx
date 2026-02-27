import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api/client";
import type { AppLocale } from "./i18n/config";
import { useI18n } from "./i18n/provider";
import { AnalysisPage } from "./pages/AnalysisPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DividendsPage } from "./pages/DividendsPage";
import { HoldingsPage } from "./pages/HoldingsPage";
import { SettingsPage } from "./pages/SettingsPage";

function Navigation(): JSX.Element {
  const { t } = useI18n();
  const links = useMemo(
    () => [
      { to: "/", label: t("app.nav.dashboard") },
      { to: "/holdings", label: t("app.nav.holdings") },
      { to: "/dividends", label: t("app.nav.dividends") },
      { to: "/analysis", label: t("app.nav.analysis") },
      { to: "/settings", label: t("app.nav.settings") }
    ],
    [t]
  );

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
  const { locale, setLocale, t } = useI18n();

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
            <strong>{t("app.demo.title")}</strong>
            <span>{t("app.demo.subtitle")}</span>
          </div>
        ) : null}

        <div className="app-header__meta-row">
          <div>
            <p className="eyebrow">{t("app.header.eyebrow")}</p>
            <h1>{t("app.header.title")}</h1>
            <p className="muted">{t("app.header.subtitle")}</p>
          </div>

          <label className="locale-switcher">
            <span>{t("lang.label")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)}>
              <option value="en">{t("lang.en")}</option>
              <option value="zh-Hans">{t("lang.zh-Hans")}</option>
              <option value="zh-Hant">{t("lang.zh-Hant")}</option>
            </select>
          </label>
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
