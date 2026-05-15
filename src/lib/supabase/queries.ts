import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  mapGalleryItem,
  mapSurvey,
  mapSurveyResponse,
  mapTrip,
  mapTripConfirmation,
  mapTripOption,
  type GalleryItem,
  type Survey,
  type SurveyResponse,
  type Trip,
  type TripConfirmation,
  type TripOption,
} from "@/lib/supabase/mappers";

type TripRow = Database["public"]["Tables"]["trip"]["Row"];
type SurveyRow = Database["public"]["Tables"]["survey"]["Row"];
type SurveyResponseRow = Database["public"]["Tables"]["survey_response"]["Row"];
type TripConfirmationRow = Database["public"]["Tables"]["trip_confirmation"]["Row"];
type TripOptionRow = Database["public"]["Tables"]["trip_option"]["Row"];
type GalleryItemRow = Database["public"]["Tables"]["gallery_item"]["Row"];

import type { LocationOption } from "@/lib/locations";
import type { PublishedItinerary, TripItinerary } from "@/lib/itinerary";

function supabase() {
  return createSupabaseAdmin();
}

function newId() {
  return crypto.randomUUID();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

export async function listTripsForOwner(ownerId: string) {
  const { data, error } = await supabase()
    .from("trip")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throwDb(error, "listTripsForOwner");

  return ((data ?? []) as TripRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    createdAt: new Date(row.created_at),
  }));
}

export async function getTripBySlug(slug: string): Promise<Trip | null> {
  const { data, error } = await supabase()
    .from("trip")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throwDb(error, "getTripBySlug");
  return data ? mapTrip(data as TripRow) : null;
}

/** @deprecated Use getTripForOrganizer from ./collaborators */
export async function getOwnedTripBySlug(
  slug: string,
  userId: string,
): Promise<Trip | null> {
  const { getTripForOrganizer } = await import("@/lib/supabase/collaborators");
  const access = await getTripForOrganizer(slug, userId);
  return access?.trip ?? null;
}

export { getTripForOrganizer, listTripsForUser } from "@/lib/supabase/collaborators";

export async function getTripByShareToken(token: string): Promise<Trip | null> {
  const { data, error } = await supabase()
    .from("trip")
    .select("*")
    .eq("share_options_token", token)
    .maybeSingle();

  if (error) throwDb(error, "getTripByShareToken");
  return data ? mapTrip(data as TripRow) : null;
}

export async function getSurveyAndTripByPublicToken(publicToken: string) {
  const { data: surveyRow, error: surveyError } = await supabase()
    .from("survey")
    .select("*")
    .eq("public_token", publicToken)
    .maybeSingle();

  if (surveyError) throwDb(surveyError, "getSurveyByPublicToken");
  if (!surveyRow) return null;

  const survey = mapSurvey(surveyRow as SurveyRow);

  const { data: tripRow, error: tripError } = await supabase()
    .from("trip")
    .select("*")
    .eq("id", survey.tripId)
    .maybeSingle();

  if (tripError) throwDb(tripError, "getTripForSurvey");
  if (!tripRow) return null;

  return { survey, trip: mapTrip(tripRow as TripRow) };
}

export async function createTrip(input: {
  slug: string;
  name: string;
  tagline: string | null;
  destinationNotes: string | null;
  targetBudget: string | null;
  shareOptionsToken: string;
  ownerId: string;
}): Promise<Trip> {
  const now = new Date().toISOString();
  const { data, error } = await supabase()
    .from("trip")
    .insert({
      id: newId(),
      slug: input.slug,
      name: input.name,
      tagline: input.tagline,
      destination_notes: input.destinationNotes,
      target_budget: input.targetBudget,
      share_options_token: input.shareOptionsToken,
      owner_id: input.ownerId,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throwDb(error, "createTrip");
  return mapTrip(data as TripRow);
}

export async function createSurvey(input: {
  tripId: string;
  publicToken: string;
  title: string;
}): Promise<Survey> {
  const { data, error } = await supabase()
    .from("survey")
    .insert({
      id: newId(),
      trip_id: input.tripId,
      public_token: input.publicToken,
      title: input.title,
    })
    .select("*")
    .single();

  if (error) throwDb(error, "createSurvey");
  return mapSurvey(data as SurveyRow);
}

export async function updateTripById(
  tripId: string,
  patch: {
    name?: string;
    tagline?: string | null;
    destinationNotes?: string | null;
    targetBudget?: string | null;
    tripStart?: Date | null;
    tripEnd?: Date | null;
    proposedDateSlots?: string[];
    locationOptions?: LocationOption[];
    selectedLocationId?: string | null;
    selectedWeekendFriday?: string | null;
    planHeadcount?: number | null;
    itinerary?: TripItinerary;
    publishedItinerary?: PublishedItinerary | null;
  },
) {
  const { error } = await supabase()
    .from("trip")
    .update({
      name: patch.name,
      tagline: patch.tagline,
      destination_notes: patch.destinationNotes,
      target_budget: patch.targetBudget,
      trip_start:
        patch.tripStart !== undefined
          ? patch.tripStart?.toISOString() ?? null
          : undefined,
      trip_end:
        patch.tripEnd !== undefined ? patch.tripEnd?.toISOString() ?? null : undefined,
      proposed_date_slots: patch.proposedDateSlots,
      location_options: patch.locationOptions,
      selected_location_id: patch.selectedLocationId,
      selected_weekend_friday: patch.selectedWeekendFriday,
      plan_headcount: patch.planHeadcount,
      itinerary: patch.itinerary,
      published_itinerary: patch.publishedItinerary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId);

  if (error) throwDb(error, "updateTripById");
}

export async function getSurveyByTripId(tripId: string): Promise<Survey | null> {
  const { data, error } = await supabase()
    .from("survey")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) throwDb(error, "getSurveyByTripId");
  return data ? mapSurvey(data as SurveyRow) : null;
}

export async function listSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  const { data, error } = await supabase()
    .from("survey_response")
    .select("*")
    .eq("survey_id", surveyId)
    .order("submitted_at", { ascending: false });

  if (error) throwDb(error, "listSurveyResponses");
  return (data ?? []).map((row) => mapSurveyResponse(row as SurveyResponseRow));
}

export async function insertSurveyResponse(input: {
  surveyId: string;
  respondentName: string;
  respondentEmail: string | null;
  selectedSlots: string[];
  selectedLocations: string[];
  adultCount: number;
  kidCount: number;
  attendeeCount: number;
  notes: string | null;
}) {
  const { error } = await supabase().from("survey_response").insert({
    id: newId(),
    survey_id: input.surveyId,
    respondent_name: input.respondentName,
    respondent_email: input.respondentEmail,
    selected_slots: input.selectedSlots,
    selected_locations: input.selectedLocations,
    adult_count: input.adultCount,
    kid_count: input.kidCount,
    attendee_count: input.attendeeCount,
    notes: input.notes,
  });

  if (error) throwDb(error, "insertSurveyResponse");
}

export async function deleteSurveyResponse(surveyId: string, responseId: string) {
  const { error } = await supabase()
    .from("survey_response")
    .delete()
    .eq("id", responseId)
    .eq("survey_id", surveyId);

  if (error) throwDb(error, "deleteSurveyResponse");
}

export async function listTripOptions(tripId: string): Promise<TripOption[]> {
  const { data, error } = await supabase()
    .from("trip_option")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throwDb(error, "listTripOptions");
  return (data ?? []).map((row) => mapTripOption(row as TripOptionRow));
}

export async function countTripOptions(tripId: string): Promise<number> {
  const { count, error } = await supabase()
    .from("trip_option")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if (error) throwDb(error, "countTripOptions");
  return count ?? 0;
}

export async function insertTripOption(input: {
  tripId: string;
  title: string;
  summary: string | null;
  contentMarkdown: string;
  sortOrder: number;
}) {
  const { error } = await supabase().from("trip_option").insert({
    id: newId(),
    trip_id: input.tripId,
    title: input.title,
    summary: input.summary,
    content_markdown: input.contentMarkdown,
    sort_order: input.sortOrder,
  });

  if (error) throwDb(error, "insertTripOption");
}

export async function deleteTripOption(tripId: string, optionId: string) {
  const { error } = await supabase()
    .from("trip_option")
    .delete()
    .eq("id", optionId)
    .eq("trip_id", tripId);

  if (error) throwDb(error, "deleteTripOption");
}

export async function listGalleryItems(tripId: string): Promise<GalleryItem[]> {
  const { data, error } = await supabase()
    .from("gallery_item")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  if (error) throwDb(error, "listGalleryItems");
  return (data ?? []).map((row) => mapGalleryItem(row as GalleryItemRow));
}

export async function insertGalleryItem(input: {
  tripId: string;
  url: string;
  mediaType: string;
  caption: string | null;
}) {
  const { error } = await supabase().from("gallery_item").insert({
    id: newId(),
    trip_id: input.tripId,
    url: input.url,
    media_type: input.mediaType,
    caption: input.caption,
  });

  if (error) throwDb(error, "insertGalleryItem");
}

export async function deleteGalleryItem(tripId: string, itemId: string) {
  const { error } = await supabase()
    .from("gallery_item")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", tripId);

  if (error) throwDb(error, "deleteGalleryItem");
}

export async function listTripConfirmations(tripId: string): Promise<TripConfirmation[]> {
  const { data, error } = await supabase()
    .from("trip_confirmation")
    .select("*")
    .eq("trip_id", tripId)
    .order("updated_at", { ascending: false });

  if (error) throwDb(error, "listTripConfirmations");
  return (data ?? []).map((row) => mapTripConfirmation(row as TripConfirmationRow));
}

export async function upsertTripConfirmation(
  tripId: string,
  existingId: string | null,
  payload: {
    respondentName: string;
    respondentEmail: string | null;
    status: "confirmed" | "declined";
    adultCount: number;
    kidCount: number;
    weekendFriday: string;
    locationId: string;
  },
) {
  const row = {
    trip_id: tripId,
    respondent_name: payload.respondentName,
    respondent_email: payload.respondentEmail,
    status: payload.status,
    adult_count: payload.adultCount,
    kid_count: payload.kidCount,
    weekend_friday: payload.weekendFriday,
    location_id: payload.locationId,
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    const { error } = await supabase()
      .from("trip_confirmation")
      .update(row)
      .eq("id", existingId);
    if (error) throwDb(error, "updateTripConfirmation");
  } else {
    const { error } = await supabase()
      .from("trip_confirmation")
      .insert({ id: newId(), ...row });
    if (error) throwDb(error, "insertTripConfirmation");
  }
}

export async function listSurveyResponsesForChat(surveyId: string) {
  const { data, error } = await supabase()
    .from("survey_response")
    .select(
      "respondent_name, adult_count, kid_count, attendee_count, selected_slots, selected_locations, notes",
    )
    .eq("survey_id", surveyId);

  if (error) throwDb(error, "listSurveyResponsesForChat");
  return (data ?? []).map((row) => ({
    respondentName: row.respondent_name,
    adultCount: row.adult_count,
    kidCount: row.kid_count,
    attendeeCount: row.attendee_count,
    selectedSlots: row.selected_slots ?? [],
    selectedLocations: row.selected_locations ?? [],
    notes: row.notes,
  }));
}
