import { getDriveCache, setDriveCache } from "@/lib/lodging/cache";
import { geocodeArea } from "@/lib/lodging/geocode";

export type DriveLeg = {
  fromLabel: string;
  minutes: number | null;
  miles: number | null;
  gasUsd: number | null;
};

const GAS_USD_PER_MILE = 0.18; // rough group-car estimate

function pairKey(a: string, b: string): string {
  const [x, y] = [a.trim().toLowerCase(), b.trim().toLowerCase()].sort();
  return `drive:v1:${x}|${y}`;
}

/**
 * Mapbox Matrix drive time between origin city and destination area.
 * Permanent city-pair cache. Returns null minutes when unresolved (omit UI).
 */
export async function getDriveTime(input: {
  fromCity: string;
  toArea: string;
  toLat?: number;
  toLng?: number;
}): Promise<DriveLeg> {
  const fromLabel = input.fromCity.trim();
  const toLabel = input.toArea.trim();
  if (!fromLabel || !toLabel) {
    return { fromLabel, minutes: null, miles: null, gasUsd: null };
  }

  const key = pairKey(fromLabel, toLabel);
  const cached = await getDriveCache(key);
  if (cached) {
    const miles =
      cached.meters != null ? cached.meters / 1609.34 : null;
    return {
      fromLabel,
      minutes: cached.minutes,
      miles: miles != null ? Math.round(miles) : null,
      gasUsd:
        miles != null ? Math.round(miles * GAS_USD_PER_MILE) : null,
    };
  }

  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token) {
    return { fromLabel, minutes: null, miles: null, gasUsd: null };
  }

  try {
    const from = await geocodeArea(fromLabel);
    let toLat = input.toLat;
    let toLng = input.toLng;
    if (toLat == null || toLng == null) {
      const to = await geocodeArea(toLabel);
      if (!to) return { fromLabel, minutes: null, miles: null, gasUsd: null };
      toLat = to.lat;
      toLng = to.lng;
    }
    if (!from || toLat == null || toLng == null) {
      return { fromLabel, minutes: null, miles: null, gasUsd: null };
    }

    const coords = `${from.lng},${from.lat};${toLng},${toLat}`;
    const url = new URL(
      `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}`,
    );
    url.searchParams.set("annotations", "duration,distance");
    url.searchParams.set("access_token", token);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) {
      return { fromLabel, minutes: null, miles: null, gasUsd: null };
    }
    const json = (await res.json()) as {
      durations?: (number | null)[][];
      distances?: (number | null)[][];
    };
    const seconds = json.durations?.[0]?.[1];
    const meters = json.distances?.[0]?.[1];
    if (seconds == null || !Number.isFinite(seconds)) {
      return { fromLabel, minutes: null, miles: null, gasUsd: null };
    }
    const minutes = Math.round(seconds / 60);
    await setDriveCache(
      key,
      minutes,
      meters != null && Number.isFinite(meters) ? meters : undefined,
    );
    const miles =
      meters != null && Number.isFinite(meters) ? meters / 1609.34 : null;
    return {
      fromLabel,
      minutes,
      miles: miles != null ? Math.round(miles) : null,
      gasUsd: miles != null ? Math.round(miles * GAS_USD_PER_MILE) : null,
    };
  } catch {
    return { fromLabel, minutes: null, miles: null, gasUsd: null };
  }
}

export function formatDriveMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
