import type { CurrencyCode } from "@dues/core";
import { currencyOptions } from "../../app/currencyOptions";
import { FormField, PageHeader, StatusMessage } from "../../components";
import type { ThemePreference } from "../../theme";
import { useSettings } from "./settingsContext";

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

export function SettingsRoute() {
  const { settings, saving, notice, updateSettings } = useSettings();

  return (
    <div className="page page--settings" aria-busy={saving}>
      <PageHeader
        index="05"
        eyebrow="Preferences"
        title="Settings"
        copy="Choose the defaults used on this device. Changes save locally as you make them."
        metadata={[
          { label: "Profile", value: "This device" },
          { label: "Sync", value: "None" },
          { label: "Telemetry", value: "None" },
        ]}
      />

      <div className="settings-register">
        <section className="settings-panel" aria-labelledby="currency-title">
          <p className="eyebrow">Payment default</p>
          <h2 id="currency-title">Currency</h2>
          <p>
            New records start with this code. Existing records keep their own
            currency, and totals are never combined across currencies.
          </p>
          <FormField id="settings-currency" label="Default currency">
            {(props) => (
              <select
                {...props}
                value={settings.defaultCurrency}
                disabled={saving}
                onChange={(event) => {
                  void updateSettings({
                    defaultCurrency: event.currentTarget.value as CurrencyCode,
                  });
                }}
              >
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </section>

        <fieldset className="theme-options">
          <legend>Appearance</legend>
          {themeChoices.map(({ value, label, description }, index) => (
            <label key={value}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={settings.theme === value}
                disabled={saving}
                onChange={() => void updateSettings({ theme: value })}
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
      </div>

      {notice && (
        <StatusMessage tone={notice.tone} title={notice.title}>
          <p>{notice.message}</p>
        </StatusMessage>
      )}

      <section className="privacy-note">
        <p className="eyebrow">Storage policy</p>
        <h2>Private by default</h2>
        <p>
          No account, analytics, advertising, or external runtime resources.
          Your payment data and preferences stay in this browser profile.
        </p>
      </section>
    </div>
  );
}
