"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  isMessageCapped,
  planDraftPayloadSchema,
  type PlanDraftPayload,
} from "@/lib/planDraft";
import {
  clearPlanDraftCookie,
  ensurePlanDraft,
  getPlanDraftBySecret,
  markPlanDraftClaimed,
  readPlanDraftCookieSecret,
  updatePlanDraftPayload,
} from "@/lib/supabase/planDrafts";
import { createSurvey, createTrip, updateTripById } from "@/lib/supabase/queries";
import { newSecretToken, newTripSlug } from "@/lib/tokens";

export async function savePlanDraftPayloadAction(payload: PlanDraftPayload) {
  const secret = await readPlanDraftCookieSecret();
  if (!secret) throw new Error("No active plan draft.");
  const draft = await getPlanDraftBySecret(secret);
  if (!draft) throw new Error("Plan draft expired. Start again from the home page.");
  if (isMessageCapped(draft.messageCount) && payload.step !== "save") {
    // still allow saving payload when capped
  }
  const parsed = planDraftPayloadSchema.parse({
    ...draft.payload,
    ...payload,
  });
  await updatePlanDraftPayload(draft.id, parsed);
  return { ok: true as const };
}

/** Guest-safe: persist survey composition to the plan draft cookie. */
export async function savePlanSurveyDraftAction(payload: {
  surveyPrefs?: PlanDraftPayload["surveyPrefs"];
  step?: PlanDraftPayload["step"];
}) {
  const secret = await readPlanDraftCookieSecret();
  if (!secret) throw new Error("No active plan draft.");
  const draft = await getPlanDraftBySecret(secret);
  if (!draft) throw new Error("Plan draft expired. Start again from the home page.");

  const parsed = planDraftPayloadSchema.parse({
    ...draft.payload,
    ...payload,
    step: payload.step ?? "survey",
  });
  await updatePlanDraftPayload(draft.id, parsed);
  return { ok: true as const };
}

/** Persist draft + send user to Google (or claim immediately if already signed in). */
export async function beginSavePlanDraftAction(payload?: PlanDraftPayload) {
  const draft = await ensurePlanDraft();
  if (payload) {
    const parsed = planDraftPayloadSchema.parse({
      ...draft.payload,
      ...payload,
      step: "save",
    });
    await updatePlanDraftPayload(draft.id, parsed);
  } else {
    await updatePlanDraftPayload(draft.id, {
      ...draft.payload,
      step: "save",
    });
  }

  const session = await auth();
  if (session?.user?.id) {
    redirect("/api/plan/claim");
  }
  redirect(`/login?intent=signup&callbackUrl=${encodeURIComponent("/api/plan/claim")}`);
}

/** After Google sign-in: turn cookie draft into a real owned trip. Call from /api/plan/claim only when authenticated. */
export async function claimPlanDraftForUser(): Promise<{ slug: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in required." };
  }

  const secret = await readPlanDraftCookieSecret();
  if (!secret) {
    return { error: "no_draft" };
  }

  const draft = await getPlanDraftBySecret(secret);
  if (!draft) {
    await clearPlanDraftCookie();
    return { error: "expired" };
  }

  const name = draft.payload.name?.trim();
  if (!name) {
    return { error: "needs_name" };
  }

  const slug = newTripSlug();
  const shareOptionsToken = newSecretToken();
  const surveyToken = newSecretToken();

  const trip = await createTrip({
    slug,
    name,
    tagline: draft.payload.tagline?.trim() || null,
    destinationNotes: draft.payload.destinationNotes?.trim() || null,
    targetBudget: draft.payload.targetBudget?.trim() || null,
    shareOptionsToken,
    ownerId: session.user.id,
  });

  await createSurvey({
    tripId: trip.id,
    publicToken: surveyToken,
    title: "When can your crew join?",
  });

  const places = draft.payload.locationTitles ?? [];
  if (places.length > 0) {
    await updateTripById(trip.id, {
      locationOptions: places.map((p) => ({
        id: crypto.randomUUID(),
        title: p.title.trim(),
        summary: p.summary?.trim() || undefined,
      })),
    });
  }

  const surveyPrefs = draft.payload.surveyPrefs;
  if (surveyPrefs?.proposedWeekends?.length) {
    const homeCity = surveyPrefs.homeCity?.trim();
    const homeState = surveyPrefs.homeState?.trim();
    await updateTripById(trip.id, {
      proposedDateSlots: surveyPrefs.proposedWeekends,
      ...(homeCity && homeState
        ? {
            originMetro: `${homeCity}, ${homeState.toUpperCase().slice(0, 2)}`,
          }
        : {}),
    });
  }

  await markPlanDraftClaimed(draft.id, trip.id);
  await clearPlanDraftCookie();

  return { slug };
}
