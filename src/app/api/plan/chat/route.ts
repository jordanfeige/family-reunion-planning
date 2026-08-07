import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
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
import {
  applyScaleInference,
  deriveMode,
  resolvePlanScale,
  scalePromptHint,
} from "@/lib/planMode";
import { placesDraftSchema } from "@/lib/placesDraft";
import {
  formatKnownBlock,
  formatWorkingFromLine,
  missingFieldsForStep,
  normalizePlanTripDraft,
  planTripDraftFromLegacy,
  type PlanStepId,
  type PlanTripDraft,
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
Name places as "Place, ST" (e.g. "Lake Okoboji, IA"). Default origin framing is Sioux Falls, SD
when the organizer has not named one — but never assume a multi-household reunion. When you give a
drive time, say which origin it is from. Do not invent live prices, availability, or booking links —
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
  scaleHint: string;
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

  return `You are WandrAI, a U.S. trip co-planner. There is ONE trip draft and ONE conversation — steps are views onto that draft, not new sessions.

${opts.scaleHint}

${US_SCOPE}

${TONE}

KNOWN — never ask for any of this again:
${opts.known}

${missingLine}

${stepTask}

You do not own structured state; an extractor does. Still call update_places_draft when you propose or revise destinations so the shortlist UI updates. Keep replies short. No emoji unless they use them. Forbidden from inventing numbers not present in the draft.`;
}

type ThinkingEvent =
  | "extracting"
  | `mode:${string}`
  | `graph:loaded${string}`
  | `tool:${string}`
  | "filtering"
  | "generating";

type StreamWriter = {
  write: (part: Record<string, unknown>) => void;
  merge: (stream: ReadableStream) => void;
};

function writeThinking(writer: StreamWriter, event: ThinkingEvent) {
  writer.write({
    type: "data-thinking",
    data: { event },
    transient: true,
  });
}

function writeDraft(writer: StreamWriter, trip: PlanTripDraft) {
  writer.write({
    type: "data-draft",
    data: { trip: normalizePlanTripDraft(trip) },
    transient: true,
  });
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
  const shouldExtract =
    Boolean(last?.role === "user" && lastText && !isAdvanceMarker);

  if (!signedIn && last?.role === "user" && !isAdvanceMarker) {
    await incrementPlanDraftMessages(draft.id);
  }

  // Deterministic scale first so converse system prompt matches the turn
  if (shouldExtract) {
    trip = normalizePlanTripDraft(applyScaleInference(trip, lastText));
  }

  const draftId = draft.id;
  let payloadSnap = draft.payload;
  let tripRef = trip;

  const scaleForPrompt = resolvePlanScale({
    householdCount: tripRef.householdCount,
    headcount: tripRef.headcount,
  });
  let missingKeys = missingFieldsForStep(tripRef, step);
  if (scaleForPrompt === "solo" || scaleForPrompt === "duo" || scaleForPrompt === "small") {
    missingKeys = missingKeys.filter((k) => k !== "householdCount");
  }

  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const system = buildSystem({
    step,
    known: formatKnownBlock(tripRef),
    missing: missingKeys.map((k) => FIELD_LABELS[k] ?? k),
    workingFrom: formatWorkingFromLine(tripRef),
    scaleHint: scalePromptHint(scaleForPrompt),
  });

  const stream = createUIMessageStream({
    originalMessages: rawMessages as UIMessage[],
    execute: async ({ writer }) => {
      const w = writer as unknown as StreamWriter;

      // Real mode from deterministic scale inference (work that already ran)
      const inferredMode = deriveMode(tripRef);
      if (inferredMode !== "unresolved") {
        writeThinking(w, `mode:${inferredMode}`);
      }

      // §5: EXTRACT + CONVERSE in parallel — thinking events only for work that runs
      const extractPromise = shouldExtract
        ? (async () => {
            writeThinking(w, "extracting");
            try {
              let next = await extractPlanTripDraft({
                prior: tripRef,
                message: lastText,
                role: "user",
              });
              next = normalizePlanTripDraft(applyScaleInference(next, lastText));
              tripRef = next;
              const mode = deriveMode(next);
              if (mode !== "unresolved") {
                writeThinking(w, `mode:${mode}`);
              }
              writeDraft(w, next);
              const nextPayload = syncLegacyFromTrip(
                planDraftPayloadSchema.parse({
                  ...payloadSnap,
                  trip: next,
                  step: step === "create" ? "create" : step,
                  messages: rawMessages,
                }),
              );
              await updatePlanDraftPayload(draftId, nextPayload);
              payloadSnap = nextPayload;
              return next;
            } catch {
              try {
                const nextPayload = syncLegacyFromTrip(
                  planDraftPayloadSchema.parse({
                    ...payloadSnap,
                    trip: normalizePlanTripDraft(tripRef),
                    step: step === "create" ? "create" : step,
                    messages: rawMessages,
                  }),
                );
                await updatePlanDraftPayload(draftId, nextPayload);
                payloadSnap = nextPayload;
              } catch {
                /* ignore */
              }
              return tripRef;
            }
          })()
        : Promise.resolve(tripRef);

      writeThinking(w, "generating");

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
              writeThinking(w, `tool:places:${input.places.length}`);
              const shortlist = input.places.map((p) => ({
                ...p,
                title: p.title.trim(),
                summary: p.summary?.trim() || undefined,
                selected: p.selected !== false,
              }));
              const nextTrip = normalizePlanTripDraft({
                ...tripRef,
                shortlist,
              });
              tripRef = nextTrip;
              writeThinking(w, "filtering");
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
              writeDraft(w, nextTrip);
              return { ok: true as const, draft: input };
            },
          }),
        },
        onFinish: async ({ text }) => {
          await extractPromise;
          try {
            if (text?.trim()) {
              const extracted = await extractPlanTripDraft({
                prior: tripRef,
                message: text,
                role: "assistant",
              });
              tripRef = extracted;
              writeDraft(w, extracted);
            }
            const next = syncLegacyFromTrip(
              planDraftPayloadSchema.parse({
                ...payloadSnap,
                trip: normalizePlanTripDraft(tripRef),
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

      writer.merge(
        result.toUIMessageStream({
          originalMessages: rawMessages as UIMessage[],
        }),
      );

      void extractPromise;
    },
  });

  return createUIMessageStreamResponse({ stream });
}
