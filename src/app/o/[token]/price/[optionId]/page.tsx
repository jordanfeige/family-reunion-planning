import { notFound } from "next/navigation";

import { PublicLodgingPriceView } from "@/components/PublicLodgingPriceView";
import {
  filterLodgingByHeadcount,
  lodgingForLocation,
  recomputeBundleForNights,
} from "@/lib/lodging";
import {
  findLocationById,
  normalizeLocationOptions,
} from "@/lib/locations";
import { partyTotal } from "@/lib/partyCount";
import { weekendStayDates } from "@/lib/stayDates";
import {
  getSurveyByTripId,
  getTripByShareToken,
  listSurveyResponses,
} from "@/lib/supabase/queries";
import { formatWeekendLabel } from "@/lib/weekends";

export default async function PublicLodgingPricePage({
  params,
}: {
  params: Promise<{ token: string; optionId: string }>;
}) {
  const { token, optionId } = await params;
  const trip = await getTripByShareToken(token);
  if (!trip) notFound();

  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const option = findLocationById(locations, optionId);
  if (!option) notFound();

  const survey = await getSurveyByTripId(trip.id);
  const responses = survey ? await listSurveyResponses(survey.id) : [];
  const householdCount = Math.max(responses.length, 1);
  const headcount =
    trip.planHeadcount ??
    responses.reduce((n, r) => n + partyTotal(r), 0);
  const stay = weekendStayDates(trip.selectedWeekendFriday);

  const lodging = recomputeBundleForNights(
    filterLodgingByHeadcount(lodgingForLocation(option), headcount || null),
    stay.nights,
    householdCount,
    headcount || undefined,
  );

  const placeName =
    option.title.indexOf(",") === -1
      ? option.title
      : option.title.slice(0, option.title.indexOf(",")).trim();

  const weekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;

  return (
    <PublicLodgingPriceView
      tripName={trip.name}
      placeName={placeName}
      shareToken={trip.shareOptionsToken}
      optionId={option.id}
      householdCount={householdCount}
      properties={lodging.properties}
      weekendLabel={weekendLabel}
      nightCount={stay.nights}
    />
  );
}
