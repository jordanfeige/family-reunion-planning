import { getPlaceCache, setPlaceCache } from "@/lib/lodging/cache";
import type { ResolvedPlace } from "@/lib/resolvedPlace";

const IMAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type PlaceImageSource = "commons" | "osm" | "unsplash" | "none";

export type PlaceImage = {
  url: string | null;
  source: PlaceImageSource;
  artist: string | null;
  license: string | null;
  attributionUrl: string | null;
  photographer: string | null;
  profileUrl: string | null;
};

const EMPTY_IMAGE: PlaceImage = {
  url: null,
  source: "none",
  artist: null,
  license: null,
  attributionUrl: null,
  photographer: null,
  profileUrl: null,
};

function cacheKey(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => String(p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

const ACCEPTABLE_LICENSES = [
  "cc0",
  "public domain",
  "pd",
  "cc by",
  "cc-by",
  "cc by-sa",
  "cc-by-sa",
];

function licenseOk(short: string): boolean {
  const s = short.toLowerCase().replace(/_/g, " ");
  return ACCEPTABLE_LICENSES.some((l) => s.includes(l));
}

function looksLikePhoto(filename: string, objectName: string): boolean {
  const hay = `${filename} ${objectName}`.toLowerCase();
  if (
    /\b(map|diagram|logo|coat of arms|svg|icon|flag|seal|chart|schematic)\b/.test(
      hay,
    )
  ) {
    return false;
  }
  return /\.(jpe?g|png|webp)$/i.test(filename) || !/\.svg$/i.test(filename);
}

type CommonsHit = {
  url: string;
  artist: string | null;
  license: string | null;
  descriptionUrl: string | null;
};

async function fetchCommonsBySearch(query: string): Promise<CommonsHit | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|size");
  url.searchParams.set("iiurlwidth", "1200");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "WandrAI/1.0 (family-reunion-planning)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: {
              url?: string;
              thumburl?: string;
              width?: number;
              descriptionurl?: string;
              extmetadata?: Record<
                string,
                { value?: string }
              >;
            }[];
          }
        >;
      };
    };
    const pages = Object.values(json.query?.pages ?? {});
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const width = info.width ?? 0;
      if (width < 800) continue;
      const meta = info.extmetadata ?? {};
      const license =
        meta.LicenseShortName?.value?.replace(/<[^>]+>/g, "").trim() ||
        meta.License?.value?.replace(/<[^>]+>/g, "").trim() ||
        "";
      if (!licenseOk(license)) continue;
      const objectName =
        meta.ObjectName?.value?.replace(/<[^>]+>/g, "").trim() || "";
      const title = page.title ?? "";
      if (!looksLikePhoto(title, objectName)) continue;
      const imgUrl = info.thumburl || info.url;
      if (!imgUrl) continue;
      const artist =
        meta.Artist?.value?.replace(/<[^>]+>/g, "").trim() ||
        meta.Credit?.value?.replace(/<[^>]+>/g, "").trim() ||
        null;
      return {
        url: imgUrl,
        artist,
        license: license || null,
        descriptionUrl: info.descriptionurl ?? null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchCommonsFile(fileTitle: string): Promise<CommonsHit | null> {
  const title = fileTitle.startsWith("File:")
    ? fileTitle
    : `File:${fileTitle.replace(/^Category:/, "")}`;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|size");
  url.searchParams.set("iiurlwidth", "1200");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "WandrAI/1.0 (family-reunion-planning)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: {
              url?: string;
              thumburl?: string;
              width?: number;
              descriptionurl?: string;
              extmetadata?: Record<string, { value?: string }>;
            }[];
          }
        >;
      };
    };
    const page = Object.values(json.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!info || (info.width ?? 0) < 400) return null;
    const meta = info.extmetadata ?? {};
    const license =
      meta.LicenseShortName?.value?.replace(/<[^>]+>/g, "").trim() || null;
    const artist =
      meta.Artist?.value?.replace(/<[^>]+>/g, "").trim() || null;
    return {
      url: info.thumburl || info.url || "",
      artist,
      license,
      descriptionUrl: info.descriptionurl ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchUnsplash(query: string): Promise<PlaceImage | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return null;
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: {
        urls?: { regular?: string };
        user?: { name?: string; links?: { html?: string } };
        links?: { html?: string };
      }[];
    };
    const hit = json.results?.[0];
    const img = hit?.urls?.regular;
    if (!img) return null;
    return {
      url: img,
      source: "unsplash",
      artist: null,
      license: null,
      attributionUrl: hit.links?.html ?? null,
      photographer: hit.user?.name ?? null,
      profileUrl: hit.user?.links?.html ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * §14 cascade: OSM tag → Wikimedia Commons → Unsplash (activities only) → letter block.
 * Fetch ONCE when the row is persisted; cache the result.
 */
export async function resolvePlaceImage(opts: {
  place?: ResolvedPlace | null;
  imageQuery: string;
  /** Named place → Commons/OSM only. Activity/stay-home → Unsplash allowed. */
  isNamedPlace: boolean;
  cacheId?: string;
}): Promise<PlaceImage> {
  const key = cacheKey([
    "place-img-v1",
    opts.cacheId,
    opts.place?.sourceId,
    opts.imageQuery,
    opts.isNamedPlace ? "named" : "activity",
  ]);
  const cached = await getPlaceCache(key);
  if (cached?.payload && typeof cached.payload === "object") {
    const p = cached.payload as PlaceImage;
    if (p.source) return p;
  }

  let result: PlaceImage = { ...EMPTY_IMAGE };

  // 1) OSM image / wikimedia_commons tags (most accurate for named places)
  if (opts.place?.osmImage?.startsWith("http")) {
    result = {
      ...EMPTY_IMAGE,
      url: opts.place.osmImage,
      source: "osm",
    };
  } else if (opts.place?.osmWikimediaCommons) {
    const hit = await fetchCommonsFile(opts.place.osmWikimediaCommons);
    if (hit?.url) {
      result = {
        url: hit.url,
        source: "commons",
        artist: hit.artist,
        license: hit.license,
        attributionUrl: hit.descriptionUrl,
        photographer: null,
        profileUrl: null,
      };
    }
  }

  // 2) Wikimedia Commons search by resolved name + locality (or Wikidata)
  if (!result.url && opts.isNamedPlace && opts.place) {
    const search =
      opts.place.wikidata != null
        ? `haswbstatement:P180=${opts.place.wikidata}`
        : `${opts.place.name} ${opts.place.locality}`.trim();
    const hit = await fetchCommonsBySearch(search);
    if (hit?.url) {
      result = {
        url: hit.url,
        source: "commons",
        artist: hit.artist,
        license: hit.license,
        attributionUrl: hit.descriptionUrl,
        photographer: null,
        profileUrl: null,
      };
    } else if (opts.place.name) {
      const hit2 = await fetchCommonsBySearch(opts.place.name);
      if (hit2?.url) {
        result = {
          url: hit2.url,
          source: "commons",
          artist: hit2.artist,
          license: hit2.license,
          attributionUrl: hit2.descriptionUrl,
          photographer: null,
          profileUrl: null,
        };
      }
    }
  }

  // 3) Unsplash — activities / stay-home ONLY, never named places
  if (!result.url && !opts.isNamedPlace) {
    const unsplash = await fetchUnsplash(opts.imageQuery);
    if (unsplash) result = unsplash;
  }

  // Assert: named place must never be Unsplash
  if (opts.isNamedPlace && result.source === "unsplash") {
    result = { ...EMPTY_IMAGE };
  }

  await setPlaceCache(key, result, IMAGE_CACHE_TTL_MS);
  return result;
}

/** Attribution line for SoftImage footer. */
export function imageAttributionText(img: PlaceImage): string | null {
  if (!img.url) return null;
  if (img.source === "commons" && (img.artist || img.license)) {
    return [img.artist, img.license].filter(Boolean).join(" · ");
  }
  if (img.source === "unsplash" && img.photographer) {
    return `${img.photographer} · Unsplash`;
  }
  if (img.source === "osm") return "OpenStreetMap";
  return null;
}
