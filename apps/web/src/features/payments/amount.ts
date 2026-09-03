import { isSupportedCurrencyCode, type CurrencyCode } from "@dues/core";

const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

export class AmountInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountInputError";
  }
}

const requireCurrency = (currency: string): CurrencyCode => {
  if (!isSupportedCurrencyCode(currency)) {
    throw new AmountInputError("Choose a supported currency code.");
  }
  return currency;
};

const numberFormatter = (
  locale: string,
  options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat => new Intl.NumberFormat(locale, options);

const digitSymbols = (locale: string): readonly string[] => {
  const formatter = numberFormatter(locale, { useGrouping: false });
  return Array.from({ length: 10 }, (_, digit) =>
    formatter.format(digit).normalize("NFKC"),
  );
};

const localizeDigits = (value: string, locale: string): string => {
  const symbols = digitSymbols(locale);
  return [...value]
    .map((character) => symbols[Number(character)] ?? character)
    .join("");
};

const replaceLocalizedDigits = (value: string, locale: string): string => {
  let normalized = value;
  digitSymbols(locale).forEach((symbol, digit) => {
    normalized = normalized.replaceAll(symbol, String(digit));
  });
  return normalized;
};

const separator = (
  locale: string,
  value: number,
  type: "decimal" | "group",
): string | undefined =>
  numberFormatter(locale)
    .formatToParts(value)
    .find((part) => part.type === type)
    ?.value.normalize("NFKC");

export const getCurrencyMinorUnitDigits = (
  currency: string,
  locale = "en",
): number => {
  const supportedCurrency = requireCurrency(currency);
  const minorUnitDigits = numberFormatter(locale, {
    style: "currency",
    currency: supportedCurrency,
  }).resolvedOptions().maximumFractionDigits;
  if (minorUnitDigits === undefined) {
    throw new AmountInputError(
      `Could not determine the smallest unit for ${currency}.`,
    );
  }
  return minorUnitDigits;
};

export const parseLocalizedAmount = (
  value: string,
  currency: string,
  locale = "en",
): number => {
  const minorUnitDigits = getCurrencyMinorUnitDigits(currency, locale);
  const decimalSeparator = separator(locale, 1.1, "decimal") ?? ".";
  const groupSeparator = separator(locale, 10_000, "group");
  let normalized = replaceLocalizedDigits(
    value.normalize("NFKC").trim(),
    locale,
  );

  if (groupSeparator) {
    normalized = /^\s$/u.test(groupSeparator)
      ? normalized.replace(/\s/gu, "")
      : normalized.replaceAll(groupSeparator, "");
  }
  if (decimalSeparator !== ".") {
    normalized = normalized.replaceAll(decimalSeparator, ".");
  }

  if (!/^(?:\d+|\d*\.\d*)$/u.test(normalized) || !/\d/u.test(normalized)) {
    throw new AmountInputError("Enter a non-negative numeric amount.");
  }

  const [wholePart = "0", fractionPart] = normalized.split(".");
  if ((fractionPart?.length ?? 0) > minorUnitDigits) {
    throw new AmountInputError(
      `${currency} accepts at most ${minorUnitDigits} decimal ${minorUnitDigits === 1 ? "place" : "places"}.`,
    );
  }

  const normalizedWhole = wholePart.replace(/^0+(?=\d)/u, "") || "0";
  const paddedFraction = (fractionPart ?? "").padEnd(minorUnitDigits, "0");
  const minorUnitsText = `${normalizedWhole}${paddedFraction}`.replace(
    /^0+(?=\d)/u,
    "",
  );
  const minorUnits = BigInt(minorUnitsText || "0");

  if (minorUnits > MAX_SAFE_MINOR_UNITS) {
    throw new AmountInputError("Amount is too large to store safely.");
  }

  return Number(minorUnits);
};

const amountParts = (
  amount: number,
  currency: string,
  locale: string,
): {
  readonly currency: CurrencyCode;
  readonly minorUnitDigits: number;
  readonly whole: bigint;
  readonly fraction: string;
} => {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("Amount must be a non-negative safe integer");
  }

  const supportedCurrency = requireCurrency(currency);
  const minorUnitDigits = getCurrencyMinorUnitDigits(supportedCurrency, locale);
  const divisor = 10n ** BigInt(minorUnitDigits);
  const minorUnits = BigInt(amount);

  return {
    currency: supportedCurrency,
    minorUnitDigits,
    whole: minorUnits / divisor,
    fraction: (minorUnits % divisor).toString().padStart(minorUnitDigits, "0"),
  };
};

export const formatMinorUnitAmount = (
  amount: number,
  currency: string,
  locale = "en",
): string => {
  const parts = amountParts(amount, currency, locale);
  const formatter = numberFormatter(locale, {
    style: "currency",
    currency: parts.currency,
    minimumFractionDigits: parts.minorUnitDigits,
    maximumFractionDigits: parts.minorUnitDigits,
  });

  return formatter
    .formatToParts(parts.whole)
    .map((part) =>
      part.type === "fraction"
        ? localizeDigits(parts.fraction, locale)
        : part.value,
    )
    .join("");
};

export const formatMinorUnitInput = (
  amount: number,
  currency: string,
  locale = "en",
): string => {
  const parts = amountParts(amount, currency, locale);
  const whole = parts.whole.toString();
  if (parts.minorUnitDigits === 0) return whole;

  const decimalSeparator = separator(locale, 1.1, "decimal") ?? ".";
  return `${whole}${decimalSeparator}${parts.fraction}`;
};
