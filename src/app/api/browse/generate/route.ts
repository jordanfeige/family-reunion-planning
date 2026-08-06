import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { extractorModel, hasAnthropicApiKey } from "@/lib/ai";
import {
  browseIdeaSchema,
  composeBrowseStack,
} from "@/lib/browseIdeas";

export const runtime = "nodejs";
/** Keep under typical gateway limits; model call aborts earlier via timeout. */
export const maxDuration = 45;

/** Abort model call before Vercel kills the function with a bare 504. */
const MODEL_TIMEOUT_MS = 35_000;

const bodySchema = z.object({
  prompt: z.string().min(1).max(280),
  filter: z
    .enum(["anything", "go-somewhere", "stay-home", "under-50", "two-hours"])
    .optional(),
  skippedTitles: z.array(z.string()).max(200).optional(),
  refine: z.enum(["cheaper", "closer", "weirder"]).optional(),
});

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  return /timed?\s*out|aborted|timeout/i.test(e.message ?? "");
}

export async function POST(request: Request) {
  if (!hasAnthropicApiKey()) {
    return NextResponse.json(
      { error: "AI planning is unavailable right now." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const skipped = (body.skippedTitles ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const refineNote =
    body.refine === "cheaper"
      ? "Bias hard toward free and under $30."
      : body.refine === "closer"
        ? "Bias toward stay-home and stay-local only."
        : body.refine === "weirder"
          ? "Bias toward unusual, specific, non-touristy ideas."
          : "";

  try {
    // Haiku + smaller stack: one structured call must finish well under gateway limit.
    // A second Sonnet pass previously pushed this past 60s → production 504.
    const { object } = await generateObject({
      model: extractorModel(),
      schema: z.object({
        ideas: z.array(browseIdeaSchema).min(8).max(12),
      }),
      maxRetries: 1,
      timeout: MODEL_TIMEOUT_MS,
      prompt: `You invent concrete weekend / evening ideas for a US family or couple.
User prompt: ${body.prompt}
Filter hint: ${body.filter ?? "anything"}
${refineNote}

Rules:
- Return exactly 10 ideas.
- At least 3 must be category "stay-home" with estCostUsd <= 20 and place null.
- At least 2 "stay-local", at least 2 "day-trip", at most 2 "overnight".
- Every idea MUST include 1–2 honest cautions (drawbacks). Empty cautions are invalid.
- Descriptions: 2 short concrete sentences (hours, what you do). No marketing adjectives.
- driveMinutes must be null (drive times come from a separate tool).
- Never reuse these skipped titles: ${skipped.slice(0, 40).join(" | ") || "(none)"}
- Titles max 52 characters.
- costNote like "free", "~$40 groceries", "$22 for two".`,
    });

    const stack = composeBrowseStack(object.ideas);

    if (stack.length < 6) {
      return NextResponse.json({
        ideas: stack,
        thin: true,
        message: `Only found ${stack.length} good ones for that. Want to loosen it up?`,
      });
    }

    return NextResponse.json({
      ideas: stack,
      promptId: crypto.randomUUID(),
      thin: false,
    });
  } catch (err) {
    console.error("browse generate:", err);
    if (isTimeoutError(err)) {
      return NextResponse.json(
        {
          error:
            "That took too long — try a shorter prompt, or tap Generate again.",
        },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Couldn't build a stack just now." },
      { status: 502 },
    );
  }
}
