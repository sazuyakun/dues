import {
  isSupportedCurrencyCode,
  validateRecurringPayment,
  type RecurringPayment,
} from "@dues/core";

import { StorageError } from "./errors.js";
import type { AppSettings, PaymentRecord, ThemeSetting } from "./types.js";

const THEME_SETTINGS: ReadonlySet<string> = new Set<ThemeSetting>([
  "light",
  "dark",
  "system",
]);

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value;
}

export function validatePaymentInput(value: unknown): RecurringPayment {
  try {
    return validateRecurringPayment(value);
  } catch {
    throw new StorageError("invalid-data");
  }
}

export function validatePaymentRecord(value: unknown): PaymentRecord {
  if (typeof value !== "object" || value === null) {
    throw new StorageError("invalid-data");
  }

  const { createdAt, updatedAt, ...payment } = value as Record<string, unknown>;
  if (!isIsoTimestamp(createdAt) || !isIsoTimestamp(updatedAt)) {
    throw new StorageError("invalid-data");
  }
  if (Date.parse(createdAt) > Date.parse(updatedAt)) {
    throw new StorageError("invalid-data");
  }

  return {
    ...validatePaymentInput(payment),
    createdAt,
    updatedAt,
  };
}

export function validateSettings(value: unknown): AppSettings {
  if (typeof value !== "object" || value === null) {
    throw new StorageError("invalid-data");
  }

  const { onboardingComplete, defaultCurrency, theme, ...unexpected } =
    value as Record<string, unknown>;
  if (
    Object.keys(unexpected).length > 0 ||
    typeof onboardingComplete !== "boolean" ||
    typeof defaultCurrency !== "string" ||
    !isSupportedCurrencyCode(defaultCurrency) ||
    typeof theme !== "string" ||
    !THEME_SETTINGS.has(theme)
  ) {
    throw new StorageError("invalid-data");
  }

  return {
    onboardingComplete,
    defaultCurrency,
    theme: theme as ThemeSetting,
  };
}
