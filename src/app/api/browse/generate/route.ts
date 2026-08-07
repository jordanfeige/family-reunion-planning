import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { extractorModel, hasAnthropicApiKey } from "@/lib/ai";
import {
  BROWSE_GENERATE_AREA_BUDGET_MS,
  BROWSE_GENERATE_MODEL_TIMEOUT_MS,
  BROWSE_GENERATE_PROD_MAX_IDEAS,
} from "@/lib/browseGenerate";
import { BROWSE_CATEGORIES, BROWSE_DEAL_MORE, BROWSE_DECK_SIZE } from "@/lib/browseIdeas";
import { gateAndIllustrateIdeas } from "@/lib/browseResolve";
import { geocodeArea } from "@/lib/lodging/geocode";
import { ideaProposalSchema } from "@/lib/resolvedPlace";

export const runtime = "nodejs";
/** Must be a static literal for Next.js segment config (prod Vercel limit). */
export const maxDuration = 60;

const bodySchema = z.object({
  prompt: z.string().min(1).max(280),
  skippedTitles: z.array(z.string()).max(200).optional(),
  refine: z.enum(["cheaper", "closer", "weirder"]).optional(),
  count: z.number().int().min(4).max(12).optional(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  areaLabel: z.string().max(120).optional().nullable(),
});

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  return /timed?\s*out|aborted|timeout/i.test(e.message ?? "");
}

async function withBudget<T>(
  promise: Promise<T>,
  ms: number,
  fallback: () => T,
): Promise<T> {
  if (ms <= 0) return fallback();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveArea(opts: {
  lat?: number | null;
  lng?: number | null;
  areaLabel?: string | null;
}): Promise<{ lat: number | null; lng: number | null; areaLabel: string | null }> {
  let lat = opts.lat ?? null;
  let lng = opts.lng ?? null;
  let areaLabel = opts.areaLabel?.trim() || null;

  if (areaLabel && (lat == null || lng == null)) {
    const geo = await geocodeArea(areaLabel);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      areaLabel = geo.label || areaLabel;
    }
  }

  if (!areaLabel && lat != null && lng != null) {
    const token = process.env.MAPBOX_TOKEN?.trim();
    if (token) {
      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
        );
        url.searchParams.set("access_token", token);
        url.searchParams.set("limit", "1");
        url.searchParams.set("types", "place,locality,neighborhood");
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(3_000),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            features?: { text?: string; place_name?: string }[];
          };
          const feat = json.features?.[0];
          areaLabel =
            feat?.text?.trim() ||
            feat?.place_name?.split(",")[0]?.trim() ||
            null;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { lat, lng, areaLabel };
}

export async function POST(request: Request) {
  if (!hasAnthropicApiKey()) {
    return NextResponse.json(
      { error: "AI planning is unavailable right now." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const skipped = (body.skippedTitles ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const onVercel = Boolean(process.env.VERCEL);
  const requested = body.count ?? BROWSE_DECK_SIZE;
  const count = onVercel
    ? Math.min(requested, BROWSE_GENERATE_PROD_MAX_IDEAS)
    : requested;
  const isRefill = count <= BROWSE_DEAL_MORE;
  const refineNote =
    body.refine === "cheaper"
      ? "Bias hard toward free and under $30."
      : body.refine === "closer"
        ? "Bias toward stay-home and stay-local only."
        : body.refine === "weirder"
          ? "Bias toward unusual, specific, non-touristy ideas."
          : "";

  const area = await withBudget(
    resolveArea({
      lat: body.lat,
      lng: body.lng,
      areaLabel: body.areaLabel,
    }),
    BROWSE_GENERATE_AREA_BUDGET_MS,
    () => ({
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      areaLabel: body.areaLabel?.trim() || null,
    }),
  );

  const locationLine = area.areaLabel
    ? `User area: ${area.areaLabel}${
        area.lat != null && area.lng != null
          ? ` (approx ${area.lat.toFixed(3)}, ${area.lng.toFixed(3)})`
          : ""
      }.`
    : area.lat != null && area.lng != null
      ? `User coordinates: ${area.lat.toFixed(3)}, ${area.lng.toFixed(3)}.`
      : "User area unknown — prefer stay-home ideas with real proper nouns.";

  const proposeCount = Math.min(count + 4, 12);

  try {
    const { object } = await generateObject({
      model: extractorModel(),
      schema: z.object({
        ideas: z.array(ideaProposalSchema).min(Math.min(4, proposeCount)).max(proposeCount),
      }),
      maxRetries: 0,
      maxOutputTokens: 2_800,
      temperature: 0.65,
      abortSignal: AbortSignal.timeout(BROWSE_GENERATE_MODEL_TIMEOUT_MS),
      prompt: `Propose ${proposeCount} concrete local weekend/evening ideas (US).
User prompt: ${body.prompt}
${locationLine}
${refineNote}

Schema rules (strict):
- placeQuery: search string for a REAL place (null ONLY when category is stay-home). NEVER invent a final place name — placeQuery is a lookup key.
- category: ${BROWSE_CATEGORIES.join("|")}
- properNouns: min 1 (games/dish/film for stay-home; named features otherwise). Stay-home must NOT name a local business.
- scaleFact: optional concrete fact (sleeps 6 / 2.4 mi of trail / opens at 8) or null
- durationHours, estCostUsd, costNote (costNote includes provenance: "free", "$22 for two")
- description: ≥80 chars with ≥2 verifiable specifics (road, hours, named feature, distance)
- pluses 1-3, cautions min 1 REQUIRED
- imageQuery: "<name> <locality>" or activity noun for stay-home
Local-first. Skip titles: ${skipped.slice(0, 24).join(" | ") || "(none)"}
${isRefill ? "Refill cards — keep variety." : ""}`,
    });

    const origin =
      area.lat != null && area.lng != null
        ? { lat: area.lat, lng: area.lng, locality: area.areaLabel }
        : null;

    const gated = await gateAndIllustrateIdeas(object.ideas, origin, {
      promptContext: body.prompt,
    });
    const ideas = gated.cards.slice(0, count).map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      place: c.placeName,
      placeName: c.placeName,
      driveMinutes: c.driveMinutes,
      scaleFact: c.scaleFact,
      durationHours: c.durationHours,
      durationMins: c.durationMins,
      estCostUsd: c.estCostUsd,
      costNote: c.costNote,
      metaLine: c.metaLine,
      blurb: c.description.slice(0, 140),
      description: c.description,
      pluses: c.pluses,
      cautions: c.cautions,
      imageQuery: c.imageQuery,
      tags: [] as string[],
      imageUrl: c.imageUrl,
      sourceId: c.sourceId,
      imageAttribution: c.image.artist
        ? `${c.image.artist}${c.image.license ? ` · ${c.image.license}` : ""}`
        : c.image.photographer
          ? `${c.image.photographer} · Unsplash`
          : null,
      imageAttributionUrl: c.image.attributionUrl ?? c.image.profileUrl,
    }));

    return NextResponse.json({
      ideas,
      promptId: crypto.randomUUID(),
      thin: ideas.length < Math.min(4, count),
      countLine: gated.countLine,
      proposed: gated.proposed,
      dropped: gated.dropped,
      message:
        gated.dropped > 0
          ? gated.countLine
          : ideas.length < Math.min(4, count)
            ? `Only found ${ideas.length} good ones for that. Want to loosen it up?`
            : undefined,
      areaLabel: area.areaLabel,
      lat: area.lat,
      lng: area.lng,
    });
  } catch (err) {
    console.error("browse generate:", err);
    if (isTimeoutError(err)) {
      return NextResponse.json(
        {
          error:
            "That took too long — try a shorter prompt, or tap Generate again.",
        },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Couldn't build a stack just now." },
      { status: 502 },
    );
  }
}
