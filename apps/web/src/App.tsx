import { useEffect, useState } from "react";
import { AppRoutes } from "./app/AppRoutes";
import { AppShell } from "./components";
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
      <AppRoutes theme={theme} onThemeChange={updateTheme} />
    </AppShell>
  );
}
