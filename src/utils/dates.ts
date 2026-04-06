import { DATE_FORMAT_REGEX } from '../constants.js';

export function validateDateRange(startDate: string, endDate: string): string | null {
  if (!DATE_FORMAT_REGEX.test(startDate)) {
    return `Invalid start_date "${startDate}". Expected format: YYYY-MM-DD`;
  }
  if (!DATE_FORMAT_REGEX.test(endDate)) {
    return `Invalid end_date "${endDate}". Expected format: YYYY-MM-DD`;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return `Invalid start_date "${startDate}". Not a valid date.`;
  }
  if (isNaN(end.getTime())) {
    return `Invalid end_date "${endDate}". Not a valid date.`;
  }

  if (start > end) {
    return `start_date (${startDate}) is after end_date (${endDate})`;
  }

  return null;
}

export function todayYMD(): string {
  const now = new Date();
  return pad(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function firstOfCurrentMonth(): string {
  const now = new Date();
  return pad(now.getFullYear(), now.getMonth() + 1, 1);
}

export function toDateString(date: Date): string {
  return pad(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function pad(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
