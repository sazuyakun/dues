import { backupPaymentSchema } from "./schema";
import type {
  BackupPayment,
  CalendarDate,
  CanonicalPayment,
  CanonicalRecurrence,
  Recurrence,
} from "./types";

const dateAnchor = (
  date: CalendarDate,
): { anchorDay: number; anchorMonth: number } => {
  const [, month, day] = date.split("-");
  return { anchorDay: Number(day), anchorMonth: Number(month) };
};

const toBackupRecurrence = (
  recurrence: CanonicalRecurrence,
  nextDueDate: CalendarDate,
): Recurrence => {
  const { anchorDay, anchorMonth } = dateAnchor(nextDueDate);
  switch (recurrence.frequency) {
    case "weekly":
      return { frequency: "weekly" };
    case "monthly":
    case "quarterly":
      return {
        frequency: recurrence.frequency,
        anchorDay: recurrence.anchorDay ?? anchorDay,
      };
    case "yearly":
      return {
        frequency: "yearly",
        anchorMonth: recurrence.anchorMonth ?? anchorMonth,
        anchorDay: recurrence.anchorDay ?? anchorDay,
      };
    case "custom": {
      const { interval } = recurrence;
      if (interval.unit === "day" || interval.unit === "week") {
        return {
          frequency: "custom",
          interval: { count: interval.count, unit: interval.unit },
        };
      }
      if (interval.unit === "month") {
        return {
          frequency: "custom",
          interval: {
            count: interval.count,
            unit: "month",
            anchorDay: interval.anchorDay ?? anchorDay,
          },
        };
      }
      return {
        frequency: "custom",
        interval: {
          count: interval.count,
          unit: "year",
          anchorMonth: interval.anchorMonth ?? anchorMonth,
          anchorDay: interval.anchorDay ?? anchorDay,
        },
      };
    }
  }
};

const copyBackupRecurrence = (recurrence: Recurrence): Recurrence => {
  if (recurrence.frequency !== "custom") return { ...recurrence };
  return { ...recurrence, interval: { ...recurrence.interval } };
};

const projectPayment = (payment: CanonicalPayment): BackupPayment => ({
  id: payment.id,
  name: payment.name,
  amount: payment.amount,
  currency: payment.currency,
  recurrence: toBackupRecurrence(payment.recurrence, payment.nextDueDate),
  nextDueDate: payment.nextDueDate,
  status: payment.status,
  ...(payment.category === undefined ? {} : { category: payment.category }),
  ...(payment.paymentMethodLabel === undefined
    ? {}
    : { paymentMethodLabel: payment.paymentMethodLabel }),
  ...(payment.freeTrialEndDate === undefined
    ? {}
    : { freeTrialEndDate: payment.freeTrialEndDate }),
  ...(payment.notes === undefined ? {} : { notes: payment.notes }),
  ...(payment.providerUrl === undefined
    ? {}
    : { providerUrl: payment.providerUrl }),
  ...(payment.reminderLeadDays === undefined
    ? {}
    : { reminderLeadDays: payment.reminderLeadDays }),
});

const copyBackupPayment = (payment: BackupPayment): BackupPayment => ({
  ...projectPayment(payment),
  recurrence: copyBackupRecurrence(payment.recurrence),
});

const parsePayment = (payment: BackupPayment): BackupPayment => {
  const result = backupPaymentSchema.safeParse(payment);
  if (!result.success) throw new TypeError("Payment is not backup-compatible");
  return result.data as BackupPayment;
};

/**
 * Projects a canonical payment onto the portable wire fields. Persistence-only
 * properties on structurally compatible records are intentionally discarded.
 */
export const toBackupPayment = (payment: CanonicalPayment): BackupPayment =>
  parsePayment(projectPayment(payment));

/**
 * Returns a detached canonical value from a validated portable record. Storage
 * metadata is assigned by the application service when this value is imported.
 */
export const fromBackupPayment = (payment: BackupPayment): CanonicalPayment =>
  parsePayment(copyBackupPayment(payment));
