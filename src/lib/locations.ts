export type LocationOption = {
  id: string;
  title: string;
  summary?: string;
  state?: string;
  driveMinutesFromOrigin?: number;
  originMetro?: string;
  nearestAirportCode?: string;
  avgHighF?: number;
  crowdLevel?: "quiet" | "moderate" | "busy";
  typicalLodgingUsd?: number;
};

export function normalizeLocationOptions(raw: unknown): LocationOption[] {
  if (!Array.isArray(raw)) return [];
  const out: LocationOption[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) continue;
    const id = String(o.id ?? "").trim() || crypto.randomUUID();
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const summary = String(o.summary ?? "").trim() || undefined;
    const state = String(o.state ?? "").trim() || undefined;
    const originMetro = String(o.originMetro ?? "").trim() || undefined;
    const nearestAirportCode = String(o.nearestAirportCode ?? "").trim() || undefined;
    const driveMinutesFromOrigin =
      typeof o.driveMinutesFromOrigin === "number" &&
      Number.isFinite(o.driveMinutesFromOrigin)
        ? Math.round(o.driveMinutesFromOrigin)
        : undefined;
    const avgHighF =
      typeof o.avgHighF === "number" && Number.isFinite(o.avgHighF)
        ? Math.round(o.avgHighF)
        : undefined;
    const typicalLodgingUsd =
      typeof o.typicalLodgingUsd === "number" && Number.isFinite(o.typicalLodgingUsd)
        ? Math.round(o.typicalLodgingUsd)
        : undefined;
    const crowdRaw = String(o.crowdLevel ?? "").trim();
    const crowdLevel =
      crowdRaw === "quiet" || crowdRaw === "moderate" || crowdRaw === "busy"
        ? crowdRaw
        : undefined;
    out.push({
      id,
      title,
      summary,
      state: state?.length === 2 ? state.toUpperCase() : state,
      driveMinutesFromOrigin,
      originMetro,
      nearestAirportCode,
      avgHighF,
      crowdLevel,
      typicalLodgingUsd,
    });
  }
  return out;
}

export function findLocationById(
  options: LocationOption[],
  id: string,
): LocationOption | undefined {
  return options.find((o) => o.id === id);
}

export function formatLocationLabel(option: LocationOption): string {
  return option.summary ? `${option.title} — ${option.summary}` : option.title;
}
