import { SUPPORTED_CURRENCY_CODES, type CurrencyCode } from "@dues/core";

const COMMON_CURRENCY_CODES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
] as const satisfies readonly CurrencyCode[];

const commonCodes = new Set<CurrencyCode>(COMMON_CURRENCY_CODES);

export const currencyOptions: readonly CurrencyCode[] = [
  ...COMMON_CURRENCY_CODES,
  ...SUPPORTED_CURRENCY_CODES.filter((code) => !commonCodes.has(code)),
];
