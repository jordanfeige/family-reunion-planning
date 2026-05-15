import { convertToModelMessages, streamText } from "ai";

import { auth } from "@/auth";
import { hasAnthropicApiKey, plannerModel } from "@/lib/ai";
import {
  formatAvailabilitySummary,
  formatLocationPreferenceSummary,
} from "@/lib/availability";
import { formatItineraryForPrompt, normalizeItinerary } from "@/lib/itinerary";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import {
  getOwnedTripBySlug,
  getSurveyByTripId,
  listSurveyResponsesForChat,
} from "@/lib/supabase/queries";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { slug } = await ctx.params;
  const trip = await getOwnedTripBySlug(slug, session.user.id);

  if (!trip) {
    return new Response("Not found", { status: 404 });
  }

  if (!hasAnthropicApiKey()) {
    return new Response(
      JSON.stringify({
        error: "Add ANTHROPIC_API_KEY to enable WandrAI trip planning.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = (await req.json()) as {
    messages?: unknown[];
    mode?: string;
    focusDay?: string;
  };
  const mode =
    body.mode === "plan"
      ? "plan"
      : body.mode === "itinerary"
        ? "itinerary"
        : "locations";
  const focusDay = body.focusDay;
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const weekendSlots = filterValidFridays(trip.proposedDateSlots ?? []);
  const locationOptions = normalizeLocationOptions(trip.locationOptions ?? []);

  const survey = await getSurveyByTripId(trip.id);
  const responses = survey ? await listSurveyResponsesForChat(survey.id) : [];

  const availabilitySummary = formatAvailabilitySummary(weekendSlots, responses);
  const locationSummary = formatLocationPreferenceSummary(
    locationOptions,
    responses,
  );

  const selectedLocation = trip.selectedLocationId
    ? findLocationById(locationOptions, trip.selectedLocationId)
    : null;
  const itinerary = normalizeItinerary(trip.itinerary, trip.selectedWeekendFriday);
  const itineraryText = formatItineraryForPrompt(itinerary);

  const contextBits = [
    `Trip name: ${trip.name}`,
    trip.tagline ? `Tagline: ${trip.tagline}` : null,
    trip.destinationNotes ? `Destination notes: ${trip.destinationNotes}` : null,
    trip.targetBudget ? `Budget note: ${trip.targetBudget}` : null,
    trip.tripStart ? `Target start: ${trip.tripStart.toISOString()}` : null,
    trip.tripEnd ? `Target end: ${trip.tripEnd.toISOString()}` : null,
    weekendSlots.length
      ? `Candidate Fri–Sun weekends: ${weekendSlots.map((s) => formatWeekendLabel(s)).join(" | ")}`
      : null,
    locationOptions.length
      ? `Survey location options: ${locationOptions.map((l) => l.title).join(" | ")}`
      : null,
    selectedLocation
      ? `Locked plan location: ${selectedLocation.title}${selectedLocation.summary ? ` — ${selectedLocation.summary}` : ""}`
      : null,
    trip.selectedWeekendFriday
      ? `Locked plan weekend: ${formatWeekendLabel(trip.selectedWeekendFriday)}`
      : null,
    trip.planHeadcount ? `Planning headcount: ${trip.planHeadcount}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const locationsSystem = `You are WandrAI, a cheerful travel co-planner helping a family choose WHERE to gather.
Your job in this mode is destination brainstorming only—not day-by-day itineraries yet.
Suggest 3–6 distinct areas or destinations (regions, cities, or venue types). For each, give a short title, why it fits a multi-generational reunion, rough travel ease, and one caution.
Use clear headings and bullet lists. End with a short "## Top picks" summary the organizer can publish to their survey.
Never invent specific real-time prices—give ranges or "check current rates".
If details are missing, state assumptions and proceed.

Current trip context:
${contextBits}`;

  const planSystem = `You are WandrAI, a cheerful travel co-planner for a family reunion or group trip.
Use clear sections with short headings and bullet lists. Call out realistic pacing, weather or season notes when relevant, kid-friendly ideas when it fits, dining at a mix of price points, and reservations or tickets to book early.
Stay practical: if details are missing, suggest 2–3 assumptions and proceed.
Never invent specific real-time prices—give ranges or "check current menus".

When survey data is present, prioritize it:
- Recommend which weekend(s) maximize attendance based on RSVP headcounts.
- Note which location options families prefer from survey votes.
- Propose trip plans conditional on a chosen weekend and location (itinerary, lodging, activities).
- If RSVPs are sparse, say so and ask what would help decide.

Current trip context:
${contextBits}

Family availability from survey RSVPs (weekends):
${availabilitySummary}

Location preferences from survey RSVPs:
${locationSummary}`;

  const itinerarySystem = `You are WandrAI, a cheerful travel co-planner building a detailed Fri–Sun reunion itinerary for a family group.
The organizer has locked a location, weekend, and headcount. Help refine activities, meals, lodging, and reservations day by day.
Use clear headings and bullet lists with times. Mark items that need reservations.
Never invent live prices—say "check availability".
${focusDay ? `Focus changes on: ${focusDay} only unless asked otherwise.` : ""}

Current trip context:
${contextBits}

Saved itinerary:
${itineraryText}

Survey weekend availability:
${availabilitySummary}

Survey location preferences:
${locationSummary}`;

  const system =
    mode === "locations"
      ? locationsSystem
      : mode === "itinerary"
        ? itinerarySystem
        : planSystem;

  const result = streamText({
    model: plannerModel(),
    system,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
