/**
 * §13 resolution helpers for browse — placeQuery proposals → resolved places.
 * Regenerates dropped slots once (§13d), then builds meta triad (§13b).
 */
import { generateObject } from "ai";
import { z } from "zod";

import { extractorModel, hasAnthropicApiKey } from "@/lib/ai";
import { formatDriveMinutes, getDriveTime } from "@/lib/drive";
import {
  ideaProposalSchema,
  resolutionCountLine,
  resolveIdeaProposals,
  type IdeaProposal,
  type ResolvedIdea,
} from "@/lib/resolvedPlace";
import {
  imageAttributionText,
  resolvePlaceImage,
  type PlaceImage,
} from "@/lib/placeImageCascade";
import type { BrowseCategory } from "@/lib/browseIdeas";

export type ResolvedBrowseCard = {
  id: string;
  title: string;
  category: BrowseCategory;
  placeName: string | null;
  place: ResolvedIdea["place"];
  driveMinutes: number | null;
  /** Concrete scale fact — omit from UI when null. */
  scaleFact: string | null;
  durationHours: number;
  durationMins: number;
  estCostUsd: number;
  costNote: string;
  description: string;
  pluses: string[];
  cautions: string[];
  imageQuery: string;
  imageUrl: string | null;
  image: PlaceImage;
  sourceId: string | null;
  /** §13b meta: drive · scale · cost — unresolved parts omitted. */
  metaLine: string;
};

/** Assert every non-stay-home card has a sourceId (§14a). */
export function assertResolvedPlaces(cards: ResolvedBrowseCard[]): void {
  for (const card of cards) {
    if (card.category === "stay-home") continue;
    if (!card.sourceId) {
      throw new Error(
        `Unresolved place rendered: "${card.title}" missing sourceId`,
      );
    }
    if (card.image.source === "unsplash" && card.place) {
      throw new Error(
        `Named place "${card.title}" must not use Unsplash`,
      );
    }
  }
}

/**
 * §13b meta triad: drive time · one scale fact · cost with provenance.
 * Omit unresolved; never guess.
 */
export function formatMetaTriad(opts: {
  driveMinutes: number | null;
  scaleFact: string | null;
  costNote: string;
  estCostUsd: number;
}): string {
  const parts: string[] = [];
  if (opts.driveMinutes != null && Number.isFinite(opts.driveMinutes)) {
    parts.push(formatDriveMinutes(opts.driveMinutes));
  }
  const scale = opts.scaleFact?.trim();
  if (scale) parts.push(scale);
  const cost =
    opts.costNote?.trim() ||
    (opts.estCostUsd === 0 ? "free" : `~$${Math.round(opts.estCostUsd)}`);
  if (cost) parts.push(cost);
  return parts.join(" · ");
}

function deriveScaleFact(idea: ResolvedIdea): string | null {
  const explicit = idea.scaleFact?.trim();
  if (explicit) return explicit;
  if (idea.category === "stay-home" && idea.properNouns.length) {
    const mins = Math.round(idea.durationHours * 60);
    if (mins > 0 && mins < 60 * 8) {
      return mins < 60 ? `${mins} min` : `${idea.durationHours} hr`;
    }
  }
  return null;
}

async function resolveDriveMinutes(
  idea: ResolvedIdea,
  origin: { lat: number; lng: number; locality?: string | null } | null,
): Promise<number | null> {
  if (!idea.place || !origin) return null;
  const fromCity = origin.locality?.trim();
  if (!fromCity || /^near you$/i.test(fromCity)) {
    return null;
  }
  const leg = await getDriveTime({
    fromCity,
    toArea: idea.place.locality
      ? `${idea.place.name}, ${idea.place.locality}`
      : idea.place.name,
    toLat: idea.place.lat,
    toLng: idea.place.lng,
  });
  return leg.minutes;
}

/** Regenerate dropped slots once with failures as constraints (§13d). */
export async function regenerateDroppedSlotsOnce(
  slotCount: number,
  droppedReasons: string[],
  origin: { lat: number; lng: number; locality?: string | null } | null,
  promptContext: string,
): Promise<IdeaProposal[]> {
  if (slotCount <= 0 || !hasAnthropicApiKey()) return [];
  try {
    const { object } = await generateObject({
      model: extractorModel(),
      schema: z.object({
        ideas: z.array(ideaProposalSchema).min(1).max(slotCount),
      }),
      maxRetries: 0,
      maxOutputTokens: 1_800,
      temperature: 0.55,
      abortSignal: AbortSignal.timeout(28_000),
      prompt: `Propose exactly ${slotCount} replacement weekend/evening ideas (US).
Context: ${promptContext}
These previous proposals FAILED resolution for these reasons — do NOT repeat them:
${droppedReasons.slice(0, 12).map((r) => `- ${r}`).join("\n") || "(unresolved places)"}
${origin?.locality ? `User area: ${origin.locality}` : "User area unknown — prefer stay-home."}
Strict schema. placeQuery is a lookup key, not a final name. Stay-home needs real proper nouns (game/dish/film), never a local business.`,
    });
    return object.ideas;
  } catch (err) {
    console.error("regenerateDroppedSlotsOnce:", err);
    return [];
  }
}

export async function gateAndIllustrateIdeas(
  proposals: unknown[],
  origin: { lat: number; lng: number; locality?: string | null } | null,
  opts?: { promptContext?: string; skipRegenerate?: boolean },
): Promise<{
  cards: ResolvedBrowseCard[];
  proposed: number;
  dropped: number;
  countLine: string;
}> {
  const valid: IdeaProposal[] = [];
  for (const raw of proposals) {
    const parsed = ideaProposalSchema.safeParse(raw);
    if (parsed.success) valid.push(parsed.data);
  }

  const first = await resolveIdeaProposals(valid, origin);
  let resolved = first.resolved;
  let totalProposed = first.proposed;
  let totalDropped = first.dropped;

  // §13d — regenerate dropped slots ONCE
  if (
    !opts?.skipRegenerate &&
    first.dropped > 0 &&
    first.droppedReasons.length > 0
  ) {
    const replacements = await regenerateDroppedSlotsOnce(
      first.dropped,
      first.droppedReasons,
      origin,
      opts?.promptContext ?? "local weekend ideas",
    );
    if (replacements.length) {
      const second = await resolveIdeaProposals(replacements, origin);
      resolved = [...resolved, ...second.resolved];
    }
  }

  // Honesty: proposed = original batch; dropped = still unresolved after one regen
  totalProposed = first.proposed;
  totalDropped = Math.max(0, totalProposed - resolved.length);

  const cards: ResolvedBrowseCard[] = [];
  for (const idea of resolved) {
    const isNamed = idea.category !== "stay-home" && Boolean(idea.place);
    const image = await resolvePlaceImage({
      place: idea.place,
      imageQuery: idea.place
        ? `${idea.place.name} ${idea.place.locality}`
        : idea.imageQuery,
      isNamedPlace: isNamed,
      cacheId: idea.place?.sourceId ?? idea.title,
    });
    const driveMinutes = await resolveDriveMinutes(idea, origin);
    const scaleFact = deriveScaleFact(idea);
    const metaLine = formatMetaTriad({
      driveMinutes,
      scaleFact,
      costNote: idea.costNote,
      estCostUsd: idea.estCostUsd,
    });
    cards.push({
      id: idea.place?.sourceId ?? crypto.randomUUID(),
      title: idea.place?.name ?? idea.title,
      category: idea.category,
      placeName: idea.place
        ? [idea.place.name, idea.place.locality].filter(Boolean).join(", ")
        : null,
      place: idea.place,
      driveMinutes,
      scaleFact,
      durationHours: idea.durationHours,
      durationMins: Math.round(idea.durationHours * 60),
      estCostUsd: idea.estCostUsd,
      costNote: idea.costNote,
      description: idea.description,
      pluses: idea.pluses,
      cautions: idea.cautions,
      imageQuery: idea.imageQuery,
      imageUrl: image.url,
      image,
      sourceId: idea.place?.sourceId ?? null,
      metaLine,
    });
  }

  assertResolvedPlaces(cards);

  return {
    cards,
    proposed: totalProposed,
    dropped: totalDropped,
    countLine: resolutionCountLine(totalProposed, cards.length, totalDropped),
  };
}

export { imageAttributionText };
