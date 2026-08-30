import { z } from "zod";

import { currencyCodeSchema } from "./currencies";

export const PAYMENT_FIELD_LIMITS = {
  id: 200,
  name: 500,
  category: 200,
  paymentMethodLabel: 200,
  notes: 10_000,
  providerUrl: 2_048,
  reminderLeadDays: 3_650,
  customIntervalCount: 3_650,
} as const;

export type PaymentId = string;
export type CalendarDate = `${number}-${number}-${number}`;
export type MinorUnitAmount = number;
export type PaymentStatus = "active" | "paused" | "archived";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const calendarDaysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
};

export const isCalendarDate = (value: string): value is CalendarDate => {
  if (!calendarDatePattern.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= calendarDaysInMonth(year, month);
};

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "Invalid calendar date")
  .transform((value) => value as CalendarDate);

export const paymentIdSchema = z
  .string()
  .min(1)
  .max(PAYMENT_FIELD_LIMITS.id)
  .refine(
    (value) => value.trim() === value,
    "Payment ID must not start or end with whitespace",
  );

const visibleTextSchema = (field: string, maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine(
      (value) => value.trim().length > 0,
      `${field} must contain visible text`,
    );

const optionalVisibleTextSchema = (field: string, maximum: number) =>
  visibleTextSchema(field, maximum).optional();

export const isSafeProviderUrl = (value: string): boolean => {
  if (value.trim() !== value) return false;

  try {
    const url = new URL(value);
    if (url.username !== "" || url.password !== "") return false;
    if (url.protocol === "https:") return true;

    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
};

export const providerUrlSchema = z
  .string()
  .max(PAYMENT_FIELD_LIMITS.providerUrl)
  .refine(
    isSafeProviderUrl,
    "Expected an HTTPS URL without embedded credentials",
  );

const anchorDaySchema = z.number().int().min(1).max(31);
const anchorMonthSchema = z.number().int().min(1).max(12);
const intervalCountSchema = z
  .number()
  .int()
  .min(1)
  .max(PAYMENT_FIELD_LIMITS.customIntervalCount);

const customIntervalInputSchema = z.discriminatedUnion("unit", [
  z.object({ count: intervalCountSchema, unit: z.literal("day") }).strict(),
  z.object({ count: intervalCountSchema, unit: z.literal("week") }).strict(),
  z
    .object({
      count: intervalCountSchema,
      unit: z.literal("month"),
      anchorDay: anchorDaySchema.optional(),
    })
    .strict(),
  z
    .object({
      count: intervalCountSchema,
      unit: z.literal("year"),
      anchorDay: anchorDaySchema.optional(),
      anchorMonth: anchorMonthSchema.optional(),
    })
    .strict(),
]);

const customIntervalSchema = z.discriminatedUnion("unit", [
  z.object({ count: intervalCountSchema, unit: z.literal("day") }).strict(),
  z.object({ count: intervalCountSchema, unit: z.literal("week") }).strict(),
  z
    .object({
      count: intervalCountSchema,
      unit: z.literal("month"),
      anchorDay: anchorDaySchema,
    })
    .strict(),
  z
    .object({
      count: intervalCountSchema,
      unit: z.literal("year"),
      anchorDay: anchorDaySchema,
      anchorMonth: anchorMonthSchema,
    })
    .strict(),
]);

/** User-facing recurrence input. Calendar anchors may be derived from a due date. */
export const recurrenceInputSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("weekly") }).strict(),
  z
    .object({
      frequency: z.literal("monthly"),
      anchorDay: anchorDaySchema.optional(),
    })
    .strict(),
  z
    .object({
      frequency: z.literal("quarterly"),
      anchorDay: anchorDaySchema.optional(),
    })
    .strict(),
  z
    .object({
      frequency: z.literal("yearly"),
      anchorMonth: anchorMonthSchema.optional(),
      anchorDay: anchorDaySchema.optional(),
    })
    .strict(),
  z
    .object({
      frequency: z.literal("custom"),
      interval: customIntervalInputSchema,
    })
    .strict(),
]);

/** Canonical recurrence stored in records and exchanged between packages. */
export const recurrenceSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("weekly") }).strict(),
  z
    .object({ frequency: z.literal("monthly"), anchorDay: anchorDaySchema })
    .strict(),
  z
    .object({ frequency: z.literal("quarterly"), anchorDay: anchorDaySchema })
    .strict(),
  z
    .object({
      frequency: z.literal("yearly"),
      anchorMonth: anchorMonthSchema,
      anchorDay: anchorDaySchema,
    })
    .strict(),
  z
    .object({
      frequency: z.literal("custom"),
      interval: customIntervalSchema,
    })
    .strict(),
]);

export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;

const paymentDetailsInputSchema = z
  .object({
    name: visibleTextSchema("Name", PAYMENT_FIELD_LIMITS.name),
    amount: z.number().int().nonnegative().safe(),
    currency: currencyCodeSchema,
    recurrence: recurrenceInputSchema,
    nextDueDate: calendarDateSchema,
    status: z.enum(["active", "paused", "archived"]),
    category: optionalVisibleTextSchema(
      "Category",
      PAYMENT_FIELD_LIMITS.category,
    ),
    paymentMethodLabel: optionalVisibleTextSchema(
      "Payment method label",
      PAYMENT_FIELD_LIMITS.paymentMethodLabel,
    ),
    freeTrialEndDate: calendarDateSchema.optional(),
    notes: z.string().max(PAYMENT_FIELD_LIMITS.notes).optional(),
    providerUrl: providerUrlSchema.optional(),
    reminderLeadDays: z
      .number()
      .int()
      .nonnegative()
      .max(PAYMENT_FIELD_LIMITS.reminderLeadDays)
      .optional(),
  })
  .strict();

const canonicalPaymentDetailsSchema = paymentDetailsInputSchema.extend({
  recurrence: recurrenceSchema,
});

const normalizeRecurrence = (
  recurrence: RecurrenceInput,
  nextDueDate: CalendarDate,
): Recurrence => {
  const [, monthText, dayText] = nextDueDate.split("-");
  const anchorDay = Number(dayText);
  const anchorMonth = Number(monthText);

  switch (recurrence.frequency) {
    case "weekly":
      return recurrence;
    case "monthly":
    case "quarterly":
      return {
        ...recurrence,
        anchorDay: recurrence.anchorDay ?? anchorDay,
      };
    case "yearly":
      return {
        ...recurrence,
        anchorDay: recurrence.anchorDay ?? anchorDay,
        anchorMonth: recurrence.anchorMonth ?? anchorMonth,
      };
    case "custom": {
      const { interval } = recurrence;
      if (interval.unit === "day" || interval.unit === "week") {
        return { frequency: "custom", interval };
      }
      if (interval.unit === "month") {
        return {
          ...recurrence,
          interval: {
            ...interval,
            anchorDay: interval.anchorDay ?? anchorDay,
          },
        };
      }
      return {
        ...recurrence,
        interval: {
          ...interval,
          anchorDay: interval.anchorDay ?? anchorDay,
          anchorMonth: interval.anchorMonth ?? anchorMonth,
        },
      };
    }
  }
};

const normalizePaymentDetails = <
  T extends { recurrence: RecurrenceInput; nextDueDate: CalendarDate },
>(
  payment: T,
): Omit<T, "recurrence"> & { recurrence: Recurrence } => ({
  ...payment,
  recurrence: normalizeRecurrence(payment.recurrence, payment.nextDueDate),
});

/** Complete input used when creating a payment before a service assigns its ID. */
export const newPaymentInputSchema = paymentDetailsInputSchema
  .transform(normalizePaymentDetails)
  .pipe(canonicalPaymentDetailsSchema);

/**
 * Partial editable fields. Services merge a validated patch with the current
 * record and pass the result through recurringPaymentSchema.
 */
export const paymentChangesSchema = paymentDetailsInputSchema
  .partial()
  .refine(
    (changes) => Object.keys(changes).length > 0,
    "At least one payment change is required",
  );

const recurringPaymentInputSchema = paymentDetailsInputSchema.extend({
  id: paymentIdSchema,
});

const canonicalRecurringPaymentSchema = canonicalPaymentDetailsSchema.extend({
  id: paymentIdSchema,
});

export const recurringPaymentSchema = recurringPaymentInputSchema
  .transform(normalizePaymentDetails)
  .pipe(canonicalRecurringPaymentSchema);

export type NewPaymentInput = z.input<typeof newPaymentInputSchema>;
export type ValidatedNewPaymentInput = z.output<typeof newPaymentInputSchema>;
export type PaymentChanges = z.input<typeof paymentChangesSchema>;
export type ValidatedPaymentChanges = z.output<typeof paymentChangesSchema>;
export type RecurringPaymentInput = z.input<typeof recurringPaymentSchema>;
export type RecurringPayment = z.infer<typeof recurringPaymentSchema>;

export const validateNewPaymentInput = (
  input: unknown,
): ValidatedNewPaymentInput => newPaymentInputSchema.parse(input);

export const safeValidateNewPaymentInput = (
  input: unknown,
): z.SafeParseReturnType<unknown, ValidatedNewPaymentInput> =>
  newPaymentInputSchema.safeParse(input);

export const validatePaymentChanges = (
  input: unknown,
): ValidatedPaymentChanges => paymentChangesSchema.parse(input);

export const safeValidatePaymentChanges = (
  input: unknown,
): z.SafeParseReturnType<unknown, ValidatedPaymentChanges> =>
  paymentChangesSchema.safeParse(input);

export const validateRecurringPayment = (input: unknown): RecurringPayment =>
  recurringPaymentSchema.parse(input);

export const safeValidateRecurringPayment = (
  input: unknown,
): z.SafeParseReturnType<unknown, RecurringPayment> =>
  recurringPaymentSchema.safeParse(input);

export const applyPaymentChanges = (
  payment: RecurringPayment,
  changes: PaymentChanges,
): RecurringPayment =>
  validateRecurringPayment({
    ...payment,
    ...validatePaymentChanges(changes),
  });
