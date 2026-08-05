/**
 * Viewer-relative and group drive-time helpers.
 * Never invent minutes — callers supply measured/estimated values.
 * Never guess a city when origin resolution fails.
 */

import { formatCityState, formatDriveTime } from "@/lib/units";

export type HomePlace = {
  city?: string | null;
  state?: string | null;
};

export type ResolvedOrigin = {
  /** Short label for formatDriveTime(..., from) — e.g. "Sioux Falls" or "your place" */
  fromLabel: string;
  /** Display place "City, ST" when known */
  placeLabel: string | null;
  source: "viewer_home" | "survey" | "trip_origin";
};

function placeFromHome(home: HomePlace | null | undefined): string | null {
  if (!home) return null;
  const city = home.city?.trim() ?? "";
  const state = home.state?.trim() ?? "";
  if (!city && !state) return null;
  return formatCityState(city, state);
}

export function cityOnly(place: string): string {
  const idx = place.indexOf(",");
  return (idx === -1 ? place : place.slice(0, idx)).trim();
}

/**
 * Resolution order:
 * viewer saved home → viewer survey answer → trip origin_metro → null (hide metric).
 */
export function resolveDriveOrigin(opts: {
  viewerHome?: HomePlace | null;
  surveyHome?: HomePlace | null;
  tripOriginMetro?: string | null;
  /** When true and origin is the viewer's home, fromLabel becomes "your place". */
  useYourPlaceLabel?: boolean;
}): ResolvedOrigin | null {
  const viewerPlace = placeFromHome(opts.viewerHome);
  if (viewerPlace) {
    return {
      fromLabel: opts.useYourPlaceLabel !== false ? "your place" : cityOnly(viewerPlace),
      placeLabel: viewerPlace,
      source: "viewer_home",
    };
  }

  const surveyPlace = placeFromHome(opts.surveyHome);
  if (surveyPlace) {
    return {
      fromLabel: cityOnly(surveyPlace),
      placeLabel: surveyPlace,
      source: "survey",
    };
  }

  const trip = opts.tripOriginMetro?.trim() ?? "";
  if (trip) {
    return {
      fromLabel: cityOnly(trip),
      placeLabel: trip.includes(",") ? trip : trip,
      source: "trip_origin",
    };
  }

  return null;
}

/** Format a single drive time with resolved origin, or "" if minutes/origin missing. */
export function formatResolvedDriveTime(
  minutes: number | undefined,
  origin: ResolvedOrigin | null,
): string {
  if (!origin) return "";
  return formatDriveTime(minutes, origin.fromLabel);
}

export type HouseholdDrive = {
  householdLabel: string;
  homeCity?: string | null;
  homeState?: string | null;
  /** Minutes from that household's home to the destination; omit if flying or unknown. */
  driveMinutes?: number | null;
  flying?: boolean;
};

export type GroupDriveSummary = {
  averageMinutes: number | null;
  averageLabel: string;
  farthest: {
    householdLabel: string;
    placeLabel: string;
    minutes: number;
    label: string;
  } | null;
  flyingCount: number;
  drivingCount: number;
  householdLines: string[];
};

/**
 * Group metrics for Decision / shortlist once survey homes exist.
 * Flying households are excluded from average/farthest.
 */
export function summarizeGroupDriveTimes(
  households: HouseholdDrive[],
): GroupDriveSummary {
  const flying = households.filter((h) => h.flying);
  const driving = households.filter(
    (h) =>
      !h.flying &&
      h.driveMinutes != null &&
      Number.isFinite(h.driveMinutes) &&
      (h.driveMinutes as number) >= 0,
  );

  const averageMinutes =
    driving.length === 0
      ? null
      : Math.round(
          driving.reduce((sum, h) => sum + (h.driveMinutes as number), 0) /
            driving.length,
        );

  let farthest: GroupDriveSummary["farthest"] = null;
  for (const h of driving) {
    const mins = h.driveMinutes as number;
    if (!farthest || mins > farthest.minutes) {
      const placeLabel = formatCityState(h.homeCity ?? "", h.homeState ?? "");
      farthest = {
        householdLabel: h.householdLabel,
        placeLabel: placeLabel || h.householdLabel,
        minutes: mins,
        label: `Farthest household · ${formatDriveTime(mins)}${placeLabel ? ` (${placeLabel})` : ""}`,
      };
    }
  }

  const averageLabel =
    averageMinutes == null
      ? ""
      : `Average drive · ${formatDriveTime(averageMinutes)} across ${driving.length} household${driving.length === 1 ? "" : "s"}`;

  const householdLines = households.map((h) => {
    const place = formatCityState(h.homeCity ?? "", h.homeState ?? "");
    if (h.flying) {
      return `${h.householdLabel}${place ? ` · ${place}` : ""} · flying`;
    }
    if (h.driveMinutes == null || !Number.isFinite(h.driveMinutes)) {
      return `${h.householdLabel}${place ? ` · ${place}` : ""}`;
    }
    return `${h.householdLabel}${place ? ` · ${place}` : ""} · ${formatDriveTime(h.driveMinutes)}`;
  });

  return {
    averageMinutes,
    averageLabel,
    farthest,
    flyingCount: flying.length,
    drivingCount: driving.length,
    householdLines,
  };
}

export function formatFlyingHouseholds(
  count: number,
  nearestAirportCode?: string | null,
): string {
  if (count <= 0) return "";
  const base = `Flying · ${count} household${count === 1 ? "" : "s"}`;
  const code = nearestAirportCode?.trim().toUpperCase();
  if (code && code.length === 3) {
    return `${base}, nearest airport ${code}`;
  }
  return base;
}
