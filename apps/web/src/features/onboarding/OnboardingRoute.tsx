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
          <div>
            <strong>Dues</strong>
            <small>Private payment register / first setup</small>
          </div>
        </header>

        <main className="pane onboarding-pane">
          <section className="onboarding-intro" aria-labelledby="welcome-title">
            <p className="eyebrow">Field note / 001</p>
            <h1 id="welcome-title">Know what’s due. Keep it yours.</h1>
            <p className="lede">
              Dues keeps recurring-payment details in this browser. There is no
              account, analytics, advertising, or bank connection.
            </p>

            <dl className="privacy-register">
              <div>
                <dt>Storage</dt>
                <dd>This device</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>Not required</dd>
              </div>
              <div>
                <dt>Credentials</dt>
                <dd>Never collected</dd>
              </div>
            </dl>
          </section>

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
            <p className="eyebrow">Local preference</p>
            <h2>Choose your default currency</h2>
            <p>
              New payments will start with this currency. You can change it at
              any time, and totals will always remain separated by currency.
            </p>

            <FormField
              id="onboarding-currency"
              label="Default currency"
              hint="Your selection is saved now, so setup can resume after closing the app."
            >
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
              {saving ? "Saving locally…" : "Save and add first payment"}
            </button>
            <small>
              Do not enter card numbers, account numbers, PINs, CVVs, or bank
              passwords in Dues.
            </small>
          </form>
        </main>

        <footer className="pane onboarding-footer">
          <p>Dues / Local-first setup</p>
          <p>No account · No analytics · Stored on this device</p>
        </footer>
      </div>
    </div>
  );
}
