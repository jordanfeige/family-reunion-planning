"use server";

import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { hasAnthropicApiKey, plannerModel } from "@/lib/ai";
import {
  findLocationById,
  normalizeLocationOptions,
  type LocationOption,
} from "@/lib/locations";
import {
  locationSuggestionsSchema,
  mergeLocationSuggestions,
  type LocationSuggestion,
} from "@/lib/locationSuggestions";
import {
  findVenueById,
  normalizeVenueCategory,
  normalizeVenueOptions,
  type VenueOption,
} from "@/lib/venues";
import { venueSuggestionsSchema, type VenueSuggestion } from "@/lib/venueSuggestions";
import { resolveVoterKey } from "@/lib/ballotVoter";
import { normalizePriceType, normalizePriceUnit } from "@/lib/venuePrices";
import { enrichVenueOption } from "@/lib/venueEnrichment";
import { findSurveyResponseByEmail } from "@/lib/supabase/ballotVotes";
import {
  normalizeVenueBookingStatus,
  type VenueBookingStatus,
} from "@/lib/venues";
import {
  itineraryDaySchema,
  itineraryFromGenerated,
  itineraryGenerationSchema,
  itineraryHasContent,
  normalizeItinerary,
  type PublishedItinerary,
  type BlockStatus,
  type DayKey,
} from "@/lib/itinerary";
import { appOrigin } from "@/lib/appOrigin";
import { sendCollaboratorInviteEmail } from "@/lib/sendCollaboratorInviteEmail";
import { sendSurveyConfirmationEmail } from "@/lib/sendSurveyConfirmationEmail";
import {
  addTripMember,
  deleteTripInvite,
  deleteTripMember,
  getTripInviteByEmail,
  getTripMemberByUserId,
  getUserByEmail,
  getUserById,
  insertTripInvite,
  listTripInvites,
  listTripMembers,
} from "@/lib/supabase/collaborators";
import { canManageCollaborators, canRemoveMembers } from "@/lib/tripAccess";
import { getSurveyNextSteps } from "@/lib/surveyNextSteps";
import type { SurveySummaryInput } from "@/lib/surveySummary";
import { filterValidFridays, formatWeekendLabel, isValidFridayIso, parseProposedWeekends } from "@/lib/weekends";
import { newSecretToken, newTripSlug } from "@/lib/tokens";
import {
  countTripOptions,
  createSurvey,
  createTrip,
  deleteGalleryItem,
  deleteSurveyResponse,
  deleteTripOption,
  getTripForOrganizer,
  getSurveyAndTripByPublicToken,
  getSurveyByTripId,
  getSurveyResponseByUserId,
  getTripConfirmationByUserId,
  insertGalleryItem,
  insertSurveyResponse,
  upsertSurveyResponseForUser,
  upsertTripConfirmationForUser,
  insertTripOption,
  listSurveyResponsesForChat,
  listTripConfirmations,
  updateTripById,
  upsertTripConfirmation,
  getTripByShareToken,
} from "@/lib/supabase/queries";
import { deleteTripById, resetTripPlanning } from "@/lib/supabase/tripReset";
import { guestSessionFromUser } from "@/lib/guestSession";
import {
  EXPENSE_CATEGORIES,
  SPLIT_METHODS,
  normalizeExpenseCategory,
  normalizeSplitMethod,
  parseDollarsToCents,
} from "@/lib/budget";
import {
  countTripExpenses,
  deleteTripContributionRow,
  deleteTripExpenseRow,
  ensureBudgetContributionsFromConfirmations,
  getTripContributionById,
  getTripExpenseById,
  insertTripExpense,
  listTripContributions,
  listTripExpenses,
  updateTripContributionRow,
  updateTripExpenseRow,
  upsertTripContributionRow,
  countConfirmedHouseholds,
} from "@/lib/supabase/budget";
import type { TripContribution, TripExpense } from "@/lib/supabase/mappers";

async function requireSessionUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login?callbackUrl=/dashboard");
  return id;
}

async function getGuestSessionForPublicSubmit() {
  const session = await auth();
  return guestSessionFromUser(session?.user ?? {});
}

export async function createTripAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Give your gathering a name.");
  }

  const slug = newTripSlug();
  const shareOptionsToken = newSecretToken();
  const surveyToken = newSecretToken();

  const trip = await createTrip({
    slug,
    name,
    tagline: String(formData.get("tagline") ?? "").trim() || null,
    destinationNotes: String(formData.get("destination") ?? "").trim() || null,
    targetBudget: String(formData.get("budget") ?? "").trim() || null,
    shareOptionsToken,
    ownerId: userId,
  });

  await createSurvey({
    tripId: trip.id,
    publicToken: surveyToken,
    title: "When can your crew join?",
  });

  redirect(`/t/${slug}#planner`);
}

async function loadTripForOrganizer(slug: string, userId: string) {
  const access = await getTripForOrganizer(slug, userId);
  if (!access) throw new Error("Trip not found.");
  return access;
}

function assertTripNameConfirmation(tripName: string, confirm: string) {
  if (confirm.trim() !== tripName.trim()) {
    throw new Error(`Type "${tripName}" exactly to confirm.`);
  }
}

async function loadTripAsOwner(slug: string, userId: string) {
  const access = await loadTripForOrganizer(slug, userId);
  if (access.role !== "owner") {
    throw new Error("Only the trip owner can do that.");
  }
  return access;
}

export async function updateTripBasicsAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);

  const proposedDateSlots = parseProposedWeekends(
    String(formData.get("proposed_weekends") ?? ""),
  );

  await updateTripById(trip.id, {
    name: String(formData.get("name") ?? trip.name).trim() || trip.name,
    destinationNotes: String(formData.get("destination") ?? "").trim() || null,
    targetBudget: String(formData.get("budget") ?? "").trim() || null,
    proposedDateSlots,
  });

  revalidatePath(`/t/${slug}`);
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function addTripOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const contentMarkdown = String(formData.get("content") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  if (!slug || !title || !contentMarkdown) {
    throw new Error("Title and plan details are required.");
  }

  const { trip } = await loadTripForOrganizer(slug, userId);

  const sortOrder = await countTripOptions(trip.id);
  await insertTripOption({
    tripId: trip.id,
    title,
    summary,
    contentMarkdown,
    sortOrder,
  });

  revalidatePath(`/t/${slug}`);
}

export async function deleteTripOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const optionId = String(formData.get("option_id") ?? "").trim();
  if (!slug || !optionId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);

  await deleteTripOption(trip.id, optionId);
  revalidatePath(`/t/${slug}`);
}

export async function addGalleryItemAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const mediaType = String(formData.get("media_type") ?? "image").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  if (!slug || !url) throw new Error("Upload did not return a URL.");

  const { trip } = await loadTripForOrganizer(slug, userId);

  await insertGalleryItem({
    tripId: trip.id,
    url,
    mediaType: mediaType === "video" ? "video" : "image",
    caption,
  });

  revalidatePath(`/t/${slug}`);
}

export async function deleteGalleryItemAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const itemId = String(formData.get("item_id") ?? "").trim();
  if (!slug || !itemId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);

  await deleteGalleryItem(trip.id, itemId);
  revalidatePath(`/t/${slug}`);
}

export async function submitSurveyResponseAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const respondentName = String(formData.get("name") ?? "").trim();
  const adultCount = Math.max(
    0,
    Number.parseInt(String(formData.get("adult_count") ?? "1"), 10) || 0,
  );
  const kidCount = Math.max(
    0,
    Number.parseInt(String(formData.get("kid_count") ?? "0"), 10) || 0,
  );
  const attendeeCount = Math.max(1, adultCount + kidCount);
  if (adultCount < 1 && kidCount < 1) {
    throw new Error("Please enter at least one adult or kid in your party.");
  }
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const respondentEmail = String(formData.get("email") ?? "").trim() || null;
  const sendEmailCopy = formData.get("send_email_copy") === "1";

  if (!token || !respondentName) {
    throw new Error("Please add your name.");
  }

  const selected = formData.getAll("slot") as string[];
  const selectedLocationIds = formData.getAll("location") as string[];

  const surveyRow = await getSurveyAndTripByPublicToken(token);
  if (!surveyRow) throw new Error("This link is not valid anymore.");

  const allowed = filterValidFridays(surveyRow.trip.proposedDateSlots ?? []);
  if (allowed.length > 0 && selected.length === 0) {
    throw new Error("Please select at least one weekend that works for you.");
  }
  const validSelected = selected.filter((s) => allowed.includes(s));
  if (selected.some((s) => !allowed.includes(s))) {
    throw new Error("Invalid weekend selection.");
  }

  const locationOptions = normalizeLocationOptions(
    surveyRow.trip.locationOptions ?? [],
  );
  const allowedLocationIds = locationOptions.map((l) => l.id);
  if (allowedLocationIds.length > 0 && selectedLocationIds.length === 0) {
    throw new Error("Please select at least one location you are interested in.");
  }
  const validLocations = selectedLocationIds.filter((id) =>
    allowedLocationIds.includes(id),
  );
  if (selectedLocationIds.some((id) => !allowedLocationIds.includes(id))) {
    throw new Error("Invalid location selection.");
  }

  const guest = await getGuestSessionForPublicSubmit();

  if (guest) {
    const lockedEmail = guest.email.trim().toLowerCase();
    await upsertSurveyResponseForUser({
      surveyId: surveyRow.survey.id,
      userId: guest.userId,
      respondentName: respondentName || guest.name,
      respondentEmail: lockedEmail,
      selectedSlots: validSelected,
      selectedLocations: validLocations,
      adultCount,
      kidCount,
      attendeeCount,
      notes,
    });
  } else {
    await insertSurveyResponse({
      surveyId: surveyRow.survey.id,
      respondentName,
      respondentEmail,
      selectedSlots: validSelected,
      selectedLocations: validLocations,
      adultCount,
      kidCount,
      attendeeCount,
      notes,
    });
  }

  let emailed = false;
  if (sendEmailCopy && respondentEmail) {
    const trip = surveyRow.trip;
    const planReady = Boolean(trip.selectedLocationId && trip.selectedWeekendFriday);
    const publishedRaw = trip.publishedItinerary as PublishedItinerary | null;
    const planPublished = Boolean(
      publishedRaw && itineraryHasContent(normalizeItinerary(publishedRaw)),
    );
    const lockedLocation = trip.selectedLocationId
      ? findLocationById(locationOptions, trip.selectedLocationId)
      : null;
    const lockedWeekendLabel = trip.selectedWeekendFriday
      ? formatWeekendLabel(trip.selectedWeekendFriday)
      : null;
    const planUrl = `${appOrigin()}/o/${trip.shareOptionsToken}`;
    const nextSteps = getSurveyNextSteps({
      planReady,
      planPublished,
      lockedLocationTitle: lockedLocation?.title ?? null,
      lockedWeekendLabel,
      submitted: true,
    });

    const summaryInput: SurveySummaryInput = {
      tripName: trip.name,
      respondentName,
      adultCount,
      kidCount,
      notes,
      selectedSlots: validSelected,
      selectedLocations: validLocations,
      locationOptions,
      nextSteps,
      planUrl: planReady ? planUrl : null,
    };
    const result = await sendSurveyConfirmationEmail(respondentEmail, summaryInput);
    emailed = result.ok;
  }

  revalidatePath(`/r/${token}`);
  revalidatePath(`/t/${surveyRow.trip.slug}`);
  const qs = emailed ? "?thanks=1&emailed=1" : "?thanks=1";
  redirect(`/r/${token}${qs}`);
}

export async function deleteSurveyResponseAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const responseId = String(formData.get("response_id") ?? "").trim();
  if (!slug || !responseId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const survey = await getSurveyByTripId(trip.id);
  if (!survey) throw new Error("Survey not found.");

  await deleteSurveyResponse(survey.id, responseId);
  revalidatePath(`/t/${slug}`);
}

export async function addLocationOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim() || undefined;
  if (!slug || !title) throw new Error("Location title is required.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const existing = normalizeLocationOptions(trip.locationOptions ?? []);
  const next: LocationOption[] = [
    ...existing,
    { id: crypto.randomUUID(), title, summary },
  ];

  await updateTripById(trip.id, { locationOptions: next });
  revalidatePath(`/t/${slug}`);
}

export async function deleteLocationOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim();
  if (!slug || !locationId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const existing = normalizeLocationOptions(trip.locationOptions ?? []);
  const next = existing.filter((l) => l.id !== locationId);

  await updateTripById(trip.id, { locationOptions: next });
  revalidatePath(`/t/${slug}`);
}

async function extractLocationsFromAssistantText(
  text: string,
): Promise<LocationSuggestion[]> {
  if (!hasAnthropicApiKey()) {
    throw new Error("Add ANTHROPIC_API_KEY to publish locations from the AI planner.");
  }

  const { object } = await generateObject({
    model: plannerModel(),
    schema: locationSuggestionsSchema,
    prompt: `Extract distinct trip destination or area options from this family reunion planning message. Return 2–6 clear choices families could vote on in a survey. Use concise titles (e.g. "Bergen & fjords", "Lofoten islands").\n\nMessage:\n${text}`,
  });

  return object.locations
    .map((loc) => ({
      title: loc.title.trim(),
      summary: loc.summary?.trim() || undefined,
    }))
    .filter((loc) => loc.title.length > 0);
}

export async function extractLocationSuggestionsAction(
  slug: string,
  assistantText: string,
): Promise<LocationSuggestion[]> {
  const userId = await requireSessionUserId();
  const text = assistantText.trim();
  if (!text) throw new Error("No AI message to extract from.");

  await loadTripForOrganizer(slug, userId);
  return extractLocationsFromAssistantText(text);
}

export async function addLocationSuggestionAction(
  slug: string,
  title: string,
  summary?: string,
) {
  const userId = await requireSessionUserId();
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Location title is required.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const existing = normalizeLocationOptions(trip.locationOptions ?? []);
  const { merged, added } = mergeLocationSuggestions(existing, [
    { title: trimmedTitle, summary: summary?.trim() || undefined },
  ]);

  await updateTripById(trip.id, { locationOptions: merged });
  revalidatePath(`/t/${slug}`);
  return { added: added > 0, total: merged.length };
}

export async function publishLocationsFromChatAction(
  slug: string,
  assistantText: string,
) {
  const userId = await requireSessionUserId();
  const text = assistantText.trim();
  if (!text) throw new Error("No AI message to extract from.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const suggestions = await extractLocationsFromAssistantText(text);
  const existing = normalizeLocationOptions(trip.locationOptions ?? []);
  const { merged, added } = mergeLocationSuggestions(existing, suggestions);

  await updateTripById(trip.id, { locationOptions: merged });

  revalidatePath(`/t/${slug}`);
  return { added, total: merged.length };
}

function lockedLocationTitleForTrip(
  trip: { selectedLocationId: string | null; locationOptions: LocationOption[] },
): string {
  if (!trip.selectedLocationId) return "";
  return (
    findLocationById(trip.locationOptions ?? [], trip.selectedLocationId)?.title ?? ""
  );
}

async function appendEnrichedVenues(
  trip: {
    id: string;
    selectedLocationId: string | null;
    locationOptions: LocationOption[];
    venueOptions: VenueOption[];
    shareOptionsToken: string;
  },
  suggestions: VenueSuggestion[],
): Promise<{ merged: VenueOption[]; added: number }> {
  const locationTitle = lockedLocationTitleForTrip(trip);
  const existing = normalizeVenueOptions(trip.venueOptions ?? []);
  const seen = new Set(
    existing.map((v) => `${v.category}:${v.title.trim().toLowerCase()}`),
  );
  const merged = [...existing];
  let added = 0;

  for (const suggestion of suggestions) {
    const title = suggestion.title.trim();
    if (!title) continue;
    const category = normalizeVenueCategory(suggestion.category);
    const key = `${category}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(await enrichVenueOption(suggestion, locationTitle));
    added += 1;
  }

  return { merged, added };
}

function revalidateTripPaths(slug: string, shareToken: string) {
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/o/${shareToken}`);
}

async function extractVenuesFromAssistantText(text: string): Promise<VenueSuggestion[]> {
  if (!hasAnthropicApiKey()) {
    throw new Error("Add ANTHROPIC_API_KEY to use WandrAI venue planning.");
  }

  const { object } = await generateObject({
    model: plannerModel(),
    schema: venueSuggestionsSchema,
    prompt: `Extract specific places from this family reunion planning message for an organizer shortlist (not a public survey).
Return 2–8 entries with category:
- stay: hotels, resorts, cabin rentals, campgrounds, lodges
- eat: restaurants, group dining, caterers
- do: activities, excursions, rentals, attractions

Use concise titles. Summaries should note capacity fit, vibe, and one caution.
Include priceType (exact, range, estimate, free, or unknown), priceMin/priceMax when you can estimate, priceUnit (per_night for stay, per_person for eat/do), and optional priceNotes.
Only include bookingUrl or mapsUrl if clearly stated—do not invent URLs.

Message:
${text}`,
  });

  return object.venues
    .map((v) => ({
      title: v.title.trim(),
      summary: v.summary?.trim() || undefined,
      category: normalizeVenueCategory(v.category),
      bookingUrl: v.bookingUrl?.trim() || undefined,
      mapsUrl: v.mapsUrl?.trim() || undefined,
      priceType: v.priceType,
      priceMin: v.priceMin,
      priceMax: v.priceMax,
      priceUnit: v.priceUnit,
      priceNotes: v.priceNotes?.trim() || undefined,
    }))
    .filter((v) => v.title.length > 0);
}

export async function extractVenueSuggestionsAction(
  slug: string,
  assistantText: string,
): Promise<VenueSuggestion[]> {
  const userId = await requireSessionUserId();
  const text = assistantText.trim();
  if (!text) throw new Error("No AI message to extract from.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  if (!trip.selectedLocationId) {
    throw new Error("Lock a location in Blueprint before planning venues.");
  }

  return extractVenuesFromAssistantText(text);
}

export async function addVenueSuggestionAction(
  slug: string,
  title: string,
  category: string,
  summary?: string,
  bookingUrl?: string,
  mapsUrl?: string,
) {
  const userId = await requireSessionUserId();
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Venue title is required.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  if (!trip.selectedLocationId) {
    throw new Error("Lock a location in Blueprint before adding venues.");
  }

  const { merged, added } = await appendEnrichedVenues(trip, [
    {
      title: trimmedTitle,
      category: normalizeVenueCategory(category),
      summary: summary?.trim() || undefined,
      bookingUrl: bookingUrl?.trim() || undefined,
      mapsUrl: mapsUrl?.trim() || undefined,
    },
  ]);

  await updateTripById(trip.id, { venueOptions: merged });
  revalidateTripPaths(slug, trip.shareOptionsToken);
  return { added: added > 0, total: merged.length };
}

export async function publishVenuesFromChatAction(slug: string, assistantText: string) {
  const userId = await requireSessionUserId();
  const text = assistantText.trim();
  if (!text) throw new Error("No AI message to extract from.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  if (!trip.selectedLocationId) {
    throw new Error("Lock a location in Blueprint before adding venues.");
  }

  const suggestions = await extractVenuesFromAssistantText(text);
  const { merged, added } = await appendEnrichedVenues(trip, suggestions);

  await updateTripById(trip.id, { venueOptions: merged });
  revalidateTripPaths(slug, trip.shareOptionsToken);
  return { added, total: merged.length };
}

export async function addVenueOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "stay").trim();
  const summary = String(formData.get("summary") ?? "").trim() || undefined;
  const bookingUrl = String(formData.get("booking_url") ?? "").trim() || undefined;
  const mapsUrl = String(formData.get("maps_url") ?? "").trim() || undefined;
  if (!slug || !title) throw new Error("Venue title is required.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  if (!trip.selectedLocationId) {
    throw new Error("Lock a location in Blueprint before adding venues.");
  }

  const { merged } = await appendEnrichedVenues(trip, [
    {
      title,
      category: normalizeVenueCategory(category),
      summary,
      bookingUrl,
      mapsUrl,
    },
  ]);

  await updateTripById(trip.id, { venueOptions: merged });
  revalidateTripPaths(slug, trip.shareOptionsToken);
}

export async function updateVenueDetailsAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const venueId = String(formData.get("venue_id") ?? "").trim();
  if (!slug || !venueId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const venues = normalizeVenueOptions(trip.venueOptions ?? []);
  const index = venues.findIndex((v) => v.id === venueId);
  if (index < 0) throw new Error("Venue not found.");

  const bookingStatus = normalizeVenueBookingStatus(
    String(formData.get("booking_status") ?? "idea"),
  ) as VenueBookingStatus;
  const plannerNotes = String(formData.get("planner_notes") ?? "").trim() || undefined;
  const bookingUrl = String(formData.get("booking_url") ?? "").trim() || undefined;
  const mapsUrl = String(formData.get("maps_url") ?? "").trim() || undefined;
  const websiteUrl = String(formData.get("website_url") ?? "").trim() || undefined;
  const category = venues[index].category;
  const priceMinRaw = String(formData.get("price_min") ?? "").trim();
  const priceMaxRaw = String(formData.get("price_max") ?? "").trim();

  const next = [...venues];
  next[index] = {
    ...venues[index],
    bookingStatus,
    plannerNotes,
    bookingUrl,
    mapsUrl,
    websiteUrl,
    priceType: normalizePriceType(formData.get("price_type")),
    priceMin: priceMinRaw ? Number.parseFloat(priceMinRaw) : undefined,
    priceMax: priceMaxRaw ? Number.parseFloat(priceMaxRaw) : undefined,
    priceUnit: normalizePriceUnit(formData.get("price_unit"), category),
    priceNotes: String(formData.get("price_notes") ?? "").trim() || undefined,
  };

  await updateTripById(trip.id, { venueOptions: next });
  revalidateTripPaths(slug, trip.shareOptionsToken);
  redirect(`/t/${slug}/venues/${venueId}`);
}

export async function refreshVenueLinksAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const venueId = String(formData.get("venue_id") ?? "").trim();
  if (!slug || !venueId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  if (!trip.selectedLocationId) throw new Error("Lock a location first.");

  const venues = normalizeVenueOptions(trip.venueOptions ?? []);
  const venue = findVenueById(venues, venueId);
  if (!venue) throw new Error("Venue not found.");

  const locationTitle = lockedLocationTitleForTrip(trip);
  const enriched = await enrichVenueOption(venue, locationTitle);
  const next = venues.map((v) => (v.id === venueId ? { ...enriched, id: venueId } : v));

  await updateTripById(trip.id, { venueOptions: next });
  revalidateTripPaths(slug, trip.shareOptionsToken);
  redirect(`/t/${slug}/venues/${venueId}`);
}

export async function deleteVenueOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const venueId = String(formData.get("venue_id") ?? "").trim();
  if (!slug || !venueId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const existing = normalizeVenueOptions(trip.venueOptions ?? []);
  const next = existing.filter((v) => v.id !== venueId);
  const selectedVenueId =
    trip.selectedVenueId === venueId ? null : trip.selectedVenueId;

  await updateTripById(trip.id, { venueOptions: next, selectedVenueId });
  revalidateTripPaths(slug, trip.shareOptionsToken);
}

export async function setPrimaryVenueAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const venueId = String(formData.get("venue_id") ?? "").trim();
  if (!slug || !venueId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const venues = normalizeVenueOptions(trip.venueOptions ?? []);
  const venue = findVenueById(venues, venueId);
  if (!venue) throw new Error("Venue not found.");
  if (venue.category !== "stay") {
    throw new Error("Only lodging (Stay) options can be set as base camp.");
  }

  await updateTripById(trip.id, { selectedVenueId: venueId });
  revalidateTripPaths(slug, trip.shareOptionsToken);
}

export async function clearPrimaryVenueAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  await updateTripById(trip.id, { selectedVenueId: null });
  revalidateTripPaths(slug, trip.shareOptionsToken);
}

export async function publishBallotAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  if (!trip.selectedLocationId) {
    throw new Error("Lock a location before opening the group vote.");
  }
  const options = normalizeVenueOptions(trip.venueOptions ?? []);
  if (options.filter((o) => (o.bookingStatus ?? "idea") !== "passed").length === 0) {
    throw new Error("Add at least one stay, eat, or do option before publishing.");
  }

  const now = new Date();
  await updateTripById(trip.id, {
    ballotStatus: "open",
    ballotOpenedAt: trip.ballotOpenedAt ?? now,
    ballotClosedAt: null,
  });
  revalidateTripPaths(slug, trip.shareOptionsToken);
  const survey = await getSurveyByTripId(trip.id);
  if (survey) {
    revalidatePath(`/r/${survey.publicToken}`);
    revalidatePath(`/r/${survey.publicToken}/vote`);
  }
}

export async function closeBallotAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  await updateTripById(trip.id, {
    ballotStatus: "closed",
    ballotClosedAt: new Date(),
  });
  revalidateTripPaths(slug, trip.shareOptionsToken);
}

export async function reopenBallotAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  await updateTripById(trip.id, {
    ballotStatus: "open",
    ballotClosedAt: null,
  });
  revalidateTripPaths(slug, trip.shareOptionsToken);
}

export async function submitBallotVotesAction(formData: FormData) {
  const token = String(formData.get("survey_token") ?? "").trim();
  const voterName = String(formData.get("voter_name") ?? "").trim();
  const voterEmail = String(formData.get("voter_email") ?? "").trim() || null;
  const guestId = String(formData.get("guest_id") ?? "").trim() || null;
  const votesRaw = String(formData.get("votes_json") ?? "").trim();

  if (!token) throw new Error("Missing survey.");
  if (!voterName) throw new Error("Please enter your name.");

  const data = await getSurveyAndTripByPublicToken(token);
  if (!data) throw new Error("Survey not found.");
  const { survey, trip } = data;

  if (trip.ballotStatus !== "open") {
    throw new Error("Voting is not open right now.");
  }

  let votes: { optionId: string; vote: "up" | "down" }[] = [];
  if (votesRaw) {
    try {
      const parsed = JSON.parse(votesRaw) as unknown;
      if (Array.isArray(parsed)) {
        votes = parsed
          .map((v) => {
            if (!v || typeof v !== "object") return null;
            const o = v as Record<string, unknown>;
            const optionId = String(o.optionId ?? "").trim();
            const vote = o.vote === "down" ? "down" : o.vote === "up" ? "up" : null;
            if (!optionId || !vote) return null;
            return { optionId, vote };
          })
          .filter((v): v is { optionId: string; vote: "up" | "down" } => v !== null);
      }
    } catch {
      throw new Error("Invalid vote payload.");
    }
  }

  const options = normalizeVenueOptions(trip.venueOptions ?? []);
  const validIds = new Set(options.map((o) => o.id));
  votes = votes.filter((v) => validIds.has(v.optionId));

  const guest = await getGuestSessionForPublicSubmit();
  const lockedEmail = guest?.email.trim().toLowerCase() ?? voterEmail;

  const surveyRowByUser =
    guest != null
      ? await getSurveyResponseByUserId(survey.id, guest.userId)
      : null;

  const matched =
    surveyRowByUser != null
      ? { id: surveyRowByUser.id, respondentName: surveyRowByUser.respondentName }
      : lockedEmail != null
        ? await findSurveyResponseByEmail(survey.id, lockedEmail)
        : null;

  const { voterKey, surveyResponseId } = resolveVoterKey({
    userId: guest?.userId ?? null,
    surveyResponseId: matched?.id ?? null,
    email: lockedEmail,
    guestId: guest ? null : guestId?.trim() || crypto.randomUUID(),
  });

  const name = guest?.name ?? matched?.respondentName ?? voterName;
  const emailForRow = guest?.email ?? lockedEmail;

  const { listBallotVotesForVoter, upsertBallotVotes, deleteBallotVotesForVoter } =
    await import("@/lib/supabase/ballotVotes");

  const existing = await listBallotVotesForVoter(trip.id, voterKey);
  const newIds = new Set(votes.map((v) => v.optionId));
  const toClear = existing
    .map((v) => v.optionId)
    .filter((id) => !newIds.has(id));

  await deleteBallotVotesForVoter(trip.id, voterKey, toClear);
  await upsertBallotVotes({
    tripId: trip.id,
    userId: guest?.userId ?? null,
    voterKey,
    voterName: name,
    voterEmail: emailForRow,
    surveyResponseId,
    votes,
  });

  revalidatePath(`/r/${token}/vote`);
  revalidatePath(`/o/${trip.shareOptionsToken}`);
  redirect(`/r/${token}/vote?thanks=1`);
}

export async function updateTripPlanContextAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const locationId = String(formData.get("selected_location_id") ?? "").trim() || null;
  const weekendFriday = String(formData.get("selected_weekend_friday") ?? "").trim() || null;
  const headcountRaw = String(formData.get("plan_headcount") ?? "").trim();
  const planHeadcount = headcountRaw
    ? Math.max(1, Number.parseInt(headcountRaw, 10) || 1)
    : null;

  const { trip } = await loadTripForOrganizer(slug, userId);
  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const weekends = filterValidFridays(trip.proposedDateSlots ?? []);

  if (locationId && !locations.some((l) => l.id === locationId)) {
    throw new Error("Invalid location.");
  }
  if (weekendFriday && !isValidFridayIso(weekendFriday)) {
    throw new Error("Invalid weekend.");
  }
  if (weekendFriday && weekends.length > 0 && !weekends.includes(weekendFriday)) {
    throw new Error("Weekend is not on your survey list.");
  }

  await updateTripById(trip.id, {
    selectedLocationId: locationId,
    selectedWeekendFriday: weekendFriday,
    planHeadcount,
  });

  revalidatePath(`/t/${slug}`);
}

export async function generateItineraryAction(slug: string) {
  const userId = await requireSessionUserId();
  if (!hasAnthropicApiKey()) {
    throw new Error("Add ANTHROPIC_API_KEY to generate an itinerary.");
  }

  const { trip } = await loadTripForOrganizer(slug, userId);
  const locationId = trip.selectedLocationId;
  const weekendFriday = trip.selectedWeekendFriday;
  const headcount = trip.planHeadcount ?? 1;

  if (!locationId || !weekendFriday) {
    throw new Error("Select a location and weekend before generating an itinerary.");
  }

  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const location = findLocationById(locations, locationId);
  if (!location) throw new Error("Selected location not found.");

  const venues = normalizeVenueOptions(trip.venueOptions ?? []);
  const baseCamp = trip.selectedVenueId
    ? findVenueById(venues, trip.selectedVenueId)
    : null;
  const stayShortlist = venues.filter((v) => v.category === "stay");
  const eatShortlist = venues.filter((v) => v.category === "eat");

  const survey = await getSurveyByTripId(trip.id);
  const responses = survey ? await listSurveyResponsesForChat(survey.id) : [];

  const notes = responses
    .map((r) => r.notes)
    .filter(Boolean)
    .join("; ");

  const { object } = await generateObject({
    model: plannerModel(),
    schema: itineraryGenerationSchema,
    prompt: `Create a Fri–Sun family reunion itinerary for ${headcount} people.
Location: ${location.title}${location.summary ? ` — ${location.summary}` : ""}
Weekend: ${weekendFriday} (Friday through Sunday)
Trip: ${trip.name}
${trip.destinationNotes ? `Notes: ${trip.destinationNotes}` : ""}
${trip.targetBudget ? `Budget: ${trip.targetBudget}` : ""}
${notes ? `Family notes from survey: ${notes}` : ""}
${baseCamp ? `Base camp (lodging): ${baseCamp.title}${baseCamp.summary ? ` — ${baseCamp.summary}` : ""}` : ""}
${stayShortlist.length ? `Lodging shortlist: ${stayShortlist.map((v) => v.title).join("; ")}` : ""}
${eatShortlist.length ? `Dining shortlist: ${eatShortlist.map((v) => v.title).join("; ")}` : ""}

Rules:
- Exactly 3 days: friday, saturday, sunday keys
- Realistic pacing for a multi-generational group; include downtime
- Mark lodging and restaurants that need reservations as status "to_book"
- Include specific activity ideas with approximate times in 12-hour form (e.g. "10:00 AM", "2:30 PM")
- Use type: activity | meal | lodging | travel
- No invented live prices; say "check availability" in notes when needed`,
  });

  const itinerary = itineraryFromGenerated(object, weekendFriday);

  await updateTripById(trip.id, { itinerary });

  revalidatePath(`/t/${slug}`);
  return { ok: true };
}

export async function updateItineraryBlockAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const dayKey = String(formData.get("day_key") ?? "").trim() as DayKey;
  const blockId = String(formData.get("block_id") ?? "").trim();

  if (!slug || !dayKey || !blockId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const itinerary = normalizeItinerary(
    trip.itinerary,
    trip.selectedWeekendFriday,
  );

  let found = false;
  for (const day of itinerary.days) {
    if (day.key !== dayKey) continue;
    for (const block of day.blocks) {
      if (block.id !== blockId) continue;
      if (formData.has("status")) {
        const status = String(formData.get("status") ?? "").trim() as BlockStatus;
        if (!["idea", "to_book", "booked"].includes(status)) {
          throw new Error("Invalid status.");
        }
        block.status = status;
      }
      if (formData.has("assigned_to_user_id")) {
        const assignee = String(formData.get("assigned_to_user_id") ?? "").trim();
        block.assignedToUserId = assignee || undefined;
      }
      if (formData.has("planner_notes")) {
        const notes = String(formData.get("planner_notes") ?? "").trim();
        block.plannerNotes = notes || undefined;
      }
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Block not found.");

  await updateTripById(trip.id, { itinerary });

  revalidatePath(`/t/${slug}`);
}

/** @deprecated Use updateItineraryBlockAction */
export async function updateItineraryBlockStatusAction(formData: FormData) {
  return updateItineraryBlockAction(formData);
}

export async function refineItineraryDayAction(
  slug: string,
  dayKey: DayKey,
  instruction: string,
) {
  const userId = await requireSessionUserId();
  const text = instruction.trim();
  if (!text) throw new Error("Add instructions for the AI.");

  if (!hasAnthropicApiKey()) {
    throw new Error("Add ANTHROPIC_API_KEY to refine the itinerary.");
  }

  const { trip } = await loadTripForOrganizer(slug, userId);
  const itinerary = normalizeItinerary(
    trip.itinerary,
    trip.selectedWeekendFriday,
  );
  const day = itinerary.days.find((d) => d.key === dayKey);
  if (!day) throw new Error("Day not found.");

  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const location = trip.selectedLocationId
    ? findLocationById(locations, trip.selectedLocationId)
    : null;

  const dayOnlySchema = itineraryDaySchema;

  const { object } = await generateObject({
    model: plannerModel(),
    schema: dayOnlySchema,
    prompt: `Revise ONLY this day of a family reunion itinerary.
Location: ${location?.title ?? "TBD"}
Headcount: ${trip.planHeadcount ?? "unknown"}
Day: ${day.label} (${dayKey})
Current plan:
${day.blocks.map((b) => `- ${b.time ?? ""} ${b.title} [${b.type}]`).join("\n") || "(empty)"}

Instruction: ${text}

Return the full updated day with realistic times and mark reservations as to_book where needed.`,
  });

  day.label = object.label || day.label;
  day.blocks = object.blocks.map((b) => ({
    id: crypto.randomUUID(),
    time: b.time?.trim() || undefined,
    title: b.title.trim(),
    type: b.type,
    notes: b.notes?.trim() || undefined,
    bookingUrl: b.bookingUrl?.trim() || undefined,
    status: b.status,
  }));

  await updateTripById(trip.id, { itinerary });

  revalidatePath(`/t/${slug}`);
  return { ok: true };
}

export async function publishItineraryAction(slug: string) {
  const userId = await requireSessionUserId();
  const { trip } = await loadTripForOrganizer(slug, userId);

  const itinerary = normalizeItinerary(
    trip.itinerary,
    trip.selectedWeekendFriday,
  );
  if (!itineraryHasContent(itinerary)) {
    throw new Error("Generate an itinerary with at least one activity before publishing.");
  }

  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const location = trip.selectedLocationId
    ? findLocationById(locations, trip.selectedLocationId)
    : null;

  const published: PublishedItinerary = {
    ...itinerary,
    locationTitle: location?.title,
    weekendLabel: trip.selectedWeekendFriday
      ? formatWeekendLabel(trip.selectedWeekendFriday)
      : undefined,
    headcount: trip.planHeadcount ?? undefined,
    publishedAt: new Date().toISOString(),
  };

  await updateTripById(trip.id, { publishedItinerary: published });

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/o/${trip.shareOptionsToken}`);
  return { ok: true };
}

export async function unpublishItineraryAction(slug: string) {
  const userId = await requireSessionUserId();
  const { trip } = await loadTripForOrganizer(slug, userId);

  await updateTripById(trip.id, { publishedItinerary: null });

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/o/${trip.shareOptionsToken}`);
  return { ok: true };
}

export async function submitPlanConfirmationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const respondentName = String(formData.get("name") ?? "").trim();
  const respondentEmail = String(formData.get("email") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim();

  if (!token || !respondentName) {
    throw new Error("Please add your name.");
  }
  if (status !== "confirmed" && status !== "declined") {
    throw new Error("Please choose Yes or No.");
  }

  const trip = await getTripByShareToken(token);
  if (!trip) throw new Error("This link is not valid anymore.");

  const weekendFriday = trip.selectedWeekendFriday;
  const locationId = trip.selectedLocationId;
  if (!weekendFriday || !locationId) {
    throw new Error(
      "The organizers have not locked the final date and location yet—check back soon.",
    );
  }

  let adultCount = 0;
  let kidCount = 0;
  if (status === "confirmed") {
    adultCount = Math.max(
      1,
      Number.parseInt(String(formData.get("adult_count") ?? "1"), 10) || 1,
    );
    kidCount = Math.max(
      0,
      Number.parseInt(String(formData.get("kid_count") ?? "0"), 10) || 0,
    );
  }

  const guest = await getGuestSessionForPublicSubmit();

  if (guest) {
    const lockedEmail = guest.email.trim().toLowerCase();
    await upsertTripConfirmationForUser(trip.id, guest.userId, {
      respondentName: respondentName || guest.name,
      respondentEmail: lockedEmail,
      status: status as "confirmed" | "declined",
      adultCount,
      kidCount,
      weekendFriday,
      locationId,
    });
  } else {
    const existing = await listTripConfirmations(trip.id);

    const match = existing.find((row) => {
      if (respondentEmail && row.respondentEmail) {
        return row.respondentEmail.toLowerCase() === respondentEmail.toLowerCase();
      }
      return row.respondentName.toLowerCase() === respondentName.toLowerCase();
    });

    await upsertTripConfirmation(trip.id, match?.id ?? null, {
      respondentName,
      respondentEmail,
      status: status as "confirmed" | "declined",
      adultCount,
      kidCount,
      weekendFriday,
      locationId,
    });
  }

  revalidatePath(`/o/${token}`);
  revalidatePath(`/t/${trip.slug}`);
  redirect(`/o/${token}?confirmed=1`);
}

export async function inviteTripCollaboratorAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  if (!slug || !emailRaw) throw new Error("Enter an email address.");

  const email = emailRaw.toLowerCase();
  const { trip, role } = await loadTripForOrganizer(slug, userId);
  if (!canManageCollaborators(role)) {
    throw new Error("You do not have permission to invite collaborators.");
  }

  const owner = await getUserById(trip.ownerId);
  if (owner?.email?.toLowerCase() === email) {
    throw new Error("That person already owns this trip.");
  }

  const session = await auth();
  if (session?.user?.email?.toLowerCase() === email) {
    throw new Error("You are already on this trip.");
  }

  const existingMember = await getUserByEmail(email);
  if (existingMember) {
    if (existingMember.id === trip.ownerId) {
      throw new Error("That person already owns this trip.");
    }
    const member = await getTripMemberByUserId(trip.id, existingMember.id);
    if (member) throw new Error("They are already a co-planner on this trip.");
    await addTripMember(trip.id, existingMember.id);
  } else {
    const pending = await getTripInviteByEmail(trip.id, email);
    if (pending) throw new Error("An invite is already pending for that email.");
    await insertTripInvite(trip.id, email, userId);
  }

  const loginUrl = `${appOrigin()}/login?callbackUrl=${encodeURIComponent(`/t/${slug}`)}`;
  const inviter = session?.user?.name ?? session?.user?.email ?? null;
  await sendCollaboratorInviteEmail(email, {
    tripName: trip.name,
    inviterName: inviter,
    loginUrl,
  });

  revalidatePath(`/t/${slug}`);
}

export async function cancelTripInviteAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const inviteId = String(formData.get("invite_id") ?? "").trim();
  if (!slug || !inviteId) throw new Error("Missing fields.");

  const { trip, role } = await loadTripForOrganizer(slug, userId);
  if (!canManageCollaborators(role)) {
    throw new Error("You do not have permission to manage invites.");
  }

  await deleteTripInvite(inviteId, trip.id);
  revalidatePath(`/t/${slug}`);
}

export async function removeTripMemberAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!slug || !memberId) throw new Error("Missing fields.");

  const { role } = await loadTripForOrganizer(slug, userId);
  if (!canRemoveMembers(role)) {
    throw new Error("Only the trip owner can remove co-planners.");
  }

  const { trip } = await loadTripForOrganizer(slug, userId);
  await deleteTripMember(memberId, trip.id);
  revalidatePath(`/t/${slug}`);
}

export async function resetTripPlanningAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "");
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripAsOwner(slug, userId);
  assertTripNameConfirmation(trip.name, confirm);

  const survey = await getSurveyByTripId(trip.id);
  await resetTripPlanning(trip.id, survey?.id ?? null);

  revalidatePath(`/t/${slug}`);
  revalidatePath("/dashboard");
}

export async function deleteTripAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "");
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripAsOwner(slug, userId);
  assertTripNameConfirmation(trip.name, confirm);

  await deleteTripById(trip.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
const splitMethodSchema = z.enum(SPLIT_METHODS);
const contributionStatusSchema = z.enum(["pending", "paid"] as const);

const expenseInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  category: expenseCategorySchema,
  amountCents: z.number().int().min(0),
  splitMethod: splitMethodSchema,
  paidByName: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const contributionInputSchema = z.object({
  householdName: z.string().trim().min(1, "Household name is required."),
  householdEmail: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  amountCents: z.number().int().min(0),
  status: contributionStatusSchema,
  method: z.string().trim().optional(),
});

export type TripBudgetSnapshot = {
  expenses: TripExpense[];
  contributions: TripContribution[];
  totals: {
    totalExpenseCents: number;
    totalCollectedCents: number;
    totalOutstandingCents: number;
  };
  perHouseholdEstimateCents: number;
  confirmedHouseholdCount: number;
};

export async function getTripBudget(tripId: string): Promise<TripBudgetSnapshot> {
  await ensureBudgetContributionsFromConfirmations(tripId);

  const [expenses, contributions, confirmations] = await Promise.all([
    listTripExpenses(tripId),
    listTripContributions(tripId),
    listTripConfirmations(tripId),
  ]);

  const totalExpenseCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const totalCollectedCents = contributions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.amountCents, 0);
  const totalOutstandingCents = Math.max(0, totalExpenseCents - totalCollectedCents);
  const confirmedHouseholdCount = countConfirmedHouseholds(confirmations);
  const perHouseholdEstimateCents =
    confirmedHouseholdCount > 0
      ? Math.round(totalExpenseCents / confirmedHouseholdCount)
      : 0;

  return {
    expenses,
    contributions,
    totals: {
      totalExpenseCents,
      totalCollectedCents,
      totalOutstandingCents,
    },
    perHouseholdEstimateCents,
    confirmedHouseholdCount,
  };
}

function parseExpenseForm(formData: FormData) {
  const amountCents = parseDollarsToCents(String(formData.get("amount_dollars") ?? ""));
  return expenseInputSchema.parse({
    title: String(formData.get("title") ?? ""),
    category: normalizeExpenseCategory(String(formData.get("category") ?? "other")),
    amountCents,
    splitMethod: normalizeSplitMethod(
      String(formData.get("split_method") ?? "even_per_household"),
    ),
    paidByName: String(formData.get("paid_by_name") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });
}

function parseContributionForm(formData: FormData) {
  const amountCents = parseDollarsToCents(String(formData.get("amount_dollars") ?? "0"));
  return contributionInputSchema.parse({
    householdName: String(formData.get("household_name") ?? ""),
    householdEmail: String(formData.get("household_email") ?? ""),
    amountCents,
    status: String(formData.get("status") ?? "pending") as "pending" | "paid",
    method: String(formData.get("method") ?? "").trim() || undefined,
  });
}

export async function createExpenseAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const input = parseExpenseForm(formData);
  const sortOrder = await countTripExpenses(trip.id);

  await insertTripExpense({
    tripId: trip.id,
    title: input.title,
    category: input.category,
    amountCents: input.amountCents,
    splitMethod: input.splitMethod,
    paidByName: input.paidByName ?? null,
    notes: input.notes ?? null,
    sortOrder,
  });

  revalidatePath(`/t/${slug}`);
}

export async function updateExpenseAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const expenseId = String(formData.get("expense_id") ?? "").trim();
  if (!slug || !expenseId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const existing = await getTripExpenseById(trip.id, expenseId);
  if (!existing) throw new Error("Expense not found.");

  const input = parseExpenseForm(formData);
  await updateTripExpenseRow(trip.id, expenseId, {
    title: input.title,
    category: input.category,
    amount_cents: input.amountCents,
    split_method: input.splitMethod,
    paid_by_name: input.paidByName ?? null,
    notes: input.notes ?? null,
  });

  revalidatePath(`/t/${slug}`);
}

export async function deleteExpenseAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const expenseId = String(formData.get("expense_id") ?? "").trim();
  if (!slug || !expenseId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  await deleteTripExpenseRow(trip.id, expenseId);
  revalidatePath(`/t/${slug}`);
}

export async function upsertContributionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const contributionId = String(formData.get("contribution_id") ?? "").trim() || undefined;
  const input = parseContributionForm(formData);

  const existing = contributionId
    ? await getTripContributionById(trip.id, contributionId)
    : null;
  const paidAt =
    input.status === "paid"
      ? (existing?.paidAt?.toISOString() ?? new Date().toISOString())
      : null;

  await upsertTripContributionRow({
    tripId: trip.id,
    id: contributionId,
    householdName: input.householdName,
    householdEmail: input.householdEmail,
    amountCents: input.amountCents,
    status: input.status,
    method: input.method ?? null,
    paidAt,
  });

  revalidatePath(`/t/${slug}`);
}

export async function markContributionPaidAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const contributionId = String(formData.get("contribution_id") ?? "").trim();
  if (!slug || !contributionId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const row = await getTripContributionById(trip.id, contributionId);
  if (!row) throw new Error("Contribution not found.");

  const method = z
    .string()
    .trim()
    .optional()
    .parse(String(formData.get("method") ?? "").trim() || undefined);

  await updateTripContributionRow(trip.id, contributionId, {
    status: "paid",
    method: method ?? row.method,
    paid_at: new Date().toISOString(),
  });

  revalidatePath(`/t/${slug}`);
}

export async function markContributionPendingAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const contributionId = String(formData.get("contribution_id") ?? "").trim();
  if (!slug || !contributionId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  const row = await getTripContributionById(trip.id, contributionId);
  if (!row) throw new Error("Contribution not found.");

  await updateTripContributionRow(trip.id, contributionId, {
    status: "pending",
    paid_at: null,
  });

  revalidatePath(`/t/${slug}`);
}

export async function deleteContributionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const contributionId = String(formData.get("contribution_id") ?? "").trim();
  if (!slug || !contributionId) throw new Error("Missing fields.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  await deleteTripContributionRow(trip.id, contributionId);
  revalidatePath(`/t/${slug}`);
}

export async function syncBudgetHouseholdsAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const { trip } = await loadTripForOrganizer(slug, userId);
  await ensureBudgetContributionsFromConfirmations(trip.id);
  revalidatePath(`/t/${slug}`);
}
