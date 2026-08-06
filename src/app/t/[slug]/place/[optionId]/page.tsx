import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { DestinationDetailView } from "@/components/DestinationDetailView";
import { aggregateLocationAvailability } from "@/lib/availability";
import { summarizeGroupDriveTimes } from "@/lib/driveTimes";
import {
  filterLodgingByHeadcount,
  lodgingForLocation,
} from "@/lib/lodging";
import {
  findLocationById,
  normalizeLocationOptions,
} from "@/lib/locations";
import { formatDriveTime } from "@/lib/units";
import { partyTotal } from "@/lib/partyCount";
import {
  getSurveyByTripId,
  getTripForOrganizer,
  listSurveyResponses,
} from "@/lib/supabase/queries";
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

  const optionIndex = Math.max(
    1,
    locations.findIndex((l) => l.id === option.id) + 1,
  );
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

  const hasLodgingField = option.lodging != null;
  const lodging = filterLodgingByHeadcount(
    hasLodgingField
      ? lodgingForLocation(option)
      : { status: "pending", properties: [] },
    headcount || null,
  );

  const groupDrive = summarizeGroupDriveTimes(
    responses.map((r) => ({
      householdLabel: r.respondentName,
      homeCity: r.homeCity,
      homeState: r.homeState,
      driveMinutes: option.driveMinutesFromOrigin,
    })),
  );

  const fitLines: string[] = [];
  for (const r of responses.slice(0, 3)) {
    const who = r.respondentName?.trim() || "A household";
    if (r.homeCity && option.driveMinutesFromOrigin != null) {
      const drive = formatDriveTime(option.driveMinutesFromOrigin);
      fitLines.push(
        drive
          ? `${who} from ${r.homeCity} — about ${drive} on the shared origin clock.`
          : `${who} from ${r.homeCity}.`,
      );
    } else if (r.homeCity) {
      fitLines.push(`${who} listed home as ${r.homeCity}.`);
    }
  }
  if (headcount > 0) {
    fitLines.push(
      `Crew size locked around ${headcount} people for lodging capacity.`,
    );
  }

  const nights = 3;
  const lodgingTotal = lodging.properties[0]?.totalUsd;
  const gasEstimate =
    option.driveMinutesFromOrigin != null
      ? Math.round((option.driveMinutesFromOrigin / 60) * 2 * 8)
      : undefined;
  const groceries = headcount > 0 ? headcount * 18 : undefined;
  const costLines = [
    { label: "Lodging", amount: lodgingTotal },
    { label: "Gas round trip", amount: gasEstimate },
    { label: "Shared groceries", amount: groceries },
  ];
  const viewerHouseholdTotal =
    lodgingTotal != null && householdCount > 0
      ? Math.round(lodgingTotal / householdCount) +
        (gasEstimate ?? 0) +
        (groceries != null ? Math.round(groceries / householdCount) : 0)
      : null;

  const weekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;

  const farthestDriveLabel =
    groupDrive.farthest != null
      ? formatDriveTime(groupDrive.farthest.minutes) || null
      : null;

  return (
    <DestinationDetailView
      slug={slug}
      option={option}
      optionIndex={optionIndex}
      optionCount={locations.length}
      isLeading={isLeading}
      headcount={headcount || 0}
      householdCount={householdCount}
      responsesReceived={responses.length}
      responsesTotal={Math.max(responses.length, householdCount)}
      weekendLabel={weekendLabel}
      nightCount={nights}
      viewerDriveMinutes={option.driveMinutesFromOrigin}
      farthestDriveLabel={farthestDriveLabel}
      nearby={[]}
      fitLines={fitLines.slice(0, 3)}
      costLines={costLines}
      viewerHouseholdTotal={viewerHouseholdTotal}
      lodging={lodging}
    />
  );
}
