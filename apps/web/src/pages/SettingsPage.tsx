import { PageHeader } from "../components/PageHeader";
import type { ThemePreference } from "../theme";

const themeChoices: readonly {
  value: ThemePreference;
  label: string;
  description: string;
}[] = [
  { value: "dark", label: "Night", description: "Use the dark field log" },
  {
    value: "light",
    label: "Paper",
    description: "Use the warm light register",
  },
  { value: "system", label: "System", description: "Match this device" },
];

interface SettingsPageProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}

export function SettingsPage({ theme, onThemeChange }: SettingsPageProps) {
  return (
    <div className="page page--settings">
      <PageHeader
        index="05"
        eyebrow="Preferences"
        title="Settings"
        copy="The night log is the default. Choose another appearance any time."
        metadata={[
          { label: "Profile", value: "This device" },
          { label: "Sync", value: "None" },
          { label: "Telemetry", value: "None" },
        ]}
      />

      <fieldset className="theme-options">
        <legend>Appearance</legend>
        {themeChoices.map(({ value, label, description }, index) => (
          <label key={value}>
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => onThemeChange(value)}
            />
            <span className="theme-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="theme-copy">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <span className="theme-marker" aria-hidden="true" />
          </label>
        ))}
      </fieldset>

      <section className="privacy-note">
        <p className="eyebrow">Storage policy</p>
        <h2>Private by default</h2>
        <p>
          No account, analytics, advertising, or external runtime resources.
          Your payment data will stay on this device.
        </p>
      </section>
    </div>
  );
}
