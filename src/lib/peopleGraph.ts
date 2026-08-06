import type { BrowseTag } from "@/lib/browseTags";

export type PersonFactKind = "preference" | "dislike";

export type PersonFact = {
  id: string;
  kind: PersonFactKind;
  value: BrowseTag;
  confidence: "inferred" | "confirmed";
  sourceQuote: string;
  createdAt: string;
  retired?: boolean;
};

export type BrowseSwipeEvent = {
  id: string;
  ideaTitle: string;
  tags: BrowseTag[];
  direction: "keep" | "skip";
  promptId: string;
  createdAt: string;
};

const FACTS_KEY = "wandrai_person_facts_v1";
const SWIPES_KEY = "wandrai_browse_swipes_v1";
const SKIPPED_TITLES_KEY = "wandrai_browse_skipped_titles_v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function listLocalSwipes(): BrowseSwipeEvent[] {
  return readJson<BrowseSwipeEvent[]>(SWIPES_KEY, []);
}

export function listLocalFacts(): PersonFact[] {
  return readJson<PersonFact[]>(FACTS_KEY, []).filter((f) => !f.retired);
}

export function listSkippedTitles(): string[] {
  return readJson<string[]>(SKIPPED_TITLES_KEY, []);
}

/** Record a swipe; only promote to a fact after 3 same-direction tag hits. */
export function recordLocalSwipe(input: {
  ideaTitle: string;
  tags: BrowseTag[];
  direction: "keep" | "skip";
  promptId: string;
}): { event: BrowseSwipeEvent; newFacts: PersonFact[] } {
  const event: BrowseSwipeEvent = {
    id: crypto.randomUUID(),
    ideaTitle: input.ideaTitle.trim(),
    tags: input.tags,
    direction: input.direction,
    promptId: input.promptId,
    createdAt: new Date().toISOString(),
  };
  const swipes = [event, ...listLocalSwipes()].slice(0, 500);
  writeJson(SWIPES_KEY, swipes);

  if (input.direction === "skip") {
    const skipped = new Set(listSkippedTitles());
    skipped.add(event.ideaTitle.toLowerCase());
    writeJson(SKIPPED_TITLES_KEY, [...skipped]);
  }

  const newFacts: PersonFact[] = [];
  const kind: PersonFactKind =
    input.direction === "keep" ? "preference" : "dislike";
  const existing = readJson<PersonFact[]>(FACTS_KEY, []);

  for (const tag of input.tags) {
    const same = swipes.filter(
      (s) => s.direction === input.direction && s.tags.includes(tag),
    );
    if (same.length < 3) continue;
    if (
      existing.some(
        (f) =>
          !f.retired &&
          f.kind === kind &&
          f.value === tag &&
          f.confidence === "inferred",
      )
    ) {
      continue;
    }
    const fact: PersonFact = {
      id: crypto.randomUUID(),
      kind,
      value: tag,
      confidence: "inferred",
      sourceQuote: input.ideaTitle,
      createdAt: new Date().toISOString(),
    };
    existing.unshift(fact);
    newFacts.push(fact);
  }
  if (newFacts.length) writeJson(FACTS_KEY, existing);

  return { event, newFacts };
}

export function undoLocalSwipe(eventId: string): BrowseSwipeEvent | null {
  const swipes = listLocalSwipes();
  const idx = swipes.findIndex((s) => s.id === eventId);
  if (idx < 0) return null;
  const [removed] = swipes.splice(idx, 1);
  writeJson(SWIPES_KEY, swipes);

  if (removed.direction === "skip") {
    const stillSkipped = swipes.some(
      (s) =>
        s.direction === "skip" &&
        s.ideaTitle.toLowerCase() === removed.ideaTitle.toLowerCase(),
    );
    if (!stillSkipped) {
      writeJson(
        SKIPPED_TITLES_KEY,
        listSkippedTitles().filter(
          (t) => t !== removed.ideaTitle.toLowerCase(),
        ),
      );
    }
  }

  // Soft-revert inferred facts that only exist because of this swipe's 3rd hit
  const facts = readJson<PersonFact[]>(FACTS_KEY, []);
  const nextFacts = facts.filter((f) => {
    if (f.sourceQuote !== removed.ideaTitle || f.confidence !== "inferred") {
      return true;
    }
    const remaining = swipes.filter(
      (s) =>
        s.direction === removed.direction &&
        s.tags.includes(f.value),
    );
    return remaining.length >= 3;
  });
  writeJson(FACTS_KEY, nextFacts);

  return removed;
}

export function retireLocalFact(factId: string) {
  const facts = readJson<PersonFact[]>(FACTS_KEY, []);
  writeJson(
    FACTS_KEY,
    facts.map((f) => (f.id === factId ? { ...f, retired: true } : f)),
  );
}

export function learningLines(swipes: BrowseSwipeEvent[]): string[] {
  if (swipes.length < 3) return [];
  const lines: string[] = [];
  const skipTags = new Map<string, number>();
  const keepTags = new Map<string, number>();
  for (const s of swipes) {
    const map = s.direction === "skip" ? skipTags : keepTags;
    for (const t of s.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  const topSkip = [...skipTags.entries()].sort((a, b) => b[1] - a[1])[0];
  const topKeep = [...keepTags.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSkip && topSkip[1] >= 2) {
    lines.push(
      `You skipped several ${topSkip[0]} ideas — I'll show fewer of those.`,
    );
  }
  if (topKeep && topKeep[1] >= 2) {
    lines.push(`You keep choosing ${topKeep[0]} things. More of that.`);
  }
  if (lines.length === 0) {
    lines.push("Still reading your swipes — a few more will sharpen this.");
  }
  return lines.slice(0, 3);
}
