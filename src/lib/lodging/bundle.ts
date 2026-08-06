/** Persisted lodging candidate on a destination option row. Never invent at render. */

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
  amenities: LodgingAmenity[];
  totalUsd?: number;
  nights?: number;
  imageUrl?: string;
  source?: string;
  providerId?: string;
  provider?: string;
  priceKind?: string;
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
};

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
        amenities,
        totalUsd:
          typeof p.totalUsd === "number" && Number.isFinite(p.totalUsd)
            ? Math.round(p.totalUsd)
            : undefined,
        nights:
          typeof p.nights === "number" && Number.isFinite(p.nights)
            ? Math.round(p.nights)
            : undefined,
        imageUrl: String(p.imageUrl ?? "").trim() || undefined,
        source: source || undefined,
        providerId: String(p.providerId ?? "").trim() || undefined,
        provider: String(p.provider ?? "").trim() || undefined,
        priceKind: String(p.priceKind ?? "").trim() || undefined,
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
  return {
    status: nextStatus,
    properties: properties.slice(0, 3),
    filteredCount:
      typeof o.filteredCount === "number" && Number.isFinite(o.filteredCount)
        ? Math.round(o.filteredCount)
        : undefined,
    filteredReason: String(o.filteredReason ?? "").trim() || undefined,
    staleLabel: String(o.staleLabel ?? "").trim() || undefined,
    partialNote: String(o.partialNote ?? "").trim() || undefined,
    fetchedAt: String(o.fetchedAt ?? "").trim() || undefined,
  };
}

export function lodgingForLocation(loc: {
  lodging?: LodgingBundle | unknown;
}): LodgingBundle {
  return normalizeLodgingBundle(loc.lodging);
}

/** Capacity hard filter — properties that cannot sleep headcount are not cards. */
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
    status: kept.length === 0 ? "empty" : bundle.status,
  };
}
