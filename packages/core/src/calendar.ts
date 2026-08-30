import type { CalendarDate } from "./model";
import { isCalendarDate } from "./model";

export interface CalendarDateParts { year: number; month: number; day: number }

export const parseCalendarDate = (value: string): CalendarDateParts => {
  if (!isCalendarDate(value)) throw new RangeError(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
};

export const formatCalendarDate = ({ year, month, day }: CalendarDateParts): CalendarDate => {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isCalendarDate(value)) throw new RangeError(`Invalid calendar date parts: ${value}`);
  return value;
};

export const compareCalendarDates = (left: CalendarDate, right: CalendarDate): number => left < right ? -1 : left > right ? 1 : 0;

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const addDays = (date: CalendarDate, days: number): CalendarDate => {
  if (!Number.isSafeInteger(days)) throw new RangeError("Days must be a safe integer");
  const { year, month, day } = parseCalendarDate(date);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return formatCalendarDate({ year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() });
};

export const addAnchoredMonths = (date: CalendarDate, months: number, anchorDay: number): CalendarDate => {
  if (!Number.isSafeInteger(months) || !Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) throw new RangeError("Invalid month interval or anchor day");
  const parts = parseCalendarDate(date);
  const monthIndex = parts.year * 12 + parts.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  return formatCalendarDate({ year, month, day: Math.min(anchorDay, daysInMonth(year, month)) });
};
