import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getAppContext, navigationItems } from "../app/navigation";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { pathname } = useLocation();
  const context = getAppContext(pathname);

  return (
    <div className="app-shell" data-context={context}>
      <div className="field-frame">
        <header className="site-header pane">
          <NavLink className="brand" to="/upcoming" aria-label="Dues home">
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
            <span className="brand-copy">
              <strong>Dues</strong>
            </span>
          </NavLink>

          <nav className="site-nav" aria-label="Main navigation">
            {navigationItems.map(({ path, label, shortLabel }) => (
              <NavLink key={path} to={path} title={label}>
                <span className="nav-label">{label}</span>
                <span className="nav-label-short">{shortLabel}</span>
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="content-pane pane">{children}</main>
      </div>
    </div>
  );
}
