"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  isMessageCapped,
  planDraftPayloadSchema,
  syncLegacyFromTrip,
  type PlanDraftPayload,
} from "@/lib/planDraft";
import {
  mergePlanTripDraft,
  normalizePlanTripDraft,
  planTripDraftFromLegacy,
  planTripDraftSchema,
  type PlanTripDraft,
} from "@/lib/planTripDraft";
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
  const merged = planDraftPayloadSchema.parse({
    ...draft.payload,
    ...payload,
  });
  const withLegacy = syncLegacyFromTrip(merged);
  await updatePlanDraftPayload(draft.id, withLegacy);
  return { ok: true as const, payload: withLegacy };
}

/** UI correction: patch one or more PlanTripDraft fields without chatting. */
export async function patchPlanTripDraftAction(patch: PlanTripDraft) {
  const secret = await readPlanDraftCookieSecret();
  if (!secret) throw new Error("No active plan draft.");
  const draft = await getPlanDraftBySecret(secret);
  if (!draft) throw new Error("Plan draft expired. Start again from the home page.");

  const prior = planTripDraftFromLegacy(draft.payload);
  const parsedPatch = planTripDraftSchema.parse(patch);
  const trip = mergePlanTripDraft(prior, parsedPatch);
  const next = syncLegacyFromTrip(
    planDraftPayloadSchema.parse({
      ...draft.payload,
      trip: normalizePlanTripDraft(trip),
    }),
  );
  await updatePlanDraftPayload(draft.id, next);
  return { ok: true as const, trip: next.trip ?? trip };
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

  const name =
    draft.payload.trip?.tripName?.trim() || draft.payload.name?.trim();
  if (!name) {
    return { error: "needs_name" };
  }

  const slug = newTripSlug();
  const shareOptionsToken = newSecretToken();
  const surveyToken = newSecretToken();

  const trip = await createTrip({
    slug,
    name,
    tagline: draft.payload.tagline?.trim() || draft.payload.trip?.vibe?.[0] || null,
    destinationNotes:
      draft.payload.destinationNotes?.trim() ||
      draft.payload.trip?.region ||
      null,
    targetBudget: draft.payload.targetBudget?.trim() || null,
    shareOptionsToken,
    ownerId: session.user.id,
  });

  await createSurvey({
    tripId: trip.id,
    publicToken: surveyToken,
    title: "When can your crew join?",
  });

  const places =
    draft.payload.trip?.shortlist?.map((p) => ({
      title: p.title,
      summary: p.summary,
    })) ??
    draft.payload.locationTitles ??
    [];
  if (places.length > 0) {
    await updateTripById(trip.id, {
      locationOptions: places.map((p) => ({
        id: crypto.randomUUID(),
        title: p.title.trim(),
        summary: p.summary?.trim() || undefined,
      })),
      ...(draft.payload.trip?.originMetro
        ? { originMetro: draft.payload.trip.originMetro }
        : {}),
    });
  } else if (draft.payload.trip?.originMetro) {
    await updateTripById(trip.id, {
      originMetro: draft.payload.trip.originMetro,
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
