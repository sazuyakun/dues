import { describe, expect, expectTypeOf, it } from "vitest";

import {
  PAYMENT_FIELD_LIMITS,
  SUPPORTED_CURRENCY_CODES,
  advancePaymentAfterPaid,
  applyPaymentChanges,
  currencyCodeSchema,
  isSafeProviderUrl,
  isSupportedCurrencyCode,
  recurrenceSchema,
  safeValidateNewPaymentInput,
  safeValidatePaymentChanges,
  safeValidateRecurringPayment,
  validateNewPaymentInput,
  validateRecurringPayment,
  type CurrencyCode,
  type NewPaymentInput,
  type RecurringPayment,
  type ValidatedNewPaymentInput,
} from "../src";

const canonicalPaymentExamples = {
  monthlyDay31: {
    id: "monthly-31",
    name: "Workspace suite",
    amount: 12_345,
    currency: "INR",
    recurrence: { frequency: "monthly" },
    nextDueDate: "2026-01-31",
    status: "active",
    category: "Work",
    paymentMethodLabel: "UPI mandate",
    freeTrialEndDate: "2026-01-15",
    notes: "Owner's plan <script>remains inert text</script>",
    providerUrl: "https://example.com/account/billing",
    reminderLeadDays: 5,
  },
  yearlyLeapDay: {
    id: "yearly-leap-day",
    name: "Leap-day membership",
    amount: 9_900,
    currency: "EUR",
    recurrence: { frequency: "yearly" },
    nextDueDate: "2024-02-29",
    status: "active",
  },
  customMonth: {
    id: "custom-month",
    name: "Bi-monthly service",
    amount: 500,
    currency: "USD",
    recurrence: {
      frequency: "custom",
      interval: { count: 2, unit: "month" },
    },
    nextDueDate: "2026-01-31",
    status: "paused",
  },
} as const;

describe("canonical payment contract", () => {
  it("normalizes complete shared examples without losing optional fields", () => {
    const payment = validateRecurringPayment(
      canonicalPaymentExamples.monthlyDay31,
    );

    expect(payment).toEqual({
      ...canonicalPaymentExamples.monthlyDay31,
      recurrence: { frequency: "monthly", anchorDay: 31 },
    });
    expect(advancePaymentAfterPaid(payment).nextDueDate).toBe("2026-02-28");
    expect(
      advancePaymentAfterPaid(advancePaymentAfterPaid(payment)).nextDueDate,
    ).toBe("2026-03-31");
  });

  it("retains leap-day and custom month anchors in canonical records", () => {
    const yearly = validateRecurringPayment(
      canonicalPaymentExamples.yearlyLeapDay,
    );
    const custom = validateRecurringPayment(
      canonicalPaymentExamples.customMonth,
    );

    expect(yearly.recurrence).toEqual({
      frequency: "yearly",
      anchorMonth: 2,
      anchorDay: 29,
    });
    expect(custom.recurrence).toEqual({
      frequency: "custom",
      interval: { count: 2, unit: "month", anchorDay: 31 },
    });
  });

  it("requires anchors when a recurrence is validated on its own", () => {
    expect(recurrenceSchema.safeParse({ frequency: "monthly" }).success).toBe(
      false,
    );
    expect(
      recurrenceSchema.safeParse({ frequency: "monthly", anchorDay: 31 })
        .success,
    ).toBe(true);
  });

  it("provides normalized create input and validated edit patches", () => {
    const { id: _id, ...exampleInput } = canonicalPaymentExamples.monthlyDay31;
    const input: NewPaymentInput = exampleInput;
    const created = validateNewPaymentInput(input);

    expectTypeOf(created).toEqualTypeOf<ValidatedNewPaymentInput>();
    expect(created.recurrence).toEqual({
      frequency: "monthly",
      anchorDay: 31,
    });
    expect(
      safeValidateNewPaymentInput({ ...input, id: "unexpected" }).success,
    ).toBe(false);
    expect(safeValidatePaymentChanges({ name: "Updated name" }).success).toBe(
      true,
    );
    expect(safeValidatePaymentChanges({}).success).toBe(false);
  });

  it("applies edits through canonical record validation", () => {
    const original = validateRecurringPayment(
      canonicalPaymentExamples.monthlyDay31,
    );
    const edited = applyPaymentChanges(original, {
      name: "Updated workspace suite",
      nextDueDate: "2026-02-28",
    });

    expect(edited.name).toBe("Updated workspace suite");
    expect(edited.nextDueDate).toBe("2026-02-28");
    expect(edited.recurrence).toEqual({
      frequency: "monthly",
      anchorDay: 31,
    });
  });

  it("exports a stable canonical output type", () => {
    const payment: RecurringPayment = validateRecurringPayment(
      canonicalPaymentExamples.yearlyLeapDay,
    );

    if (payment.recurrence.frequency === "yearly") {
      expectTypeOf(payment.recurrence.anchorDay).toEqualTypeOf<number>();
      expectTypeOf(payment.recurrence.anchorMonth).toEqualTypeOf<number>();
    }
  });
});

describe("shared payment constraints", () => {
  it("uses the portable field limits for locally valid records", () => {
    const atLimits = {
      ...canonicalPaymentExamples.monthlyDay31,
      id: "i".repeat(PAYMENT_FIELD_LIMITS.id),
      name: "n".repeat(PAYMENT_FIELD_LIMITS.name),
      category: "c".repeat(PAYMENT_FIELD_LIMITS.category),
      paymentMethodLabel: "p".repeat(PAYMENT_FIELD_LIMITS.paymentMethodLabel),
      notes: "x".repeat(PAYMENT_FIELD_LIMITS.notes),
      providerUrl: `https://example.com/${"u".repeat(
        PAYMENT_FIELD_LIMITS.providerUrl - "https://example.com/".length,
      )}`,
      reminderLeadDays: PAYMENT_FIELD_LIMITS.reminderLeadDays,
    };

    expect(safeValidateRecurringPayment(atLimits).success).toBe(true);
    expect(
      safeValidateRecurringPayment({
        ...atLimits,
        name: `${atLimits.name}n`,
      }).success,
    ).toBe(false);
  });

  it.each(["ZWG", "XCG", "XAD", "BGN", "USD"])(
    "accepts supported current or historical currency %s",
    (currency) => {
      expect(isSupportedCurrencyCode(currency)).toBe(true);
      expect(currencyCodeSchema.safeParse(currency).success).toBe(true);
    },
  );

  it.each(["ZZZ", "usd", "US", "USDD"])(
    "rejects unsupported currency %s",
    (currency) => {
      expect(isSupportedCurrencyCode(currency)).toBe(false);
      expect(currencyCodeSchema.safeParse(currency).success).toBe(false);
      expect(
        safeValidateRecurringPayment({
          ...canonicalPaymentExamples.monthlyDay31,
          currency,
        }).success,
      ).toBe(false);
    },
  );

  it("publishes the same currency literals used by validation", () => {
    const code: CurrencyCode = "INR";
    expect(SUPPORTED_CURRENCY_CODES).toContain(code);
  });

  it.each([
    "javascript:alert(1)",
    "http://example.com/billing",
    "https://user:secret@example.com/billing",
    " https://example.com/billing",
  ])("rejects unsafe provider URL %s", (providerUrl) => {
    expect(isSafeProviderUrl(providerUrl)).toBe(false);
    expect(
      safeValidateRecurringPayment({
        ...canonicalPaymentExamples.monthlyDay31,
        providerUrl,
      }).success,
    ).toBe(false);
  });

  it.each([
    "https://example.com/billing",
    "http://localhost:4173/billing",
    "http://127.0.0.1/billing",
    "http://[::1]/billing",
  ])("accepts documented provider URL %s", (providerUrl) => {
    expect(isSafeProviderUrl(providerUrl)).toBe(true);
  });

  it("rejects identifiers with surrounding whitespace and blank labels", () => {
    expect(
      safeValidateRecurringPayment({
        ...canonicalPaymentExamples.monthlyDay31,
        id: " monthly-31",
      }).success,
    ).toBe(false);
    expect(
      safeValidateRecurringPayment({
        ...canonicalPaymentExamples.monthlyDay31,
        category: "   ",
      }).success,
    ).toBe(false);
  });
});
