import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Mapbox reverse-geocode for guest home location (§4a).
 * Called once from the client; result cached in localStorage.
 * Never invents a city — returns null label on failure.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ label: null, lat: body.lat, lng: body.lng });
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${body.lng},${body.lat}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "1");
    url.searchParams.set("types", "place,locality");
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      return NextResponse.json({ label: null, lat: body.lat, lng: body.lng });
    }
    const json = (await res.json()) as {
      features?: {
        text?: string;
        place_name?: string;
        context?: { id?: string; text?: string; short_code?: string }[];
      }[];
    };
    const feat = json.features?.[0];
    if (!feat) {
      return NextResponse.json({ label: null, lat: body.lat, lng: body.lng });
    }
    const place = feat.text?.trim();
    const region = feat.context?.find((c) => c.id?.startsWith("region."));
    const state =
      region?.short_code?.replace(/^US-/i, "").toUpperCase() ||
      region?.text?.trim();
    const label =
      place && state
        ? `${place}, ${state}`
        : place ||
          feat.place_name?.split(",").slice(0, 2).join(",").trim() ||
          null;
    return NextResponse.json({ label, lat: body.lat, lng: body.lng });
  } catch {
    return NextResponse.json({ label: null, lat: body.lat, lng: body.lng });
  }
}
