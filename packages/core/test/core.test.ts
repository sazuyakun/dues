import { describe, expect, it } from "vitest";
import {
  advanceCalendarDate,
  advancePaymentAfterPaid,
  currentPeriodTotals,
  filterPayments,
  groupUpcomingPayments,
  parseCalendarDate,
  safeValidateRecurringPayment,
  validateRecurringPayment,
  type RecurringPayment
} from "../src";

const payment = (overrides: Partial<RecurringPayment> = {}): RecurringPayment => validateRecurringPayment({
  id: "p1", name: "Cloud", amount: 999, currency: "USD",
  recurrence: { frequency: "monthly" }, nextDueDate: "2025-01-31", status: "active",
  ...overrides
});

describe("calendar schedules", () => {
  it("retains a January 31 monthly anchor after February", () => {
    const original = payment();
    const february = advancePaymentAfterPaid(original);
    expect(february.nextDueDate).toBe("2025-02-28");
    expect(advancePaymentAfterPaid(february).nextDueDate).toBe("2025-03-31");
  });

  it("handles February 29 across leap and non-leap years", () => {
    expect(advanceCalendarDate("2024-02-29", { frequency: "yearly", anchorMonth: 2, anchorDay: 29 })).toBe("2025-02-28");
    expect(advanceCalendarDate("2025-02-28", { frequency: "yearly", anchorMonth: 2, anchorDay: 29 }, 3)).toBe("2028-02-29");
  });

  it("handles quarterly, yearly, and custom intervals", () => {
    expect(advanceCalendarDate("2025-11-30", { frequency: "quarterly", anchorDay: 30 })).toBe("2026-02-28");
    expect(advanceCalendarDate("2025-06-15", { frequency: "yearly" })).toBe("2026-06-15");
    expect(advanceCalendarDate("2025-01-01", { frequency: "custom", interval: { count: 10, unit: "day" } })).toBe("2025-01-11");
    expect(advanceCalendarDate("2025-01-31", { frequency: "custom", interval: { count: 2, unit: "month", anchorDay: 31 } })).toBe("2025-03-31");
  });

  it("advances repeatedly past a late paid-through date", () => {
    expect(advancePaymentAfterPaid(payment({ nextDueDate: "2025-01-01", recurrence: { frequency: "weekly" } }), "2025-02-01").nextDueDate).toBe("2025-02-05");
  });
});

describe("validation", () => {
  it.each(["2025-02-29", "2025-13-01", "not-a-date"])("rejects invalid date %s", (nextDueDate) => {
    expect(safeValidateRecurringPayment({ ...payment(), nextDueDate }).success).toBe(false);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid amount %s", (amount) => {
    expect(safeValidateRecurringPayment({ ...payment(), amount }).success).toBe(false);
  });
});

describe("queries", () => {
  const items = [
    payment({ id: "old", name: "Old hosting", nextDueDate: "2025-03-01", category: "Work", notes: "legacy server" }),
    payment({ id: "today", name: "Music", nextDueDate: "2025-03-10", category: "Fun" }),
    payment({ id: "week", name: "Gym", nextDueDate: "2025-03-17" }),
    payment({ id: "month", name: "Phone", nextDueDate: "2025-03-20" }),
    payment({ id: "beyond", name: "Domain", nextDueDate: "2025-04-01" }),
    payment({ id: "paused", name: "Paused", nextDueDate: "2025-03-11", status: "paused" }),
    payment({ id: "archived", name: "Archived", nextDueDate: "2025-03-11", status: "archived" })
  ];

  it("groups active upcoming payments and excludes paused/archived records", () => {
    const groups = groupUpcomingPayments(items, "2025-03-10");
    expect(Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.map(({ id }) => id)]))).toEqual({
      overdue: ["old"], today: ["today"], nextSevenDays: ["week"], laterThisMonth: ["month"], beyond: ["beyond"]
    });
  });

  it("searches text and filters category and status", () => {
    expect(filterPayments(items, { query: "LEGACY", categories: ["Work"], statuses: ["active"] }).map(({ id }) => id)).toEqual(["old"]);
    expect(filterPayments(items, { statuses: ["paused", "archived"] }).map(({ id }) => id)).toEqual(["paused", "archived"]);
  });

  it("keeps totals separate by currency and ignores inactive records", () => {
    const totals = currentPeriodTotals([
      payment({ id: "usd", amount: 100, currency: "USD", nextDueDate: "2025-03-01", recurrence: { frequency: "weekly" } }),
      payment({ id: "eur", amount: 250, currency: "EUR", nextDueDate: "2025-03-15" }),
      payment({ id: "off", amount: 900, currency: "USD", nextDueDate: "2025-03-01", status: "paused" })
    ], "2025-03-10");
    expect(totals.month).toEqual({ USD: 500, EUR: 250 });
    expect(totals.year).toEqual({ USD: 4400, EUR: 2500 });
  });

  it("rejects impossible calendar parsing", () => expect(() => parseCalendarDate("2025-04-31")).toThrow(RangeError));
});
