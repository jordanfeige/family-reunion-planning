import { fridayIsoFromDate, parseFridayIso } from "@/lib/weekends";

/** Fri check-in → Mon check-out (3 nights). Falls back to generic 3-night window. */
export function weekendStayDates(fridayIso: string | null | undefined): {
  checkIn: string;
  checkOut: string;
  nights: number;
  month: number;
} {
  const fri = fridayIso ? parseFridayIso(fridayIso) : null;
  if (!fri) {
    const start = new Date();
    start.setDate(start.getDate() + ((5 - start.getDay() + 7) % 7 || 7));
    const checkIn = fridayIsoFromDate(start);
    const end = new Date(start);
    end.setDate(end.getDate() + 3);
    return {
      checkIn,
      checkOut: fridayIsoFromDate(end),
      nights: 3,
      month: start.getMonth() + 1,
    };
  }
  const mon = new Date(fri);
  mon.setDate(mon.getDate() + 3);
  return {
    checkIn: fridayIso!,
    checkOut: fridayIsoFromDate(mon),
    nights: 3,
    month: fri.getMonth() + 1,
  };
}
