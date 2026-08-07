import { z } from "zod";

import { BROWSE_TAGS } from "@/lib/browseTags";

export const BROWSE_CATEGORIES = [
  "stay-home",
  "stay-local",
  "day-trip",
  "overnight",
  "go-somewhere",
] as const;

export type BrowseCategory = (typeof BROWSE_CATEGORIES)[number];

export const BROWSE_DECK_SIZE = 12;
export const BROWSE_KEEP_TARGET = 3;
export const BROWSE_DEAL_MORE = 8;

export const browseIdeaSchema = z.object({
  title: z.string().min(1).max(52),
  category: z.enum(BROWSE_CATEGORIES),
  place: z.string().nullable().optional(),
  placeName: z.string().nullable().optional(),
  driveMinutes: z.number().nonnegative().nullable().optional(),
  durationHours: z.number().positive().optional(),
  durationMins: z.number().positive().optional(),
  estCostUsd: z.number().min(0),
  costNote: z.string().min(1).optional(),
  blurb: z.string().min(8).max(140).optional(),
  description: z.string().min(12).max(600).optional(),
  pluses: z.array(z.string().min(1)).max(3).optional(),
  cautions: z.array(z.string().min(1)).max(2).optional(),
  imageQuery: z.string().min(1).optional(),
  tags: z.array(z.enum(BROWSE_TAGS)).max(6).optional(),
});

export type BrowseIdea = {
  id: string;
  title: string;
  category: BrowseCategory;
  place: string | null;
  placeName: string | null;
  driveMinutes: number | null;
  /** Concrete scale fact for §13b meta triad. */
  scaleFact?: string | null;
  durationHours: number;
  durationMins: number;
  estCostUsd: number;
  costNote: string;
  /** Prebuilt §13b meta line when provided by resolver. */
  metaLine?: string | null;
  blurb: string;
  description: string;
  pluses: string[];
  cautions: string[];
  imageQuery: string;
  tags: string[];
  /** Resolved photo URL — never invent; null → letter-block. */
  imageUrl: string | null;
  sourceId?: string | null;
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

function firstSentence(text: string, max = 120): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const cut = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return cut.length > max ? `${cut.slice(0, max - 1).trim()}…` : cut;
}

function normalizeIdea(
  data: z.infer<typeof browseIdeaSchema>,
): Omit<BrowseIdea, "id" | "imageUrl"> | null {
  const durationMins =
    data.durationMins && Number.isFinite(data.durationMins)
      ? Math.round(data.durationMins)
      : data.durationHours && Number.isFinite(data.durationHours)
        ? Math.round(data.durationHours * 60)
        : 120;
  const durationHours = Math.max(0.5, Math.round((durationMins / 60) * 10) / 10);
  const rawPlace = data.placeName?.trim() || data.place?.trim() || null;
  const placeName = data.category === "stay-home" ? null : rawPlace;
  const description =
    data.description?.trim() ||
    data.blurb?.trim() ||
    `${data.title} near you.`;
  const blurb =
    data.blurb?.trim() ||
    firstSentence(description) ||
    `${data.title}.`;
  const costNote =
    data.costNote?.trim() ||
    (data.estCostUsd === 0 ? "free" : `~$${Math.round(data.estCostUsd)}`);

  return {
    title: data.title.trim(),
    category: data.category,
    place: placeName,
    placeName,
    driveMinutes:
      data.driveMinutes != null && Number.isFinite(data.driveMinutes)
        ? Math.round(data.driveMinutes)
        : null,
    durationHours,
    durationMins,
    estCostUsd: Math.max(0, data.estCostUsd),
    costNote,
    blurb: blurb.slice(0, 140),
    description: description.padEnd(12, ".").slice(0, 600),
    pluses: (data.pluses ?? []).slice(0, 3),
    cautions: (data.cautions ?? ["Timing depends on weather."]).slice(0, 2),
    imageQuery: data.imageQuery?.trim() || data.title.trim(),
    tags: (data.tags ?? []).filter((t) =>
      (BROWSE_TAGS as readonly string[]).includes(t),
    ),
  };
}

/** Enforce stack mix in code; shuffle so a stay-home appears in the first 4. */
export function composeBrowseStack(
  raw: unknown[],
  limit = BROWSE_DECK_SIZE,
): BrowseIdea[] {
  const valid: BrowseIdea[] = [];
  for (const item of raw) {
    const parsed = browseIdeaSchema.safeParse(item);
    if (!parsed.success) continue;
    const normalized = normalizeIdea(parsed.data);
    if (!normalized) continue;
    valid.push({
      ...normalized,
      id: crypto.randomUUID(),
      imageUrl: null,
    });
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
      if (picked.length >= limit) break;
      if (picked.some((p) => p.title === idea.title)) continue;
      if (n <= 0) break;
      picked.push(idea);
      n -= 1;
    }
  };

  // Local-first mix for a 12-card deck
  take(stayHome, 3);
  take(stayLocal, 3);
  take(dayTrip, 3);
  take(overnight, 2);
  take(elsewhere, 1);

  for (const idea of valid) {
    if (picked.length >= limit) break;
    if (picked.some((p) => p.title === idea.title)) continue;
    if (
      idea.category === "overnight" &&
      picked.filter((p) => p.category === "overnight").length >= 2
    ) {
      continue;
    }
    if (
      idea.category === "go-somewhere" &&
      picked.filter((p) => p.category === "go-somewhere").length >= 2
    ) {
      continue;
    }
    picked.push(idea);
  }

  if (picked.length < 6) return picked;

  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  const homeIdx = picked.findIndex((p) => p.category === "stay-home");
  if (homeIdx > 3) {
    const swap = Math.floor(Math.random() * 4);
    [picked[swap], picked[homeIdx]] = [picked[homeIdx], picked[swap]];
  }

  return picked.slice(0, limit);
}

export function formatDurationLabel(idea: BrowseIdea): string {
  const mins = idea.durationMins || Math.round(idea.durationHours * 60);
  if (mins >= 60 * 24) {
    const nights = Math.max(1, Math.round(mins / (60 * 24)));
    return nights === 1 ? "1 night" : `${nights} nights`;
  }
  if (mins >= 60) {
    const h = Math.round((mins / 60) * 10) / 10;
    return h === 1 ? "1 hr" : `${h} hr`;
  }
  return `${mins} min`;
}

export function formatDriveLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const m = Math.round(minutes);
  if (m <= 0) return "nearby";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} hr ${rem} min` : `${h} hr`;
}

/** Card face meta §13b: drive · scale fact · cost provenance — omit unresolved. */
export function formatBrowseMeta(idea: BrowseIdea): string {
  if (idea.metaLine?.trim()) return idea.metaLine.trim();
  const parts: string[] = [];
  const drive = formatDriveLabel(idea.driveMinutes);
  if (drive) parts.push(drive);
  const scale = idea.scaleFact?.trim();
  if (scale) parts.push(scale);
  const cost =
    idea.costNote?.trim() ||
    (idea.estCostUsd === 0 ? "free" : `~$${Math.round(idea.estCostUsd)}`);
  if (cost) parts.push(cost);
  return parts.join(" · ");
}

export function formatCostDollars(estCostUsd: number): string {
  if (estCostUsd <= 0) return "free";
  if (estCostUsd < 40) return "$";
  if (estCostUsd < 100) return "$$";
  if (estCostUsd < 220) return "$$$";
  return "$$$$";
}
