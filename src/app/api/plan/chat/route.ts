import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";

import { auth } from "@/auth";
import { hasAnthropicApiKey, plannerModel } from "@/lib/ai";
import { extractPlanTripDraft } from "@/lib/extractPlanTripDraft";
import {
  isMessageCapped,
  PLAN_DRAFT_MESSAGE_LIMIT,
  planDraftPayloadSchema,
  syncLegacyFromTrip,
} from "@/lib/planDraft";
import { placesDraftSchema } from "@/lib/placesDraft";
import {
  formatKnownBlock,
  formatWorkingFromLine,
  missingFieldsForStep,
  normalizePlanTripDraft,
  planTripDraftFromLegacy,
  type PlanStepId,
  FIELD_LABELS,
} from "@/lib/planTripDraft";
import { textFromMessage } from "@/lib/chatMessage";
import {
  getPlanDraftBySecret,
  incrementPlanDraftMessages,
  readPlanDraftCookieSecret,
  updatePlanDraftPayload,
} from "@/lib/supabase/planDrafts";

export const runtime = "nodejs";
export const maxDuration = 60;

const US_SCOPE = `Scope: United States only. Never suggest a non-US destination unless the user explicitly names one.
Units: miles, Fahrenheit, USD, MM/DD/YYYY dates, 12-hour times. Never metric, never Celsius.
Name places as "Place, ST" (e.g. "Lake Okoboji, IA"). The family is scattered across the US: the
organizer's default origin is Sioux Falls, SD, but never assume everyone drives from there. When you
give a drive time, say which origin it is from, and prefer framing like "about 4 hr from Sioux Falls,
longer for anyone coming from the coasts." Do not compute per-household drive times or averages —
the app does that from survey answers. Never invent live prices, availability, or booking links —
give typical ranges and say they're estimates.`;

const TONE = `Tone: Never begin a message with "You're absolutely right", "Great question", "Great —", "I'd be happy to", or similar sycophantic openers. Start with the substance. Confirmations are at most one short clause before useful content. If the user says they already answered something, do not apologize and do not re-list it — produce the output.`;

function stepFromBody(raw: unknown): PlanStepId {
  if (raw === "places" || raw === "destinations") return "places";
  if (raw === "survey") return "survey";
  return "create";
}

function buildSystem(opts: {
  step: PlanStepId;
  known: string;
  missing: string[];
  workingFrom: string;
}): string {
  const missingLine =
    opts.missing.length === 0
      ? "MISSING: none. Do not ask any questions. State what you are using in one short line, then immediately produce this step's output."
      : `MISSING (ask ONLY these, batched in one message, max two questions): ${opts.missing.join(", ")}. Never re-ask anything in KNOWN. Never ask a question whose text appears in answeredQuestions.`;

  const stepTask =
    opts.step === "create"
      ? "Step: Basics. When nothing is missing, confirm the trip name is set (call update_places_draft only later). For Basics completion, ensure tripName is clear in your reply; the extractor persists state."
      : opts.step === "places"
        ? `Step: Destinations. When nothing is missing, open with "Working from: ${opts.workingFrom}." then deliver a shortlist of 3–6 US places and call update_places_draft with full US meta. When something is missing, ask only for the missing fields.`
        : "Step: Survey prep. Confirm shortlist is ready; do not re-interview.";

  return `You are WandrAI, a U.S. family reunion co-planner. There is ONE trip draft and ONE conversation — steps are views onto that draft, not new sessions.

${US_SCOPE}

${TONE}

KNOWN — never ask for any of this again:
${opts.known}

${missingLine}

${stepTask}

You do not own structured state; an extractor does. Still call update_places_draft when you propose or revise destinations so the shortlist UI updates. Keep replies short. No emoji unless they use them.`;
}

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

  const body = (await req.json()) as {
    messages?: unknown[];
    mode?: string;
    step?: string;
  };
  const step = stepFromBody(body.step ?? body.mode);
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];

  let trip = planTripDraftFromLegacy(draft.payload);

  const last = rawMessages[rawMessages.length - 1] as UIMessage | undefined;
  const lastText = last ? textFromMessage(last) : "";
  const isAdvanceMarker = lastText.startsWith("⟦advance:");

  if (!signedIn && last?.role === "user" && !isAdvanceMarker) {
    await incrementPlanDraftMessages(draft.id);
  }

  // Extractor: after each real user message (not step markers)
  if (last?.role === "user" && lastText && !isAdvanceMarker) {
    try {
      trip = await extractPlanTripDraft({
        prior: trip,
        message: lastText,
        role: "user",
      });
      const nextPayload = syncLegacyFromTrip(
        planDraftPayloadSchema.parse({
          ...draft.payload,
          trip: normalizePlanTripDraft(trip),
          step: step === "create" ? "create" : step,
          messages: rawMessages,
        }),
      );
      await updatePlanDraftPayload(draft.id, nextPayload);
      draft.payload = nextPayload;
    } catch {
      // Extraction failure must not block the conversational turn
    }
  }

  const missingKeys = missingFieldsForStep(trip, step);

  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const system = buildSystem({
    step,
    known: formatKnownBlock(trip),
    missing: missingKeys.map((k) => FIELD_LABELS[k] ?? k),
    workingFrom: formatWorkingFromLine(trip),
  });

  const draftId = draft.id;
  let payloadSnap = draft.payload;

  const result = streamText({
    model: plannerModel(),
    system,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      update_places_draft: tool({
        description:
          "Update destination shortlist. Titles as 'Place, ST' with US meta when known.",
        inputSchema: placesDraftSchema,
        execute: async (input) => {
          const shortlist = input.places.map((p) => ({
            ...p,
            title: p.title.trim(),
            summary: p.summary?.trim() || undefined,
            selected: p.selected !== false,
          }));
          const nextTrip = normalizePlanTripDraft({
            ...trip,
            shortlist,
          });
          trip = nextTrip;
          const next = syncLegacyFromTrip(
            planDraftPayloadSchema.parse({
              ...payloadSnap,
              trip: nextTrip,
              step: "places",
              locationTitles: shortlist.map((p) => ({
                title: p.title,
                summary: p.summary,
              })),
            }),
          );
          payloadSnap = next;
          await updatePlanDraftPayload(draftId, next);
          return { ok: true as const, draft: input };
        },
      }),
    },
    onFinish: async ({ text }) => {
      try {
        if (text?.trim()) {
          const extracted = await extractPlanTripDraft({
            prior: trip,
            message: text,
            role: "assistant",
          });
          trip = extracted;
        }
        const next = syncLegacyFromTrip(
          planDraftPayloadSchema.parse({
            ...payloadSnap,
            trip: normalizePlanTripDraft(trip),
            step: step === "create" ? "create" : step,
            messages: rawMessages,
          }),
        );
        await updatePlanDraftPayload(draftId, next);
      } catch {
        /* ignore persist errors on finish */
      }
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: rawMessages as UIMessage[],
  });
}
