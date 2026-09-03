import { describe, expect, it } from "vitest";
import { validateRecurringPayment } from "@dues/core";

import {
  emptyPaymentFormValues,
  paymentInputAsChanges,
  paymentToFormValues,
  validatePaymentForm,
  type PaymentFormValues,
} from "./formModel";

const validValues = (
  overrides: Partial<PaymentFormValues> = {},
): PaymentFormValues => ({
  ...emptyPaymentFormValues("USD"),
  name: "Workspace",
  amount: "12.34",
  nextDueDate: "2026-01-31",
  ...overrides,
});

describe("payment form validation", () => {
  it("creates a complete required payment input", () => {
    expect(validatePaymentForm(validValues(), "en-US")).toEqual({
      success: true,
      input: {
        name: "Workspace",
        amount: 1_234,
        currency: "USD",
        recurrence: { frequency: "monthly", anchorDay: 31 },
        nextDueDate: "2026-01-31",
        status: "active",
        category: undefined,
        paymentMethodLabel: undefined,
        freeTrialEndDate: undefined,
        notes: undefined,
        providerUrl: undefined,
        reminderLeadDays: undefined,
      },
    });
  });

  it("validates every optional field and custom recurrence", () => {
    const result = validatePaymentForm(
      validValues({
        amount: "9,876.543",
        currency: "KWD",
        frequency: "custom",
        customCount: "2",
        customUnit: "year",
        category: "Work",
        paymentMethodLabel: "Bank mandate",
        freeTrialEndDate: "2025-12-31",
        notes: "Procurement owner",
        providerUrl: "https://example.com/manage",
        reminderLeadDays: "14",
      }),
      "en-US",
    );

    expect(result).toMatchObject({
      success: true,
      input: {
        amount: 9_876_543,
        recurrence: {
          frequency: "custom",
          interval: {
            count: 2,
            unit: "year",
            anchorMonth: 1,
            anchorDay: 31,
          },
        },
        category: "Work",
        paymentMethodLabel: "Bank mandate",
        reminderLeadDays: 14,
      },
    });
  });

  it("returns field guidance for invalid amounts, dates, URLs, and intervals", () => {
    const result = validatePaymentForm(
      validValues({
        amount: "-1.00",
        frequency: "custom",
        customCount: "0",
        nextDueDate: "2026-02-30",
        freeTrialEndDate: "not-a-date",
        providerUrl: "javascript:alert(1)",
        reminderLeadDays: "1.5",
      }),
      "en-US",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toMatchObject({
        amount: expect.any(String),
        customCount: expect.any(String),
      });
    }

    const domainResult = validatePaymentForm(
      validValues({
        nextDueDate: "2026-02-30",
        freeTrialEndDate: "not-a-date",
        providerUrl: "javascript:alert(1)",
        reminderLeadDays: "1.5",
      }),
      "en-US",
    );
    expect(domainResult.success).toBe(false);
    if (!domainResult.success) {
      expect(domainResult.errors).toMatchObject({
        nextDueDate: expect.any(String),
        freeTrialEndDate: expect.any(String),
        providerUrl: expect.any(String),
        reminderLeadDays: expect.any(String),
      });
    }
  });

  it("preserves hidden schedule anchors when editing", () => {
    const current = validateRecurringPayment({
      id: "payment-1",
      name: "Workspace",
      amount: 1_234,
      currency: "USD",
      recurrence: { frequency: "monthly", anchorDay: 31 },
      nextDueDate: "2026-02-28",
      status: "active",
    });
    const values = paymentToFormValues(current, "en-US");
    const result = validatePaymentForm(
      { ...values, name: "Updated workspace" },
      "en-US",
      current,
    );

    expect(result).toMatchObject({
      success: true,
      input: { recurrence: { frequency: "monthly", anchorDay: 31 } },
    });
  });

  it("round-trips every editable field without exposing custom anchors", () => {
    const current = validateRecurringPayment({
      id: "complete-payment",
      name: "Complete record",
      amount: 987_654,
      currency: "KWD",
      recurrence: {
        frequency: "custom",
        interval: {
          count: 2,
          unit: "year",
          anchorMonth: 2,
          anchorDay: 29,
        },
      },
      nextDueDate: "2028-02-29",
      status: "paused",
      category: "Work",
      paymentMethodLabel: "Bank mandate",
      freeTrialEndDate: "2027-12-31",
      notes: "Keep this exact note.\nSecond line.",
      providerUrl: "https://example.com/manage",
      reminderLeadDays: 30,
    });
    const values = paymentToFormValues(current, "en-US");
    const { id: _id, ...expectedInput } = current;

    expect(values).not.toHaveProperty("anchorDay");
    expect(values).not.toHaveProperty("anchorMonth");
    expect(validatePaymentForm(values, "en-US", current)).toEqual({
      success: true,
      input: expectedInput,
    });
  });

  it("sends cleared optional fields explicitly in edit changes", () => {
    const result = validatePaymentForm(validValues(), "en-US");
    expect(result.success).toBe(true);
    if (!result.success) return;

    const changes = paymentInputAsChanges(result.input);
    for (const field of [
      "category",
      "paymentMethodLabel",
      "freeTrialEndDate",
      "notes",
      "providerUrl",
      "reminderLeadDays",
    ]) {
      expect(changes).toHaveProperty(field, undefined);
    }
  });
});
