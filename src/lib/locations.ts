export type LocationOption = {
  id: string;
  title: string;
  summary?: string;
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
    out.push({ id, title, summary });
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
