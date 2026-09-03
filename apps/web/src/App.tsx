import { Route, Routes } from "react-router-dom";
import { AppRoutes } from "./app/AppRoutes";
import { AppShell } from "./components";
import { OnboardingRoute } from "./features/onboarding";
import { useSettings } from "./features/settings";

export function App() {
  const { settings } = useSettings();

  if (!settings.onboardingComplete) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingRoute />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
