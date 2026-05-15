import { mergeResolvedLinks, resolveVenueLinks } from "@/lib/enrichVenueLinks";
import {
  defaultPriceUnitForCategory,
  normalizePriceType,
  normalizePriceUnit,
} from "@/lib/venuePrices";
import type { VenueSuggestion } from "@/lib/venueSuggestions";
import {
  normalizeVenueBookingStatus,
  normalizeVenueCategory,
  type VenueOption,
} from "@/lib/venues";

export async function enrichVenueOption(
  input: VenueSuggestion & {
    id?: string;
    bookingStatus?: VenueOption["bookingStatus"];
    plannerNotes?: string;
  },
  locationTitle: string,
): Promise<VenueOption> {
  const category = normalizeVenueCategory(input.category);
  const resolved = await resolveVenueLinks(input.title, category, locationTitle);
  const links = mergeResolvedLinks(
    {
      bookingUrl: input.bookingUrl,
      mapsUrl: input.mapsUrl,
      websiteUrl: input.websiteUrl,
      sourceLabel: input.sourceLabel,
    },
    resolved,
  );

  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    summary: input.summary?.trim() || undefined,
    category,
    bookingStatus: normalizeVenueBookingStatus(input.bookingStatus),
    plannerNotes: input.plannerNotes?.trim() || undefined,
    priceType: normalizePriceType(input.priceType),
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    priceUnit: normalizePriceUnit(input.priceUnit, category),
    priceNotes: input.priceNotes?.trim() || undefined,
    ...links,
  };
}

export async function enrichVenueSuggestions(
  suggestions: VenueSuggestion[],
  locationTitle: string,
): Promise<VenueOption[]> {
  const out: VenueOption[] = [];
  for (const suggestion of suggestions) {
    out.push(await enrichVenueOption(suggestion, locationTitle));
  }
  return out;
}
