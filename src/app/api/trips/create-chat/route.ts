import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";

import { auth } from "@/auth";
import { hasAnthropicApiKey, plannerModel } from "@/lib/ai";
import { tripDraftSchema } from "@/lib/tripDraft";

export const runtime = "nodejs";
export const maxDuration = 60;

const CREATE_SYSTEM = `You are WandrAI, a warm, concise trip co-planner helping someone start a family reunion or multi-household weekend.

Your job is conversational onboarding—not a full itinerary yet.
Gather enough to create their trip hub:
- A clear trip name (required before they can create)
- Optional tagline / vibe
- Destination or region ideas
- Budget note (free text ranges are fine)
- A few distinct place titles they could put on a family survey

Rules:
- Organizer-facing, concise, no emoji unless they use them first.
- Ask at most one clarifying question per turn; prefer stating assumptions and continuing.
- Never invent live prices or booking links.
- When you have a usable name (and any extras), call the update_trip_draft tool so they see a confirmable card.
- Call update_trip_draft again whenever the draft should change.
- After updating the draft, briefly tell them they can keep chatting or create the hub.
- Do not claim the trip already exists until they press Create.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasAnthropicApiKey()) {
    return new Response(
      JSON.stringify({
        error: "Add ANTHROPIC_API_KEY to plan a trip with WandrAI.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = (await req.json()) as { messages?: unknown[] };
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const result = streamText({
    model: plannerModel(),
    system: CREATE_SYSTEM,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      update_trip_draft: tool({
        description:
          "Update the on-screen trip draft the organizer will confirm before creating the hub.",
        inputSchema: tripDraftSchema,
        execute: async (draft) => ({
          ok: true as const,
          draft,
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: rawMessages as UIMessage[],
  });
}
