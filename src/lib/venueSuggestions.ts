import { z } from "zod";

import {
  normalizeVenueCategory,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export type VenueSuggestion = {
  title: string;
  summary?: string;
  category: VenueCategory;
  bookingUrl?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  sourceLabel?: string;
};

export const venueSuggestionsSchema = z.object({
  venues: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().optional(),
        category: z.enum(["stay", "eat", "area"]),
        bookingUrl: z.string().optional(),
        mapsUrl: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export function mergeVenueSuggestions(
  existing: VenueOption[],
  suggestions: VenueSuggestion[],
): { merged: VenueOption[]; added: number } {
  const seen = new Set(
    existing.map((v) => `${v.category}:${v.title.trim().toLowerCase()}`),
  );
  const merged = [...existing];
  let added = 0;

  for (const item of suggestions) {
    const title = item.title.trim();
    if (!title) continue;
    const category = normalizeVenueCategory(item.category);
    const key = `${category}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      id: crypto.randomUUID(),
      title,
      category,
      summary: item.summary?.trim() || undefined,
      bookingUrl: item.bookingUrl?.trim() || undefined,
      mapsUrl: item.mapsUrl?.trim() || undefined,
    });
    added += 1;
  }

  return { merged, added };
}
