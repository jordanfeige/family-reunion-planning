import type { AmenityRow } from "@/lib/lodging/amenities";

export type LodgingSource = "provider" | "unknown";

export type LodgingPriceKind = "confirmed" | "estimated_nightly";

export type Lodging = {
  id: string;
  providerId: string;
  provider: "rapidapi" | "amadeus" | string;
  source: LodgingSource;
  name: string;
  area?: string;
  address?: string;
  structuralFact?: string;
  sleeps: number;
  bedrooms?: number;
  amenityCodes: string[];
  amenities: AmenityRow[];
  totalUsd: number;
  nights: number;
  priceKind: LodgingPriceKind;
  priceAsOf: string;
  imageUrl?: string;
  reviewScore?: number;
  badge?: "recommended" | "logistics" | string;
  householdsAtCeiling?: number;
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
