import { z } from "zod";
import { isIso4217CurrencyCode } from "./currencies";
import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION } from "./types";

const isCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
};

const calendarDate = z
  .string()
  .refine(isCalendarDate, "Must be a real YYYY-MM-DD calendar date");

const isSafeProviderUrl = (value: string): boolean => {
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

const providerUrl = z
  .string()
  .max(2_048)
  .refine(
    isSafeProviderUrl,
    "Must be an HTTPS URL without embedded credentials (HTTP is allowed only for localhost development)",
  );

const anchorDay = z.number().int().min(1).max(31);
const anchorMonth = z.number().int().min(1).max(12);
const intervalCount = z.number().int().safe().min(1).max(3650);

const customIntervalSchema = z.discriminatedUnion("unit", [
  z.object({ count: intervalCount, unit: z.literal("day") }).strict(),
  z.object({ count: intervalCount, unit: z.literal("week") }).strict(),
  z
    .object({
      count: intervalCount,
      unit: z.literal("month"),
      anchorDay,
    })
    .strict(),
  z
    .object({
      count: intervalCount,
      unit: z.literal("year"),
      anchorMonth,
      anchorDay,
    })
    .strict(),
]);

const recurrenceSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("weekly") }).strict(),
  z.object({ frequency: z.literal("monthly"), anchorDay }).strict(),
  z.object({ frequency: z.literal("quarterly"), anchorDay }).strict(),
  z
    .object({
      frequency: z.literal("yearly"),
      anchorMonth,
      anchorDay,
    })
    .strict(),
  z
    .object({
      frequency: z.literal("custom"),
      interval: customIntervalSchema,
    })
    .strict(),
]);

const requiredVisibleText = (maximumLength: number) =>
  z
    .string()
    .min(1)
    .max(maximumLength)
    .refine((value) => value.trim().length > 0, "Must contain visible text");

export const backupPaymentSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(200)
      .refine(
        (value) => value.trim() === value,
        "Must not start or end with whitespace",
      ),
    name: requiredVisibleText(500),
    amount: z.number().int().safe().nonnegative(),
    currency: z
      .string()
      .refine(isIso4217CurrencyCode, "Must be a recognized ISO 4217 code"),
    recurrence: recurrenceSchema,
    nextDueDate: calendarDate,
    status: z.enum(["active", "paused", "archived"]),
    category: requiredVisibleText(200).optional(),
    paymentMethodLabel: requiredVisibleText(200).optional(),
    freeTrialEndDate: calendarDate.optional(),
    notes: z.string().max(10_000).optional(),
    providerUrl: providerUrl.optional(),
    reminderLeadDays: z
      .number()
      .int()
      .safe()
      .nonnegative()
      .max(3650)
      .optional(),
  })
  .strict();

export const envelopeHeaderSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(CURRENT_BACKUP_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    payments: z.array(z.unknown()),
  })
  .strict();
