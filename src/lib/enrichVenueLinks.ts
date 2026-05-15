import type { VenueCategory } from "@/lib/venues";

export type ResolvedVenueLinks = {
  bookingUrl?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  sourceLabel?: string;
};

function hasPlacesApiKey(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

function categoryQueryHint(category: VenueCategory): string {
  if (category === "eat") return "restaurant";
  if (category === "do") return "activity attraction";
  return "lodging hotel cabin resort campground";
}

function buildMapsSearchUrl(title: string, locationTitle: string): string {
  const q = locationTitle ? `${title}, ${locationTitle}` : title;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function hostnameLabel(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || undefined;
  } catch {
    return undefined;
  }
}

async function resolveViaGooglePlaces(
  title: string,
  category: VenueCategory,
  locationTitle: string,
): Promise<ResolvedVenueLinks | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  const hint = categoryQueryHint(category);
  const textQuery = [title, hint, locationTitle].filter(Boolean).join(" ");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.googleMapsUri,places.websiteUri,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery, languageCode: "en", maxResultCount: 1 }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    places?: {
      displayName?: { text?: string };
      googleMapsUri?: string;
      websiteUri?: string;
    }[];
  };

  const place = data.places?.[0];
  if (!place) return null;

  const websiteUri = place.websiteUri?.trim() || undefined;
  const googleMapsUri = place.googleMapsUri?.trim() || undefined;

  return {
    mapsUrl: googleMapsUri ?? buildMapsSearchUrl(title, locationTitle),
    websiteUrl: websiteUri,
    bookingUrl: websiteUri ?? googleMapsUri,
    sourceLabel: websiteUri
      ? hostnameLabel(websiteUri) ?? "Website"
      : googleMapsUri
        ? "Google Maps"
        : undefined,
  };
}

/** Fill booking/map/website links when missing (Google Places if configured, else Maps search). */
export async function resolveVenueLinks(
  title: string,
  category: VenueCategory,
  locationTitle: string,
): Promise<ResolvedVenueLinks> {
  const trimmedTitle = title.trim();
  const trimmedLocation = locationTitle.trim();

  try {
    const fromPlaces = await resolveViaGooglePlaces(
      trimmedTitle,
      category,
      trimmedLocation,
    );
    if (fromPlaces) return fromPlaces;
  } catch {
    // fall through to search URLs
  }

  const mapsUrl = buildMapsSearchUrl(trimmedTitle, trimmedLocation);
  return {
    mapsUrl,
    bookingUrl: mapsUrl,
    sourceLabel: "Google Maps",
  };
}

export function mergeResolvedLinks(
  existing: {
    bookingUrl?: string;
    mapsUrl?: string;
    websiteUrl?: string;
    sourceLabel?: string;
  },
  resolved: ResolvedVenueLinks,
): ResolvedVenueLinks {
  const bookingUrl = existing.bookingUrl ?? resolved.bookingUrl;
  const websiteUrl = existing.websiteUrl ?? resolved.websiteUrl;
  return {
    mapsUrl: existing.mapsUrl ?? resolved.mapsUrl,
    websiteUrl,
    bookingUrl: bookingUrl ?? websiteUrl ?? resolved.bookingUrl,
    sourceLabel: existing.sourceLabel ?? resolved.sourceLabel,
  };
}
