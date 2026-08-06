import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { DestinationDetailView } from "@/components/DestinationDetailView";
import { aggregateLocationAvailability } from "@/lib/availability";
import { formatDriveMinutes, getDriveTime, type DriveLeg } from "@/lib/drive";
import { geocodeArea } from "@/lib/lodging/geocode";
import {
  filterLodgingByHeadcount,
  lodgingForLocation,
} from "@/lib/lodging";
import {
  findLocationById,
  normalizeLocationOptions,
} from "@/lib/locations";
import { getNearbyPlaces } from "@/lib/nearby";
import { planCapabilities } from "@/lib/planMode";
import { partyTotal } from "@/lib/partyCount";
import { weekendStayDates } from "@/lib/stayDates";
import {
  getSurveyByTripId,
  getTripForOrganizer,
  listSurveyResponses,
} from "@/lib/supabase/queries";
import { getSeasonStat } from "@/lib/weather";
import { formatWeekendLabel } from "@/lib/weekends";

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; optionId: string }>;
}) {
  const { slug, optionId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/t/${slug}/place/${optionId}`)}`,
    );
  }

  const access = await getTripForOrganizer(slug, session.user.id);
  if (!access) notFound();

  const { trip } = access;
  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const option = findLocationById(locations, optionId);
  if (!option) notFound();

  const survey = await getSurveyByTripId(trip.id);
  const responses = survey ? await listSurveyResponses(survey.id) : [];
  const surveyRows = responses.map((r) => ({
    respondentName: r.respondentName,
    selectedSlots: r.selectedSlots,
    selectedLocations: r.selectedLocations,
    adultCount: r.adultCount,
    kidCount: r.kidCount,
    homeCity: r.homeCity,
    homeState: r.homeState,
  }));

  const shortlist = locations.slice(0, 3);
  const shortlistIndex = shortlist.findIndex((l) => l.id === option.id);
  const optionIndex =
    shortlistIndex >= 0
      ? shortlistIndex + 1
      : Math.min(
          locations.findIndex((l) => l.id === option.id) + 1,
          3,
        );
  const optionCount = Math.min(locations.length, 3);

  const votes = aggregateLocationAvailability(locations, surveyRows);
  const leadingId = [...locations].sort((a, b) => {
    const va = votes.find((v) => v.locationId === a.id)?.totalAttendees ?? 0;
    const vb = votes.find((v) => v.locationId === b.id)?.totalAttendees ?? 0;
    return vb - va;
  })[0]?.id;
  const isLeading = leadingId === option.id;

  const householdCount = Math.max(responses.length, 1);
  const headcount =
    trip.planHeadcount ??
    responses.reduce((n, r) => n + partyTotal(r), 0);
  const capabilities = planCapabilities({ householdCount, headcount });

  const lodging = filterLodgingByHeadcount(
    lodgingForLocation(option),
    headcount || null,
  );

  const stay = weekendStayDates(trip.selectedWeekendFriday);
  const area = await geocodeArea(option.title);

  const homes = responses
    .map((r) => {
      const city = [r.homeCity, r.homeState].filter(Boolean).join(", ").trim();
      const label = r.respondentName?.trim() || city || "Household";
      return { label, city };
    })
    .filter((h) => h.city);

  const gettingThere: DriveLeg[] = [];
  for (const h of homes.slice(0, 8)) {
    gettingThere.push(
      await getDriveTime({
        fromCity: h.city,
        toArea: option.title,
        toLat: area?.lat,
        toLng: area?.lng,
      }),
    );
  }
  // Prefer labeled legs
  for (let i = 0; i < gettingThere.length; i++) {
    gettingThere[i] = {
      ...gettingThere[i]!,
      fromLabel: homes[i]?.label || gettingThere[i]!.fromLabel,
    };
  }

  const viewerLeg = gettingThere[0];
  const driveStat = {
    value:
      viewerLeg?.minutes != null
        ? formatDriveMinutes(viewerLeg.minutes)
        : option.driveMinutesFromOrigin != null
          ? formatDriveMinutes(option.driveMinutesFromOrigin)
          : null,
    qualifier: null as string | null,
  };

  let farthestDriveLabel: string | null = null;
  if (capabilities.farthestHousehold && gettingThere.length > 1) {
    const farthest = [...gettingThere]
      .filter((l) => l.minutes != null)
      .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))[0];
    if (farthest?.minutes != null) {
      farthestDriveLabel = formatDriveMinutes(farthest.minutes);
    }
  }

  const seasonStat =
    area != null
      ? await getSeasonStat({
          lat: area.lat,
          lng: area.lng,
          month: stay.month,
        })
      : option.avgHighF != null
        ? {
            value: `${Math.round(option.avgHighF)}°`,
            qualifier: "typical high",
          }
        : null;

  const sleepsValue =
    lodging.properties.find((p) => p.sleeps != null)?.sleeps ?? null;

  const nearby =
    area != null
      ? await getNearbyPlaces({
          lat: area.lat,
          lng: area.lng,
          areaLabel: option.title,
        })
      : [];

  const lodgingTotal = lodging.properties[0]?.totalUsd ?? null;
  const perHouseholdLodgingUsd =
    lodgingTotal != null && householdCount > 0
      ? Math.round(lodgingTotal / householdCount)
      : null;

  const gasLegs = gettingThere.filter((l) => l.gasUsd != null);
  const gasEstimate =
    gasLegs.length > 0
      ? gasLegs.reduce((s, l) => s + (l.gasUsd ?? 0), 0)
      : gettingThere.length === 0
        ? 0
        : null;
  const groceries = headcount > 0 ? headcount * 28 : null;

  const costLines = [
    { label: "Lodging", amount: lodgingTotal },
    { label: "Gas round trip", amount: gasEstimate },
    { label: "Shared groceries", amount: groceries },
  ];
  const costReady =
    lodgingTotal != null && gasEstimate != null && groceries != null;

  const viewerHouseholdTotal =
    costReady && lodgingTotal != null && householdCount > 0
      ? Math.round(lodgingTotal / householdCount) +
        Math.round((gasEstimate ?? 0) / Math.max(householdCount, 1)) +
        Math.round((groceries ?? 0) / householdCount)
      : null;

  const weekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;

  return (
    <DestinationDetailView
      slug={slug}
      option={option}
      optionIndex={optionIndex}
      optionCount={optionCount}
      isLeading={isLeading}
      headcount={headcount || 0}
      householdCount={householdCount}
      responsesReceived={responses.length}
      responsesTotal={Math.max(responses.length, householdCount)}
      weekendLabel={weekendLabel}
      nightCount={stay.nights}
      driveStat={driveStat}
      farthestDriveLabel={farthestDriveLabel}
      perHouseholdLodgingUsd={perHouseholdLodgingUsd}
      seasonStat={seasonStat}
      sleepsValue={sleepsValue}
      gettingThere={gettingThere}
      nearby={nearby}
      costLines={costLines}
      costReady={Boolean(costReady)}
      viewerHouseholdTotal={viewerHouseholdTotal}
      lodging={lodging}
      capabilities={capabilities}
    />
  );
}
