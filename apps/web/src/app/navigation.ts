export const navigationItems = [
  { path: "/upcoming", label: "Upcoming", shortLabel: "Upcoming", index: "01" },
  { path: "/payments", label: "Payments", shortLabel: "Payments", index: "02" },
  { path: "/add", label: "Add payment", shortLabel: "Add", index: "03" },
  { path: "/backup", label: "Backup", shortLabel: "Backup", index: "04" },
  { path: "/settings", label: "Settings", shortLabel: "Settings", index: "05" },
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
