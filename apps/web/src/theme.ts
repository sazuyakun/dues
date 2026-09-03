import type { ThemeSetting } from "@dues/storage";

export type ThemePreference = ThemeSetting;

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
