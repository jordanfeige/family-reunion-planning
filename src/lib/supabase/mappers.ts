import type { LocationOption } from "@/lib/locations";
import {
  normalizeBallotStatus,
  normalizeVenueOptions,
  type BallotStatus,
  type VenueOption,
} from "@/lib/venues";
import type { PublishedItinerary, TripItinerary } from "@/lib/itinerary";
import type { Database } from "@/lib/supabase/database.types";

type TripRow = Database["public"]["Tables"]["trip"]["Row"];
type SurveyRow = Database["public"]["Tables"]["survey"]["Row"];
type SurveyResponseRow = Database["public"]["Tables"]["survey_response"]["Row"];
type TripConfirmationRow = Database["public"]["Tables"]["trip_confirmation"]["Row"];
type TripOptionRow = Database["public"]["Tables"]["trip_option"]["Row"];
type GalleryItemRow = Database["public"]["Tables"]["gallery_item"]["Row"];

export type Trip = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  destinationNotes: string | null;
  targetBudget: string | null;
  tripStart: Date | null;
  tripEnd: Date | null;
  proposedDateSlots: string[];
  locationOptions: LocationOption[];
  selectedLocationId: string | null;
  selectedWeekendFriday: string | null;
  venueOptions: VenueOption[];
  selectedVenueId: string | null;
  ballotStatus: BallotStatus;
  ballotOpenedAt: Date | null;
  ballotClosedAt: Date | null;
  planHeadcount: number | null;
  itinerary: TripItinerary;
  publishedItinerary: PublishedItinerary | null;
  shareOptionsToken: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Survey = {
  id: string;
  tripId: string;
  publicToken: string;
  title: string;
  createdAt: Date;
};

export type SurveyResponse = {
  id: string;
  surveyId: string;
  respondentName: string;
  respondentEmail: string | null;
  selectedSlots: string[];
  selectedLocations: string[];
  adultCount: number;
  kidCount: number;
  attendeeCount: number;
  notes: string | null;
  submittedAt: Date;
};

export type TripConfirmation = {
  id: string;
  tripId: string;
  respondentName: string;
  respondentEmail: string | null;
  status: "confirmed" | "declined";
  adultCount: number;
  kidCount: number;
  weekendFriday: string;
  locationId: string;
  submittedAt: Date;
  updatedAt: Date;
};

export type TripOption = {
  id: string;
  tripId: string;
  title: string;
  summary: string | null;
  contentMarkdown: string;
  sortOrder: number;
  createdAt: Date;
};

export type GalleryItem = {
  id: string;
  tripId: string;
  url: string;
  mediaType: string;
  caption: string | null;
  createdAt: Date;
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    destinationNotes: row.destination_notes,
    targetBudget: row.target_budget,
    tripStart: parseDate(row.trip_start),
    tripEnd: parseDate(row.trip_end),
    proposedDateSlots: row.proposed_date_slots ?? [],
    locationOptions: (row.location_options ?? []) as LocationOption[],
    selectedLocationId: row.selected_location_id,
    selectedWeekendFriday: row.selected_weekend_friday,
    venueOptions: normalizeVenueOptions(row.venue_options),
    selectedVenueId: row.selected_venue_id,
    ballotStatus: normalizeBallotStatus(row.ballot_status),
    ballotOpenedAt: parseDate(row.ballot_opened_at),
    ballotClosedAt: parseDate(row.ballot_closed_at),
    planHeadcount: row.plan_headcount,
    itinerary: (row.itinerary ?? { days: [] }) as TripItinerary,
    publishedItinerary: row.published_itinerary as PublishedItinerary | null,
    shareOptionsToken: row.share_options_token,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapSurvey(row: SurveyRow): Survey {
  return {
    id: row.id,
    tripId: row.trip_id,
    publicToken: row.public_token,
    title: row.title,
    createdAt: new Date(row.created_at),
  };
}

export function mapSurveyResponse(row: SurveyResponseRow): SurveyResponse {
  return {
    id: row.id,
    surveyId: row.survey_id,
    respondentName: row.respondent_name,
    respondentEmail: row.respondent_email,
    selectedSlots: row.selected_slots ?? [],
    selectedLocations: row.selected_locations ?? [],
    adultCount: row.adult_count,
    kidCount: row.kid_count,
    attendeeCount: row.attendee_count,
    notes: row.notes,
    submittedAt: new Date(row.submitted_at),
  };
}

export function mapTripConfirmation(row: TripConfirmationRow): TripConfirmation {
  return {
    id: row.id,
    tripId: row.trip_id,
    respondentName: row.respondent_name,
    respondentEmail: row.respondent_email,
    status: row.status as "confirmed" | "declined",
    adultCount: row.adult_count,
    kidCount: row.kid_count,
    weekendFriday: row.weekend_friday,
    locationId: row.location_id,
    submittedAt: new Date(row.submitted_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapTripOption(row: TripOptionRow): TripOption {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    summary: row.summary,
    contentMarkdown: row.content_markdown,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
  };
}

export function mapGalleryItem(row: GalleryItemRow): GalleryItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    url: row.url,
    mediaType: row.media_type,
    caption: row.caption,
    createdAt: new Date(row.created_at),
  };
}

export function tripToRow(
  trip: Partial<Trip> & { id?: string },
): Database["public"]["Tables"]["trip"]["Update"] {
  return {
    slug: trip.slug,
    name: trip.name,
    tagline: trip.tagline,
    destination_notes: trip.destinationNotes,
    target_budget: trip.targetBudget,
    trip_start: trip.tripStart?.toISOString() ?? null,
    trip_end: trip.tripEnd?.toISOString() ?? null,
    proposed_date_slots: trip.proposedDateSlots,
    location_options: trip.locationOptions,
    selected_location_id: trip.selectedLocationId,
    selected_weekend_friday: trip.selectedWeekendFriday,
    venue_options: trip.venueOptions,
    selected_venue_id: trip.selectedVenueId,
    ballot_status: trip.ballotStatus,
    ballot_opened_at: trip.ballotOpenedAt?.toISOString() ?? null,
    ballot_closed_at: trip.ballotClosedAt?.toISOString() ?? null,
    plan_headcount: trip.planHeadcount,
    itinerary: trip.itinerary,
    published_itinerary: trip.publishedItinerary,
    share_options_token: trip.shareOptionsToken,
    owner_id: trip.ownerId,
    updated_at: trip.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}
