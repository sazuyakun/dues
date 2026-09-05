import type { CurrencyCode } from "@dues/core";
import { currencyOptions } from "../../app/currencyOptions";
import { FormField, StatusMessage } from "../../components";
import type { ThemePreference } from "../../theme";
import { useSettings } from "./settingsContext";

const themeChoices: readonly {
  value: ThemePreference;
  label: string;
}[] = [
  { value: "dark", label: "Night" },
  { value: "light", label: "Paper" },
  { value: "system", label: "System" },
];

export function SettingsRoute() {
  const { settings, saving, notice, updateSettings } = useSettings();

  return (
    <div className="page page--settings" aria-busy={saving}>
      <h1 className="page-title">Settings</h1>

      <div className="settings-register">
        <section className="settings-panel" aria-label="Payment defaults">
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
          {themeChoices.map(({ value, label }) => (
            <label key={value}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={settings.theme === value}
                disabled={saving}
                onChange={() => void updateSettings({ theme: value })}
              />
              <span className="theme-copy">
                <strong>{label}</strong>
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
    </div>
  );
}
