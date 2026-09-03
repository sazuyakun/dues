import { validateRecurringPayment, type RecurringPayment } from "@dues/core";
import { describe, expect, it } from "vitest";
import type { PaymentRecord } from "../../app/index";
import {
  createUpcomingViewModel,
  formatMinorUnitAmount,
  recurrenceLabel,
} from "./upcomingModel";

function payment(
  id: string,
  nextDueDate: RecurringPayment["nextDueDate"],
  overrides: Partial<RecurringPayment> = {},
): PaymentRecord {
  const [, month, day] = nextDueDate.split("-");
  return {
    ...validateRecurringPayment({
      id,
      name: `Payment ${id}`,
      amount: 100,
      currency: "USD",
      recurrence: {
        frequency: "yearly",
        anchorMonth: Number(month),
        anchorDay: Number(day),
      },
      nextDueDate,
      status: "active",
      ...overrides,
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("upcoming view model", () => {
  it("uses core grouping and keeps currency totals separate", () => {
    const model = createUpcomingViewModel(
      [
        payment("overdue", "2026-09-01", { amount: 1_000 }),
        payment("today", "2026-09-03", {
          amount: 2_000,
          currency: "INR",
        }),
        payment("next", "2026-09-10", { amount: 300 }),
        payment("later", "2026-09-20", {
          amount: 400,
          currency: "INR",
        }),
        payment("beyond", "2026-10-01", {
          amount: 5_000,
          currency: "EUR",
        }),
        payment("paused", "2026-09-04", {
          amount: 99_999,
          status: "paused",
        }),
        payment("archived", "2026-09-05", {
          amount: 99_999,
          status: "archived",
        }),
      ],
      "2026-09-03",
    );

    expect(model.groups.overdue.map(({ id }) => id)).toEqual(["overdue"]);
    expect(model.groups.today.map(({ id }) => id)).toEqual(["today"]);
    expect(model.groups.nextSevenDays.map(({ id }) => id)).toEqual(["next"]);
    expect(model.groups.laterThisMonth.map(({ id }) => id)).toEqual(["later"]);
    expect(model.groups.beyond.map(({ id }) => id)).toEqual(["beyond"]);
    expect(model.upcomingCount).toBe(5);
    expect(model.activeCount).toBe(5);
    expect(model.totals.month).toEqual({ USD: 1_300, INR: 2_400 });
    expect(model.totals.year).toEqual({
      USD: 1_300,
      INR: 2_400,
      EUR: 5_000,
    });
  });

  it("flags only active payments currently inside their reminder window", () => {
    const model = createUpcomingViewModel(
      [
        payment("inside", "2026-09-05", { reminderLeadDays: 2 }),
        payment("outside", "2026-09-06", { reminderLeadDays: 2 }),
        payment("overdue", "2026-09-02", { reminderLeadDays: 30 }),
        payment("paused", "2026-09-03", {
          reminderLeadDays: 1,
          status: "paused",
        }),
      ],
      "2026-09-03",
    );

    expect([...model.reminderIds]).toEqual(["inside"]);
  });

  it("formats minor units for display and describes custom recurrences", () => {
    expect(formatMinorUnitAmount(12_345, "USD", "en-US")).toBe("$123.45");
    expect(formatMinorUnitAmount(12_345, "JPY", "en-US")).toBe("¥12,345");
    expect(
      recurrenceLabel(
        payment("custom", "2026-09-05", {
          recurrence: {
            frequency: "custom",
            interval: { count: 2, unit: "week" },
          },
        }),
      ),
    ).toBe("every 2 weeks");
  });
});
