/** Persist Browse area preference (local-first). */

export type BrowseAreaPreference = {
  label: string;
  lat: number | null;
  lng: number | null;
  updatedAt: string;
};

const AREA_KEY = "wandrai_browse_area_v1";
const KEPT_KEY = "wandrai_browse_kept_v1";
const NIGHT_KEY = "wandrai_browse_night_v1";

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

export function readBrowseArea(): BrowseAreaPreference | null {
  const v = readJson<BrowseAreaPreference | null>(AREA_KEY, null);
  if (!v || typeof v.label !== "string") return null;
  return v;
}

export function writeBrowseArea(next: Omit<BrowseAreaPreference, "updatedAt">) {
  writeJson(AREA_KEY, {
    ...next,
    label: next.label.trim(),
    updatedAt: new Date().toISOString(),
  } satisfies BrowseAreaPreference);
}

export type PersistedKeptIdea = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  estCostUsd: number;
  durationMins: number;
  driveMinutes: number | null;
  imageUrl: string | null;
  keptAt: string;
};

export function readPersistedKept(): PersistedKeptIdea[] {
  return readJson<PersistedKeptIdea[]>(KEPT_KEY, []);
}

export function writePersistedKept(items: PersistedKeptIdea[]) {
  writeJson(KEPT_KEY, items.slice(0, 40));
}

export function bumpBrowseNight(): number {
  const today = new Date().toISOString().slice(0, 10);
  const prev = readJson<{ date: string; count: number } | null>(NIGHT_KEY, null);
  if (prev?.date === today) return Math.max(1, prev.count);
  const count = (prev?.count ?? 0) + 1;
  writeJson(NIGHT_KEY, { date: today, count });
  return count;
}

export function readBrowseNight(): number {
  const prev = readJson<{ date: string; count: number } | null>(NIGHT_KEY, null);
  return Math.max(1, prev?.count ?? 1);
}
