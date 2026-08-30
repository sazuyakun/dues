export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "dues-theme";

export function isThemePreference(
  value: string | null,
): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function applyTheme(preference: ThemePreference): void {
  const systemIsDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const resolved =
    preference === "system" ? (systemIsDark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function loadTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Applying the theme still works when browser storage is unavailable.
  }
  applyTheme(preference);
}
