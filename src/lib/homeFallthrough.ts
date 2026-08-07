import { unstable_cache } from "next/cache";
import { generateObject } from "ai";
import { z } from "zod";

import { extractorModel, hasAnthropicApiKey } from "@/lib/ai";
import { categoryLabel, type BrowseCategory } from "@/lib/browseIdeas";
import { geocodeArea } from "@/lib/lodging/geocode";
import {
  imageAttributionText,
  resolvePlaceImage,
} from "@/lib/placeImageCascade";
import {
  ideaProposalSchema,
  resolveIdeaProposals,
  type IdeaProposal,
} from "@/lib/resolvedPlace";

export type HomeFallthroughCard = {
  id: string;
  title: string;
  category: BrowseCategory;
  durationLabel: string;
  costLabel: string;
  imageUrl: string | null;
  attribution: string | null;
  attributionHref: string | null;
};

function durationLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours === 1) return "1 hr";
  if (Number.isInteger(hours)) return `${hours} hr`;
  return `${hours} hr`;
}

async function generateFallthroughIdeas(
  areaLabel: string,
  lat: number,
  lng: number,
): Promise<HomeFallthroughCard[]> {
  if (!hasAnthropicApiKey()) return [];

  const proposalSchema = ideaProposalSchema;
  try {
    const { object } = await generateObject({
      model: extractorModel(),
      schema: z.object({
        ideas: z.array(proposalSchema).min(4).max(8),
      }),
      temperature: 0.6,
      maxRetries: 0,
      maxOutputTokens: 2200,
      abortSignal: AbortSignal.timeout(42_000),
      prompt: `Propose 6 concrete weekend/evening ideas near ${areaLabel} (${lat.toFixed(3)}, ${lng.toFixed(3)}).
Each idea MUST follow the schema:
- placeQuery: search string for a REAL named place (null ONLY for stay-home)
- category: stay-home|stay-local|day-trip|overnight|go-somewhere
- properNouns: at least one (games/dish/film for stay-home; place features otherwise)
- durationHours, estCostUsd, costNote
- description: ≥80 chars with ≥2 verifiable specifics
- pluses (1-3), cautions (min 1 REQUIRED)
- imageQuery: resolved-name + locality, or activity noun for stay-home
Do NOT invent place names as final titles — placeQuery is a search query only.
Mix: 1 stay-home, rest local/day-trip. No exotic far destinations.`,
    });

    const proposals = object.ideas as IdeaProposal[];
    const { resolved } = await resolveIdeaProposals(
      proposals,
      { lat, lng, locality: areaLabel },
      75,
    );

    // §13d regenerate dropped is handled in gateAndIllustrateIdeas for browse;
    // home fallthrough uses survivors only (budget-friendly).
    const top = resolved.slice(0, 3);
    const cards: HomeFallthroughCard[] = [];

    for (const idea of top) {
      const isNamed = idea.category !== "stay-home" && Boolean(idea.place);
      const img = await resolvePlaceImage({
        place: idea.place,
        imageQuery:
          idea.place != null
            ? `${idea.place.name} ${idea.place.locality}`
            : idea.imageQuery,
        isNamedPlace: isNamed,
        cacheId: idea.place?.sourceId ?? idea.title,
      });
      cards.push({
        id: idea.place?.sourceId ?? crypto.randomUUID(),
        title: idea.place
          ? idea.place.locality
            ? `${idea.place.name}`
            : idea.place.name
          : idea.title,
        category: idea.category,
        durationLabel: durationLabel(idea.durationHours),
        costLabel:
          idea.estCostUsd === 0
            ? idea.costNote || "free"
            : idea.costNote || `$${Math.round(idea.estCostUsd)}`,
        imageUrl: img.url,
        attribution: imageAttributionText(img),
        attributionHref: img.attributionUrl ?? img.profileUrl,
      });
    }

    return cards;
  } catch (err) {
    console.error("home fallthrough:", err);
    return [];
  }
}

/**
 * Two/three real ideas for the home fallthrough — cached 6h.
 * On failure returns [] so the section is omitted (§4).
 */
export function getHomeFallthrough(areaLabel: string, lat: number, lng: number) {
  const key = `${areaLabel}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
  return unstable_cache(
    () => generateFallthroughIdeas(areaLabel, lat, lng),
    ["home-fallthrough-v1", key],
    { revalidate: 60 * 60 * 6 },
  )();
}

export { categoryLabel };
