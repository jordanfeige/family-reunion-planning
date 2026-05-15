export const VENUE_CATEGORIES = ["stay", "eat", "area"] as const;
export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

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
};

export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  stay: "Stay",
  eat: "Eat",
  area: "Area",
};

export const VENUE_BOOKING_STATUS_LABELS: Record<VenueBookingStatus, string> = {
  idea: "Researching",
  contacted: "Contacted",
  hold: "On hold",
  booked: "Booked",
  passed: "Not using",
};

export function normalizeVenueCategory(raw: unknown): VenueCategory {
  const s = String(raw ?? "").toLowerCase();
  if (s === "eat" || s === "dining" || s === "meal") return "eat";
  if (s === "area" || s === "gather" || s === "hub") return "area";
  return "stay";
}

export function normalizeVenueBookingStatus(raw: unknown): VenueBookingStatus {
  const s = String(raw ?? "").toLowerCase();
  if (VENUE_BOOKING_STATUSES.includes(s as VenueBookingStatus)) {
    return s as VenueBookingStatus;
  }
  return "idea";
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
    const summary = String(o.summary ?? "").trim() || undefined;
    const bookingUrl = String(o.bookingUrl ?? "").trim() || undefined;
    const mapsUrl = String(o.mapsUrl ?? "").trim() || undefined;
    const websiteUrl = String(o.websiteUrl ?? "").trim() || undefined;
    const sourceLabel = String(o.sourceLabel ?? "").trim() || undefined;
    const plannerNotes = String(o.plannerNotes ?? "").trim() || undefined;
    const bookingStatus = normalizeVenueBookingStatus(o.bookingStatus);
    out.push({
      id,
      title,
      summary,
      category,
      bookingUrl,
      mapsUrl,
      websiteUrl,
      sourceLabel,
      plannerNotes,
      bookingStatus,
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

/** Best URL for preview / primary outbound link. */
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

/** Venues visible on the family plan (hide passed options). */
export function venuesForPublicShowcase(venues: VenueOption[]): VenueOption[] {
  return venues.filter((v) => (v.bookingStatus ?? "idea") !== "passed");
}
