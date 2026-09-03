import {
  PAYMENT_FIELD_LIMITS,
  isSupportedCurrencyCode,
  newPaymentInputSchema,
  type NewPaymentInput,
  type PaymentChanges,
  type RecurrenceInput,
  type RecurringPayment,
} from "@dues/core";

import {
  AmountInputError,
  formatMinorUnitInput,
  parseLocalizedAmount,
} from "./amount";

export type PaymentFrequency = RecurrenceInput["frequency"];
export type CustomIntervalUnit = "day" | "week" | "month" | "year";

export interface PaymentFormValues {
  readonly name: string;
  readonly amount: string;
  readonly currency: string;
  readonly frequency: PaymentFrequency;
  readonly customCount: string;
  readonly customUnit: CustomIntervalUnit;
  readonly nextDueDate: string;
  readonly status: "active" | "paused" | "archived";
  readonly category: string;
  readonly paymentMethodLabel: string;
  readonly freeTrialEndDate: string;
  readonly notes: string;
  readonly providerUrl: string;
  readonly reminderLeadDays: string;
}

export type PaymentFormField = keyof PaymentFormValues;
export type PaymentFormErrors = Partial<Record<PaymentFormField, string>>;

export type PaymentFormValidation =
  | { readonly success: true; readonly input: NewPaymentInput }
  | {
      readonly success: false;
      readonly errors: PaymentFormErrors;
      readonly message: string;
    };

const optionalTrimmed = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalNotes = (value: string): string | undefined =>
  value.trim().length > 0 ? value : undefined;

export const emptyPaymentFormValues = (
  defaultCurrency: string,
): PaymentFormValues => ({
  name: "",
  amount: "",
  currency: isSupportedCurrencyCode(defaultCurrency) ? defaultCurrency : "USD",
  frequency: "monthly",
  customCount: "1",
  customUnit: "month",
  nextDueDate: "",
  status: "active",
  category: "",
  paymentMethodLabel: "",
  freeTrialEndDate: "",
  notes: "",
  providerUrl: "",
  reminderLeadDays: "",
});

export const paymentToFormValues = (
  payment: RecurringPayment,
  locale: string,
): PaymentFormValues => {
  const customInterval =
    payment.recurrence.frequency === "custom"
      ? payment.recurrence.interval
      : undefined;

  return {
    name: payment.name,
    amount: formatMinorUnitInput(payment.amount, payment.currency, locale),
    currency: payment.currency,
    frequency: payment.recurrence.frequency,
    customCount: String(customInterval?.count ?? 1),
    customUnit: customInterval?.unit ?? "month",
    nextDueDate: payment.nextDueDate,
    status: payment.status,
    category: payment.category ?? "",
    paymentMethodLabel: payment.paymentMethodLabel ?? "",
    freeTrialEndDate: payment.freeTrialEndDate ?? "",
    notes: payment.notes ?? "",
    providerUrl: payment.providerUrl ?? "",
    reminderLeadDays:
      payment.reminderLeadDays === undefined
        ? ""
        : String(payment.reminderLeadDays),
  };
};

const preservedRecurrence = (
  values: PaymentFormValues,
  customCount: number | undefined,
  current?: RecurringPayment,
): unknown => {
  switch (values.frequency) {
    case "weekly":
      return { frequency: "weekly" };
    case "monthly":
    case "quarterly": {
      const existing =
        current?.recurrence.frequency === values.frequency
          ? current.recurrence
          : undefined;
      return {
        frequency: values.frequency,
        ...(existing ? { anchorDay: existing.anchorDay } : {}),
      };
    }
    case "yearly": {
      const existing =
        current?.recurrence.frequency === "yearly"
          ? current.recurrence
          : undefined;
      return {
        frequency: "yearly",
        ...(existing
          ? {
              anchorDay: existing.anchorDay,
              anchorMonth: existing.anchorMonth,
            }
          : {}),
      };
    }
    case "custom": {
      const existing =
        current?.recurrence.frequency === "custom" &&
        current.recurrence.interval.unit === values.customUnit
          ? current.recurrence.interval
          : undefined;
      const interval = {
        count: customCount,
        unit: values.customUnit,
        ...(existing && "anchorDay" in existing
          ? { anchorDay: existing.anchorDay }
          : {}),
        ...(existing && "anchorMonth" in existing
          ? { anchorMonth: existing.anchorMonth }
          : {}),
      };
      return { frequency: "custom", interval };
    }
  }
};

const fieldForIssue = (path: readonly PropertyKey[]): PaymentFormField => {
  const [field, nested, detail] = path;
  if (field === "recurrence") {
    if (nested === "interval" && detail === "count") return "customCount";
    if (nested === "interval" && detail === "unit") return "customUnit";
    return "frequency";
  }
  if (typeof field === "string" && field in emptyPaymentFormValues("USD")) {
    return field as PaymentFormField;
  }
  return "name";
};

const friendlyMessage = (field: PaymentFormField, fallback: string): string => {
  switch (field) {
    case "name":
      return "Enter a payment name using 500 characters or fewer.";
    case "currency":
      return "Choose a supported ISO 4217 currency code.";
    case "nextDueDate":
      return "Enter a real next due date.";
    case "freeTrialEndDate":
      return "Enter a real free-trial end date or leave it blank.";
    case "providerUrl":
      return "Use an HTTPS URL without embedded credentials.";
    case "reminderLeadDays":
      return `Use a whole number from 0 through ${PAYMENT_FIELD_LIMITS.reminderLeadDays}.`;
    case "customCount":
      return `Use a whole interval from 1 through ${PAYMENT_FIELD_LIMITS.customIntervalCount}.`;
    default:
      return fallback;
  }
};

export const validatePaymentForm = (
  values: PaymentFormValues,
  locale: string,
  current?: RecurringPayment,
): PaymentFormValidation => {
  const errors: PaymentFormErrors = {};
  let amount: number | undefined;
  let customCount: number | undefined;

  try {
    amount = parseLocalizedAmount(values.amount, values.currency, locale);
  } catch (error) {
    errors.amount =
      error instanceof AmountInputError
        ? error.message
        : "Enter a valid amount for the selected currency.";
  }

  if (values.frequency === "custom") {
    if (!/^\d+$/u.test(values.customCount)) {
      errors.customCount = `Use a whole interval from 1 through ${PAYMENT_FIELD_LIMITS.customIntervalCount}.`;
    } else {
      customCount = Number(values.customCount);
      if (
        !Number.isSafeInteger(customCount) ||
        customCount < 1 ||
        customCount > PAYMENT_FIELD_LIMITS.customIntervalCount
      ) {
        errors.customCount = `Use a whole interval from 1 through ${PAYMENT_FIELD_LIMITS.customIntervalCount}.`;
      }
    }
  }

  const candidate = {
    name: values.name.trim(),
    amount,
    currency: values.currency,
    recurrence: preservedRecurrence(values, customCount, current),
    nextDueDate: values.nextDueDate,
    status: values.status,
    category: optionalTrimmed(values.category),
    paymentMethodLabel: optionalTrimmed(values.paymentMethodLabel),
    freeTrialEndDate: optionalTrimmed(values.freeTrialEndDate),
    notes: optionalNotes(values.notes),
    providerUrl: optionalTrimmed(values.providerUrl),
    reminderLeadDays:
      values.reminderLeadDays.trim() === ""
        ? undefined
        : Number(values.reminderLeadDays),
  };
  const result = newPaymentInputSchema.safeParse(candidate);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = fieldForIssue(issue.path);
      errors[field] ??= friendlyMessage(field, issue.message);
    }
    return {
      success: false,
      errors,
      message: "Check the highlighted payment details.",
    };
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
      message: "Check the highlighted payment details.",
    };
  }

  return { success: true, input: result.data };
};

export const paymentInputAsChanges = (
  input: NewPaymentInput,
): PaymentChanges => ({
  ...input,
  category: input.category,
  paymentMethodLabel: input.paymentMethodLabel,
  freeTrialEndDate: input.freeTrialEndDate,
  notes: input.notes,
  providerUrl: input.providerUrl,
  reminderLeadDays: input.reminderLeadDays,
});
