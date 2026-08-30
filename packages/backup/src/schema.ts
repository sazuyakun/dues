import { z } from "zod";
import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION } from "./types";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD calendar date").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined || year < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Must be a real calendar date");

const providerUrl = z.string().url("Must be a valid URL").refine((value) => {
  const url = new URL(value);
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}, "Must use HTTPS (HTTP is allowed only for localhost development)");

const recurrenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("weekly") }).strict(),
  z.object({ type: z.literal("monthly") }).strict(),
  z.object({ type: z.literal("quarterly") }).strict(),
  z.object({ type: z.literal("yearly") }).strict(),
  z.object({
    type: z.literal("custom"),
    interval: z.number().int().safe().positive(),
    unit: z.enum(["days", "weeks", "months", "years"]),
  }).strict(),
]);

export const backupPaymentSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().min(1).max(500),
  amount: z.number().int().safe().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Must be a three-letter uppercase ISO 4217 code"),
  recurrence: recurrenceSchema,
  nextDueDate: calendarDate,
  status: z.enum(["active", "paused", "archived"]),
  category: z.string().max(200).optional(),
  paymentMethodLabel: z.string().max(200).optional(),
  freeTrialEndDate: calendarDate.optional(),
  notes: z.string().max(10_000).optional(),
  providerUrl: providerUrl.optional(),
  reminderLeadDays: z.number().int().safe().nonnegative().max(3650).optional(),
}).strict();

export const envelopeHeaderSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(CURRENT_BACKUP_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  payments: z.array(z.unknown()),
}).strict();
