import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";

import { auth } from "@/auth";
import { hasAnthropicApiKey, plannerModel } from "@/lib/ai";
import {
  formatAvailabilitySummary,
  formatLocationPreferenceSummary,
} from "@/lib/availability";
import { formatItineraryForPrompt, normalizeItinerary } from "@/lib/itinerary";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import { placesDraftSchema } from "@/lib/placesDraft";
import {
  findVenueById,
  formatVenuesForPrompt,
  normalizeVenueOptions,
} from "@/lib/venues";
import {
  normalizeChatFocusDay,
  saveChatThread,
  type ChatThreadMode,
} from "@/lib/supabase/chatHistory";
import {
  getTripForOrganizer,
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
  const access = await getTripForOrganizer(slug, session.user.id);

  if (!access) {
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
  const mode: ChatThreadMode =
    body.mode === "itinerary"
      ? "itinerary"
      : body.mode === "venues"
        ? "venues"
        : "locations";
  const focusDay = normalizeChatFocusDay(mode, body.focusDay);

  if (mode === "itinerary") {
    const { trip: t } = access;
    if (!t.selectedLocationId || !t.selectedWeekendFriday) {
      return new Response(
        JSON.stringify({
          error: "Lock a location and weekend in Blueprint before using itinerary chat.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  if (mode === "venues") {
    const { trip: t } = access;
    if (!t.selectedLocationId) {
      return new Response(
        JSON.stringify({
          error: "Lock a location in Blueprint before planning where to stay and eat.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const { trip } = access;
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
  const venueOptions = normalizeVenueOptions(trip.venueOptions ?? []);
  const selectedVenue = trip.selectedVenueId
    ? findVenueById(venueOptions, trip.selectedVenueId)
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
    mode !== "locations" && venueOptions.length
      ? `Organizer venue shortlist:\n${formatVenuesForPrompt(venueOptions)}`
      : null,
    mode !== "locations" && selectedVenue
      ? `Base camp (primary lodging): ${selectedVenue.title}${selectedVenue.summary ? ` — ${selectedVenue.summary}` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const locationsSystem = `You are WandrAI, a warm, concise destination co-planner for a U.S. family reunion (unless they specify another country).
This is a two-way interview, then a shortlist—not a lecture and not a day-by-day itinerary.

Flow:
1. Ask at most one clarifying question per turn (people count, vibe, region, drive/flight limits).
2. When you know enough, propose 3–6 distinct U.S. areas/destinations with a short why + one caution each.
3. Call update_places_draft whenever the survey shortlist should change so they see a confirmable card.
4. After updating the draft, tell them they can keep chatting or publish to the survey.

Rules:
- Organizer-facing, concise, no emoji unless they use them first.
- Prefer stating assumptions over stacking questions.
- Never invent live prices or booking links.
- Do not reopen lodging/restaurant planning—places only.

Current trip context:
${contextBits}`;

  const itinerarySystem = `You are WandrAI, a cheerful travel co-planner building a detailed Fri–Sun reunion itinerary for a family group.
The organizer has locked a location, weekend, and headcount. Help refine activities, meals, lodging, and reservations day by day.
Use clear headings and bullet lists with times. Mark items that need reservations.
Never invent live prices—say "check availability".
Default to U.S. norms unless context says otherwise.
${focusDay ? `Focus changes on: ${focusDay} only unless asked otherwise.` : ""}

Current trip context:
${contextBits}

Saved itinerary:
${itineraryText}

Survey weekend availability:
${availabilitySummary}

Survey location preferences:
${locationSummary}`;

  const venuesSystem = `You are WandrAI, helping organizers and co-planners shortlist real places within their locked reunion location.
This is private planner work—not a family survey. Suggest specific places to STAY (resorts, cabin clusters, campgrounds, rentals), EAT (group-friendly restaurants), and DO (activities, excursions, attractions).
Include a price estimate per item (priceType, priceMin/priceMax, priceUnit: per_night for stay, per_person for eat/do).
For each suggestion use category stay, eat, or area in your prose with clear **bold** names.
Compare options for a multi-generational group: sleeping capacity, meeting space, kitchen/group dining, drive time, accessibility, and booking friction.
Format in markdown with ## sections (e.g. "## Where to stay", "## Where to eat"). End with "## Shortlist" bullets.
Never invent live prices or fake booking links—say "verify on the property site" unless the user supplied a URL.
Do not re-open the regional destination debate—the location is already locked.
Be conversational: ask at most one clarifying question when needed.

Current trip context:
${contextBits}`;

  const system =
    mode === "itinerary"
      ? itinerarySystem
      : mode === "venues"
        ? venuesSystem
        : locationsSystem;

  const result = streamText({
    model: plannerModel(),
    system,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools:
      mode === "locations"
        ? {
            update_places_draft: tool({
              description:
                "Update the on-screen survey destinations draft the organizer will publish.",
              inputSchema: placesDraftSchema,
              execute: async (draft) => ({ ok: true as const, draft }),
            }),
          }
        : undefined,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: rawMessages as UIMessage[],
    onFinish: async ({ messages }) => {
      await saveChatThread({
        tripId: trip.id,
        mode,
        focusDay,
        messages,
      });
    },
  });
}
