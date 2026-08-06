import {
  amenityRowsFromCodes,
  normalizeAmenityStrings,
} from "@/lib/lodging/amenities";
import type { Lodging } from "@/lib/lodging/types";

type TokenCache = { token: string; expiresAt: number };
let amadeusToken: TokenCache | null = null;

async function getAmadeusToken(): Promise<string | null> {
  const id = process.env.AMADEUS_CLIENT_ID?.trim();
  const secret = process.env.AMADEUS_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  if (amadeusToken && amadeusToken.expiresAt > Date.now() + 60_000) {
    return amadeusToken.token;
  }
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    });
    const res = await fetch("https://api.amadeus.com/v1/security/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) return null;
    amadeusToken = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000,
    };
    return amadeusToken.token;
  } catch {
    return null;
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Amadeus hotel list + offers by geo. */
export async function fetchAmadeusHotels(input: {
  lat: number;
  lng: number;
  checkIn: string;
  checkOut: string;
  headcount: number;
  areaLabel?: string;
}): Promise<{ ok: boolean; rateLimited?: boolean; properties: Lodging[] }> {
  const token = await getAmadeusToken();
  if (!token) return { ok: false, properties: [] };

  const nights = nightsBetween(input.checkIn, input.checkOut);
  const adults = Math.min(9, Math.max(1, input.headcount));

  try {
    const listUrl = new URL(
      "https://api.amadeus.com/v1/reference-data/locations/hotels/by-geocode",
    );
    listUrl.searchParams.set("latitude", String(input.lat));
    listUrl.searchParams.set("longitude", String(input.lng));
    listUrl.searchParams.set("radius", "40");
    listUrl.searchParams.set("radiusUnit", "KM");
    listUrl.searchParams.set("hotelSource", "ALL");

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (listRes.status === 429)
      return { ok: false, rateLimited: true, properties: [] };
    if (!listRes.ok) return { ok: false, properties: [] };

    const listJson = (await listRes.json()) as {
      data?: Array<{ hotelId?: string; name?: string; distance?: string }>;
    };
    const hotelIds = (listJson.data ?? [])
      .map((h) => h.hotelId)
      .filter((id): id is string => Boolean(id))
      .slice(0, 20);
    if (hotelIds.length === 0) return { ok: true, properties: [] };

    const offerUrl = new URL(
      "https://api.amadeus.com/v3/shopping/hotel-offers",
    );
    offerUrl.searchParams.set("hotelIds", hotelIds.join(","));
    offerUrl.searchParams.set("adults", String(adults));
    offerUrl.searchParams.set("checkInDate", input.checkIn);
    offerUrl.searchParams.set("checkOutDate", input.checkOut);
    offerUrl.searchParams.set("roomQuantity", "1");
    offerUrl.searchParams.set("currency", "USD");
    offerUrl.searchParams.set("bestRateOnly", "true");

    const offerRes = await fetch(offerUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (offerRes.status === 429)
      return { ok: false, rateLimited: true, properties: [] };
    if (!offerRes.ok) return { ok: false, properties: [] };

    const offerJson = (await offerRes.json()) as {
      data?: Array<{
        hotel?: {
          hotelId?: string;
          name?: string;
          amenities?: string[];
          address?: { lines?: string[]; cityName?: string };
        };
        offers?: Array<{
          id?: string;
          room?: {
            typeEstimated?: { beds?: number; bedType?: string };
            description?: { text?: string };
          };
          price?: { total?: string; currency?: string };
        }>;
      }>;
    };

    const properties: Lodging[] = [];
    for (const row of offerJson.data ?? []) {
      const hotel = row.hotel;
      const offer = row.offers?.[0];
      if (!hotel?.hotelId || !hotel.name || !offer?.price?.total) continue;
      const totalUsd = Math.round(Number(offer.price.total));
      if (!Number.isFinite(totalUsd) || totalUsd <= 0) continue;

      // Hotels rarely expose true sleep capacity; skip unless beds estimated
      const beds = offer.room?.typeEstimated?.beds;
      const sleeps = beds != null && beds > 0 ? Math.max(beds, adults) : null;
      if (sleeps == null) continue;

      const codes = normalizeAmenityStrings(hotel.amenities ?? []);
      const amenityText = offer.room?.description?.text
        ? [offer.room.description.text]
        : [];
      const more = normalizeAmenityStrings(amenityText);
      const allCodes = [...new Set([...codes, ...more])];

      properties.push({
        id: `amadeus:${hotel.hotelId}`,
        providerId: hotel.hotelId,
        provider: "amadeus",
        source: "provider",
        name: hotel.name,
        area: hotel.address?.cityName ?? input.areaLabel,
        address: hotel.address?.lines?.join(", "),
        structuralFact: `Sleeps ${sleeps}`,
        sleeps,
        amenityCodes: allCodes,
        amenities: amenityRowsFromCodes(allCodes),
        totalUsd,
        nights,
        priceKind: "confirmed",
        priceAsOf: new Date().toISOString(),
      });
    }
    return { ok: true, properties };
  } catch {
    return { ok: false, properties: [] };
  }
}
