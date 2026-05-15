const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse YYYY-MM-DD as a local calendar date (noon avoids DST edge cases). */
export function parseFridayIso(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function fridayIsoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isFriday(iso: string): boolean {
  const d = parseFridayIso(iso);
  return d !== null && d.getDay() === 5;
}

export function isValidFridayIso(iso: string): boolean {
  return isFriday(iso);
}

export function sundayFromFriday(fridayIso: string): Date | null {
  const fri = parseFridayIso(fridayIso);
  if (!fri || fri.getDay() !== 5) return null;
  const sun = new Date(fri);
  sun.setDate(sun.getDate() + 2);
  return sun;
}

export function formatWeekendLabel(fridayIso: string): string {
  const fri = parseFridayIso(fridayIso);
  if (!fri) return fridayIso;
  const sun = sundayFromFriday(fridayIso);
  if (!sun) return fridayIso;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  const year =
    fri.getFullYear() === sun.getFullYear()
      ? String(fri.getFullYear())
      : `${fri.getFullYear()}–${sun.getFullYear()}`;
  return `Weekend of ${fmt(fri)} – ${fmt(sun)}, ${year}`;
}

export function filterValidFridays(slots: string[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const slot of slots) {
    const trimmed = slot.trim();
    if (!isValidFridayIso(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    valid.push(trimmed);
  }
  return valid.sort();
}

export function parseProposedWeekends(raw: string): string[] {
  if (!raw.trim()) return [];
  return filterValidFridays(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
