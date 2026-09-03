import { Navigate, Route, Routes } from "react-router-dom";
import { SettingsRoute } from "../features/settings";
import {
  BackupRoute,
  PaymentFormRoute,
  PaymentsRoute,
  UpcomingRoute,
} from "./featureFallbacks";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upcoming" replace />} />
      <Route path="/upcoming" element={<UpcomingRoute />} />
      <Route path="/payments" element={<PaymentsRoute />} />
      <Route path="/add" element={<PaymentFormRoute />} />
      <Route path="/payments/:paymentId/edit" element={<PaymentFormRoute />} />
      <Route path="/backup" element={<BackupRoute />} />
      <Route path="/settings" element={<SettingsRoute />} />
      <Route path="*" element={<Navigate to="/upcoming" replace />} />
    </Routes>
  );
}
