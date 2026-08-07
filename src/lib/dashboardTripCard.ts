import {
  itineraryHasContent,
  normalizeItinerary,
} from "@/lib/itinerary";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import {
  householdCountForTripCapabilities,
  planCapabilities,
} from "@/lib/planMode";
import { hubFlowSteps } from "@/lib/planSteps";
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

/** Dashboard card status + trail progress for a trip row. */
export function dashboardTripCardMeta(input: {
  slug: string;
  locationOptions: unknown;
  proposedDateSlots: string[];
  selectedLocationId: string | null;
  selectedWeekendFriday: string | null;
  ballotStatus: string;
  publishedItinerary: unknown;
  surveyResponseCount: number;
  planHeadcount?: number | null;
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

  const capabilities = planCapabilities({
    householdCount: householdCountForTripCapabilities({
      surveyResponseCount: input.surveyResponseCount,
      planHeadcount: input.planHeadcount,
    }),
    headcount: input.planHeadcount,
  });
  const flow = hubFlowSteps(capabilities);

  const segments = flow.map((s) => {
    if (s.id === "destinations") return hasPlaces;
    if (s.id === "survey") return hasSurvey;
    if (s.id === "decision") return locked;
    if (s.id === "weekend") return published;
    if (s.id === "share") return published && (hasSurvey || !capabilities.survey);
    return false;
  });
  const filledSegments = segments.filter(Boolean).length;

  let statusPrimary = "In progress";
  let statusSecondary = hasPlaces
    ? (input.selectedLocationId
        ? findLocationById(places, input.selectedLocationId)?.title
        : null) ??
      places[0]?.title ??
      "Shortlist ready"
    : "Add places";

  if (ballotOpen && hasSurvey && capabilities.survey) {
    statusPrimary = "Waiting on votes";
    statusSecondary =
      input.surveyResponseCount > 0 ? "Ballot open" : "No replies yet";
  } else if (locked && !published) {
    statusPrimary = "Itinerary";
    statusSecondary = "Build the weekend";
  } else if (published) {
    statusPrimary = "Plan published";
    statusSecondary = "Ready to share";
  } else if (!locked && hasPlaces) {
    statusSecondary = "Decide next";
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

  const households = Math.max(input.surveyResponseCount, 1);
  const householdLabel = `${households} household${households === 1 ? "" : "s"}`;

  let href = `/t/${input.slug}?stop=destinations`;
  let ctaLabel = "Continue";
  if (!hasPlaces) {
    href = `/t/${input.slug}?stop=destinations`;
    ctaLabel = "Add places";
  } else if (capabilities.survey && !hasSurvey) {
    href = `/t/${input.slug}?stop=survey`;
    ctaLabel = "Ask the family";
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
