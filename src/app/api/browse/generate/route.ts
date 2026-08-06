import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasAnthropicApiKey, plannerModel } from "@/lib/ai";
import {
  browseIdeaSchema,
  composeBrowseStack,
} from "@/lib/browseIdeas";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  prompt: z.string().min(1).max(280),
  filter: z
    .enum(["anything", "go-somewhere", "stay-home", "under-50", "two-hours"])
    .optional(),
  skippedTitles: z.array(z.string()).max(200).optional(),
  refine: z.enum(["cheaper", "closer", "weirder"]).optional(),
});

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
    const { object } = await generateObject({
      model: plannerModel(),
      schema: z.object({
        ideas: z.array(browseIdeaSchema).min(10).max(20),
      }),
      prompt: `You invent concrete weekend / evening ideas for a US family or couple.
User prompt: ${body.prompt}
Filter hint: ${body.filter ?? "anything"}
${refineNote}

Rules:
- Return 14–18 ideas.
- At least 4 must be category "stay-home" with estCostUsd <= 20 and place null.
- At least 3 "stay-local", at least 2 "day-trip", at most 2 "overnight".
- Every idea MUST include 1–2 honest cautions (drawbacks). Empty cautions are invalid.
- Descriptions: 2–3 concrete sentences with real-feeling details (hours, what you do). No marketing adjectives.
- driveMinutes must be null (drive times come from a separate tool).
- Never reuse these skipped titles: ${skipped.slice(0, 80).join(" | ") || "(none)"}
- Titles max 52 characters.
- costNote like "free", "~$40 groceries", "$22 for two".`,
    });

    let stack = composeBrowseStack(object.ideas);
    if (stack.length < 6) {
      // Second pass focused on stay-home fill
      const { object: more } = await generateObject({
        model: plannerModel(),
        schema: z.object({ ideas: z.array(browseIdeaSchema).min(6).max(12) }),
        prompt: `Generate 8 stay-home and stay-local ideas for: ${body.prompt}.
Every idea needs cautions. stay-home place=null, estCostUsd<=20. driveMinutes=null.
Avoid titles: ${[...skipped, ...stack.map((s) => s.title.toLowerCase())].join(" | ")}`,
      });
      stack = composeBrowseStack([...object.ideas, ...more.ideas]);
    }

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
    return NextResponse.json(
      { error: "Couldn't build a stack just now." },
      { status: 502 },
    );
  }
}
