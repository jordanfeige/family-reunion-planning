import { getLodgingCache, setLodgingCache } from "@/lib/lodging/cache";
import { geocodeArea } from "@/lib/lodging/geocode";
import { fetchOverpassRentals } from "@/lib/lodging/overpass";
import type { LodgingBundle } from "@/lib/lodging/bundle";
import type {
  GetLodgingInput,
  Lodging,
  LodgingResult,
} from "@/lib/lodging/types";

const TTL_FRESH_MS = 24 * 60 * 60 * 1000; // Overpass listings — no live prices
const TTL_EMPTY_MS = 24 * 60 * 60 * 1000;

function cacheKey(input: GetLodgingInput): string {
  const area = input.area.trim().toLowerCase();
  return `lodging:v3:${area}:${input.checkIn}:${input.checkOut}:${input.headcount}`;
}

function dedupe(properties: Lodging[]): Lodging[] {
  const seen = new Set<string>();
  const out: Lodging[] = [];
  for (const p of properties) {
    const k = `${p.provider}:${p.providerId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Exclude only when capacity is known and below headcount. */
function filterCapacity(
  properties: Lodging[],
  headcount: number,
): { kept: Lodging[]; filteredCount: number } {
  const need = Math.max(1, headcount);
  const kept = properties.filter((p) => {
    if (p.source !== "provider") return false;
    if (p.sleeps == null) return true;
    return p.sleeps >= need;
  });
  return { kept, filteredCount: properties.length - kept.length };
}

/** Sort by capacity fit — never by price; unknown capacity sorts last. */
function sortByCapacityFit(properties: Lodging[], headcount: number): Lodging[] {
  const need = Math.max(1, headcount);
  return [...properties].sort((a, b) => {
    const aKnown = a.sleeps != null;
    const bKnown = b.sleeps != null;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (aKnown && bKnown) {
      const da = Math.abs((a.sleeps as number) - need);
      const db = Math.abs((b.sleeps as number) - need);
      if (da !== db) return da - db;
      return (a.sleeps as number) - (b.sleeps as number);
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Unified lodging retrieval. Never call from render paths that block TTFB —
 * use from Server Actions / shortlist publish / refresh.
 *
 * Provider: OpenStreetMap Overpass only (no prices).
 */
export async function getLodging(input: GetLodgingInput): Promise<LodgingResult> {
  const key = cacheKey(input);
  const cached = await getLodgingCache(key);
  if (cached?.payload) {
    const payload = cached.payload as LodgingResult;
    return {
      ...payload,
      staleLabel: undefined,
    };
  }

  let lat = input.lat;
  let lng = input.lng;
  if ((lat == null || lng == null) && process.env.MAPBOX_TOKEN?.trim()) {
    const area = await geocodeArea(input.area);
    if (area) {
      lat = area.lat;
      lng = area.lng;
    }
  }

  if (lat == null || lng == null) {
    const failed: LodgingResult = {
      status: "failed",
      properties: [],
      partialNote:
        "Could not resolve this area to coordinates (Mapbox geocode). Lodging search needs a location.",
      fetchedAt: new Date().toISOString(),
    };
    await setLodgingCache(key, failed, TTL_EMPTY_MS);
    return failed;
  }

  const r = await fetchOverpassRentals({
    lat,
    lng,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    areaLabel: input.area,
  });

  const unique = dedupe(r.properties).filter((p) => p.source === "provider");
  const { kept, filteredCount } = filterCapacity(unique, input.headcount);
  const sorted = sortByCapacityFit(kept, input.headcount);

  let status: LodgingResult["status"];
  if (!r.ok && sorted.length === 0) status = "failed";
  else if (sorted.length === 0) status = "empty";
  else if (!r.ok && sorted.length > 0) status = "partial";
  else status = "ready";

  const pricedCount = sorted.filter(
    (p) => p.pricing.kind === "organizerEntered",
  ).length;
  const unpricedRentalCount = sorted.length - pricedCount;

  const result: LodgingResult = {
    status,
    properties: sorted,
    pricedCount,
    unpricedRentalCount,
    filteredCount: filteredCount > 0 ? filteredCount : undefined,
    filteredReason:
      filteredCount > 0
        ? `Filtered ${filteredCount} listing${filteredCount === 1 ? "" : "s"} that sleep fewer than ${input.headcount}.`
        : undefined,
    partialNote:
      status === "partial"
        ? "OpenStreetMap did not fully respond; showing what we have."
        : status === "failed"
          ? "Could not reach OpenStreetMap for rentals."
          : status === "empty"
            ? "No listings found that sleep your whole group for these dates."
            : undefined,
    fetchedAt: new Date().toISOString(),
  };

  const ttl =
    status === "ready" || status === "partial" ? TTL_FRESH_MS : TTL_EMPTY_MS;
  await setLodgingCache(key, result, ttl);
  return result;
}

/** Map LodgingResult into the trip_option lodging JSON shape used by the UI. */
export function lodgingResultToBundle(result: LodgingResult): LodgingBundle {
  return {
    status: result.status,
    filteredCount: result.filteredCount,
    filteredReason: result.filteredReason,
    staleLabel: result.staleLabel,
    partialNote: result.partialNote,
    fetchedAt: result.fetchedAt,
    pricedCount: result.pricedCount,
    unpricedRentalCount: result.unpricedRentalCount,
    properties: result.properties.map((p) => ({
      id: p.id,
      providerId: p.providerId,
      provider: p.provider,
      source: p.source,
      name: p.name,
      area: p.area,
      address: p.address,
      structuralFact: p.structuralFact,
      sleeps: p.sleeps ?? undefined,
      bedrooms: p.bedrooms,
      roomsOnly: p.roomsOnly,
      amenities: p.amenities,
      nights: p.nights,
      pricing: p.pricing,
      imageUrl: p.imageUrl,
      badge: p.badge,
      householdsAtCeiling: p.householdsAtCeiling,
      websiteUrl: p.websiteUrl,
      phone: p.phone,
    })),
  };
}

export type { GetLodgingInput, Lodging, LodgingResult } from "@/lib/lodging/types";
export {
  filterLodgingByHeadcount,
  lodgingForLocation,
  mergeLodgingWithPrior,
  normalizeLodgingBundle,
  recomputeBundleForNights,
  type LodgingAmenity,
  type LodgingBundle,
  type LodgingProperty,
} from "@/lib/lodging/bundle";
export {
  buildOrganizerPricing,
  computeLodgingTotals,
  enteredNightlyRange,
  isOrganizerEntered,
  looksLikeUrl,
  normalizeSourceUrl,
  parseFeesUsd,
  parseNightlyUsd,
  unknownPricing,
  type LodgingPricing,
} from "@/lib/lodging/pricing";
