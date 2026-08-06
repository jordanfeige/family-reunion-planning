import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { extractorModel, hasAnthropicApiKey } from "@/lib/ai";
import {
  BROWSE_GENERATE_IMAGE_BUDGET_MS,
  BROWSE_GENERATE_MAX_DURATION_SEC,
  BROWSE_GENERATE_MODEL_TIMEOUT_MS,
} from "@/lib/browseGenerate";
import { attachBrowseImages } from "@/lib/browseImages";
import {
  BROWSE_DEAL_MORE,
  BROWSE_DECK_SIZE,
  browseIdeaSchema,
  composeBrowseStack,
} from "@/lib/browseIdeas";
import { geocodeArea } from "@/lib/lodging/geocode";

export const runtime = "nodejs";
export const maxDuration = BROWSE_GENERATE_MAX_DURATION_SEC;

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
          signal: AbortSignal.timeout(6000),
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
  const count = body.count ?? BROWSE_DECK_SIZE;
  const isRefill = count <= BROWSE_DEAL_MORE;
  const refineNote =
    body.refine === "cheaper"
      ? "Bias hard toward free and under $30."
      : body.refine === "closer"
        ? "Bias toward stay-home and stay-local only."
        : body.refine === "weirder"
          ? "Bias toward unusual, specific, non-touristy ideas."
          : "";

  const area = await resolveArea({
    lat: body.lat,
    lng: body.lng,
    areaLabel: body.areaLabel,
  });

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
    const { object } = await generateObject({
      model: extractorModel(),
      schema: z.object({
        ideas: z.array(browseIdeaSchema).min(Math.min(6, count)).max(12),
      }),
      maxRetries: 1,
      timeout: BROWSE_GENERATE_MODEL_TIMEOUT_MS,
      prompt: `You invent concrete weekend / evening ideas LOCAL to the user — near their city/town/area in the United States. No fantasy far-away destinations (no Azores, Kyoto, Dolomites, etc.) unless the user explicitly asked for that place.
User prompt: ${body.prompt}
${locationLine}
${refineNote}

Rules:
- Return exactly ${count} ideas.
- Local-first: stay-home, stay-local, and day-trip should dominate. At most 2 overnight. At most 1 go-somewhere, and only if still regional (driveable).
- Prefer real placeName values the user could find near them (park, bakery, trailhead, neighborhood). placeName null for pure at-home activities.
- Each idea needs: title, category, short blurb (one line, max ~110 chars), durationMins (positive), estCostUsd, costNote, optional driveMinutes (realistic from their area; null for stay-home), optional placeName, optional tags from: quiet, lively, outdoors, hands-on, food-forward, alcohol, spectator, physical, kids-friendly, at-home, long-drive, budget, splurge.
- Descriptions: 1–2 short concrete sentences if you include them. Blurb is required for the card face.
- Never reuse these skipped titles: ${skipped.slice(0, 40).join(" | ") || "(none)"}
- Titles max 52 characters.
- costNote like "free", "~$40 groceries", "$22 for two".
${isRefill ? "- These are refill cards for an existing shortlist — keep variety, avoid duplicates." : ""}`,
    });

    const stack = composeBrowseStack(object.ideas, count);
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

    if (withImages.length < Math.min(6, count)) {
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
