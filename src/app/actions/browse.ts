"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { emptyPlanTripDraft } from "@/lib/planTripDraft";
import {
  ensurePlanDraft,
  updatePlanDraftPayload,
} from "@/lib/supabase/planDrafts";

export async function startPlanFromBrowseAction(kept: {
  title: string;
  summary?: string;
  category?: string;
}[]) {
  const cleaned = kept
    .map((k) => ({
      title: k.title.trim(),
      summary: k.summary?.trim() || k.category?.trim() || undefined,
    }))
    .filter((k) => k.title.length > 0)
    .slice(0, 8);

  if (cleaned.length === 0) {
    throw new Error("Keep at least one idea first.");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent("/browse?save=1")}`,
    );
  }

  const draft = await ensurePlanDraft();
  const base = emptyPlanTripDraft();
  const shortlist = cleaned.map((k) => ({
    title: k.title,
    summary: k.summary,
    selected: true as const,
  }));

  await updatePlanDraftPayload(draft.id, {
    ...draft.payload,
    step: "places",
    locationTitles: cleaned,
    trip: {
      ...base,
      ...draft.payload.trip,
      shortlist,
      tripName: draft.payload.trip?.tripName || "Weekend from Browse",
      vibe: cleaned.map((c) => c.title).slice(0, 6),
    },
    messages: [
      {
        id: `browse-seed-${Date.now()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `You kept these from Browse:\n${cleaned.map((c) => `• ${c.title}`).join("\n")}\n\nI'll use them as seeds. Want to refine the shortlist or continue?`,
          },
        ],
      },
    ],
  });

  redirect("/plan");
}
