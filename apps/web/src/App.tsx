import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BackupPage } from "./pages/BackupPage";
import { PaymentFormPage } from "./pages/PaymentFormPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpcomingPage } from "./pages/UpcomingPage";
import {
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemePreference,
} from "./theme";

export function App() {
  const [theme, setTheme] = useState<ThemePreference>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (theme === "system") applyTheme(theme);
    };

    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [theme]);

  const updateTheme = (nextTheme: ThemePreference) => {
    saveTheme(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/upcoming" replace />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/add" element={<PaymentFormPage />} />
        <Route path="/payments/:paymentId/edit" element={<PaymentFormPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route
          path="/settings"
          element={<SettingsPage theme={theme} onThemeChange={updateTheme} />}
        />
        <Route path="*" element={<Navigate to="/upcoming" replace />} />
      </Routes>
    </AppShell>
  );
}
