import type { TripItinerary } from "@/lib/itinerary";
import { isMissingTableError } from "@/lib/supabase/errors";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { updateTripById } from "@/lib/supabase/queries";

function supabase() {
  return createSupabaseAdmin();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

const emptyItinerary: TripItinerary = { days: [] };

/** Clears all trip planning data; keeps name, slug, collaborators, survey link, and gallery. */
export async function resetTripPlanning(tripId: string, surveyId: string | null) {
  await updateTripById(tripId, {
    tagline: null,
    destinationNotes: null,
    targetBudget: null,
    tripStart: null,
    tripEnd: null,
    proposedDateSlots: [],
    locationOptions: [],
    selectedLocationId: null,
    selectedWeekendFriday: null,
    venueOptions: [],
    selectedVenueId: null,
    ballotStatus: "draft",
    ballotOpenedAt: null,
    ballotClosedAt: null,
    planHeadcount: null,
    itinerary: emptyItinerary,
    publishedItinerary: null,
  });

  if (surveyId) {
    const { error } = await supabase()
      .from("survey_response")
      .delete()
      .eq("survey_id", surveyId);
    if (error) throwDb(error, "resetTripPlanning.surveyResponses");
  }

  const { error: confirmationsError } = await supabase()
    .from("trip_confirmation")
    .delete()
    .eq("trip_id", tripId);
  if (confirmationsError && !isMissingTableError(confirmationsError)) {
    throwDb(confirmationsError, "resetTripPlanning.confirmations");
  }

  const { error: optionsError } = await supabase()
    .from("trip_option")
    .delete()
    .eq("trip_id", tripId);
  if (optionsError && !isMissingTableError(optionsError)) {
    throwDb(optionsError, "resetTripPlanning.options");
  }
}

export async function deleteTripById(tripId: string) {
  const { error } = await supabase().from("trip").delete().eq("id", tripId);
  if (error) throwDb(error, "deleteTripById");
}
