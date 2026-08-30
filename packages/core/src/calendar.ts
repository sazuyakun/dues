import type { CalendarDate } from "./model";
import { isCalendarDate } from "./model";

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

export const parseCalendarDate = (value: string): CalendarDateParts => {
  if (!isCalendarDate(value))
    throw new RangeError(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
};

export const formatCalendarDate = ({
  year,
  month,
  day,
}: CalendarDateParts): CalendarDate => {
  const formattedYear = String(year).padStart(4, "0");
  const formattedMonth = String(month).padStart(2, "0");
  const formattedDay = String(day).padStart(2, "0");
  const value = `${formattedYear}-${formattedMonth}-${formattedDay}`;
  if (!isCalendarDate(value))
    throw new RangeError(`Invalid calendar date parts: ${value}`);
  return value;
};

export const compareCalendarDates = (
  left: CalendarDate,
  right: CalendarDate,
): number => {
  parseCalendarDate(left);
  parseCalendarDate(right);
  return left < right ? -1 : left > right ? 1 : 0;
};

export const daysInMonth = (year: number, month: number): number => {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new RangeError("Year must be an integer from 1 through 9999");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Month must be an integer from 1 through 12");
  }
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
};

export const addDays = (date: CalendarDate, days: number): CalendarDate => {
  if (!Number.isSafeInteger(days))
    throw new RangeError("Days must be a safe integer");
  const { year, month, day } = parseCalendarDate(date);
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCDate(result.getUTCDate() + days);
  return formatCalendarDate({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  });
};

export const addAnchoredMonths = (
  date: CalendarDate,
  months: number,
  anchorDay: number,
): CalendarDate => {
  if (
    !Number.isSafeInteger(months) ||
    !Number.isInteger(anchorDay) ||
    anchorDay < 1 ||
    anchorDay > 31
  ) {
    throw new RangeError("Invalid month interval or anchor day");
  }
  const parts = parseCalendarDate(date);
  const monthIndex = parts.year * 12 + parts.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = (((monthIndex % 12) + 12) % 12) + 1;
  return formatCalendarDate({
    year,
    month,
    day: Math.min(anchorDay, daysInMonth(year, month)),
  });
};
