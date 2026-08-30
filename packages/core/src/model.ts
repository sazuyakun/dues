import { z } from "zod";

export type PaymentId = string;
export type CalendarDate = `${number}-${number}-${number}`;
export type MinorUnitAmount = number;
export type PaymentStatus = "active" | "paused" | "archived";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoCurrencyPattern = /^[A-Z]{3}$/;

export const isCalendarDate = (value: string): value is CalendarDate => {
  if (!calendarDatePattern.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const calendarDateSchema = z.string().refine(isCalendarDate, "Invalid calendar date").transform((value) => value as CalendarDate);

const anchorDaySchema = z.number().int().min(1).max(31).optional();

export const recurrenceSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("weekly") }).strict(),
  z.object({ frequency: z.literal("monthly"), anchorDay: anchorDaySchema }).strict(),
  z.object({ frequency: z.literal("quarterly"), anchorDay: anchorDaySchema }).strict(),
  z.object({ frequency: z.literal("yearly"), anchorMonth: z.number().int().min(1).max(12).optional(), anchorDay: anchorDaySchema }).strict(),
  z.object({
    frequency: z.literal("custom"),
    interval: z.object({
      count: z.number().int().min(1).max(3650),
      unit: z.enum(["day", "week", "month", "year"]),
      anchorDay: anchorDaySchema,
      anchorMonth: z.number().int().min(1).max(12).optional()
    }).strict()
  }).strict()
]);

export type Recurrence = z.infer<typeof recurrenceSchema>;

const recurringPaymentInputSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  amount: z.number().int().nonnegative().safe(),
  currency: z.string().regex(isoCurrencyPattern, "Expected an uppercase ISO 4217 currency code"),
  recurrence: recurrenceSchema,
  nextDueDate: calendarDateSchema,
  status: z.enum(["active", "paused", "archived"]),
  category: z.string().trim().min(1).max(100).optional(),
  paymentMethodLabel: z.string().trim().min(1).max(100).optional(),
  freeTrialEndDate: calendarDateSchema.optional(),
  notes: z.string().max(10_000).optional(),
  providerUrl: z.string().url().max(2_048).optional(),
  reminderLeadDays: z.number().int().nonnegative().max(3650).optional()
}).strict();

export const recurringPaymentSchema = recurringPaymentInputSchema.transform((payment) => {
  const [, monthText, dayText] = payment.nextDueDate.split("-");
  const anchorDay = Number(dayText);
  const anchorMonth = Number(monthText);
  const recurrence = payment.recurrence;
  if (recurrence.frequency === "monthly" || recurrence.frequency === "quarterly") {
    return { ...payment, recurrence: { ...recurrence, anchorDay: recurrence.anchorDay ?? anchorDay } };
  }
  if (recurrence.frequency === "yearly") {
    return { ...payment, recurrence: { ...recurrence, anchorDay: recurrence.anchorDay ?? anchorDay, anchorMonth: recurrence.anchorMonth ?? anchorMonth } };
  }
  if (recurrence.frequency === "custom" && (recurrence.interval.unit === "month" || recurrence.interval.unit === "year")) {
    return { ...payment, recurrence: { ...recurrence, interval: { ...recurrence.interval, anchorDay: recurrence.interval.anchorDay ?? anchorDay, anchorMonth: recurrence.interval.anchorMonth ?? anchorMonth } } };
  }
  return payment;
});

export type RecurringPayment = z.infer<typeof recurringPaymentSchema>;

export const validateRecurringPayment = (input: unknown): RecurringPayment => recurringPaymentSchema.parse(input);

export const safeValidateRecurringPayment = (input: unknown): z.SafeParseReturnType<unknown, RecurringPayment> => recurringPaymentSchema.safeParse(input);
