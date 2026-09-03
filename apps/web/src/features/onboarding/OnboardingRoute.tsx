import type { CurrencyCode } from "@dues/core";
import { useNavigate } from "react-router-dom";
import { currencyOptions } from "../../app/currencyOptions";
import { FormField, StatusMessage } from "../../components";
import { useSettings } from "../settings";

export function OnboardingRoute() {
  const navigate = useNavigate();
  const { settings, saving, notice, updateSettings } = useSettings();

  return (
    <div className="app-shell onboarding-shell" data-context="settings">
      <div className="field-frame onboarding-frame">
        <header className="pane onboarding-masthead">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <strong>Dues</strong>
        </header>

        <main className="pane onboarding-pane">
          <form
            className="onboarding-setup"
            aria-busy={saving}
            onSubmit={(event) => {
              event.preventDefault();
              void updateSettings({ onboardingComplete: true }).then(
                (saved) => {
                  if (saved) navigate("/add", { replace: true });
                },
              );
            }}
          >
            <h1>Set up Dues</h1>

            <FormField id="onboarding-currency" label="Default currency">
              {(props) => (
                <select
                  {...props}
                  value={settings.defaultCurrency}
                  disabled={saving}
                  onChange={(event) => {
                    void updateSettings({
                      defaultCurrency: event.currentTarget
                        .value as CurrencyCode,
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

            {notice && (
              <StatusMessage tone={notice.tone} title={notice.title}>
                <p>{notice.message}</p>
              </StatusMessage>
            )}

            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Continue"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
