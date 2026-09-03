import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PAYMENT_FIELD_LIMITS, SUPPORTED_CURRENCY_CODES } from "@dues/core";

import {
  presentApplicationError,
  toApplicationError,
  useApplicationServices,
  type ApplicationError,
  type PaymentRecord,
} from "../../app/index";
import { FormField, LoadingState, StatusMessage } from "../../components";
import {
  emptyPaymentFormValues,
  paymentInputAsChanges,
  paymentToFormValues,
  validatePaymentForm,
  type CustomIntervalUnit,
  type PaymentFormErrors,
  type PaymentFormField,
  type PaymentFormValues,
  type PaymentFrequency,
} from "./formModel";
import "./payments.css";

interface PaymentFormRouteProps {
  readonly locale?: string;
}

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly error: ApplicationError };

const FREQUENCIES: readonly {
  readonly value: PaymentFrequency;
  readonly label: string;
}[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom interval" },
];

const CUSTOM_UNITS: readonly {
  readonly value: CustomIntervalUnit;
  readonly label: string;
}[] = [
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" },
  { value: "year", label: "Years" },
];

const focusFirstError = (): void => {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
};

export function PaymentFormRoute({
  locale = navigator.language || "en",
}: PaymentFormRouteProps) {
  const { payments, settings, environment } = useApplicationServices();
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const editing = paymentId !== undefined;
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
  });
  const [values, setValues] = useState<PaymentFormValues>(() =>
    emptyPaymentFormValues("USD"),
  );
  const [current, setCurrent] = useState<PaymentRecord>();
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [saveError, setSaveError] = useState<ApplicationError>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);

  const loadForm = useCallback(async (): Promise<void> => {
    await Promise.resolve();
    setLoadState({ status: "loading" });
    setSaveError(undefined);
    setNotice(undefined);

    try {
      if (paymentId) {
        const payment = await payments.get(paymentId);
        if (!payment) {
          setCurrent(undefined);
          setLoadState({ status: "not-found" });
          return;
        }
        setCurrent(payment);
        setValues(paymentToFormValues(payment, locale));
      } else {
        const preferences = await settings.get();
        setCurrent(undefined);
        setValues({
          ...emptyPaymentFormValues(preferences.defaultCurrency),
          nextDueDate: environment.currentDate(),
        });
      }
      setErrors({});
      setLoadState({ status: "ready" });
    } catch (error) {
      setLoadState({ status: "error", error: toApplicationError(error) });
    }
  }, [environment, locale, paymentId, payments, settings]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadForm();
    });
    return () => {
      active = false;
    };
  }, [loadForm]);

  const updateField = <Field extends PaymentFormField>(
    field: Field,
    value: PaymentFormValues[Field],
  ): void => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaveError(undefined);
    setNotice(undefined);

    const validation = validatePaymentForm(values, locale, current);
    if (!validation.success) {
      setErrors(validation.errors);
      setNotice(validation.message);
      focusFirstError();
      return;
    }

    setErrors({});
    setPending(true);
    try {
      if (current) {
        await payments.update(
          current.id,
          paymentInputAsChanges(validation.input),
          { expectedUpdatedAt: current.updatedAt },
        );
        navigate("/payments", {
          replace: true,
          state: { paymentNotice: "Payment saved." },
        });
      } else {
        await payments.create(validation.input);
        navigate("/payments", {
          replace: true,
          state: { paymentNotice: "Payment added." },
        });
      }
    } catch (error) {
      const applicationError = toApplicationError(error);
      if (applicationError.code === "not-found") {
        setLoadState({ status: "not-found" });
      } else {
        setSaveError(applicationError);
      }
    } finally {
      setPending(false);
    }
  };

  if (loadState.status === "loading") {
    return (
      <div className="page payments-feature">
        <LoadingState title="Loading payment" />
      </div>
    );
  }

  if (loadState.status === "not-found") {
    return (
      <div className="page payments-feature">
        <StatusMessage tone="error" title="Payment not found">
          <button type="button" onClick={() => navigate("/payments")}>
            Return to payments
          </button>
        </StatusMessage>
      </div>
    );
  }

  if (loadState.status === "error") {
    const presentation = presentApplicationError(loadState.error);
    return (
      <div className="page payments-feature">
        <StatusMessage tone="error" title={presentation.title}>
          <p>{presentation.message}</p>
          {presentation.retryable && (
            <button type="button" onClick={() => void loadForm()}>
              Try again
            </button>
          )}
        </StatusMessage>
      </div>
    );
  }

  const errorPresentation = saveError
    ? presentApplicationError(saveError)
    : undefined;

  return (
    <div className="page payments-feature">
      <h1 className="page-title">{editing ? "Edit payment" : "Add payment"}</h1>

      {notice && (
        <p className="payment-form-notice" role="status">
          {notice}
        </p>
      )}

      {errorPresentation && (
        <section className="payment-inline-alert" role="alert">
          <strong>{errorPresentation.title}</strong>
          <p>{errorPresentation.message}</p>
          {saveError?.code === "conflict" && (
            <button type="button" onClick={() => void loadForm()}>
              Reload latest payment
            </button>
          )}
        </section>
      )}

      <form className="payment-editor" noValidate onSubmit={submit}>
        <fieldset disabled={pending}>
          <legend>Details</legend>
          <div className="payment-field-grid payment-field-grid--identity">
            <FormField
              id="payment-name"
              label="Name"
              error={errors.name}
              required
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={values.name}
                  maxLength={PAYMENT_FIELD_LIMITS.name}
                  autoComplete="off"
                  onChange={(event) => updateField("name", event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id="payment-amount"
              label="Amount"
              hint="Use your locale's decimal separator."
              error={errors.amount}
              required
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  inputMode="decimal"
                  value={values.amount}
                  autoComplete="off"
                  onChange={(event) =>
                    updateField("amount", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id="payment-currency"
              label="Currency"
              error={errors.currency}
              required
            >
              {(props) => (
                <select
                  {...props}
                  value={values.currency}
                  onChange={(event) =>
                    updateField("currency", event.target.value)
                  }
                >
                  {SUPPORTED_CURRENCY_CODES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div className="payment-field-grid payment-field-grid--schedule">
            <FormField
              id="payment-frequency"
              label="Frequency"
              error={errors.frequency}
              required
            >
              {(props) => (
                <select
                  {...props}
                  value={values.frequency}
                  onChange={(event) =>
                    updateField(
                      "frequency",
                      event.target.value as PaymentFrequency,
                    )
                  }
                >
                  {FREQUENCIES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField
              id="payment-next-due"
              label="Next due date"
              error={errors.nextDueDate}
              required
            >
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={values.nextDueDate}
                  onChange={(event) =>
                    updateField("nextDueDate", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id="payment-status"
              label="Status"
              error={errors.status}
              required
            >
              {(props) => (
                <select
                  {...props}
                  value={values.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value as PaymentFormValues["status"],
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              )}
            </FormField>
          </div>

          {values.frequency === "custom" && (
            <div className="custom-recurrence" aria-label="Custom recurrence">
              <p className="telemetry">Custom interval</p>
              <div className="payment-field-grid payment-field-grid--custom">
                <FormField
                  id="payment-custom-count"
                  label="Repeat every"
                  error={errors.customCount}
                  required
                >
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      inputMode="numeric"
                      value={values.customCount}
                      onChange={(event) =>
                        updateField("customCount", event.target.value)
                      }
                    />
                  )}
                </FormField>
                <FormField
                  id="payment-custom-unit"
                  label="Interval unit"
                  error={errors.customUnit}
                  required
                >
                  {(props) => (
                    <select
                      {...props}
                      value={values.customUnit}
                      onChange={(event) =>
                        updateField(
                          "customUnit",
                          event.target.value as CustomIntervalUnit,
                        )
                      }
                    >
                      {CUSTOM_UNITS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
              </div>
            </div>
          )}
        </fieldset>

        <fieldset disabled={pending}>
          <legend>Optional</legend>
          <div className="payment-field-grid">
            <FormField
              id="payment-category"
              label="Category"
              error={errors.category}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={values.category}
                  maxLength={PAYMENT_FIELD_LIMITS.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id="payment-method"
              label="Payment method"
              hint="Label only—never enter a full card or account number."
              error={errors.paymentMethodLabel}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={values.paymentMethodLabel}
                  maxLength={PAYMENT_FIELD_LIMITS.paymentMethodLabel}
                  autoComplete="off"
                  onChange={(event) =>
                    updateField("paymentMethodLabel", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id="payment-trial-end"
              label="Free-trial end date"
              error={errors.freeTrialEndDate}
            >
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={values.freeTrialEndDate}
                  onChange={(event) =>
                    updateField("freeTrialEndDate", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id="payment-reminder"
              label="Reminder lead time (days)"
              error={errors.reminderLeadDays}
            >
              {(props) => (
                <input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={PAYMENT_FIELD_LIMITS.reminderLeadDays}
                  step="1"
                  value={values.reminderLeadDays}
                  onChange={(event) =>
                    updateField("reminderLeadDays", event.target.value)
                  }
                />
              )}
            </FormField>
          </div>

          <FormField
            id="payment-provider-url"
            label="Provider URL"
            hint="HTTPS only."
            error={errors.providerUrl}
          >
            {(props) => (
              <input
                {...props}
                type="url"
                value={values.providerUrl}
                maxLength={PAYMENT_FIELD_LIMITS.providerUrl}
                autoComplete="url"
                onChange={(event) =>
                  updateField("providerUrl", event.target.value)
                }
              />
            )}
          </FormField>

          <FormField id="payment-notes" label="Notes" error={errors.notes}>
            {(props) => (
              <textarea
                {...props}
                rows={5}
                value={values.notes}
                maxLength={PAYMENT_FIELD_LIMITS.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            )}
          </FormField>
        </fieldset>

        <div className="payment-form-actions">
          <button type="submit" disabled={pending}>
            {pending
              ? editing
                ? "Saving changes…"
                : "Adding payment…"
              : editing
                ? "Save changes"
                : "Add payment"}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={pending}
            onClick={() => navigate("/payments")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
