import { getPlaceCache, setPlaceCache } from "@/lib/lodging/cache";
import {
  bboxAround,
  bboxClause,
  elementCoords,
  haversineMiles,
  queryOverpass,
} from "@/lib/overpass";

export type NearbyPlace = {
  name: string;
  category: string;
  distanceLabel?: string;
};

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

function categoryForTags(tags: Record<string, string>): string {
  if (tags.shop === "supermarket") return "Supermarket";
  if (tags.tourism === "attraction") return "Attraction";
  if (tags.tourism === "museum") return "Museum";
  if (tags.amenity === "restaurant") return "Restaurant";
  return "Nearby";
}

function distanceLabel(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Nearby POIs via OpenStreetMap Overpass.
 * Never invents venues — empty array on failure.
 */
export async function getNearbyPlaces(input: {
  lat: number;
  lng: number;
  areaLabel: string;
}): Promise<NearbyPlace[]> {
  const key = `nearby:v2:${input.lat.toFixed(3)},${input.lng.toFixed(3)}`;
  const cached = await getPlaceCache(key);
  if (cached?.payload && Array.isArray(cached.payload)) {
    return cached.payload as NearbyPlace[];
  }

  const bbox = bboxAround(input.lat, input.lng);
  const box = bboxClause(bbox);
  const ql = `
[out:json][timeout:25];
(
  nwr["shop"="supermarket"]["name"](${box});
  nwr["tourism"="attraction"]["name"](${box});
  nwr["tourism"="museum"]["name"](${box});
  nwr["amenity"="restaurant"]["name"](${box});
);
out center tags;
`.trim();

  try {
    const { ok, elements } = await queryOverpass(ql);
    if (!ok) {
      await setPlaceCache(key, [], Math.min(TTL_MS, 6 * 60 * 60 * 1000));
      return [];
    }

    const scored: { place: NearbyPlace; miles: number }[] = [];
    const seen = new Set<string>();
    for (const el of elements) {
      const tags = el.tags ?? {};
      const name = String(tags.name ?? "").trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const coords = elementCoords(el);
      const miles = coords
        ? haversineMiles(input.lat, input.lng, coords.lat, coords.lng)
        : Number.POSITIVE_INFINITY;
      scored.push({
        miles,
        place: {
          name,
          category: categoryForTags(tags),
          distanceLabel: Number.isFinite(miles)
            ? distanceLabel(miles)
            : undefined,
        },
      });
    }

    scored.sort((a, b) => a.miles - b.miles);
    const limited = scored.slice(0, 8).map((s) => s.place);
    await setPlaceCache(key, limited, TTL_MS);
    return limited;
  } catch {
    await setPlaceCache(key, [], Math.min(TTL_MS, 6 * 60 * 60 * 1000));
    return [];
  }
}
