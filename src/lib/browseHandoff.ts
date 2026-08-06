import {
  BROWSE_TAGS,
  deriveBrowseTags,
  type BrowseTag,
} from "@/lib/browseTags";
import type { BrowseCategory, BrowseIdea } from "@/lib/browseIdeas";

/** Human vibe phrases from R8 tag vocabulary — never item titles. */
const TAG_VIBE: Record<BrowseTag, string> = {
  quiet: "relaxed",
  lively: "lively",
  outdoors: "outdoors",
  "hands-on": "hands-on",
  "food-forward": "food-forward",
  alcohol: "social",
  spectator: "easygoing",
  physical: "active",
  "kids-friendly": "kids-friendly",
  "at-home": "close to home",
  "long-drive": "worth the drive",
  budget: "budget-friendly",
  splurge: "a little splurge",
};

const ACTIVITY_CATEGORIES: BrowseCategory[] = [
  "stay-home",
  "stay-local",
  "day-trip",
];

export type BrowseKeptSeed = {
  title: string;
  summary?: string;
  category?: BrowseCategory | string;
  tags?: BrowseTag[];
};

export function isBrowseActivityCategory(
  category: BrowseCategory | string | undefined,
): boolean {
  if (!category) return false;
  const raw = String(category).trim().toLowerCase();
  return (
    ACTIVITY_CATEGORIES.includes(raw as BrowseCategory) ||
    raw === "stay home" ||
    raw === "stay local" ||
    raw === "day trip"
  );
}

/** Ideas vs Places — majority of kept seeds. */
export function browseShortlistKind(
  kept: BrowseKeptSeed[],
): "ideas" | "places" {
  if (kept.length === 0) return "places";
  const activityVotes = kept.filter((k) =>
    isBrowseActivityCategory(k.category),
  ).length;
  return activityVotes >= kept.length / 2 ? "ideas" : "places";
}

function titleToWeekendName(title: string): string | null {
  const cleaned = title
    .replace(/\s+/g, " ")
    .replace(/[,:].*$/, "")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 40) return null;
  // Avoid feature-plumbing names
  if (/browse|weekend from/i.test(cleaned)) return null;
  const lower = cleaned.toLowerCase();
  if (/\bweekend\b/i.test(lower)) return cleaned;
  return `${cleaned} weekend`;
}

/** Trip name from kept items — never "Weekend from Browse". */
export function deriveBrowseTripName(kept: BrowseKeptSeed[]): string | undefined {
  const first = kept[0];
  if (!first) return undefined;
  return titleToWeekendName(first.title) ?? undefined;
}

function tagsForSeed(seed: BrowseKeptSeed): BrowseTag[] {
  if (seed.tags?.length) {
    return seed.tags.filter((t) =>
      (BROWSE_TAGS as readonly string[]).includes(t),
    );
  }
  // Reconstruct a minimal idea for tag derivation when only title/summary/category exist
  const category = normalizeBrowseCategory(seed.category);
  if (!category) return [];
  const stub: BrowseIdea = {
    id: "stub",
    title: seed.title,
    category,
    place: null,
    placeName: null,
    driveMinutes: null,
    durationHours: 2,
    durationMins: 120,
    estCostUsd: 0,
    costNote: "n/a",
    blurb: seed.summary?.slice(0, 120) || `${seed.title}.`,
    description: seed.summary?.padEnd(20, ".") ?? `${seed.title} activity ideas.`,
    pluses: ["kept"],
    cautions: ["none"],
    imageQuery: seed.title,
    tags: [],
    imageUrl: null,
  };
  return deriveBrowseTags(stub);
}

function normalizeBrowseCategory(
  raw: BrowseCategory | string | undefined,
): BrowseCategory | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "stay-home" || s === "stay home") return "stay-home";
  if (s === "stay-local" || s === "stay local") return "stay-local";
  if (s === "day-trip" || s === "day trip") return "day-trip";
  if (s === "overnight") return "overnight";
  if (s === "go-somewhere" || s === "go somewhere") return "go-somewhere";
  return null;
}

/** Vibe descriptors from tags — omit when nothing derives. */
export function deriveBrowseVibe(kept: BrowseKeptSeed[]): string[] | undefined {
  const counts = new Map<BrowseTag, number>();
  for (const seed of kept) {
    for (const tag of tagsForSeed(seed)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const phrases = ranked
    .slice(0, 4)
    .map(([tag]) => TAG_VIBE[tag])
    .filter(Boolean);
  const unique = [...new Set(phrases)];
  return unique.length > 0 ? unique : undefined;
}

const COUNT_WORDS = [
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
];

export function browseOpeningMessage(count: number): string {
  const n = Math.max(1, Math.min(count, 8));
  const word = COUNT_WORDS[n - 1] ?? String(n);
  return `${word} from Browse, ready to go. Want to swap any of them, or build the plan?`;
}

export function browsePlacesSubtitle(count: number, kind: "ideas" | "places"): string {
  const n = Math.max(1, count);
  const word = COUNT_WORDS[Math.min(n, 8) - 1]?.toLowerCase() ?? String(n);
  if (kind === "ideas") {
    return `${word.charAt(0).toUpperCase()}${word.slice(1)} ideas you kept. Refine them, or build the plan.`;
  }
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} places you kept. Refine them, or build the plan.`;
}
