"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  browseOpeningMessage,
  browseShortlistKind,
  deriveBrowseTripName,
  deriveBrowseVibe,
  type BrowseKeptSeed,
} from "@/lib/browseHandoff";
import type { BrowseTag } from "@/lib/browseTags";
import { emptyPlanTripDraft } from "@/lib/planTripDraft";
import {
  ensurePlanDraft,
  updatePlanDraftPayload,
} from "@/lib/supabase/planDrafts";

export async function startPlanFromBrowseAction(kept: {
  title: string;
  summary?: string;
  category?: string;
  tags?: BrowseTag[];
}[]) {
  const cleaned: BrowseKeptSeed[] = kept
    .map((k) => ({
      title: k.title.trim(),
      summary: k.summary?.trim() || undefined,
      category: k.category?.trim() || undefined,
      tags: k.tags,
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

  const tripName = deriveBrowseTripName(cleaned);
  const vibe = deriveBrowseVibe(cleaned);
  const kind = browseShortlistKind(cleaned);

  await updatePlanDraftPayload(draft.id, {
    ...draft.payload,
    step: "places",
    locationTitles: cleaned.map((k) => ({
      title: k.title,
      summary: k.summary,
    })),
    browseSeed: {
      kind,
      count: cleaned.length,
    },
    trip: {
      ...base,
      ...draft.payload.trip,
      shortlist,
      // Solo scale from Browse — survey is not a capability
      householdCount: draft.payload.trip?.householdCount ?? 1,
      headcount: draft.payload.trip?.headcount ?? 1,
      ...(tripName ? { tripName } : { tripName: undefined }),
      ...(vibe ? { vibe } : { vibe: [] }),
    },
    messages: [
      {
        id: `browse-seed-${Date.now()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: browseOpeningMessage(cleaned.length),
          },
        ],
      },
    ],
  });

  redirect("/plan");
}
