import { amenityRowsFromOsmTags } from "@/lib/lodging/amenities";
import { unknownPricing } from "@/lib/lodging/pricing";
import type { Lodging } from "@/lib/lodging/types";
import {
  bboxAround,
  bboxClause,
  elementCoords,
  queryOverpass,
  type OverpassElement,
} from "@/lib/overpass";

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

const TOURISM_LABEL: Record<string, string> = {
  chalet: "Chalet",
  guest_house: "Guest house",
  apartment: "Apartment",
  resort: "Resort",
};

function parseIntTag(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.round(n);
}

/**
 * beds/capacity → known sleeps.
 * rooms/guest_rooms only → roomsOnly (capacity unknown).
 * nothing → both absent.
 */
function parseCapacity(tags: Record<string, string>): {
  sleeps?: number;
  bedrooms?: number;
  roomsOnly?: number;
} {
  const beds =
    parseIntTag(tags.beds) ??
    parseIntTag(tags.capacity) ??
    parseIntTag(tags.guests);
  const bedroomsTag = parseIntTag(tags.bedrooms);
  const roomsTag = parseIntTag(tags.rooms) ?? parseIntTag(tags.guest_rooms);

  if (beds != null) {
    return {
      sleeps: beds,
      bedrooms: bedroomsTag ?? roomsTag,
    };
  }
  // Rooms only → capacity-unknown group ("N rooms — sleeps unknown")
  if (roomsTag != null || bedroomsTag != null) {
    return {
      roomsOnly: roomsTag ?? bedroomsTag,
      bedrooms: bedroomsTag,
    };
  }
  return {};
}

function websiteFromTags(tags: Record<string, string>): string | undefined {
  const url =
    tags.website?.trim() ||
    tags["contact:website"]?.trim() ||
    tags.url?.trim() ||
    "";
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function phoneFromTags(tags: Record<string, string>): string | undefined {
  const phone =
    tags.phone?.trim() ||
    tags["contact:phone"]?.trim() ||
    tags["contact:mobile"]?.trim() ||
    "";
  return phone || undefined;
}

function mapElement(
  el: OverpassElement,
  nights: number,
  areaLabel?: string,
): Lodging | null {
  const tags = el.tags ?? {};
  const name = String(tags.name ?? "").trim();
  if (!name) return null;
  const tourism = String(tags.tourism ?? "").trim();
  const id = String(el.id ?? `${name}-${tourism}`).trim();
  if (!id) return null;

  const { sleeps, bedrooms, roomsOnly } = parseCapacity(tags);
  const structural =
    TOURISM_LABEL[tourism] ??
    (tourism ? tourism.replace(/_/g, " ") : "Vacation rental");
  const factParts = [structural];
  if (sleeps != null) factParts.push(`sleeps ${sleeps}`);
  else if (roomsOnly != null) {
    factParts.push(
      `${roomsOnly} room${roomsOnly === 1 ? "" : "s"} — sleeps unknown`,
    );
  }

  return {
    id: `overpass:${el.type ?? "n"}:${id}`,
    providerId: id,
    provider: "overpass",
    source: "provider",
    name,
    area: tags["addr:city"]?.trim() || areaLabel,
    address: [tags["addr:housenumber"], tags["addr:street"]]
      .filter(Boolean)
      .join(" ")
      .trim() || undefined,
    structuralFact: factParts.join(" · "),
    sleeps,
    bedrooms,
    roomsOnly,
    amenityCodes: [],
    amenities: amenityRowsFromOsmTags(tags),
    nights,
    pricing: unknownPricing(),
    websiteUrl: websiteFromTags(tags),
    phone: phoneFromTags(tags),
  };
}

/** Named vacation rentals via OpenStreetMap Overpass (no API key, no prices). */
export async function fetchOverpassRentals(input: {
  lat: number;
  lng: number;
  checkIn: string;
  checkOut: string;
  areaLabel?: string;
}): Promise<{ ok: boolean; properties: Lodging[] }> {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const bbox = bboxAround(input.lat, input.lng);
  const box = bboxClause(bbox);
  const ql = `
[out:json][timeout:25];
(
  nwr["tourism"="chalet"]["name"](${box});
  nwr["tourism"="guest_house"]["name"](${box});
  nwr["tourism"="apartment"]["name"](${box});
  nwr["tourism"="resort"]["name"](${box});
);
out center tags;
`.trim();

  const { ok, elements } = await queryOverpass(ql);
  if (!ok) return { ok: false, properties: [] };

  const properties: Lodging[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!elementCoords(el) && el.type !== "node" && !el.center) {
      /* still allow if tags present — center may be missing on some ways */
    }
    const mapped = mapElement(el, nights, input.areaLabel);
    if (!mapped) continue;
    if (seen.has(mapped.providerId)) continue;
    seen.add(mapped.providerId);
    properties.push(mapped);
    if (properties.length >= 20) break;
  }
  return { ok: true, properties };
}
