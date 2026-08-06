/** Shared Overpass API helpers (no API key). */

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** ~0.18° box ≈ 15–20 km around a point. */
export function bboxAround(
  lat: number,
  lng: number,
  halfDeg = 0.18,
): BBox {
  return {
    south: lat - halfDeg,
    west: lng - halfDeg,
    north: lat + halfDeg,
    east: lng + halfDeg,
  };
}

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function elementCoords(
  el: OverpassElement,
): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (
    typeof el.center?.lat === "number" &&
    typeof el.center?.lon === "number"
  ) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

export async function queryOverpass(
  ql: string,
): Promise<{ ok: boolean; elements: OverpassElement[] }> {
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(ql)}`,
      next: { revalidate: 0 },
    });
    if (!res.ok) return { ok: false, elements: [] };
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return { ok: true, elements: json.elements ?? [] };
  } catch {
    return { ok: false, elements: [] };
  }
}

export function bboxClause(bbox: BBox): string {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}
