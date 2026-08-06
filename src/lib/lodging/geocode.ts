import { getCachedArea, upsertArea, type AreaRow } from "@/lib/lodging/cache";

export async function geocodeArea(query: string): Promise<AreaRow | null> {
  const q = query.trim();
  if (!q) return null;

  const cached = await getCachedArea(q);
  if (cached) return cached;

  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token) return null;

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "1");
    url.searchParams.set("types", "place,locality,region,neighborhood");

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{
        place_name?: string;
        center?: [number, number];
        context?: Array<{ id?: string; text?: string; short_code?: string }>;
      }>;
    };
    const feat = json.features?.[0];
    if (!feat?.center) return null;
    const [lng, lat] = feat.center;
    let country: string | null = null;
    let region: string | null = null;
    for (const c of feat.context ?? []) {
      if (c.id?.startsWith("country")) country = c.short_code ?? c.text ?? null;
      if (c.id?.startsWith("region")) region = c.text ?? null;
    }
    return await upsertArea({
      query_key: q,
      label: feat.place_name ?? q,
      lat,
      lng,
      country,
      region,
    });
  } catch {
    return null;
  }
}
