import {
  itineraryHasContent,
  normalizeItinerary,
  type PublishedItinerary,
} from "@/lib/itinerary";
import { normalizeLocationOptions } from "@/lib/locations";
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

  if (!hasPlaces) {
    return {
      step: "locations",
      stageLabel: hasWeekends ? "Add destinations" : "Set places & weekends",
      ctaLabel: "Continue with WandrAI",
      href: `/t/${input.slug}?step=locations`,
    };
  }

  if (input.surveyResponseCount === 0) {
    return {
      step: "survey",
      stageLabel: "Survey ready",
      ctaLabel: "Share survey",
      href: `/t/${input.slug}?step=survey`,
    };
  }

  if (!locked) {
    return {
      step: "survey",
      stageLabel: "Review family answers",
      ctaLabel: "Continue deciding",
      href: `/t/${input.slug}?step=survey`,
    };
  }

  if (!ballotActive && !published) {
    return {
      step: "ballot",
      stageLabel: "Shape lodging",
      ctaLabel: "Continue shaping",
      href: `/t/${input.slug}?step=ballot`,
    };
  }

  if (!published) {
    return {
      step: "blueprint",
      stageLabel: "Build the weekend",
      ctaLabel: "Continue planning",
      href: `/t/${input.slug}?step=blueprint`,
    };
  }

  return {
    step: "confirmations",
    stageLabel: "Plan published",
    ctaLabel: "Open hub",
    href: `/t/${input.slug}?step=confirmations`,
  };
}
