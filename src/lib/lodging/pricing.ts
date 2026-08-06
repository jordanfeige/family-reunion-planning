/**
 * Organizer-entered lodging rates (R9 Amendment).
 * Never invent prices — only `unknown` or values a human pasted in.
 */

export type LodgingPricingUnknown = { kind: "unknown" };

export type LodgingPricingOrganizerEntered = {
  kind: "organizerEntered";
  nightlyUsd: number;
  feesUsd?: number;
  sourceUrl?: string;
  totalUsd: number;
  perHouseholdUsd: number;
  enteredByName: string;
  enteredByUserId?: string;
  enteredAt: string; // ISO
  datesChangedAt?: string; // ISO when nights recomputed due to date change
  nightsAtEntry?: number;
};

export type LodgingPricing =
  | LodgingPricingUnknown
  | LodgingPricingOrganizerEntered;

export type LodgingSplitMode = "even_per_household" | "per_person";

const URL_RE = /^https?:\/\/\S+$/i;

/** Detect pasted listing URL so the UI can move it to the source field. */
export function looksLikeUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (URL_RE.test(t)) return true;
  if (/^www\./i.test(t) && !/\s/.test(t)) return true;
  return false;
}

export function normalizeSourceUrl(raw: string | undefined | null): string | undefined {
  const t = String(raw ?? "").trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  return t;
}

/**
 * Accept `240`, `$240`, `240/night`, `$240 a night`, etc.
 * Returns null when empty or not a number (caller may treat as URL).
 */
export function parseNightlyUsd(raw: string): number | null {
  const t = raw.trim();
  if (!t || looksLikeUrl(t)) return null;
  const cleaned = t
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s*\/\s*nights?\b/i, "")
    .replace(/\s+a\s+night\b/i, "")
    .replace(/\s+per\s+night\b/i, "")
    .replace(/\s+nightly\b/i, "")
    .replace(/\s+nights?\b/i, "")
    .trim();
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function parseFeesUsd(raw: string | undefined | null): number | undefined {
  const t = String(raw ?? "").trim();
  if (!t) return undefined;
  const cleaned = t.replace(/\$/g, "").replace(/,/g, "").trim();
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

/** R6 Part 2 §3 — even split default; by-head alternate. */
export function computeLodgingTotals(input: {
  nightlyUsd: number;
  feesUsd?: number;
  nights: number;
  householdCount: number;
  headcount?: number;
  split?: LodgingSplitMode;
}): { totalUsd: number; perHouseholdUsd: number } {
  const nights = Math.max(1, Math.round(input.nights));
  const fees = input.feesUsd != null && Number.isFinite(input.feesUsd)
    ? Math.max(0, Math.round(input.feesUsd))
    : 0;
  const totalUsd = Math.round(input.nightlyUsd) * nights + fees;
  const split = input.split ?? "even_per_household";
  if (split === "per_person") {
    const heads = Math.max(1, Math.round(input.headcount ?? input.householdCount));
    return { totalUsd, perHouseholdUsd: Math.round(totalUsd / heads) };
  }
  const households = Math.max(1, Math.round(input.householdCount));
  return { totalUsd, perHouseholdUsd: Math.round(totalUsd / households) };
}

export function unknownPricing(): LodgingPricingUnknown {
  return { kind: "unknown" };
}

export function isOrganizerEntered(
  p: LodgingPricing | undefined | null,
): p is LodgingPricingOrganizerEntered {
  return p?.kind === "organizerEntered";
}

export function isUnknownPricing(
  p: LodgingPricing | undefined | null,
): p is LodgingPricingUnknown {
  return !p || p.kind === "unknown";
}

/** Recompute totals when trip nights change; append datesChangedAt when needed. */
export function recomputePricingForNights(
  pricing: LodgingPricing,
  nights: number,
  householdCount: number,
  headcount?: number,
  split?: LodgingSplitMode,
): LodgingPricing {
  if (pricing.kind !== "organizerEntered") return pricing;
  const nextNights = Math.max(1, Math.round(nights));
  const { totalUsd, perHouseholdUsd } = computeLodgingTotals({
    nightlyUsd: pricing.nightlyUsd,
    feesUsd: pricing.feesUsd,
    nights: nextNights,
    householdCount,
    headcount,
    split,
  });
  const priorNights = pricing.nightsAtEntry ?? nextNights;
  const datesChanged =
    priorNights !== nextNights
      ? pricing.datesChangedAt ?? new Date().toISOString()
      : pricing.datesChangedAt;
  return {
    ...pricing,
    totalUsd,
    perHouseholdUsd,
    nightsAtEntry: nextNights,
    datesChangedAt: datesChanged,
  };
}

export function buildOrganizerPricing(input: {
  nightlyUsd: number;
  feesUsd?: number;
  sourceUrl?: string;
  nights: number;
  householdCount: number;
  headcount?: number;
  split?: LodgingSplitMode;
  enteredByName: string;
  enteredByUserId?: string;
  enteredAt?: string;
}): LodgingPricingOrganizerEntered {
  const { totalUsd, perHouseholdUsd } = computeLodgingTotals(input);
  return {
    kind: "organizerEntered",
    nightlyUsd: Math.round(input.nightlyUsd),
    feesUsd: input.feesUsd,
    sourceUrl: normalizeSourceUrl(input.sourceUrl),
    totalUsd,
    perHouseholdUsd,
    enteredByName: input.enteredByName.trim() || "Someone",
    enteredByUserId: input.enteredByUserId,
    enteredAt: input.enteredAt ?? new Date().toISOString(),
    nightsAtEntry: Math.max(1, Math.round(input.nights)),
  };
}

/** Min–max of entered nightlies for the "Others so far" hint (observation only). */
export function enteredNightlyRange(
  properties: { pricing?: LodgingPricing }[],
): { low: number; high: number } | null {
  const rates = properties
    .map((p) => (p.pricing?.kind === "organizerEntered" ? p.pricing.nightlyUsd : null))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
  if (rates.length === 0) return null;
  return { low: Math.min(...rates), high: Math.max(...rates) };
}

export function normalizePricing(raw: unknown): LodgingPricing {
  if (!raw || typeof raw !== "object") return unknownPricing();
  const o = raw as Record<string, unknown>;
  const kind = String(o.kind ?? "").trim();
  if (kind === "organizerEntered") {
    const nightlyUsd =
      typeof o.nightlyUsd === "number" && Number.isFinite(o.nightlyUsd)
        ? Math.round(o.nightlyUsd)
        : null;
    if (nightlyUsd == null || nightlyUsd < 0) return unknownPricing();
    const feesUsd =
      typeof o.feesUsd === "number" && Number.isFinite(o.feesUsd)
        ? Math.round(o.feesUsd)
        : undefined;
    const totalUsd =
      typeof o.totalUsd === "number" && Number.isFinite(o.totalUsd)
        ? Math.round(o.totalUsd)
        : nightlyUsd;
    const perHouseholdUsd =
      typeof o.perHouseholdUsd === "number" && Number.isFinite(o.perHouseholdUsd)
        ? Math.round(o.perHouseholdUsd)
        : totalUsd;
    const enteredByName = String(o.enteredByName ?? "").trim() || "Someone";
    const enteredAt = String(o.enteredAt ?? "").trim() || new Date().toISOString();
    return {
      kind: "organizerEntered",
      nightlyUsd,
      feesUsd,
      sourceUrl: normalizeSourceUrl(String(o.sourceUrl ?? "")) || undefined,
      totalUsd,
      perHouseholdUsd,
      enteredByName,
      enteredByUserId: String(o.enteredByUserId ?? "").trim() || undefined,
      enteredAt,
      datesChangedAt: String(o.datesChangedAt ?? "").trim() || undefined,
      nightsAtEntry:
        typeof o.nightsAtEntry === "number" && Number.isFinite(o.nightsAtEntry)
          ? Math.round(o.nightsAtEntry)
          : undefined,
    };
  }
  return unknownPricing();
}
