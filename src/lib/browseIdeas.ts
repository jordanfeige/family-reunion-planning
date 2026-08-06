import { z } from "zod";

export const BROWSE_CATEGORIES = [
  "stay-home",
  "stay-local",
  "day-trip",
  "overnight",
  "go-somewhere",
] as const;

export type BrowseCategory = (typeof BROWSE_CATEGORIES)[number];

export const BROWSE_FILTERS = [
  "anything",
  "go-somewhere",
  "stay-home",
  "under-50",
  "two-hours",
] as const;

export type BrowseFilter = (typeof BROWSE_FILTERS)[number];

export const browseIdeaSchema = z.object({
  title: z.string().min(1).max(52),
  category: z.enum(BROWSE_CATEGORIES),
  place: z.string().nullable(),
  driveMinutes: z.number().nullable(),
  durationHours: z.number().positive(),
  estCostUsd: z.number().min(0),
  costNote: z.string().min(1),
  description: z.string().min(20).max(600),
  pluses: z.array(z.string().min(1)).min(1).max(3),
  cautions: z.array(z.string().min(1)).min(1).max(2),
  imageQuery: z.string().min(1),
});

export type BrowseIdea = z.infer<typeof browseIdeaSchema> & {
  id: string;
};

export const browseStackSchema = z.object({
  ideas: z.array(browseIdeaSchema).min(6).max(20),
});

export function categoryLabel(category: BrowseCategory): string {
  switch (category) {
    case "stay-home":
      return "Stay home";
    case "stay-local":
      return "Stay local";
    case "day-trip":
      return "Day trip";
    case "overnight":
      return "Overnight";
    case "go-somewhere":
      return "Go somewhere";
  }
}

/** Enforce stack mix in code; shuffle so a stay-home appears in the first 4. */
export function composeBrowseStack(raw: unknown[]): BrowseIdea[] {
  const valid: BrowseIdea[] = [];
  for (const item of raw) {
    const parsed = browseIdeaSchema.safeParse(item);
    if (!parsed.success) continue;
    // driveMinutes only from tool — we have no tool yet, force null
    const idea = {
      ...parsed.data,
      driveMinutes: null as number | null,
      place: parsed.data.category === "stay-home" ? null : parsed.data.place,
      id: crypto.randomUUID(),
    };
    if (idea.cautions.length < 1) continue;
    valid.push(idea);
  }

  const stayHome = valid.filter(
    (i) => i.category === "stay-home" && i.estCostUsd <= 20,
  );
  const stayLocal = valid.filter((i) => i.category === "stay-local");
  const dayTrip = valid.filter((i) => i.category === "day-trip");
  const overnight = valid.filter((i) => i.category === "overnight");
  const elsewhere = valid.filter((i) => i.category === "go-somewhere");

  const picked: BrowseIdea[] = [];
  const take = (pool: BrowseIdea[], n: number) => {
    for (const idea of pool) {
      if (picked.length >= 15) break;
      if (picked.some((p) => p.title === idea.title)) continue;
      if (n <= 0) break;
      picked.push(idea);
      n -= 1;
    }
  };

  take(stayHome, 3);
  take(stayLocal, 3);
  take(dayTrip, 2);
  take(overnight, 2);
  take(elsewhere, 4);

  // Fill remainder from leftovers
  for (const idea of valid) {
    if (picked.length >= 14) break;
    if (picked.some((p) => p.title === idea.title)) continue;
    if (idea.category === "overnight" && picked.filter((p) => p.category === "overnight").length >= 2) {
      continue;
    }
    picked.push(idea);
  }

  if (picked.length < 6) return picked;

  // Shuffle, then ensure a stay-home in first 4
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  const homeIdx = picked.findIndex((p) => p.category === "stay-home");
  if (homeIdx > 3) {
    const swap = Math.floor(Math.random() * 4);
    [picked[swap], picked[homeIdx]] = [picked[homeIdx], picked[swap]];
  }

  return picked.slice(0, 15);
}

export function filterBrowseIdeas(
  ideas: BrowseIdea[],
  filter: BrowseFilter,
): BrowseIdea[] {
  switch (filter) {
    case "go-somewhere":
      return ideas.filter(
        (i) =>
          i.category === "go-somewhere" ||
          i.category === "day-trip" ||
          i.category === "overnight",
      );
    case "stay-home":
      return ideas.filter((i) => i.category === "stay-home");
    case "under-50":
      return ideas.filter((i) => i.estCostUsd <= 50);
    case "two-hours":
      return ideas.filter((i) => i.durationHours <= 2);
    default:
      return ideas;
  }
}

export function formatBrowseMeta(idea: BrowseIdea, partySize = 2): string {
  const parts: string[] = [];
  if (idea.place) parts.push(idea.place);
  if (idea.driveMinutes != null && Number.isFinite(idea.driveMinutes)) {
    const h = Math.floor(idea.driveMinutes / 60);
    const m = Math.round(idea.driveMinutes % 60);
    parts.push(h > 0 ? `${h} hr ${m} min` : `${m} min`);
  }
  parts.push(
    idea.durationHours === 1
      ? "1 hr"
      : `${idea.durationHours} hr`,
  );
  parts.push(idea.costNote || (idea.estCostUsd === 0 ? "free" : `~$${idea.estCostUsd}`));
  if (partySize > 1 && idea.estCostUsd > 0) {
    // costNote already carries party framing when model is good
  }
  return parts.join(" · ");
}
