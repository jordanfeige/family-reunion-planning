import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { extractorModel, hasAnthropicApiKey } from "@/lib/ai";
import {
  BROWSE_GENERATE_AREA_BUDGET_MS,
  BROWSE_GENERATE_IMAGE_BUDGET_MS,
  BROWSE_GENERATE_MODEL_TIMEOUT_MS,
  BROWSE_GENERATE_PROD_MAX_IDEAS,
} from "@/lib/browseGenerate";
import { attachBrowseImages } from "@/lib/browseImages";
import {
  BROWSE_CATEGORIES,
  BROWSE_DEAL_MORE,
  BROWSE_DECK_SIZE,
  composeBrowseStack,
} from "@/lib/browseIdeas";
import { geocodeArea } from "@/lib/lodging/geocode";

export const runtime = "nodejs";
/** Must be a static literal for Next.js segment config (prod Vercel limit). */
export const maxDuration = 60;

const bodySchema = z.object({
  prompt: z.string().min(1).max(280),
  skippedTitles: z.array(z.string()).max(200).optional(),
  refine: z.enum(["cheaper", "closer", "weirder"]).optional(),
  /** Append/refill size — default full deck. */
  count: z.number().int().min(4).max(12).optional(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  areaLabel: z.string().max(120).optional().nullable(),
});

/** Lean schema — full browseIdeaSchema JSON Schema is too large/slow for Haiku under gateway limits. */
const leanIdeaSchema = z.object({
  title: z.string().min(1).max(52),
  category: z.enum(BROWSE_CATEGORIES),
  blurb: z.string().min(8).max(140),
  durationMins: z.number().positive(),
  estCostUsd: z.number().min(0),
  costNote: z.string().min(1).max(48),
  driveMinutes: z.number().nonnegative().nullable().optional(),
  placeName: z.string().max(80).nullable().optional(),
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
      : "User area unknown — prefer generic US stay-home / stay-local ideas, not exotic destinations.";

  try {
    // AI SDK generateObject ignores `timeout` — must use abortSignal.
    const { object } = await generateObject({
      model: extractorModel(),
      schema: z.object({
        ideas: z.array(leanIdeaSchema).min(Math.min(4, count)).max(count),
      }),
      maxRetries: 0,
      maxOutputTokens: 1_600,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(BROWSE_GENERATE_MODEL_TIMEOUT_MS),
      prompt: `Invent ${count} concrete local weekend/evening ideas (US). No exotic far-away destinations unless the user asked for that place.
User prompt: ${body.prompt}
${locationLine}
${refineNote}

Return JSON ideas with: title, category (stay-home|stay-local|day-trip|overnight|go-somewhere), blurb (~110 chars), durationMins, estCostUsd, costNote, optional driveMinutes (null for stay-home), optional placeName.
Local-first: mostly stay-home / stay-local / day-trip. At most 1 overnight, at most 1 go-somewhere (regional only).
Skip titles: ${skipped.slice(0, 24).join(" | ") || "(none)"}
${isRefill ? "Refill cards — keep variety." : ""}`,
    });

    const stack = composeBrowseStack(object.ideas, count);
    // Prod: skip Places/Mapbox on the critical path — SoftImage letter fallback.
    const withImages = await withBudget(
      attachBrowseImages(stack, {
        lat: area.lat,
        lng: area.lng,
        areaLabel: area.areaLabel,
      }),
      BROWSE_GENERATE_IMAGE_BUDGET_MS,
      () =>
        stack.map((idea) => ({
          ...idea,
          imageUrl: idea.imageUrl ?? null,
        })),
    );

    if (withImages.length < Math.min(4, count)) {
      return NextResponse.json({
        ideas: withImages,
        thin: true,
        message: `Only found ${withImages.length} good ones for that. Want to loosen it up?`,
        areaLabel: area.areaLabel,
        lat: area.lat,
        lng: area.lng,
      });
    }

    return NextResponse.json({
      ideas: withImages,
      promptId: crypto.randomUUID(),
      thin: false,
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
