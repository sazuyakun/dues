import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemePreference,
} from "./theme";

const navItems = [
  ["/upcoming", "Upcoming", "⌁"],
  ["/payments", "Payments", "▤"],
  ["/add", "Add payment", "+"],
  ["/backup", "Backup", "⇅"],
  ["/settings", "Settings", "⚙"],
] as const;

const samplePayments = [
  {
    name: "Cloud storage",
    detail: "Tomorrow · Monthly",
    amount: "₹199",
    tone: "blue",
  },
  {
    name: "Music",
    detail: "In 4 days · Monthly",
    amount: "₹119",
    tone: "coral",
  },
  {
    name: "Domain renewal",
    detail: "Aug 26 · Yearly",
    amount: "$18",
    tone: "green",
  },
] as const;

function PageHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lede">{copy}</p>
    </header>
  );
}

function Upcoming() {
  return (
    <>
      <PageHeader
        eyebrow="Upcoming overview"
        title="Know what's due."
        copy="A calm look at the recurring payments ahead."
      />
      <section className="summary-grid" aria-label="Spending summary">
        <article className="summary-card featured">
          <span>Due this month</span>
          <strong>₹318</strong>
          <small>2 payments remaining</small>
        </article>
        <article className="summary-card">
          <span>Next payment</span>
          <strong>Tomorrow</strong>
          <small>Cloud storage · ₹199</small>
        </article>
      </section>
      <section className="payment-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Coming up</p>
            <h2>Next seven days</h2>
          </div>
          <span className="count">2</span>
        </div>
        <div className="payment-list">
          {samplePayments.slice(0, 2).map((payment) => (
            <PaymentRow key={payment.name} {...payment} />
          ))}
        </div>
      </section>
      <section className="payment-section muted-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Later</p>
            <h2>Beyond this week</h2>
          </div>
          <span className="count">1</span>
        </div>
        <PaymentRow {...samplePayments[2]} />
      </section>
    </>
  );
}

function PaymentRow({
  name,
  detail,
  amount,
  tone,
}: (typeof samplePayments)[number]) {
  return (
    <article className="payment-row">
      <span className={`payment-mark ${tone}`} aria-hidden="true">
        {name.charAt(0)}
      </span>
      <div className="payment-copy">
        <h3>{name}</h3>
        <p>{detail}</p>
      </div>
      <strong>{amount}</strong>
    </article>
  );
}

function Payments() {
  return (
    <>
      <PageHeader
        eyebrow="Your records"
        title="Payments"
        copy="Search, filter, and maintain every recurring payment in one place."
      />
      <div className="toolbar">
        <label>
          <span className="sr-only">Search payments</span>
          <input type="search" placeholder="Search payments" />
        </label>
        <button type="button">Filter</button>
      </div>
      <div className="payment-list all-payments">
        {samplePayments.map((payment) => (
          <PaymentRow key={payment.name} {...payment} />
        ))}
      </div>
    </>
  );
}

function PaymentForm() {
  return (
    <>
      <PageHeader
        eyebrow="New record"
        title="Add payment"
        copy="The full payment editor arrives when the domain package is connected."
      />
      <form className="placeholder-form">
        <label>
          Name
          <input disabled placeholder="e.g. Internet plan" />
        </label>
        <div className="field-row">
          <label>
            Amount
            <input disabled placeholder="0" />
          </label>
          <label>
            Currency
            <select disabled>
              <option>INR</option>
            </select>
          </label>
        </div>
        <label>
          Next due date
          <input disabled type="date" />
        </label>
        <button disabled type="button">
          Save payment
        </button>
      </form>
    </>
  );
}

function Backup() {
  return (
    <>
      <PageHeader
        eyebrow="Your data"
        title="Backup"
        copy="Portable export and carefully previewed import will live here."
      />
      <section className="empty-card">
        <span className="large-icon" aria-hidden="true">
          ⇅
        </span>
        <h2>Stay in control</h2>
        <p>
          Backups will be plain, versioned JSON files. They will never silently
          overwrite your existing records.
        </p>
        <button disabled type="button">
          Export backup
        </button>
      </section>
    </>
  );
}

function Settings({
  theme,
  onThemeChange,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        copy="Dues follows your device by default. Choose another appearance any time."
      />
      <fieldset className="theme-options">
        <legend>Appearance</legend>
        {(["light", "dark", "system"] as const).map((choice) => (
          <label key={choice}>
            <input
              type="radio"
              name="theme"
              value={choice}
              checked={theme === choice}
              onChange={() => onThemeChange(choice)}
            />
            <span>
              <strong>
                {choice.charAt(0).toUpperCase() + choice.slice(1)}
              </strong>
              <small>
                {choice === "system"
                  ? "Match this device"
                  : `Always use ${choice} mode`}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <section className="privacy-note">
        <h2>Private by default</h2>
        <p>
          No account, analytics, advertising, or external runtime resources.
          Your payment data will stay on this device.
        </p>
      </section>
    </>
  );
}

export function App() {
  const [theme, setTheme] = useState<ThemePreference>(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => theme === "system" && applyTheme(theme);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const updateTheme = (next: ThemePreference) => {
    saveTheme(next);
    setTheme(next);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/upcoming" aria-label="Dues home">
          <span className="brand-mark">D</span>
          <span>
            <strong>Dues</strong>
            <small>Know what's due.</small>
          </span>
        </NavLink>
        <nav aria-label="Main navigation">
          {navItems.map(([path, label, icon]) => (
            <NavLink key={path} to={path}>
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="local-note">Your data stays on this device.</p>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/upcoming" replace />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/add" element={<PaymentForm />} />
          <Route path="/payments/:paymentId/edit" element={<PaymentForm />} />
          <Route path="/backup" element={<Backup />} />
          <Route
            path="/settings"
            element={<Settings theme={theme} onThemeChange={updateTheme} />}
          />
          <Route path="*" element={<Navigate to="/upcoming" replace />} />
        </Routes>
      </main>
      <nav className="mobile-nav" aria-label="Main navigation">
        {navItems.slice(0, 5).map(([path, label, icon]) => (
          <NavLink key={path} to={path}>
            <span aria-hidden="true">{icon}</span>
            <small>{label === "Add payment" ? "Add" : label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
