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
  isMessageCapped,
  PLAN_DRAFT_MESSAGE_LIMIT,
  planDraftPayloadSchema,
} from "@/lib/planDraft";
import { placesDraftSchema } from "@/lib/placesDraft";
import { tripDraftSchema } from "@/lib/tripDraft";
import {
  getPlanDraftBySecret,
  incrementPlanDraftMessages,
  readPlanDraftCookieSecret,
  updatePlanDraftPayload,
} from "@/lib/supabase/planDrafts";

export const runtime = "nodejs";
export const maxDuration = 60;

const CREATE_SYSTEM = `You are WandrAI, a warm, concise trip co-planner helping someone start a U.S. family reunion (unless they specify elsewhere).

Conversational onboarding only—not a full itinerary.
Gather over multiple turns: who's coming, vibe/region feel, rough budget, then a trip name.

Rules:
- Ask exactly one clarifying question per turn. Never stack who / vibe / budget in one message.
- Short replies (1–3 sentences). Mirror their energy.
- Typical order: who → vibe → budget → propose a name → call update_trip_draft.
- When you have a usable name (and extras), call update_trip_draft.
- After updating, tell them they can keep chatting or continue to pick places / save.
- Never invent live prices or booking links.
- Do not claim the trip is saved until they create an account.`;

const PLACES_SYSTEM = `You are WandrAI, helping pick U.S. destinations for a family reunion survey (unless they specify elsewhere).
Two-way interview, then a shortlist.

Flow:
1. Ask exactly one clarifying question per turn (region, drive time, vibe — not all at once).
2. After 1–2 answers, propose 3–6 distinct areas with a short why + one caution.
3. Call update_places_draft when the shortlist should change.
4. Remind them saving unlocks the real survey link.

Rules: concise, no emoji unless they use them, no fake booking links.`;

export async function POST(req: Request) {
  if (!hasAnthropicApiKey()) {
    return new Response(
      JSON.stringify({ error: "Add ANTHROPIC_API_KEY to plan with WandrAI." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const secret = await readPlanDraftCookieSecret();
  if (!secret) {
    return new Response(JSON.stringify({ error: "No plan draft. Start from /plan." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const draft = await getPlanDraftBySecret(secret);
  if (!draft) {
    return new Response(JSON.stringify({ error: "Plan draft expired. Start again." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  if (!signedIn && isMessageCapped(draft.messageCount)) {
    return new Response(
      JSON.stringify({
        error: "message_cap",
        message: `You've used all ${PLAN_DRAFT_MESSAGE_LIMIT} free messages. Save with Google to keep planning.`,
        messageCount: draft.messageCount,
        limit: PLAN_DRAFT_MESSAGE_LIMIT,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = (await req.json()) as { messages?: unknown[]; mode?: string };
  const mode = body.mode === "places" ? "places" : "create";
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];

  // Count this user turn (anonymous quota only)
  const last = rawMessages[rawMessages.length - 1] as { role?: string } | undefined;
  if (!signedIn && last?.role === "user") {
    await incrementPlanDraftMessages(draft.id);
  }

  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const contextBits = [
    draft.payload.name ? `Working name: ${draft.payload.name}` : null,
    draft.payload.tagline ? `Tagline: ${draft.payload.tagline}` : null,
    draft.payload.destinationNotes
      ? `Notes: ${draft.payload.destinationNotes}`
      : null,
    draft.payload.targetBudget ? `Budget: ${draft.payload.targetBudget}` : null,
    draft.payload.locationTitles?.length
      ? `Places so far: ${draft.payload.locationTitles.map((p) => p.title).join(" | ")}`
      : null,
    `Anonymous draft — ${signedIn ? "signed-in (no message cap)" : `${Math.max(0, PLAN_DRAFT_MESSAGE_LIMIT - draft.messageCount - (last?.role === "user" ? 1 : 0))} messages left before save is required.`}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = streamText({
    model: plannerModel(),
    system: `${mode === "places" ? PLACES_SYSTEM : CREATE_SYSTEM}\n\nDraft context:\n${contextBits}`,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools:
      mode === "places"
        ? {
            update_places_draft: tool({
              description: "Update survey destinations draft.",
              inputSchema: placesDraftSchema,
              execute: async (input) => {
                const places = input.places.map((p) => ({
                  title: p.title.trim(),
                  summary: p.summary?.trim() || undefined,
                }));
                const next = planDraftPayloadSchema.parse({
                  ...draft.payload,
                  locationTitles: places,
                  step: "places",
                });
                await updatePlanDraftPayload(draft.id, next);
                return { ok: true as const, draft: input };
              },
            }),
          }
        : {
            update_trip_draft: tool({
              description: "Update the trip draft card.",
              inputSchema: tripDraftSchema,
              execute: async (input) => {
                const next = planDraftPayloadSchema.parse({
                  ...draft.payload,
                  name: input.name,
                  tagline: input.tagline,
                  destinationNotes: input.destinationNotes,
                  targetBudget: input.targetBudget,
                  locationTitles:
                    input.locationTitles?.map((title) => ({ title })) ??
                    draft.payload.locationTitles,
                  step: "create",
                });
                await updatePlanDraftPayload(draft.id, next);
                return { ok: true as const, draft: input };
              },
            }),
          },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: rawMessages as UIMessage[],
  });
}
