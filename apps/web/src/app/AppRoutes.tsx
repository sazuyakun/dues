import { Navigate, Route, Routes } from "react-router-dom";
import { SettingsRoute } from "../features/settings";
import type { ThemePreference } from "../theme";
import {
  BackupRoute,
  PaymentFormRoute,
  PaymentsRoute,
  UpcomingRoute,
} from "./featureFallbacks";

interface AppRoutesProps {
  readonly theme: ThemePreference;
  readonly onThemeChange: (theme: ThemePreference) => void;
}

export function AppRoutes({ theme, onThemeChange }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upcoming" replace />} />
      <Route path="/upcoming" element={<UpcomingRoute />} />
      <Route path="/payments" element={<PaymentsRoute />} />
      <Route path="/add" element={<PaymentFormRoute />} />
      <Route path="/payments/:paymentId/edit" element={<PaymentFormRoute />} />
      <Route path="/backup" element={<BackupRoute />} />
      <Route
        path="/settings"
        element={<SettingsRoute theme={theme} onThemeChange={onThemeChange} />}
      />
      <Route path="*" element={<Navigate to="/upcoming" replace />} />
    </Routes>
  );
}
