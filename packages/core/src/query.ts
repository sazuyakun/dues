import { addDays, compareCalendarDates, formatCalendarDate, parseCalendarDate } from "./calendar";
import type { CalendarDate, PaymentStatus, RecurringPayment } from "./model";
import { occurrencesBetween } from "./schedule";

export type UpcomingGroup = "overdue" | "today" | "nextSevenDays" | "laterThisMonth" | "beyond";
export type GroupedUpcoming = Record<UpcomingGroup, RecurringPayment[]>;

export const groupUpcomingPayments = (payments: readonly RecurringPayment[], today: CalendarDate): GroupedUpcoming => {
  const result: GroupedUpcoming = { overdue: [], today: [], nextSevenDays: [], laterThisMonth: [], beyond: [] };
  const sevenDaysLater = addDays(today, 7);
  const { year, month } = parseCalendarDate(today);
  const monthEnd = month === 12 ? formatCalendarDate({ year: year + 1, month: 1, day: 1 }) : formatCalendarDate({ year, month: month + 1, day: 1 });
  for (const payment of payments.filter(({ status }) => status === "active").sort((a, b) => compareCalendarDates(a.nextDueDate, b.nextDueDate) || a.name.localeCompare(b.name))) {
    const due = payment.nextDueDate;
    if (compareCalendarDates(due, today) < 0) result.overdue.push(payment);
    else if (due === today) result.today.push(payment);
    else if (compareCalendarDates(due, sevenDaysLater) <= 0) result.nextSevenDays.push(payment);
    else if (compareCalendarDates(due, monthEnd) < 0) result.laterThisMonth.push(payment);
    else result.beyond.push(payment);
  }
  return result;
};

export interface PaymentFilters { query?: string; categories?: readonly string[]; statuses?: readonly PaymentStatus[] }

export const filterPayments = (payments: readonly RecurringPayment[], filters: PaymentFilters): RecurringPayment[] => {
  const query = filters.query?.trim().toLocaleLowerCase();
  const categories = filters.categories && new Set(filters.categories);
  const statuses = filters.statuses && new Set(filters.statuses);
  return payments.filter((payment) => {
    const searchable = [payment.name, payment.category, payment.paymentMethodLabel, payment.notes].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query)) && (!categories || categories.has(payment.category ?? "")) && (!statuses || statuses.has(payment.status));
  });
};

export type CurrencyTotals = Readonly<Record<string, number>>;

export const totalsBetween = (payments: readonly RecurringPayment[], start: CalendarDate, end: CalendarDate): CurrencyTotals => {
  const totals: Record<string, number> = {};
  for (const payment of payments) {
    for (const _occurrence of occurrencesBetween(payment, start, end)) {
      const total = (totals[payment.currency] ?? 0) + payment.amount;
      if (!Number.isSafeInteger(total)) throw new RangeError(`Total for ${payment.currency} exceeds the safe integer range`);
      totals[payment.currency] = total;
    }
  }
  return totals;
};

export const currentPeriodTotals = (payments: readonly RecurringPayment[], today: CalendarDate): { month: CurrencyTotals; year: CurrencyTotals } => {
  const { year, month } = parseCalendarDate(today);
  const monthStart = formatCalendarDate({ year, month, day: 1 });
  const monthEnd = addDays(month === 12 ? formatCalendarDate({ year: year + 1, month: 1, day: 1 }) : formatCalendarDate({ year, month: month + 1, day: 1 }), -1);
  return {
    month: totalsBetween(payments, monthStart, monthEnd),
    year: totalsBetween(payments, formatCalendarDate({ year, month: 1, day: 1 }), formatCalendarDate({ year, month: 12, day: 31 }))
  };
};
