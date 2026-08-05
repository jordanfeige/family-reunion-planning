import {
  itineraryHasContent,
  normalizeItinerary,
} from "@/lib/itinerary";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import { placeStillUrl } from "@/lib/placeImages";
import { formatDateRangeUS } from "@/lib/units";
import { parseFridayIso, sundayFromFriday } from "@/lib/weekends";

export type DashboardTripCardMeta = {
  photoUrl: string;
  dateRangeLabel: string | null;
  householdLabel: string;
  statusPrimary: string;
  statusSecondary: string;
  filledSegments: number;
  href: string;
  ctaLabel: string;
};

/** Dashboard card status + 5-segment trail progress for a trip row. */
export function dashboardTripCardMeta(input: {
  slug: string;
  locationOptions: unknown;
  proposedDateSlots: string[];
  selectedLocationId: string | null;
  selectedWeekendFriday: string | null;
  ballotStatus: string;
  publishedItinerary: unknown;
  surveyResponseCount: number;
}): DashboardTripCardMeta {
  const places = normalizeLocationOptions(input.locationOptions);
  const hasPlaces = places.length > 0;
  const hasSurvey = input.surveyResponseCount > 0;
  const locked =
    Boolean(input.selectedLocationId) && Boolean(input.selectedWeekendFriday);
  const published = itineraryHasContent(
    normalizeItinerary(input.publishedItinerary, input.selectedWeekendFriday),
  );
  const ballotOpen = input.ballotStatus === "open";

  const segments = [
    hasPlaces,
    hasSurvey,
    locked,
    published,
    published && hasSurvey,
  ];
  const filledSegments = segments.filter(Boolean).length;

  let step = 1;
  if (hasPlaces) step = 2;
  if (hasPlaces && hasSurvey) step = 3;
  if (locked) step = 4;
  if (published) step = 5;

  let statusPrimary = "In progress";
  let statusSecondary = `Step ${step} of 5`;

  if (ballotOpen && hasSurvey) {
    const pending = Math.max(0, input.surveyResponseCount - 1);
    statusPrimary = "Waiting on votes";
    statusSecondary =
      pending > 0 ? `${pending} vote${pending === 1 ? "" : "s"} left` : "Ballot open";
  } else if (locked && !published) {
    statusPrimary = "Itinerary";
    statusSecondary = "Step 4 of 5";
  } else if (published) {
    statusPrimary = "Plan published";
    statusSecondary = "Step 5 of 5";
  }

  const selectedPlace = input.selectedLocationId
    ? findLocationById(places, input.selectedLocationId)
    : null;
  const heroPlace = selectedPlace ?? places[0];
  const photoUrl = heroPlace
    ? placeStillUrl(heroPlace.title, heroPlace.summary)
    : placeStillUrl(input.slug, "family reunion");

  const fridayIso =
    input.selectedWeekendFriday ?? input.proposedDateSlots[0] ?? null;
  let dateRangeLabel: string | null = null;
  if (fridayIso) {
    const fri = parseFridayIso(fridayIso);
    const sun = sundayFromFriday(fridayIso);
    if (fri && sun) {
      dateRangeLabel = formatDateRangeUS(fri, sun);
    }
  }

  const households = input.surveyResponseCount;
  const householdLabel = `${households} household${households === 1 ? "" : "s"}`;

  let href = `/t/${input.slug}?stop=destinations`;
  let ctaLabel = "Continue";
  if (!hasPlaces) {
    href = `/t/${input.slug}?stop=destinations`;
    ctaLabel = "Add places";
  } else if (!hasSurvey) {
    href = `/t/${input.slug}?stop=survey`;
    ctaLabel = "Share survey";
  } else if (!locked) {
    href = `/t/${input.slug}?stop=decision`;
    ctaLabel = "Decide";
  } else if (!published) {
    href = `/t/${input.slug}?stop=weekend`;
    ctaLabel = "Build itinerary";
  } else {
    href = `/t/${input.slug}?stop=share`;
    ctaLabel = "Open hub";
  }

  return {
    photoUrl,
    dateRangeLabel,
    householdLabel,
    statusPrimary,
    statusSecondary,
    filledSegments,
    href,
    ctaLabel,
  };
}
