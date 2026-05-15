import {
  normalizePriceType,
  normalizePriceUnit,
  type PriceType,
  type PriceUnit,
} from "@/lib/venuePrices";

export const VENUE_CATEGORIES = ["stay", "eat", "do"] as const;
export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

export const BALLOT_STATUSES = ["draft", "open", "closed"] as const;
export type BallotStatus = (typeof BALLOT_STATUSES)[number];

export const VENUE_BOOKING_STATUSES = [
  "idea",
  "contacted",
  "hold",
  "booked",
  "passed",
] as const;
export type VenueBookingStatus = (typeof VENUE_BOOKING_STATUSES)[number];

export type VenueOption = {
  id: string;
  title: string;
  summary?: string;
  category: VenueCategory;
  bookingUrl?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  sourceLabel?: string;
  bookingStatus?: VenueBookingStatus;
  plannerNotes?: string;
  priceType?: PriceType;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: PriceUnit;
  priceNotes?: string;
};

export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  stay: "Stay",
  eat: "Eat",
  do: "Do",
};

export const VENUE_BOOKING_STATUS_LABELS: Record<VenueBookingStatus, string> = {
  idea: "Researching",
  contacted: "Contacted",
  hold: "On hold",
  booked: "Booked",
  passed: "Not using",
};

export function normalizeBallotStatus(raw: unknown): BallotStatus {
  const s = String(raw ?? "").toLowerCase();
  if (BALLOT_STATUSES.includes(s as BallotStatus)) return s as BallotStatus;
  return "draft";
}

export function normalizeVenueCategory(raw: unknown): VenueCategory {
  const s = String(raw ?? "").toLowerCase();
  if (s === "eat" || s === "dining" || s === "meal") return "eat";
  if (s === "do" || s === "activity" || s === "activities" || s === "area" || s === "gather") {
    return "do";
  }
  return "stay";
}

export function normalizeVenueBookingStatus(raw: unknown): VenueBookingStatus {
  const s = String(raw ?? "").toLowerCase();
  if (VENUE_BOOKING_STATUSES.includes(s as VenueBookingStatus)) {
    return s as VenueBookingStatus;
  }
  return "idea";
}

function parsePriceNumber(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeVenueOptions(raw: unknown): VenueOption[] {
  if (!Array.isArray(raw)) return [];
  const out: VenueOption[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) continue;
    const category = normalizeVenueCategory(o.category);
    const key = `${category}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = String(o.id ?? "").trim() || crypto.randomUUID();
    out.push({
      id,
      title,
      summary: String(o.summary ?? "").trim() || undefined,
      category,
      bookingUrl: String(o.bookingUrl ?? "").trim() || undefined,
      mapsUrl: String(o.mapsUrl ?? "").trim() || undefined,
      websiteUrl: String(o.websiteUrl ?? "").trim() || undefined,
      sourceLabel: String(o.sourceLabel ?? "").trim() || undefined,
      plannerNotes: String(o.plannerNotes ?? "").trim() || undefined,
      bookingStatus: normalizeVenueBookingStatus(o.bookingStatus),
      priceType: normalizePriceType(o.priceType),
      priceMin: parsePriceNumber(o.priceMin),
      priceMax: parsePriceNumber(o.priceMax),
      priceUnit: normalizePriceUnit(o.priceUnit, category),
      priceNotes: String(o.priceNotes ?? "").trim() || undefined,
    });
  }

  return out;
}

export function findVenueById(
  options: VenueOption[],
  id: string,
): VenueOption | undefined {
  return options.find((o) => o.id === id);
}

export function normalizeVenueTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function isVenueOnShortlist(
  title: string,
  category: VenueCategory,
  venues: readonly VenueOption[],
): boolean {
  const key = `${category}:${normalizeVenueTitle(title)}`;
  return venues.some(
    (v) => `${v.category}:${normalizeVenueTitle(v.title)}` === key,
  );
}

export function primaryVenueUrl(venue: VenueOption): string | undefined {
  return venue.bookingUrl ?? venue.websiteUrl ?? venue.mapsUrl;
}

export function formatVenuesForPrompt(venues: VenueOption[]): string {
  if (venues.length === 0) return "None shortlisted yet.";
  return venues
    .map((v) => {
      const parts = [`[${VENUE_CATEGORY_LABELS[v.category]}] ${v.title}`];
      if (v.summary) parts.push(v.summary);
      const link = primaryVenueUrl(v);
      if (link) parts.push(`link: ${link}`);
      return parts.join(" — ");
    })
    .join("\n");
}

export function venuesForPublicShowcase(venues: VenueOption[]): VenueOption[] {
  return venues.filter((v) => (v.bookingStatus ?? "idea") !== "passed");
}

export function ballotOptionsForVoting(venues: VenueOption[]): VenueOption[] {
  return venuesForPublicShowcase(venues);
}
