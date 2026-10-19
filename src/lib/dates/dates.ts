/**
 * PocketPlan Date & Period Utilities
 * Timezone: Asia/Kolkata (IST, UTC+05:30)
 * Locale: en-IN
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_LOCALE = "en-IN";

/**
 * Returns today's date formatted as YYYY-MM-DD in the given timezone (default Asia/Kolkata).
 */
export function getTodayDateString(timeZone = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/**
 * Returns the current year-month string formatted as YYYY-MM in the given timezone.
 */
export function getCurrentMonthKey(timeZone = DEFAULT_TIMEZONE): string {
  const today = getTodayDateString(timeZone);
  return today.slice(0, 7);
}

/**
 * Parses YYYY-MM-DD into components { year, month, day } (1-indexed month)
 */
export function parseDateComponents(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/**
 * Formats YYYY-MM-DD into friendly Indian English format:
 * e.g. "19 Oct 2026" or "19 October 2026"
 */
export function formatDateReadable(
  dateStr: string,
  options: { includeWeekday?: boolean; monthStyle?: "short" | "long" } = {}
): string {
  const { year, month, day } = parseDateComponents(dateStr);
  const dateObj = new Date(Date.UTC(year, month - 1, day));

  const formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: "UTC", // Use UTC since we created from explicit Y/M/D
    day: "numeric",
    month: options.monthStyle || "short",
    year: "numeric",
    weekday: options.includeWeekday ? "short" : undefined,
  });

  return formatter.format(dateObj);
}

/**
 * Returns the number of days in a specific year and month (1-indexed month).
 */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of next month is the last day of the target month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calculates the exact occurrence date for a recurring due day (e.g. 31st of month)
 * for a specific year and month (1-indexed).
 * If the month has fewer days than desiredDueDay (e.g. Feb has 28 or 29 days, Apr has 30),
 * it clamps to the last day of that month.
 */
export function getMonthOccurrenceDate(year: number, month: number, desiredDueDay: number): string {
  const daysInMonth = getDaysInMonth(year, month);
  const actualDay = Math.min(Math.max(desiredDueDay, 1), daysInMonth);

  const mm = month.toString().padStart(2, "0");
  const dd = actualDay.toString().padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Computes period boundaries (startDate, endDate in YYYY-MM-DD) for standard intervals.
 */
export type PeriodType = "today" | "this-week" | "this-month" | "this-year" | "custom";

export function getPeriodBoundaries(
  periodType: PeriodType,
  options: {
    referenceDate?: string; // YYYY-MM-DD
    customStart?: string;
    customEnd?: string;
    timeZone?: string;
  } = {}
): { startDate: string; endDate: string; label: string } {
  const tz = options.timeZone || DEFAULT_TIMEZONE;
  const todayStr = options.referenceDate || getTodayDateString(tz);
  const { year, month, day } = parseDateComponents(todayStr);

  switch (periodType) {
    case "today":
      return {
        startDate: todayStr,
        endDate: todayStr,
        label: formatDateReadable(todayStr),
      };

    case "this-week": {
      // Week starting Monday (ISO week)
      const d = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayDate = new Date(Date.UTC(year, month - 1, day + diffToMonday));
      const sundayDate = new Date(Date.UTC(year, month - 1, day + diffToMonday + 6));

      const start = mondayDate.toISOString().slice(0, 10);
      const end = sundayDate.toISOString().slice(0, 10);
      return {
        startDate: start,
        endDate: end,
        label: `${formatDateReadable(start)} – ${formatDateReadable(end)}`,
      };
    }

    case "this-month": {
      const daysInMonth = getDaysInMonth(year, month);
      const mm = month.toString().padStart(2, "0");
      const start = `${year}-${mm}-01`;
      const end = `${year}-${mm}-${daysInMonth.toString().padStart(2, "0")}`;
      const monthName = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month - 1, 1)));

      return {
        startDate: start,
        endDate: end,
        label: monthName,
      };
    }

    case "this-year": {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        label: `${year}`,
      };
    }

    case "custom": {
      const start = options.customStart || todayStr;
      const end = options.customEnd || todayStr;
      return {
        startDate: start,
        endDate: end,
        label: `${formatDateReadable(start)} – ${formatDateReadable(end)}`,
      };
    }
  }
}

/**
 * Checks if a given date string falls within [startDate, endDate] inclusive.
 */
export function isDateInPeriod(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate;
}

/**
 * Advances or decrements a YYYY-MM key by N months.
 */
export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split("-");
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) + deltaMonths;

  while (month > 12) {
    year += 1;
    month -= 12;
  }
  while (month < 1) {
    year -= 1;
    month += 12;
  }

  return `${year}-${month.toString().padStart(2, "0")}`;
}
