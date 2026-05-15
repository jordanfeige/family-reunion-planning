/** Format an instant in the viewer's local timezone (12-hour clock). */
export function formatDateTimeLocal(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

/** Date only in the viewer's locale (no time). */
export function formatDateLocal(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Convert stored 24h time strings (e.g. "14:30") to 12-hour labels ("2:30 PM"). */
export function formatTimeOfDay(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/\b(am|pm)\b/i.test(s)) return s;

  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return s;

  const hour = Number.parseInt(match[1], 10);
  const minute = match[2];
  if (hour < 0 || hour > 23) return s;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

/** Value for `<input type="datetime-local" />` in the user's local timezone. */
export function dateToDatetimeLocalInputValue(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
