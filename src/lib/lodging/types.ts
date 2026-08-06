import type { AmenityRow } from "@/lib/lodging/amenities";
import type { LodgingPricing } from "@/lib/lodging/pricing";

export type LodgingSource = "provider" | "unknown";

export type Lodging = {
  id: string;
  providerId: string;
  provider: "overpass" | string;
  source: LodgingSource;
  name: string;
  area?: string;
  address?: string;
  structuralFact?: string;
  /** Known bed/capacity count. Absent = capacity unknown (never invent). */
  sleeps?: number | null;
  bedrooms?: number;
  /** When OSM only has rooms (not beds/capacity) — shown as "N rooms — sleeps unknown". */
  roomsOnly?: number;
  amenityCodes: string[];
  amenities: AmenityRow[];
  nights: number;
  pricing: LodgingPricing;
  imageUrl?: string;
  reviewScore?: number;
  badge?: "recommended" | "logistics" | string;
  householdsAtCeiling?: number;
  websiteUrl?: string;
  phone?: string;
};

export type LodgingFetchStatus =
  | "pending"
  | "ready"
  | "empty"
  | "failed"
  | "partial";

export type LodgingResult = {
  status: LodgingFetchStatus;
  properties: Lodging[];
  staleLabel?: string;
  partialNote?: string;
  filteredCount?: number;
  filteredReason?: string;
  fetchedAt?: string;
  pricedCount?: number;
  unpricedRentalCount?: number;
};

export type GetLodgingInput = {
  area: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  headcount: number;
  /** Optional lat/lng if already resolved */
  lat?: number;
  lng?: number;
  areaId?: string;
};
