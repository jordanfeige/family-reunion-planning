import { z } from "zod";

import type { LocationOption } from "@/lib/locations";

export type LocationSuggestion = {
  title: string;
  summary?: string;
};

export const locationSuggestionsSchema = z.object({
  locations: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
});

export function normalizeLocationTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function isLocationOnSurvey(
  title: string,
  existingTitles: readonly string[],
): boolean {
  const key = normalizeLocationTitle(title);
  return existingTitles.some((t) => normalizeLocationTitle(t) === key);
}

export function mergeLocationSuggestions(
  existing: LocationOption[],
  suggestions: LocationSuggestion[],
): { merged: LocationOption[]; added: number } {
  const titles = new Set(existing.map((l) => normalizeLocationTitle(l.title)));
  const merged = [...existing];
  let added = 0;

  for (const loc of suggestions) {
    const title = loc.title.trim();
    if (!title) continue;
    const key = normalizeLocationTitle(title);
    if (titles.has(key)) continue;
    titles.add(key);
    merged.push({
      id: crypto.randomUUID(),
      title,
      summary: loc.summary?.trim() || undefined,
    });
    added += 1;
  }

  return { merged, added };
}
