import { getPlaceCache, setPlaceCache } from "@/lib/lodging/cache";
import type { BrowseCategory } from "@/lib/browseIdeas";

const PHOTO_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAPBOX_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type PhotoCachePayload = { imageUrl: string; source: "places" | "mapbox" };

function cacheKey(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => String(p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function hasPlacesKey(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

function hasMapboxToken(): boolean {
  return Boolean(process.env.MAPBOX_TOKEN?.trim());
}

async function fetchPlacesPhotoUrl(opts: {
  placeName: string;
  lat?: number | null;
  lng?: number | null;
  areaLabel?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  const textQuery = [opts.placeName, opts.areaLabel].filter(Boolean).join(" near ");
  const body: Record<string, unknown> = {
    textQuery,
    languageCode: "en",
    maxResultCount: 1,
  };
  if (
    opts.lat != null &&
    opts.lng != null &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng)
  ) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: 48000,
      },
    };
  }

  const searchRes = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.photos.name,places.displayName",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!searchRes.ok) return null;

  const searchJson = (await searchRes.json()) as {
    places?: { photos?: { name?: string }[] }[];
  };
  const photoName = searchJson.places?.[0]?.photos?.[0]?.name?.trim();
  if (!photoName) return null;

  const mediaUrl = new URL(
    `https://places.googleapis.com/v1/${photoName}/media`,
  );
  mediaUrl.searchParams.set("maxHeightPx", "480");
  mediaUrl.searchParams.set("maxWidthPx", "720");
  mediaUrl.searchParams.set("skipHttpRedirect", "true");
  mediaUrl.searchParams.set("key", apiKey);

  const mediaRes = await fetch(mediaUrl.toString(), {
    signal: AbortSignal.timeout(8000),
  });
  if (!mediaRes.ok) return null;

  const mediaJson = (await mediaRes.json()) as { photoUri?: string };
  const photoUri = mediaJson.photoUri?.trim();
  return photoUri || null;
}

function mapboxStaticUrl(lat: number, lng: number): string | null {
  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token) return null;
  // Local vignette — light street style, no markers, no inventing destinations.
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${lng},${lat},11.5,0/640x400@2x?access_token=${token}`;
}

/**
 * Image pipeline for Browse cards:
 * 1. Google Places Photo when idea has a resolvable place near the user
 * 2. Mapbox Static of the user area (activity / no venue)
 * 3. null → letter-block (SoftImage fallback)
 *
 * Never invents Unsplash/pollinations URLs.
 */
export async function resolveBrowseIdeaImage(opts: {
  title: string;
  category: BrowseCategory;
  placeName?: string | null;
  lat?: number | null;
  lng?: number | null;
  areaLabel?: string | null;
}): Promise<string | null> {
  const placeName = opts.placeName?.trim() || null;
  const hasCoords =
    opts.lat != null &&
    opts.lng != null &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng);

  // 1) Places photo for a named venue
  if (placeName && hasPlacesKey()) {
    const key = cacheKey([
      "browse-img-places",
      placeName,
      opts.areaLabel,
      opts.lat?.toFixed(2),
      opts.lng?.toFixed(2),
    ]);
    const cached = await getPlaceCache(key);
    if (cached?.payload && typeof cached.payload === "object") {
      const payload = cached.payload as PhotoCachePayload;
      if (payload.imageUrl) return payload.imageUrl;
    }
    try {
      const url = await fetchPlacesPhotoUrl({
        placeName,
        lat: opts.lat,
        lng: opts.lng,
        areaLabel: opts.areaLabel,
      });
      if (url) {
        await setPlaceCache(
          key,
          { imageUrl: url, source: "places" } satisfies PhotoCachePayload,
          PHOTO_CACHE_TTL_MS,
        );
        return url;
      }
    } catch {
      /* fall through */
    }
  }

  // 2) Mapbox local vignette for activity / no venue (or Places miss)
  if (hasCoords && hasMapboxToken()) {
    const key = cacheKey([
      "browse-img-mapbox",
      opts.lat!.toFixed(3),
      opts.lng!.toFixed(3),
    ]);
    const cached = await getPlaceCache(key);
    if (cached?.payload && typeof cached.payload === "object") {
      const payload = cached.payload as PhotoCachePayload;
      if (payload.imageUrl) return payload.imageUrl;
    }
    const url = mapboxStaticUrl(opts.lat!, opts.lng!);
    if (url) {
      await setPlaceCache(
        key,
        { imageUrl: url, source: "mapbox" } satisfies PhotoCachePayload,
        MAPBOX_CACHE_TTL_MS,
      );
      return url;
    }
  }

  // 3) Letter-block
  return null;
}

export async function attachBrowseImages<
  T extends {
    title: string;
    category: BrowseCategory;
    placeName?: string | null;
    imageUrl?: string | null;
  },
>(
  ideas: T[],
  location: {
    lat?: number | null;
    lng?: number | null;
    areaLabel?: string | null;
  },
): Promise<(T & { imageUrl: string | null })[]> {
  const settled = await Promise.all(
    ideas.map(async (idea) => {
      if (idea.imageUrl) return { ...idea, imageUrl: idea.imageUrl };
      const imageUrl = await resolveBrowseIdeaImage({
        title: idea.title,
        category: idea.category,
        placeName: idea.placeName,
        lat: location.lat,
        lng: location.lng,
        areaLabel: location.areaLabel,
      });
      return { ...idea, imageUrl };
    }),
  );
  return settled;
}
