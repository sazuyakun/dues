import {
  addDays,
  compareCalendarDates,
  currentPeriodTotals,
  groupUpcomingPayments,
  type CalendarDate,
  type CurrencyTotals,
  type UpcomingGroup,
} from "@dues/core";
import type { PaymentRecord } from "../../app/index";

export interface UpcomingSection {
  readonly key: UpcomingGroup;
  readonly eyebrow: string;
  readonly title: string;
}

export const UPCOMING_SECTIONS: readonly UpcomingSection[] = [
  { key: "overdue", eyebrow: "Action needed", title: "Overdue" },
  { key: "today", eyebrow: "Due now", title: "Today" },
  {
    key: "nextSevenDays",
    eyebrow: "Coming up",
    title: "Next seven days",
  },
  {
    key: "laterThisMonth",
    eyebrow: "This cycle",
    title: "Later this month",
  },
  { key: "beyond", eyebrow: "On the horizon", title: "Beyond" },
];

export type UpcomingRecordGroups = Record<UpcomingGroup, PaymentRecord[]>;

export interface UpcomingViewModel {
  readonly groups: UpcomingRecordGroups;
  readonly totals: {
    readonly month: CurrencyTotals;
    readonly year: CurrencyTotals;
  };
  readonly reminderIds: ReadonlySet<string>;
  readonly activeCount: number;
  readonly upcomingCount: number;
}

function reminderEndDate(today: CalendarDate, leadDays: number): CalendarDate {
  try {
    return addDays(today, leadDays);
  } catch (error) {
    if (error instanceof RangeError) return "9999-12-31";
    throw error;
  }
}

export function createUpcomingViewModel(
  records: readonly PaymentRecord[],
  today: CalendarDate,
): UpcomingViewModel {
  const grouped = groupUpcomingPayments(records, today);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const recordsFor = (key: UpcomingGroup): PaymentRecord[] =>
    grouped[key].map((payment) => {
      const record = recordsById.get(payment.id);
      if (record === undefined) {
        throw new Error("Grouped payment is missing from its source set");
      }
      return record;
    });
  const groups: UpcomingRecordGroups = {
    overdue: recordsFor("overdue"),
    today: recordsFor("today"),
    nextSevenDays: recordsFor("nextSevenDays"),
    laterThisMonth: recordsFor("laterThisMonth"),
    beyond: recordsFor("beyond"),
  };
  const reminderIds = new Set<string>();

  for (const payment of records) {
    if (
      payment.status !== "active" ||
      payment.reminderLeadDays === undefined ||
      compareCalendarDates(payment.nextDueDate, today) < 0
    ) {
      continue;
    }
    if (
      compareCalendarDates(
        payment.nextDueDate,
        reminderEndDate(today, payment.reminderLeadDays),
      ) <= 0
    ) {
      reminderIds.add(payment.id);
    }
  }

  const activeCount = records.filter(
    ({ status }) => status === "active",
  ).length;
  return {
    groups,
    totals: currentPeriodTotals(records, today),
    reminderIds,
    activeCount,
    upcomingCount: Object.values(groups).reduce(
      (count, payments) => count + payments.length,
      0,
    ),
  };
}

export function formatMinorUnitAmount(
  amount: number,
  currency: string,
  locale?: string,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** fractionDigits);
}

export function recurrenceLabel(payment: PaymentRecord): string {
  const { recurrence } = payment;
  if (recurrence.frequency !== "custom") return recurrence.frequency;
  const { count, unit } = recurrence.interval;
  return `every ${count} ${unit}${count === 1 ? "" : "s"}`;
}
