import type {
  ApplicationEnvironment,
  CalendarDate,
  PaymentId,
} from "../app/index";

function localCalendarDate(date: Date): CalendarDate {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as CalendarDate;
}

export function createBrowserEnvironment(): ApplicationEnvironment {
  return {
    currentDate: () => localCalendarDate(new Date()),
    now: () => new Date(),
    createId: () => {
      if (typeof globalThis.crypto?.randomUUID !== "function") {
        throw new Error("Secure UUID generation is unavailable");
      }
      return globalThis.crypto.randomUUID() as PaymentId;
    },
  };
}
