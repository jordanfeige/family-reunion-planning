import { getPlaceCache, setPlaceCache } from "@/lib/lodging/cache";

export type NearbyPlace = {
  name: string;
  category: string;
  distanceLabel?: string;
};

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

/**
 * Nearby POIs via Foursquare Places (preferred) or Mapbox Search.
 * Never invents venues — empty array when keys missing / fail.
 */
export async function getNearbyPlaces(input: {
  lat: number;
  lng: number;
  areaLabel: string;
}): Promise<NearbyPlace[]> {
  const key = `nearby:v1:${input.lat.toFixed(3)},${input.lng.toFixed(3)}`;
  const cached = await getPlaceCache(key);
  if (cached?.payload && Array.isArray(cached.payload)) {
    return cached.payload as NearbyPlace[];
  }

  const fsKey = process.env.FOURSQUARE_API_KEY?.trim();
  if (fsKey) {
    try {
      const url = new URL("https://api.foursquare.com/v3/places/search");
      url.searchParams.set("ll", `${input.lat},${input.lng}`);
      url.searchParams.set("radius", "8000");
      url.searchParams.set("limit", "6");
      url.searchParams.set(
        "categories",
        "13065,16032,16019,10027", // dining, park, beach, museum-ish
      );
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: fsKey,
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          results?: Array<{
            name?: string;
            categories?: Array<{ name?: string }>;
            distance?: number;
          }>;
        };
        const places: NearbyPlace[] = (json.results ?? [])
          .map((r) => ({
            name: String(r.name ?? "").trim(),
            category: String(r.categories?.[0]?.name ?? "Place").trim(),
            distanceLabel:
              typeof r.distance === "number"
                ? r.distance < 1000
                  ? `${r.distance} m`
                  : `${(r.distance / 1609.34).toFixed(1)} mi`
                : undefined,
          }))
          .filter((p) => p.name);
        if (places.length > 0) {
          await setPlaceCache(key, places, TTL_MS);
          return places;
        }
      }
    } catch {
      /* fall through */
    }
  }

  const mapbox = process.env.MAPBOX_TOKEN?.trim();
  if (mapbox) {
    try {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          "park,restaurant,museum",
        )}.json`,
      );
      url.searchParams.set("proximity", `${input.lng},${input.lat}`);
      url.searchParams.set("limit", "6");
      url.searchParams.set("types", "poi");
      url.searchParams.set("access_token", mapbox);
      const res = await fetch(url.toString(), { next: { revalidate: 0 } });
      if (res.ok) {
        const json = (await res.json()) as {
          features?: Array<{
            text?: string;
            place_name?: string;
            properties?: { category?: string };
          }>;
        };
        const places: NearbyPlace[] = (json.features ?? [])
          .map((f) => ({
            name: String(f.text ?? f.place_name ?? "").trim(),
            category: String(f.properties?.category ?? "Nearby").trim(),
          }))
          .filter((p) => p.name);
        if (places.length > 0) {
          await setPlaceCache(key, places, TTL_MS);
          return places;
        }
      }
    } catch {
      /* empty */
    }
  }

  await setPlaceCache(key, [], Math.min(TTL_MS, 6 * 60 * 60 * 1000));
  return [];
}
