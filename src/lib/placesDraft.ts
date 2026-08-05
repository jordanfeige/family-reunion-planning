import { z } from "zod";

export const placesDraftSchema = z.object({
  places: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().optional(),
      }),
    )
    .min(1)
    .max(8)
    .describe("Destination options for the family survey"),
});

export type PlacesDraftItem = {
  title: string;
  summary?: string;
  selected?: boolean;
};

export type PlacesDraft = {
  places: PlacesDraftItem[];
};

export function normalizePlacesDraft(input: {
  places: { title: string; summary?: string }[];
}): PlacesDraft {
  const seen = new Set<string>();
  const places: PlacesDraftItem[] = [];
  for (const p of input.places) {
    const title = p.title.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      title,
      summary: p.summary?.trim() || undefined,
      selected: true,
    });
    if (places.length >= 8) break;
  }
  return { places };
}
