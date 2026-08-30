import {
  addAnchoredMonths,
  addDays,
  compareCalendarDates,
  daysInMonth,
  formatCalendarDate,
  parseCalendarDate,
} from "./calendar";
import type { CalendarDate, Recurrence, RecurringPayment } from "./model";

const calendarAnchor = (
  recurrence: Recurrence,
  date: CalendarDate,
): { day: number; month?: number } => {
  const parts = parseCalendarDate(date);
  if (
    recurrence.frequency === "monthly" ||
    recurrence.frequency === "quarterly"
  ) {
    return { day: recurrence.anchorDay ?? parts.day };
  }
  if (recurrence.frequency === "yearly") {
    return {
      day: recurrence.anchorDay ?? parts.day,
      month: recurrence.anchorMonth ?? parts.month,
    };
  }
  if (
    recurrence.frequency === "custom" &&
    recurrence.interval.unit === "month"
  ) {
    return { day: recurrence.interval.anchorDay ?? parts.day };
  }
  if (
    recurrence.frequency === "custom" &&
    recurrence.interval.unit === "year"
  ) {
    return {
      day: recurrence.interval.anchorDay ?? parts.day,
      month: recurrence.interval.anchorMonth ?? parts.month,
    };
  }
  return { day: parts.day };
};

export const advanceCalendarDate = (
  date: CalendarDate,
  recurrence: Recurrence,
  steps = 1,
): CalendarDate => {
  if (!Number.isSafeInteger(steps) || steps < 1) {
    throw new RangeError("Steps must be a positive safe integer");
  }
  const anchor = calendarAnchor(recurrence, date);
  switch (recurrence.frequency) {
    case "weekly":
      return addDays(date, 7 * steps);
    case "monthly":
      return addAnchoredMonths(date, steps, anchor.day);
    case "quarterly":
      return addAnchoredMonths(date, 3 * steps, anchor.day);
    case "yearly": {
      const { year } = parseCalendarDate(date);
      const targetYear = year + steps;
      const month = anchor.month!;
      return formatCalendarDate({
        year: targetYear,
        month,
        day: Math.min(anchor.day, daysInMonth(targetYear, month)),
      });
    }
    case "custom": {
      const { count, unit } = recurrence.interval;
      if (unit === "day") return addDays(date, count * steps);
      if (unit === "week") return addDays(date, count * steps * 7);
      if (unit === "month")
        return addAnchoredMonths(date, count * steps, anchor.day);
      const { year } = parseCalendarDate(date);
      const targetYear = year + count * steps;
      const month = anchor.month!;
      return formatCalendarDate({
        year: targetYear,
        month,
        day: Math.min(anchor.day, daysInMonth(targetYear, month)),
      });
    }
  }
};

export const advancePaymentAfterPaid = (
  payment: RecurringPayment,
  paidThrough: CalendarDate = payment.nextDueDate,
): RecurringPayment => {
  if (payment.status !== "active") return payment;
  let nextDueDate = payment.nextDueDate;
  do nextDueDate = advanceCalendarDate(nextDueDate, payment.recurrence);
  while (compareCalendarDates(nextDueDate, paidThrough) <= 0);
  return { ...payment, nextDueDate };
};

export function* occurrencesBetween(
  payment: RecurringPayment,
  start: CalendarDate,
  end: CalendarDate,
): Generator<CalendarDate> {
  if (payment.status !== "active" || compareCalendarDates(start, end) > 0)
    return;
  let occurrence = payment.nextDueDate;
  let guard = 0;

  const advanceOccurrence = (): CalendarDate | undefined => {
    try {
      return advanceCalendarDate(occurrence, payment.recurrence);
    } catch (error) {
      if (error instanceof RangeError) return undefined;
      throw error;
    }
  };

  while (compareCalendarDates(occurrence, start) < 0) {
    const nextOccurrence = advanceOccurrence();
    if (!nextOccurrence) return;
    occurrence = nextOccurrence;
    if (++guard > 1_000_000)
      throw new RangeError("Schedule range is too large");
  }
  while (compareCalendarDates(occurrence, end) <= 0) {
    yield occurrence;
    const nextOccurrence = advanceOccurrence();
    if (!nextOccurrence) return;
    occurrence = nextOccurrence;
    if (++guard > 1_000_000)
      throw new RangeError("Schedule range is too large");
  }
}
