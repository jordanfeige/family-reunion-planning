import { z } from "zod";

import { planTripDraftSchema } from "@/lib/planTripDraft";

/** Max AI user messages on an anonymous plan draft before save is required. */
export const PLAN_DRAFT_MESSAGE_LIMIT = 15;

/** Anonymous draft lifetime. */
export const PLAN_DRAFT_TTL_DAYS = 7;

export const PLAN_DRAFT_COOKIE = "wandrai_plan_draft";

/** Persisted UIMessage-shaped objects (validated loosely for forward compat). */
const uiMessageSchema = z
  .object({
    id: z.string(),
    role: z.string(),
    parts: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const planDraftPayloadSchema = z.object({
  name: z.string().optional(),
  tagline: z.string().optional(),
  destinationNotes: z.string().optional(),
  targetBudget: z.string().optional(),
  locationTitles: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  step: z.enum(["create", "places", "survey", "save"]).optional(),
  /** Single source of truth for the continuous /plan conversation. */
  trip: planTripDraftSchema.optional(),
  /** One continuous chat thread across Basics → Destinations → Survey. */
  messages: z.array(uiMessageSchema).optional(),
  surveyPrefs: z
    .object({
      pace: z.enum(["easy", "balanced", "full"]).optional(),
      lodging: z.enum(["rental", "hotel", "cabins"]).optional(),
      mustHave: z.enum(["swimming", "walks", "dinner"]).optional(),
      budget: z.enum(["lean", "middle", "comfortable"]).optional(),
      travel: z.enum(["driving", "mixed", "flying"]).optional(),
      homeCity: z.string().optional(),
      homeState: z.string().optional(),
      proposedWeekends: z.array(z.string()).optional(),
    })
    .optional(),
  /** Browse → plan handoff metadata (R10). */
  browseSeed: z
    .object({
      kind: z.enum(["ideas", "places"]),
      count: z.number().int().positive(),
      partnerName: z.string().optional(),
    })
    .optional(),
});

export type PlanDraftPayload = z.infer<typeof planDraftPayloadSchema>;

export type PlanDraftRecord = {
  id: string;
  secret: string;
  payload: PlanDraftPayload;
  messageCount: number;
  createdAt: Date;
  expiresAt: Date;
  claimedAt: Date | null;
  claimedTripId: string | null;
};

export function messagesRemaining(messageCount: number): number {
  return Math.max(0, PLAN_DRAFT_MESSAGE_LIMIT - messageCount);
}

export function isMessageCapped(messageCount: number): boolean {
  return messageCount >= PLAN_DRAFT_MESSAGE_LIMIT;
}

/** Keep legacy claim fields in sync with PlanTripDraft. */
export function syncLegacyFromTrip(payload: PlanDraftPayload): PlanDraftPayload {
  const trip = payload.trip;
  if (!trip) return payload;
  return {
    ...payload,
    name: trip.tripName?.trim() || payload.name,
    tagline: trip.vibe?.[0] || payload.tagline,
    destinationNotes: trip.region || payload.destinationNotes,
    targetBudget:
      trip.budgetPerHouseholdUsd != null
        ? `$${trip.budgetPerHouseholdUsd} per household`
        : payload.targetBudget,
    locationTitles:
      trip.shortlist?.map((p) => ({
        title: p.title,
        summary: p.summary,
      })) ?? payload.locationTitles,
  };
}
