import type { VenueCategory, VenueOption } from "@/lib/venues";

export const PRICE_TYPES = ["exact", "range", "estimate", "free", "unknown"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const PRICE_UNITS = [
  "per_night",
  "per_person",
  "per_group",
  "total_stay",
] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export function defaultPriceUnitForCategory(category: VenueCategory): PriceUnit {
  if (category === "stay") return "per_night";
  return "per_person";
}

export function normalizePriceType(raw: unknown): PriceType {
  const s = String(raw ?? "").toLowerCase();
  if (PRICE_TYPES.includes(s as PriceType)) return s as PriceType;
  return "unknown";
}

export function normalizePriceUnit(raw: unknown, category: VenueCategory): PriceUnit {
  const s = String(raw ?? "").toLowerCase();
  if (PRICE_UNITS.includes(s as PriceUnit)) return s as PriceUnit;
  return defaultPriceUnitForCategory(category);
}

function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  return amount % 1 === 0
    ? `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const UNIT_SUFFIX: Record<PriceUnit, string> = {
  per_night: "/night",
  per_person: "/person",
  per_group: "· group",
  total_stay: "· total stay",
};

export function formatVenuePrice(venue: VenueOption): string {
  const type = venue.priceType ?? "unknown";
  const unit = venue.priceUnit ?? defaultPriceUnitForCategory(venue.category);
  const suffix = UNIT_SUFFIX[unit];
  const notes = venue.priceNotes?.trim();

  if (type === "free") return notes ? `Free · ${notes}` : "Free";
  if (type === "unknown") return notes ? `Price TBD · ${notes}` : "Price TBD";

  const min = venue.priceMin;
  const max = venue.priceMax;

  let base = "";
  if (min != null && max != null && min !== max) {
    base = `${formatMoney(min)}–${formatMoney(max)}${suffix}`;
  } else if (min != null) {
    base = `${formatMoney(min)}${suffix}`;
  } else if (max != null) {
    base = `Up to ${formatMoney(max)}${suffix}`;
  } else if (type === "estimate") {
    base = `Estimated${suffix}`;
  } else {
    base = `Price TBD${suffix ? ` ${suffix.trim()}` : ""}`;
  }

  return notes ? `${base} · ${notes}` : base;
}
