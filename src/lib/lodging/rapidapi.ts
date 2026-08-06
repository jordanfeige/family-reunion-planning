import {
  amenityRowsFromCodes,
  normalizeAmenityStrings,
} from "@/lib/lodging/amenities";
import type { Lodging } from "@/lib/lodging/types";

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  const n = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return Math.max(1, n);
}

/** RapidAPI vacation-rental search. Host configurable via RAPIDAPI_LODGING_HOST. */
export async function fetchRapidApiRentals(input: {
  area: string;
  checkIn: string;
  checkOut: string;
  headcount: number;
  lat?: number;
  lng?: number;
}): Promise<{ ok: boolean; rateLimited?: boolean; properties: Lodging[] }> {
  const key = process.env.RAPIDAPI_KEY?.trim();
  const host =
    process.env.RAPIDAPI_LODGING_HOST?.trim() ||
    "airbnb19.p.rapidapi.com";
  if (!key) return { ok: false, properties: [] };

  const nights = nightsBetween(input.checkIn, input.checkOut);

  try {
    // Common Airbnb RapidAPI search shape — soft-parse whatever comes back
    const url = new URL(`https://${host}/api/v2/searchPropertyByLocation`);
    url.searchParams.set("location", input.area);
    url.searchParams.set("checkin", input.checkIn);
    url.searchParams.set("checkout", input.checkOut);
    url.searchParams.set("adults", String(Math.max(1, input.headcount)));
    if (input.lat != null && input.lng != null) {
      url.searchParams.set("ne_lat", String(input.lat + 0.35));
      url.searchParams.set("ne_lng", String(input.lng + 0.45));
      url.searchParams.set("sw_lat", String(input.lat - 0.35));
      url.searchParams.set("sw_lng", String(input.lng - 0.45));
    }

    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": host,
      },
      next: { revalidate: 0 },
    });

    if (res.status === 429) return { ok: false, rateLimited: true, properties: [] };
    if (!res.ok) return { ok: false, properties: [] };

    const json = (await res.json()) as unknown;
    const list = extractListingArray(json);
    const properties: Lodging[] = [];

    for (const raw of list.slice(0, 12)) {
      const mapped = mapRapidListing(raw, nights);
      if (mapped) properties.push(mapped);
    }
    return { ok: true, properties };
  } catch {
    return { ok: false, properties: [] };
  }
}

function extractListingArray(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  const candidates = [
    root.data,
    root.results,
    root.listings,
    (root.data as Record<string, unknown> | undefined)?.results,
    (root.data as Record<string, unknown> | undefined)?.list,
    (root.data as Record<string, unknown> | undefined)?.homes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Record<string, unknown>[];
  }
  return [];
}

function mapRapidListing(
  raw: Record<string, unknown>,
  nights: number,
): Lodging | null {
  const id = String(
    raw.id ?? raw.listing_id ?? raw.propertyId ?? raw.hotelId ?? "",
  ).trim();
  const name = String(
    raw.name ?? raw.title ?? raw.listingName ?? raw.propertyName ?? "",
  ).trim();
  if (!id || !name) return null;

  const sleeps = num(
    raw.personCapacity ??
      raw.person_capacity ??
      raw.guests ??
      raw.maxGuests ??
      raw.accommodates,
  );
  if (sleeps == null || sleeps < 1) return null;

  const nightly = num(
    raw.price ??
      raw.pricePerNight ??
      raw.avgPrice ??
      (raw.pricing as Record<string, unknown> | undefined)?.rate ??
      (raw.price as Record<string, unknown> | undefined)?.total,
  );
  const totalDirect = num(
    raw.totalPrice ??
      raw.total ??
      (raw.pricing as Record<string, unknown> | undefined)?.total,
  );
  let totalUsd = totalDirect;
  let priceKind: Lodging["priceKind"] = "confirmed";
  if (totalUsd == null && nightly != null) {
    totalUsd = Math.round(nightly * nights);
    priceKind = "estimated_nightly";
  }
  if (totalUsd == null || totalUsd <= 0) return null;

  const amenityRaw = collectStrings(
    raw.amenities,
    raw.amenityIds,
    raw.highlights,
    raw.tags,
  );
  const codes = normalizeAmenityStrings(amenityRaw);
  const bedrooms = num(raw.bedrooms ?? raw.beds);
  const imageUrl = String(
    raw.image ??
      raw.pictureUrl ??
      raw.thumbnailUrl ??
      (Array.isArray(raw.images) ? raw.images[0] : "") ??
      "",
  ).trim() || undefined;

  return {
    id: `rapidapi:${id}`,
    providerId: id,
    provider: "rapidapi",
    source: "provider",
    name,
    area: str(raw.city ?? raw.neighborhood ?? raw.area),
    address: str(raw.address ?? raw.publicAddress),
    structuralFact:
      bedrooms != null
        ? `${bedrooms} bedroom${bedrooms === 1 ? "" : "s"} · sleeps ${sleeps}`
        : `Sleeps ${sleeps}`,
    sleeps,
    bedrooms: bedrooms ?? undefined,
    amenityCodes: codes,
    amenities: amenityRowsFromCodes(codes),
    totalUsd: Math.round(totalUsd),
    nights,
    priceKind,
    priceAsOf: new Date().toISOString(),
    imageUrl,
    reviewScore: num(raw.rating ?? raw.avgRating ?? raw.starRating) ?? undefined,
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v)))
    return Number(v);
  if (v && typeof v === "object" && "amount" in (v as object))
    return num((v as { amount: unknown }).amount);
  return null;
}

function str(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

function collectStrings(...chunks: unknown[]): string[] {
  const out: string[] = [];
  for (const c of chunks) {
    if (!c) continue;
    if (typeof c === "string") out.push(c);
    else if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === "string") out.push(item);
        else if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          if (typeof o.name === "string") out.push(o.name);
          else if (typeof o.title === "string") out.push(o.title);
          else if (typeof o.label === "string") out.push(o.label);
        }
      }
    }
  }
  return out;
}
