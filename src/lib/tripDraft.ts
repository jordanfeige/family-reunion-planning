import { z } from "zod";

/** Draft gathered by create-trip chat before the hub exists. */
export const tripDraftSchema = z.object({
  name: z.string().min(1).describe("Trip or reunion name"),
  tagline: z
    .string()
    .optional()
    .describe("Short vibe line, e.g. Lake weekends and silly games"),
  destinationNotes: z
    .string()
    .optional()
    .describe("Place ideas, constraints, dietary notes, travel notes"),
  targetBudget: z
    .string()
    .optional()
    .describe("Budget note per household or overall, free text"),
  locationTitles: z
    .array(z.string())
    .max(6)
    .optional()
    .describe("2–6 distinct destination titles to seed the survey"),
});

export type TripDraft = z.infer<typeof tripDraftSchema>;

export function normalizeTripDraft(input: TripDraft): TripDraft {
  const name = input.name.trim();
  const locationTitles = (input.locationTitles ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    name,
    tagline: input.tagline?.trim() || undefined,
    destinationNotes: input.destinationNotes?.trim() || undefined,
    targetBudget: input.targetBudget?.trim() || undefined,
    locationTitles: locationTitles.length ? locationTitles : undefined,
  };
}
