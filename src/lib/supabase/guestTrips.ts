import { createSupabaseAdmin } from "@/lib/supabase/server";
import { mapTrip } from "@/lib/supabase/mappers";
import type { Database } from "@/lib/supabase/database.types";

type TripRow = Database["public"]["Tables"]["trip"]["Row"];

export type GuestTripStage = "survey" | "vote" | "rsvp";

export type GuestTripParticipation = {
  tripId: string;
  tripName: string;
  tagline: string | null;
  stage: GuestTripStage;
  stageLabel: string;
  href: string;
  ctaLabel: string;
};

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

const STAGE_RANK: Record<GuestTripStage, number> = {
  survey: 1,
  vote: 2,
  rsvp: 3,
};

/**
 * Trips the signed-in user has participated in as family (survey / vote / RSVP),
 * excluding trips they already organize.
 */
export async function listGuestTripsForUser(
  userId: string,
  _email: string | null | undefined,
  excludeTripIds: string[] = [],
): Promise<GuestTripParticipation[]> {
  const supabase = createSupabaseAdmin();
  const exclude = new Set(excludeTripIds);
  const byTrip = new Map<
    string,
    {
      stage: GuestTripStage;
      stageLabel: string;
      surveyToken: string | null;
      shareToken: string | null;
      tripName: string;
      tagline: string | null;
    }
  >();

  function upsert(
    tripId: string,
    stage: GuestTripStage,
    stageLabel: string,
    meta: {
      surveyToken?: string | null;
      shareToken?: string | null;
      tripName?: string;
      tagline?: string | null;
    },
  ) {
    if (exclude.has(tripId)) return;
    const existing = byTrip.get(tripId);
    if (existing && STAGE_RANK[existing.stage] > STAGE_RANK[stage]) {
      if (meta.surveyToken) existing.surveyToken = meta.surveyToken;
      if (meta.shareToken) existing.shareToken = meta.shareToken;
      return;
    }
    byTrip.set(tripId, {
      stage,
      stageLabel,
      surveyToken: meta.surveyToken ?? existing?.surveyToken ?? null,
      shareToken: meta.shareToken ?? existing?.shareToken ?? null,
      tripName: meta.tripName ?? existing?.tripName ?? "Family trip",
      tagline: meta.tagline !== undefined ? meta.tagline : (existing?.tagline ?? null),
    });
  }

  const { data: surveyRows, error: surveyErr } = await supabase
    .from("survey_response")
    .select("survey_id")
    .eq("user_id", userId);
  if (surveyErr) throwDb(surveyErr, "listGuestTrips.survey");

  const surveyIds = [
    ...new Set((surveyRows ?? []).map((r) => (r as { survey_id: string }).survey_id)),
  ];

  if (surveyIds.length > 0) {
    const { data: surveys, error: sErr } = await supabase
      .from("survey")
      .select("id, trip_id, public_token")
      .in("id", surveyIds);
    if (sErr) throwDb(sErr, "listGuestTrips.surveys");

    const tripIds = [...new Set((surveys ?? []).map((s) => (s as { trip_id: string }).trip_id))];
    const trips = await loadTripsByIds(tripIds);

    for (const s of surveys ?? []) {
      const row = s as { id: string; trip_id: string; public_token: string };
      const trip = trips.get(row.trip_id);
      if (!trip) continue;
      upsert(row.trip_id, "survey", "Survey", {
        surveyToken: row.public_token,
        shareToken: trip.shareOptionsToken,
        tripName: trip.name,
        tagline: trip.tagline,
      });
    }
  }

  const { data: ballotRows, error: ballotErr } = await supabase
    .from("trip_ballot_vote")
    .select("trip_id")
    .eq("user_id", userId);
  if (ballotErr) throwDb(ballotErr, "listGuestTrips.ballot");

  const ballotTripIds = [
    ...new Set((ballotRows ?? []).map((r) => (r as { trip_id: string }).trip_id)),
  ];
  if (ballotTripIds.length > 0) {
    const trips = await loadTripsByIds(ballotTripIds);
    const tokens = await loadSurveyTokensByTripIds(ballotTripIds);
    for (const tripId of ballotTripIds) {
      const trip = trips.get(tripId);
      if (!trip) continue;
      upsert(tripId, "vote", "Vote", {
        surveyToken: tokens.get(tripId) ?? null,
        shareToken: trip.shareOptionsToken,
        tripName: trip.name,
        tagline: trip.tagline,
      });
    }
  }

  const { data: confirmRows, error: confirmErr } = await supabase
    .from("trip_confirmation")
    .select("trip_id, status")
    .eq("user_id", userId);
  if (confirmErr) throwDb(confirmErr, "listGuestTrips.confirm");

  const confirmByTrip = new Map<string, string>();
  for (const row of confirmRows ?? []) {
    const r = row as { trip_id: string; status: string };
    confirmByTrip.set(r.trip_id, r.status);
  }
  const confirmTripIds = [...confirmByTrip.keys()];
  if (confirmTripIds.length > 0) {
    const trips = await loadTripsByIds(confirmTripIds);
    const tokens = await loadSurveyTokensByTripIds(confirmTripIds);
    for (const tripId of confirmTripIds) {
      const trip = trips.get(tripId);
      if (!trip) continue;
      const status = confirmByTrip.get(tripId);
      const yes = status === "confirmed";
      upsert(tripId, "rsvp", yes ? "RSVP · Yes" : "RSVP · No", {
        surveyToken: tokens.get(tripId) ?? null,
        shareToken: trip.shareOptionsToken,
        tripName: trip.name,
        tagline: trip.tagline,
      });
    }
  }

  // Claim usually runs before this query; user_id matches are the source of truth.
  const results: GuestTripParticipation[] = [];
  for (const [tripId, meta] of byTrip) {
    const href =
      meta.stage === "rsvp" && meta.shareToken
        ? `/o/${meta.shareToken}`
        : meta.stage === "vote" && meta.surveyToken
          ? `/r/${meta.surveyToken}/vote`
          : meta.surveyToken
            ? `/r/${meta.surveyToken}`
            : meta.shareToken
              ? `/o/${meta.shareToken}`
              : null;
    if (!href) continue;

    const ctaLabel =
      meta.stage === "rsvp"
        ? "View plan"
        : meta.stage === "vote"
          ? "Open ballot"
          : "Open survey";

    results.push({
      tripId,
      tripName: meta.tripName,
      tagline: meta.tagline,
      stage: meta.stage,
      stageLabel: meta.stageLabel,
      href,
      ctaLabel,
    });
  }

  results.sort((a, b) => a.tripName.localeCompare(b.tripName));
  return results;
}

async function loadTripsByIds(ids: string[]) {
  const map = new Map<string, ReturnType<typeof mapTrip>>();
  if (ids.length === 0) return map;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("trip").select("*").in("id", ids);
  if (error) throwDb(error, "listGuestTrips.loadTrips");
  for (const row of data ?? []) {
    const trip = mapTrip(row as TripRow);
    map.set(trip.id, trip);
  }
  return map;
}

async function loadSurveyTokensByTripIds(tripIds: string[]) {
  const map = new Map<string, string>();
  if (tripIds.length === 0) return map;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("survey")
    .select("trip_id, public_token")
    .in("trip_id", tripIds);
  if (error) throwDb(error, "listGuestTrips.surveyTokens");
  for (const row of data ?? []) {
    const r = row as { trip_id: string; public_token: string };
    map.set(r.trip_id, r.public_token);
  }
  return map;
}
