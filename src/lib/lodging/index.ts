import { getLodgingCache, setLodgingCache } from "@/lib/lodging/cache";
import { geocodeArea } from "@/lib/lodging/geocode";
import { fetchAmadeusHotels } from "@/lib/lodging/amadeus";
import { fetchRapidApiRentals } from "@/lib/lodging/rapidapi";
import type { LodgingBundle } from "@/lib/lodging/bundle";
import type {
  GetLodgingInput,
  Lodging,
  LodgingResult,
} from "@/lib/lodging/types";

const TTL_FRESH_MS = 6 * 60 * 60 * 1000; // 6h confirmed prices
const TTL_EMPTY_MS = 24 * 60 * 60 * 1000;

function cacheKey(input: GetLodgingInput): string {
  const area = input.area.trim().toLowerCase();
  return `lodging:v1:${area}:${input.checkIn}:${input.checkOut}:${input.headcount}`;
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

function filterCapacity(
  properties: Lodging[],
  headcount: number,
): { kept: Lodging[]; filteredCount: number } {
  const need = Math.max(1, headcount);
  const kept = properties.filter((p) => p.sleeps >= need && p.source === "provider");
  return { kept, filteredCount: properties.length - kept.length };
}

/**
 * Unified lodging retrieval. Never call from render paths that block TTFB —
 * use from Server Actions / shortlist publish / refresh.
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

  const hasRapid = Boolean(process.env.RAPIDAPI_KEY?.trim());
  const hasAmadeus = Boolean(
    process.env.AMADEUS_CLIENT_ID?.trim() &&
      process.env.AMADEUS_CLIENT_SECRET?.trim(),
  );

  if (!hasRapid && !hasAmadeus) {
    const failed: LodgingResult = {
      status: "failed",
      properties: [],
      partialNote: "Lodging providers are not configured.",
      fetchedAt: new Date().toISOString(),
    };
    await setLodgingCache(key, failed, TTL_EMPTY_MS);
    return failed;
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

  const results: Lodging[] = [];
  let anyOk = false;
  let anyFail = false;
  let rateLimited = false;

  if (hasRapid) {
    const r = await fetchRapidApiRentals({
      area: input.area,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      headcount: input.headcount,
      lat,
      lng,
    });
    if (r.rateLimited) rateLimited = true;
    if (r.ok) anyOk = true;
    else anyFail = true;
    results.push(...r.properties);
  }

  if (hasAmadeus && lat != null && lng != null) {
    const a = await fetchAmadeusHotels({
      lat,
      lng,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      headcount: input.headcount,
      areaLabel: input.area,
    });
    if (a.rateLimited) rateLimited = true;
    if (a.ok) anyOk = true;
    else anyFail = true;
    results.push(...a.properties);
  } else if (hasAmadeus && (lat == null || lng == null)) {
    anyFail = true;
  }

  const unique = dedupe(results).filter((p) => p.source === "provider");
  const { kept, filteredCount } = filterCapacity(unique, input.headcount);

  let status: LodgingResult["status"];
  if (rateLimited && kept.length === 0) status = "failed";
  else if (!anyOk && anyFail) status = "failed";
  else if (kept.length === 0) status = "empty";
  else if (anyFail && kept.length > 0) status = "partial";
  else status = "ready";

  // Badge cheapest as recommended when we have 2+
  const sorted = [...kept].sort((a, b) => a.totalUsd - b.totalUsd);
  if (sorted[0]) sorted[0] = { ...sorted[0], badge: "recommended" };
  if (sorted[1] && !sorted[1].badge) {
    sorted[1] = { ...sorted[1], badge: "logistics" };
  }

  const result: LodgingResult = {
    status,
    properties: sorted,
    filteredCount: filteredCount > 0 ? filteredCount : undefined,
    filteredReason:
      filteredCount > 0
        ? `Filtered ${filteredCount} listing${filteredCount === 1 ? "" : "s"} that sleep fewer than ${input.headcount}.`
        : undefined,
    partialNote:
      status === "partial"
        ? "Some lodging sources did not respond; showing what we have."
        : status === "failed" && rateLimited
          ? "Lodging providers rate-limited this request. Try refresh later."
          : status === "failed"
            ? "Could not reach lodging providers."
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
    properties: result.properties.map((p) => ({
      id: p.id,
      providerId: p.providerId,
      provider: p.provider,
      source: p.source,
      name: p.name,
      area: p.area,
      address: p.address,
      structuralFact: p.structuralFact,
      sleeps: p.sleeps,
      bedrooms: p.bedrooms,
      amenities: p.amenities,
      totalUsd: p.totalUsd,
      nights: p.nights,
      priceKind: p.priceKind,
      imageUrl: p.imageUrl,
      badge: p.badge,
      householdsAtCeiling: p.householdsAtCeiling,
    })),
  };
}

export type { GetLodgingInput, Lodging, LodgingResult } from "@/lib/lodging/types";
export {
  filterLodgingByHeadcount,
  lodgingForLocation,
  normalizeLodgingBundle,
  type LodgingAmenity,
  type LodgingBundle,
  type LodgingProperty,
} from "@/lib/lodging/bundle";
