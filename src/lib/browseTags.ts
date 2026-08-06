import type { BrowseCategory, BrowseIdea } from "@/lib/browseIdeas";

/** Fixed tag vocabulary — model may not invent tags. */
export const BROWSE_TAGS = [
  "quiet",
  "lively",
  "outdoors",
  "hands-on",
  "food-forward",
  "alcohol",
  "spectator",
  "physical",
  "kids-friendly",
  "at-home",
  "long-drive",
  "budget",
  "splurge",
] as const;

export type BrowseTag = (typeof BROWSE_TAGS)[number];

const CATEGORY_TAGS: Record<BrowseCategory, BrowseTag[]> = {
  "stay-home": ["at-home", "budget"],
  "stay-local": ["budget"],
  "day-trip": ["outdoors"],
  overnight: ["long-drive"],
  "go-somewhere": ["long-drive"],
};

const KEYWORD_TAGS: { re: RegExp; tag: BrowseTag }[] = [
  { re: /\bquiet|calm|slow|cozy\b/i, tag: "quiet" },
  { re: /\blively|party|crowd|busy|bar\b/i, tag: "lively" },
  { re: /\boutdoor|hike|trail|park|lake|beach\b/i, tag: "outdoors" },
  { re: /\bcraft|cook|bake|build|workshop|hands[- ]?on\b/i, tag: "hands-on" },
  { re: /\bfood|dinner|brunch|restaurant|cuisine\b/i, tag: "food-forward" },
  { re: /\bbeer|wine|cocktail|brewery|alcohol\b/i, tag: "alcohol" },
  { re: /\bshow|concert|game|watch|spectator\b/i, tag: "spectator" },
  { re: /\bhike|run|climb|bike|physical|walk\b/i, tag: "physical" },
  { re: /\bkids?|family|toddler|child\b/i, tag: "kids-friendly" },
  { re: /\bfree|cheap|budget|\$[0-2]?\d\b/i, tag: "budget" },
  { re: /\bsplurge|luxury|upscale\b/i, tag: "splurge" },
];

export function deriveBrowseTags(idea: BrowseIdea): BrowseTag[] {
  const tags = new Set<BrowseTag>(CATEGORY_TAGS[idea.category] ?? []);
  if (idea.estCostUsd <= 20) tags.add("budget");
  if (idea.estCostUsd >= 120) tags.add("splurge");
  if ((idea.driveMinutes ?? 0) >= 90) tags.add("long-drive");

  const blob = [idea.title, idea.description, ...idea.pluses, ...idea.cautions].join(
    " ",
  );
  for (const { re, tag } of KEYWORD_TAGS) {
    if (re.test(blob)) tags.add(tag);
  }

  return [...tags].filter((t) =>
    (BROWSE_TAGS as readonly string[]).includes(t),
  );
}
