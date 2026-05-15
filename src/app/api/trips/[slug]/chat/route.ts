import { convertToModelMessages, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { trips } from "@/db/schema";

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
  const db = getDb();
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.ownerId, session.user.id)))
    .limit(1);

  if (!trip) {
    return new Response("Not found", { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Add OPENAI_API_KEY to enable the Nordic co-planner.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = (await req.json()) as { messages?: unknown[] };
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const modelMessages = await convertToModelMessages(
    rawMessages as Parameters<typeof convertToModelMessages>[0],
  );

  const contextBits = [
    `Trip name: ${trip.name}`,
    trip.tagline ? `Tagline: ${trip.tagline}` : null,
    trip.destinationNotes ? `Destination notes: ${trip.destinationNotes}` : null,
    trip.targetBudget ? `Budget note: ${trip.targetBudget}` : null,
    trip.tripStart ? `Target start: ${trip.tripStart.toISOString()}` : null,
    trip.tripEnd ? `Target end: ${trip.tripEnd.toISOString()}` : null,
    trip.proposedDateSlots?.length
      ? `Proposed date options from organizer: ${trip.proposedDateSlots.join(" | ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You are a cheerful Nordic-inspired travel co-planner for the Feige family.
Use clear sections with short headings and bullet lists. Call out realistic pacing, weather or season notes when relevant, kid-friendly ideas when it fits, dining at a mix of price points, and reservations or tickets to book early.
Stay practical: if details are missing, suggest 2–3 assumptions and proceed.
Never invent specific real-time prices—give ranges or "check current menus".
Current trip context:
${contextBits}`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
