export const navigationItems = [
  { path: "/upcoming", label: "Upcoming", shortLabel: "Upcoming" },
  { path: "/payments", label: "Payments", shortLabel: "Payments" },
  { path: "/add", label: "Add payment", shortLabel: "Add" },
  { path: "/backup", label: "Backup", shortLabel: "Backup" },
  { path: "/settings", label: "Settings", shortLabel: "Settings" },
] as const;

export type AppContext =
  "upcoming" | "payments" | "add" | "backup" | "settings";

export function getAppContext(pathname: string): AppContext {
  if (pathname === "/add" || pathname.endsWith("/edit")) return "add";
  if (pathname.startsWith("/payments")) return "payments";
  if (pathname.startsWith("/backup")) return "backup";
  if (pathname.startsWith("/settings")) return "settings";
  return "upcoming";
}
