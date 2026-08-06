import { createSupabaseAdmin } from "@/lib/supabase/server";

/** Permanent area cache (Mapbox geocode). Soft-fail if table missing. */
export type AreaRow = {
  id: string;
  query_key: string;
  label: string;
  lat: number;
  lng: number;
  country?: string | null;
  region?: string | null;
};

function areaKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getCachedArea(query: string): Promise<AreaRow | null> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("areas")
      .select("*")
      .eq("query_key", areaKey(query))
      .maybeSingle();
    if (error || !data) return null;
    return data as AreaRow;
  } catch {
    return null;
  }
}

export async function upsertArea(row: Omit<AreaRow, "id"> & { id?: string }): Promise<AreaRow | null> {
  try {
    const db = createSupabaseAdmin();
    const id = row.id ?? crypto.randomUUID();
    const payload = {
      id,
      query_key: areaKey(row.query_key),
      label: row.label,
      lat: row.lat,
      lng: row.lng,
      country: row.country ?? null,
      region: row.region ?? null,
    };
    const { data, error } = await db
      .from("areas")
      .upsert(payload, { onConflict: "query_key" })
      .select("*")
      .maybeSingle();
    if (error || !data) return null;
    return data as AreaRow;
  } catch {
    return null;
  }
}

export type LodgingCacheRow = {
  cache_key: string;
  payload: unknown;
  fetched_at: string;
  expires_at: string;
};

export async function getLodgingCache(
  cacheKey: string,
): Promise<LodgingCacheRow | null> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("lodging_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as LodgingCacheRow;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return row;
  } catch {
    return null;
  }
}

export async function setLodgingCache(
  cacheKey: string,
  payload: unknown,
  ttlMs: number,
): Promise<void> {
  try {
    const db = createSupabaseAdmin();
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMs);
    await db.from("lodging_cache").upsert(
      {
        cache_key: cacheKey,
        payload,
        fetched_at: now.toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch {
    /* soft-fail */
  }
}

export type PlaceCacheRow = {
  cache_key: string;
  payload: unknown;
  fetched_at: string;
  expires_at: string;
};

export async function getPlaceCache(
  cacheKey: string,
): Promise<PlaceCacheRow | null> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("place_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as PlaceCacheRow;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return row;
  } catch {
    return null;
  }
}

export async function setPlaceCache(
  cacheKey: string,
  payload: unknown,
  ttlMs: number,
): Promise<void> {
  try {
    const db = createSupabaseAdmin();
    const now = new Date();
    await db.from("place_cache").upsert(
      {
        cache_key: cacheKey,
        payload,
        fetched_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlMs).toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch {
    /* soft-fail */
  }
}

export type DriveCacheRow = {
  pair_key: string;
  minutes: number;
  meters?: number | null;
};

export async function getDriveCache(
  pairKey: string,
): Promise<DriveCacheRow | null> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("drive_cache")
      .select("*")
      .eq("pair_key", pairKey)
      .maybeSingle();
    if (error || !data) return null;
    return data as DriveCacheRow;
  } catch {
    return null;
  }
}

export async function setDriveCache(
  pairKey: string,
  minutes: number,
  meters?: number,
): Promise<void> {
  try {
    const db = createSupabaseAdmin();
    await db.from("drive_cache").upsert(
      {
        pair_key: pairKey,
        minutes,
        meters: meters ?? null,
      },
      { onConflict: "pair_key" },
    );
  } catch {
    /* soft-fail */
  }
}
