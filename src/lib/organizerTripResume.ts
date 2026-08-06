import {
  itineraryHasContent,
  normalizeItinerary,
  type PublishedItinerary,
} from "@/lib/itinerary";
import { normalizeLocationOptions } from "@/lib/locations";
import {
  householdCountForTripCapabilities,
  planCapabilities,
} from "@/lib/planMode";
import type { BallotStatus } from "@/lib/venues";

export type OrganizerTripResume = {
  href: string;
  stageLabel: string;
  ctaLabel: string;
  step: string;
};

/** Next conversational hub step for an in-progress trip. */
export function organizerTripResume(input: {
  slug: string;
  locationOptions: unknown;
  proposedDateSlots: string[] | null | undefined;
  selectedLocationId: string | null | undefined;
  selectedWeekendFriday: string | null | undefined;
  ballotStatus: BallotStatus | string | null | undefined;
  publishedItinerary: PublishedItinerary | null | unknown;
  surveyResponseCount: number;
  planHeadcount?: number | null;
}): OrganizerTripResume {
  const places = normalizeLocationOptions(input.locationOptions);
  const hasPlaces = places.length > 0;
  const hasWeekends = (input.proposedDateSlots ?? []).length > 0;
  const locked =
    Boolean(input.selectedLocationId) && Boolean(input.selectedWeekendFriday);
  const published = itineraryHasContent(
    normalizeItinerary(
      input.publishedItinerary as PublishedItinerary | null,
      input.selectedWeekendFriday,
    ),
  );
  const ballotActive =
    input.ballotStatus === "open" || input.ballotStatus === "closed";

  const capabilities = planCapabilities({
    householdCount: householdCountForTripCapabilities({
      surveyResponseCount: input.surveyResponseCount,
      planHeadcount: input.planHeadcount,
    }),
    headcount: input.planHeadcount,
  });

  if (!hasPlaces) {
    return {
      step: "destinations",
      stageLabel: hasWeekends ? "Add destinations" : "Set places & weekends",
      ctaLabel: "Continue with WandrAI",
      href: `/t/${input.slug}?stop=destinations`,
    };
  }

  if (capabilities.survey && input.surveyResponseCount === 0) {
    return {
      step: "survey",
      stageLabel: "Ready to ask",
      ctaLabel: "Ask the family",
      href: `/t/${input.slug}?stop=survey`,
    };
  }

  if (capabilities.survey && !locked) {
    return {
      step: "decision",
      stageLabel: "Review family answers",
      ctaLabel: "Continue deciding",
      href: `/t/${input.slug}?stop=decision`,
    };
  }

  if (!locked) {
    return {
      step: "decision",
      stageLabel: "Pick a place",
      ctaLabel: "Decide",
      href: `/t/${input.slug}?stop=decision`,
    };
  }

  if (!ballotActive && !published) {
    return {
      step: "weekend",
      stageLabel: "Shape lodging",
      ctaLabel: "Continue shaping",
      href: `/t/${input.slug}?stop=weekend`,
    };
  }

  if (!published) {
    return {
      step: "weekend",
      stageLabel: "Build the weekend",
      ctaLabel: "Continue planning",
      href: `/t/${input.slug}?stop=weekend`,
    };
  }

  return {
    step: "share",
    stageLabel: "Plan published",
    ctaLabel: "Open hub",
    href: `/t/${input.slug}?stop=share`,
  };
}
