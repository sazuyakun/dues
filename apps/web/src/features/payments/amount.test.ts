import { describe, expect, it } from "vitest";

import {
  AmountInputError,
  formatMinorUnitAmount,
  formatMinorUnitInput,
  getCurrencyMinorUnitDigits,
  parseLocalizedAmount,
} from "./amount";

describe("localized payment amounts", () => {
  it.each([
    ["1,234.56", "USD", "en-US", 123_456],
    ["1.234,56", "EUR", "de-DE", 123_456],
    ["1,23,456.78", "INR", "en-IN", 12_345_678],
    ["١٢٣٫٤٥", "USD", "ar-EG", 12_345],
    ["1234", "JPY", "ja-JP", 1_234],
    ["1.234", "KWD", "en", 1_234],
  ] as const)(
    "parses %s as integer minor units for %s",
    (input, currency, locale, expected) => {
      expect(parseLocalizedAmount(input, currency, locale)).toBe(expected);
    },
  );

  it.each([
    ["-1.00", "USD", "en-US"],
    ["1e3", "USD", "en-US"],
    ["1.001", "USD", "en-US"],
    ["1.5", "JPY", "ja-JP"],
    ["90071992547409.92", "USD", "en-US"],
    ["1.00", "ZZZ", "en-US"],
  ] as const)("rejects unsafe amount %s for %s", (input, currency, locale) => {
    expect(() => parseLocalizedAmount(input, currency, locale)).toThrow(
      AmountInputError,
    );
  });

  it("uses the currency's declared smallest unit", () => {
    expect(getCurrencyMinorUnitDigits("JPY", "en")).toBe(0);
    expect(getCurrencyMinorUnitDigits("USD", "en")).toBe(2);
    expect(getCurrencyMinorUnitDigits("KWD", "en")).toBe(3);
  });

  it("formats from integers without losing large exact values", () => {
    expect(formatMinorUnitAmount(123_456, "USD", "en-US")).toBe("$1,234.56");
    expect(
      formatMinorUnitAmount(Number.MAX_SAFE_INTEGER, "JPY", "en-US"),
    ).toContain("9,007,199,254,740,991");
    expect(formatMinorUnitInput(123_456, "EUR", "de-DE")).toBe("1234,56");
  });
});
