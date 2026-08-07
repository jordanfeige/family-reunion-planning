import { z } from "zod";

import {
  bboxAround,
  bboxClause,
  elementCoords,
  haversineMiles,
  queryOverpass,
  type OverpassElement,
} from "@/lib/overpass";

/** Real place resolved via Overpass or Mapbox — never from a model completion. */
export type ResolvedPlace = {
  name: string;
  locality: string;
  lat: number;
  lng: number;
  source: "overpass" | "mapbox";
  sourceId: string;
  website: string | null;
  phone: string | null;
  /** OSM tags useful for image cascade. */
  osmImage?: string | null;
  osmWikimediaCommons?: string | null;
  wikidata?: string | null;
};

export const ideaProposalSchema = z
  .object({
    placeQuery: z.string().min(1).nullable(),
    category: z.enum([
      "stay-home",
      "stay-local",
      "day-trip",
      "overnight",
      "go-somewhere",
    ]),
    properNouns: z.array(z.string().min(1)).min(1),
    /** Concrete scale fact: sleeps N / N mi of trail / opens at 8 — omit if unknown. */
    scaleFact: z.string().min(1).nullable().optional(),
    durationHours: z.number().positive(),
    estCostUsd: z.number().min(0),
    costNote: z.string().min(1),
    description: z.string().min(80),
    pluses: z.array(z.string().min(1)).min(1).max(3),
    cautions: z.array(z.string().min(1)).min(1),
    imageQuery: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    if (val.category !== "stay-home" && !val.placeQuery?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "placeQuery required for non-stay-home",
        path: ["placeQuery"],
      });
    }
  });

export type IdeaProposal = z.infer<typeof ideaProposalSchema>;

export type ResolvedIdea = IdeaProposal & {
  place: ResolvedPlace | null;
  title: string;
};

function localityFromTags(tags: Record<string, string>): string {
  const parts = [
    tags["addr:city"] || tags.city || tags.place || "",
    tags["addr:state"] || tags.state || "",
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(", ") || tags["addr:suburb"] || "";
}

function namedElements(elements: OverpassElement[]): OverpassElement[] {
  return elements.filter((el) => {
    const name = el.tags?.name?.trim();
    return Boolean(name) && elementCoords(el);
  });
}

function scoreElement(
  el: OverpassElement,
  query: string,
  origin: { lat: number; lng: number },
): number {
  const name = (el.tags?.name ?? "").toLowerCase();
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  let score = 0;
  for (const t of tokens) {
    if (name.includes(t)) score += 3;
  }
  const coords = elementCoords(el);
  if (coords) {
    const mi = haversineMiles(origin.lat, origin.lng, coords.lat, coords.lng);
    score += Math.max(0, 40 - mi);
  }
  return score;
}

function toResolvedFromOverpass(
  el: OverpassElement,
  localityFallback: string,
): ResolvedPlace | null {
  const coords = elementCoords(el);
  const name = el.tags?.name?.trim();
  if (!coords || !name || el.id == null) return null;
  const tags = el.tags ?? {};
  return {
    name,
    locality: localityFromTags(tags) || localityFallback,
    lat: coords.lat,
    lng: coords.lng,
    source: "overpass",
    sourceId: `${el.type ?? "node"}/${el.id}`,
    website: tags.website?.trim() || tags["contact:website"]?.trim() || null,
    phone: tags.phone?.trim() || tags["contact:phone"]?.trim() || null,
    osmImage: tags.image?.trim() || null,
    osmWikimediaCommons: tags.wikimedia_commons?.trim() || null,
    wikidata: tags.wikidata?.trim() || null,
  };
}

async function resolveViaOverpass(
  placeQuery: string,
  origin: { lat: number; lng: number },
  maxDriveMiles: number,
  localityFallback: string,
): Promise<ResolvedPlace | null> {
  // ~69 miles per degree latitude; pad bbox to max drive.
  const halfDeg = Math.min(2.5, Math.max(0.25, (maxDriveMiles / 69) * 1.15));
  const bbox = bboxAround(origin.lat, origin.lng, halfDeg);
  const bb = bboxClause(bbox);
  const ql = `
[out:json][timeout:18];
(
  node["name"]["tourism"](${bb});
  way["name"]["tourism"](${bb});
  node["name"]["leisure"](${bb});
  way["name"]["leisure"](${bb});
  node["name"]["amenity"](${bb});
  way["name"]["amenity"](${bb});
  node["name"]["shop"](${bb});
  way["name"]["shop"](${bb});
  node["name"]["natural"](${bb});
  way["name"]["natural"](${bb});
);
out center 80;
`.trim();

  const { elements } = await queryOverpass(ql);
  const named = namedElements(elements);
  if (!named.length) return null;

  const ranked = [...named].sort(
    (a, b) =>
      scoreElement(b, placeQuery, origin) - scoreElement(a, placeQuery, origin),
  );
  const best = ranked[0];
  if (!best || scoreElement(best, placeQuery, origin) < 2) return null;
  return toResolvedFromOverpass(best, localityFallback);
}

async function resolveViaMapbox(
  placeQuery: string,
  origin: { lat: number; lng: number },
  localityFallback: string,
): Promise<ResolvedPlace | null> {
  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token) return null;

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(placeQuery)}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "5");
    url.searchParams.set("types", "poi");
    url.searchParams.set("proximity", `${origin.lng},${origin.lat}`);
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: {
        id?: string;
        text?: string;
        place_name?: string;
        center?: [number, number];
        properties?: { address?: string; category?: string };
        context?: { text?: string; id?: string }[];
      }[];
    };
    const feat = json.features?.[0];
    if (!feat?.id || !feat.center || !feat.text) return null;
    const [lng, lat] = feat.center;
    const placeCtx = feat.context?.find((c) => c.id?.startsWith("place."));
    const regionCtx = feat.context?.find((c) => c.id?.startsWith("region."));
    const locality =
      [placeCtx?.text, regionCtx?.text].filter(Boolean).join(", ") ||
      feat.place_name?.split(",").slice(1, 3).join(",").trim() ||
      localityFallback;
    return {
      name: feat.text.trim(),
      locality,
      lat,
      lng,
      source: "mapbox",
      sourceId: feat.id,
      website: null,
      phone: null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a placeQuery → ResolvedPlace (Overpass → Mapbox). Returns null if unresolved.
 */
export async function resolvePlaceQuery(
  placeQuery: string,
  origin: { lat: number; lng: number; locality?: string | null },
  maxDriveMiles = 90,
): Promise<ResolvedPlace | null> {
  const q = placeQuery.trim();
  if (!q) return null;
  const locality = origin.locality?.trim() || "";

  const overpass = await resolveViaOverpass(q, origin, maxDriveMiles, locality);
  if (overpass) return overpass;

  return resolveViaMapbox(q, origin, locality);
}

/**
 * Apply the §13 resolution gate: drop unresolved non-stay-home proposals.
 * Stay-home keeps place=null but must have properNouns (schema-enforced).
 * Returns droppedQueries so callers can regenerate those slots once (§13d).
 */
export async function resolveIdeaProposals(
  proposals: IdeaProposal[],
  origin: { lat: number; lng: number; locality?: string | null } | null,
  maxDriveMiles = 90,
): Promise<{
  resolved: ResolvedIdea[];
  dropped: number;
  proposed: number;
  droppedQueries: string[];
  droppedReasons: string[];
}> {
  const resolved: ResolvedIdea[] = [];
  let dropped = 0;
  const droppedQueries: string[] = [];
  const droppedReasons: string[] = [];

  for (const proposal of proposals) {
    const parsed = ideaProposalSchema.safeParse(proposal);
    if (!parsed.success) {
      dropped += 1;
      droppedReasons.push(parsed.error.issues[0]?.message ?? "schema");
      if (proposal.placeQuery) droppedQueries.push(proposal.placeQuery);
      continue;
    }
    const p = parsed.data;

    if (p.category === "stay-home") {
      const title = p.properNouns.slice(0, 2).join(" and ");
      resolved.push({ ...p, place: null, title });
      continue;
    }

    if (!origin || !p.placeQuery) {
      dropped += 1;
      droppedReasons.push("missing origin or placeQuery");
      if (p.placeQuery) droppedQueries.push(p.placeQuery);
      continue;
    }

    const place = await resolvePlaceQuery(p.placeQuery, origin, maxDriveMiles);
    if (!place?.sourceId) {
      dropped += 1;
      droppedQueries.push(p.placeQuery);
      droppedReasons.push(`unresolved: ${p.placeQuery}`);
      continue;
    }

    resolved.push({
      ...p,
      place,
      title: place.locality
        ? `${place.name}, ${place.locality}`
        : place.name,
    });
  }

  return {
    resolved,
    dropped,
    proposed: proposals.length,
    droppedQueries,
    droppedReasons,
  };
}

/** Honest count line for generated lists (§13e). */
export function resolutionCountLine(
  proposed: number,
  resolved: number,
  dropped: number,
): string {
  if (dropped === 0) {
    return `${resolved} of ${proposed} ideas resolved to real places.`;
  }
  return `${resolved} of ${proposed} ideas resolved to real places. ${dropped} didn't and were dropped.`;
}
