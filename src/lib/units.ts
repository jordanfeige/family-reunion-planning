/** United States display formatting — route all user-facing units through here. */

export const US_STATE_ABBR: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

const STATE_NAME_BY_ABBR = Object.fromEntries(
  Object.entries(US_STATE_ABBR).map(([name, abbr]) => [abbr, name]),
) as Record<string, string>;

export function abbreviateState(state: string): string {
  const trimmed = state.trim();
  if (!trimmed) return "";
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return US_STATE_ABBR[trimmed] ?? trimmed;
}

export function formatMiles(mi: number, opts?: { long?: boolean }): string {
  const n = Math.round(mi);
  if (opts?.long) {
    return `${n} ${n === 1 ? "mile" : "miles"}`;
  }
  return `${n} mi`;
}

/**
 * Drive time with named origin. Returns "" when minutes is undefined —
 * callers must render nothing rather than a placeholder.
 */
export function formatDriveTime(
  minutes: number | undefined,
  from?: string,
): string {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes < 0) {
    return "";
  }
  const total = Math.round(minutes);
  const hr = Math.floor(total / 60);
  const min = total % 60;
  let core: string;
  if (hr === 0) {
    core = `${min} min`;
  } else if (min === 0) {
    core = `${hr} hr`;
  } else {
    core = `${hr} hr ${min} min`;
  }
  if (!from?.trim()) return core;
  return `${core} from ${from.trim()}`;
}

export function formatFahrenheit(f: number): string {
  return `${Math.round(f)}°F`;
}

export function formatUsd(
  amount: number,
  opts?: { perLabel?: string },
): string {
  const abs = Math.abs(amount);
  const rounded =
    abs < 10 && abs !== Math.floor(abs)
      ? amount.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : `$${Math.round(amount).toLocaleString("en-US")}`;
  if (opts?.perLabel) {
    return `${rounded} ${opts.perLabel}`;
  }
  return rounded;
}

export function formatUsdRange(low: number, high: number): string {
  return `${formatUsd(low)} – ${formatUsd(high)}`;
}

export function formatDateNumericUS(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

/** Weekday, Mon D — e.g. Fri, Jul 17 */
export function formatDateProseUS(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateRangeUS(start: Date, end: Date): string {
  return `${formatDateNumericUS(start)} – ${formatDateNumericUS(end)}`;
}

export function formatCityState(city: string, state: string): string {
  const c = city.trim();
  const st = abbreviateState(state);
  if (!c) return st;
  if (!st) return c;
  return `${c}, ${st}`;
}

export function stateNameFromAbbr(abbr: string): string | undefined {
  return STATE_NAME_BY_ABBR[abbr.trim().toUpperCase()];
}
