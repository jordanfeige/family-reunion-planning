/** Persisted lodging candidate on a destination option row. Never invent at render. */

import {
  normalizePricing,
  recomputePricingForNights,
  type LodgingPricing,
  type LodgingSplitMode,
} from "@/lib/lodging/pricing";

export type LodgingAmenity = {
  kind: "pro" | "con";
  label: string;
};

export type LodgingProperty = {
  id: string;
  name: string;
  area?: string;
  address?: string;
  structuralFact?: string;
  sleeps?: number;
  bedrooms?: number;
  roomsOnly?: number;
  amenities: LodgingAmenity[];
  nights?: number;
  imageUrl?: string;
  source?: string;
  providerId?: string;
  provider?: string;
  pricing: LodgingPricing;
  websiteUrl?: string;
  phone?: string;
  badge?: "recommended" | "logistics" | string;
  /** How many households sit at/above their private ceiling for this split — count only. */
  householdsAtCeiling?: number;
};

export type LodgingBundle = {
  status: "pending" | "ready" | "empty" | "failed" | "partial";
  properties: LodgingProperty[];
  filteredCount?: number;
  filteredReason?: string;
  staleLabel?: string;
  partialNote?: string;
  fetchedAt?: string;
  pricedCount?: number;
  unpricedRentalCount?: number;
};

const MAX_PROPERTIES = 12;

function propertyKey(p: {
  provider?: string;
  providerId?: string;
  id?: string;
}): string {
  if (p.provider && p.providerId) return `${p.provider}:${p.providerId}`;
  return p.id ?? "";
}

export function normalizeLodgingBundle(raw: unknown): LodgingBundle {
  if (!raw || typeof raw !== "object") {
    return { status: "pending", properties: [] };
  }
  const o = raw as Record<string, unknown>;
  const statusRaw = String(o.status ?? "").trim();
  const status =
    statusRaw === "ready" ||
    statusRaw === "empty" ||
    statusRaw === "pending" ||
    statusRaw === "failed" ||
    statusRaw === "partial"
      ? statusRaw
      : "pending";
  const properties: LodgingProperty[] = [];
  if (Array.isArray(o.properties)) {
    for (const item of o.properties) {
      if (!item || typeof item !== "object") continue;
      const p = item as Record<string, unknown>;
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      // Never surface fabricated / unknown-source rows as cards
      const source = String(p.source ?? "").trim();
      if (source && source !== "provider") continue;
      const amenities: LodgingAmenity[] = [];
      if (Array.isArray(p.amenities)) {
        for (const a of p.amenities) {
          if (!a || typeof a !== "object") continue;
          const am = a as Record<string, unknown>;
          const label = String(am.label ?? "").trim();
          if (!label) continue;
          amenities.push({
            kind: am.kind === "con" ? "con" : "pro",
            label,
          });
        }
      }
      if (!amenities.some((x) => x.kind === "con")) {
        amenities.push({ kind: "con", label: "Nothing flagged" });
      }

      // Prefer nested pricing; legacy quoted/areaTypical → unknown (never invent)
      let pricing = normalizePricing(p.pricing);
      if (pricing.kind === "unknown" && p.pricing == null) {
        // Drop old Amadeus quoted / areaTypical figures — organizer must re-enter
        pricing = { kind: "unknown" };
      }

      properties.push({
        id: String(p.id ?? "").trim() || crypto.randomUUID(),
        name,
        area: String(p.area ?? "").trim() || undefined,
        address: String(p.address ?? "").trim() || undefined,
        structuralFact: String(p.structuralFact ?? "").trim() || undefined,
        sleeps:
          typeof p.sleeps === "number" && Number.isFinite(p.sleeps)
            ? Math.round(p.sleeps)
            : undefined,
        bedrooms:
          typeof p.bedrooms === "number" && Number.isFinite(p.bedrooms)
            ? Math.round(p.bedrooms)
            : undefined,
        roomsOnly:
          typeof p.roomsOnly === "number" && Number.isFinite(p.roomsOnly)
            ? Math.round(p.roomsOnly)
            : undefined,
        amenities,
        nights:
          typeof p.nights === "number" && Number.isFinite(p.nights)
            ? Math.round(p.nights)
            : undefined,
        imageUrl: String(p.imageUrl ?? "").trim() || undefined,
        source: source || undefined,
        providerId: String(p.providerId ?? "").trim() || undefined,
        provider: String(p.provider ?? "").trim() || undefined,
        pricing,
        websiteUrl: String(p.websiteUrl ?? "").trim() || undefined,
        phone: String(p.phone ?? "").trim() || undefined,
        badge: String(p.badge ?? "").trim() || undefined,
        householdsAtCeiling:
          typeof p.householdsAtCeiling === "number" &&
          Number.isFinite(p.householdsAtCeiling)
            ? Math.max(0, Math.round(p.householdsAtCeiling))
            : undefined,
      });
    }
  }
  let nextStatus: LodgingBundle["status"] = status;
  if (properties.length === 0 && status === "ready") nextStatus = "empty";

  const pricedCount = properties.filter(
    (p) => p.pricing.kind === "organizerEntered",
  ).length;
  const unpricedRentalCount = properties.length - pricedCount;

  return {
    status: nextStatus,
    properties: properties.slice(0, MAX_PROPERTIES),
    filteredCount:
      typeof o.filteredCount === "number" && Number.isFinite(o.filteredCount)
        ? Math.round(o.filteredCount)
        : undefined,
    filteredReason: String(o.filteredReason ?? "").trim() || undefined,
    staleLabel: String(o.staleLabel ?? "").trim() || undefined,
    partialNote: String(o.partialNote ?? "").trim() || undefined,
    fetchedAt: String(o.fetchedAt ?? "").trim() || undefined,
    pricedCount,
    unpricedRentalCount,
  };
}

export function lodgingForLocation(loc: {
  lodging?: LodgingBundle | unknown;
}): LodgingBundle {
  return normalizeLodgingBundle(loc.lodging);
}

/** Capacity hard filter — known capacity below headcount is excluded; unknown kept. */
export function filterLodgingByHeadcount(
  bundle: LodgingBundle,
  headcount: number | null | undefined,
): LodgingBundle {
  if (!headcount || headcount <= 0) return bundle;
  const kept = bundle.properties.filter(
    (p) => p.sleeps == null || p.sleeps >= headcount,
  );
  if (kept.length === bundle.properties.length) return bundle;
  return {
    ...bundle,
    properties: kept,
    pricedCount: kept.filter((p) => p.pricing.kind === "organizerEntered").length,
    unpricedRentalCount: kept.filter((p) => p.pricing.kind === "unknown").length,
    status: kept.length === 0 ? "empty" : bundle.status,
  };
}

/**
 * Merge Overpass refresh onto prior bundle: preserve organizerEntered by providerId.
 * Recompute totals when nights changed.
 */
export function mergeLodgingWithPrior(
  fresh: LodgingBundle,
  prior: LodgingBundle | undefined,
  opts: {
    nights: number;
    householdCount: number;
    headcount?: number;
    split?: LodgingSplitMode;
  },
): LodgingBundle {
  const priorByKey = new Map<string, LodgingProperty>();
  for (const p of prior?.properties ?? []) {
    const k = propertyKey(p);
    if (k) priorByKey.set(k, p);
  }

  const properties = fresh.properties.map((p) => {
    const prev = priorByKey.get(propertyKey(p));
    const nights = opts.nights;
    let pricing = p.pricing;
    if (prev?.pricing.kind === "organizerEntered") {
      pricing = recomputePricingForNights(
        prev.pricing,
        nights,
        opts.householdCount,
        opts.headcount,
        opts.split,
      );
    }
    return {
      ...p,
      nights,
      pricing,
      // Keep organizer source URL preference if fresh has none
      websiteUrl: p.websiteUrl || prev?.websiteUrl,
      phone: p.phone || prev?.phone,
    };
  });

  // Capacity-fit sort: known capacity closer to headcount first; unknown last
  const need = Math.max(1, opts.headcount ?? 1);
  properties.sort((a, b) => {
    const aKnown = a.sleeps != null;
    const bKnown = b.sleeps != null;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (aKnown && bKnown) {
      const da = Math.abs((a.sleeps as number) - need);
      const db = Math.abs((b.sleeps as number) - need);
      if (da !== db) return da - db;
      return (a.sleeps as number) - (b.sleeps as number);
    }
    return a.name.localeCompare(b.name);
  });

  // Badge leading priced row (cheapest total among organizerEntered)
  const priced = properties
    .filter((p) => p.pricing.kind === "organizerEntered")
    .sort(
      (a, b) =>
        ((a.pricing as { totalUsd: number }).totalUsd ?? Infinity) -
        ((b.pricing as { totalUsd: number }).totalUsd ?? Infinity),
    );
  const leadingId = priced[0]?.id;
  const withBadges = properties.map((p) => {
    if (p.id === leadingId) return { ...p, badge: "recommended" as const };
    const { badge: _drop, ...rest } = p;
    return rest;
  });

  const pricedCount = withBadges.filter(
    (p) => p.pricing.kind === "organizerEntered",
  ).length;

  return {
    ...fresh,
    properties: withBadges.slice(0, MAX_PROPERTIES),
    pricedCount,
    unpricedRentalCount: withBadges.length - pricedCount,
  };
}

/** Recompute organizerEntered totals for current nights (e.g. date edit without refresh). */
export function recomputeBundleForNights(
  bundle: LodgingBundle,
  nights: number,
  householdCount: number,
  headcount?: number,
  split?: LodgingSplitMode,
): LodgingBundle {
  const properties = bundle.properties.map((p) => ({
    ...p,
    nights,
    pricing: recomputePricingForNights(
      p.pricing,
      nights,
      householdCount,
      headcount,
      split,
    ),
  }));
  const pricedCount = properties.filter(
    (p) => p.pricing.kind === "organizerEntered",
  ).length;
  return {
    ...bundle,
    properties,
    pricedCount,
    unpricedRentalCount: properties.length - pricedCount,
  };
}
