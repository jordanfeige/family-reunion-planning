import { z } from "zod";

/** Max AI user messages on an anonymous plan draft before save is required. */
export const PLAN_DRAFT_MESSAGE_LIMIT = 15;

/** Anonymous draft lifetime. */
export const PLAN_DRAFT_TTL_DAYS = 7;

export const PLAN_DRAFT_COOKIE = "wandrai_plan_draft";

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
