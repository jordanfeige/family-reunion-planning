"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { appOrigin } from "@/lib/appOrigin";
import {
  buildOrganizerPricing,
  getLodging,
  lodgingResultToBundle,
  looksLikeUrl,
  mergeLodgingWithPrior,
  normalizeLodgingBundle,
  normalizeSourceUrl,
  parseFeesUsd,
  parseNightlyUsd,
  type LodgingBundle,
} from "@/lib/lodging";
import {
  findLocationById,
  normalizeLocationOptions,
  type LocationOption,
} from "@/lib/locations";
import { sendLodgingPriceHelpEmail } from "@/lib/sendLodgingPriceHelpEmail";
import { weekendStayDates } from "@/lib/stayDates";
import type { Trip } from "@/lib/supabase/mappers";
import {
  getSurveyByTripId,
  getTripByShareToken,
  getTripForOrganizer,
  listSurveyResponses,
  updateTripById,
} from "@/lib/supabase/queries";

async function hydrateOne(
  option: LocationOption,
  checkIn: string,
  checkOut: string,
  headcount: number,
  householdCount: number,
): Promise<LocationOption> {
  const stayNights = Math.max(
    1,
    Math.round(
      (new Date(`${checkOut}T12:00:00`).getTime() -
        new Date(`${checkIn}T12:00:00`).getTime()) /
        86_400_000,
    ),
  );
  const result = await getLodging({
    area: option.title,
    checkIn,
    checkOut,
    headcount: Math.max(1, headcount),
  });
  const fresh = lodgingResultToBundle(result);
  const prior = option.lodging
    ? normalizeLodgingBundle(option.lodging)
    : undefined;
  const lodging = mergeLodgingWithPrior(fresh, prior, {
    nights: stayNights,
    householdCount: Math.max(1, householdCount),
    headcount: Math.max(1, headcount),
  });
  return { ...option, lodging };
}

async function householdCountForTrip(tripId: string): Promise<number> {
  const survey = await getSurveyByTripId(tripId);
  const responses = survey ? await listSurveyResponses(survey.id) : [];
  return Math.max(responses.length, 1);
}

/** Pull Overpass lodging for every shortlisted place (publish / refresh). */
export async function hydrateTripLodgingAction(slug: string): Promise<{
  ok: true;
  updated: number;
} | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const access = await getTripForOrganizer(slug, session.user.id);
  if (!access) return { ok: false, error: "Trip not found." };

  const { trip } = access;
  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  if (locations.length === 0) return { ok: true, updated: 0 };

  const stay = weekendStayDates(trip.selectedWeekendFriday);
  const headcount = trip.planHeadcount ?? 1;
  const householdCount = await householdCountForTrip(trip.id);

  const next: LocationOption[] = [];
  for (const loc of locations) {
    next.push(
      await hydrateOne(
        loc,
        stay.checkIn,
        stay.checkOut,
        headcount,
        householdCount,
      ),
    );
  }

  await updateTripById(trip.id, { locationOptions: next });
  revalidatePath(`/t/${slug}`);
  for (const loc of next) {
    revalidatePath(`/t/${slug}/place/${loc.id}`);
  }
  return { ok: true, updated: next.length };
}

/** Refresh listings for one destination; preserves organizerEntered rates. */
export async function refreshPlaceLodgingAction(
  slug: string,
  optionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const access = await getTripForOrganizer(slug, session.user.id);
  if (!access) return { ok: false, error: "Trip not found." };

  const { trip } = access;
  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const option = findLocationById(locations, optionId);
  if (!option) return { ok: false, error: "Place not found." };

  const stay = weekendStayDates(trip.selectedWeekendFriday);
  const headcount = trip.planHeadcount ?? 1;
  const householdCount = await householdCountForTrip(trip.id);
  const updated = await hydrateOne(
    option,
    stay.checkIn,
    stay.checkOut,
    headcount,
    householdCount,
  );
  const next = locations.map((l) => (l.id === optionId ? updated : l));
  await updateTripById(trip.id, { locationOptions: next });
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/place/${optionId}`);
  return { ok: true };
}

function applyRateToBundle(
  lodging: LodgingBundle,
  propertyId: string,
  pricing: ReturnType<typeof buildOrganizerPricing>,
  nights: number,
  sourceUrl?: string,
): LodgingBundle | null {
  const idx = lodging.properties.findIndex((p) => p.id === propertyId);
  if (idx < 0) return null;

  const properties = lodging.properties.map((p, i) =>
    i === idx
      ? {
          ...p,
          nights,
          pricing,
          websiteUrl: sourceUrl || p.websiteUrl,
        }
      : p,
  );

  const priced = properties
    .filter((p) => p.pricing.kind === "organizerEntered")
    .sort((a, b) => {
      const ta =
        a.pricing.kind === "organizerEntered" ? a.pricing.totalUsd : Infinity;
      const tb =
        b.pricing.kind === "organizerEntered" ? b.pricing.totalUsd : Infinity;
      return ta - tb;
    });
  const leadingId = priced[0]?.id;
  const withBadges = properties.map((p) => {
    if (p.id === leadingId) return { ...p, badge: "recommended" as const };
    const { badge: _b, ...rest } = p;
    return rest;
  });

  return {
    ...lodging,
    properties: withBadges,
    pricedCount: withBadges.filter((p) => p.pricing.kind === "organizerEntered")
      .length,
    unpricedRentalCount: withBadges.filter((p) => p.pricing.kind === "unknown")
      .length,
  };
}

async function persistRateOnTrip(
  trip: Trip,
  input: {
    optionId: string;
    propertyId: string;
    nightlyRaw: string;
    feesRaw?: string;
    sourceUrlRaw?: string;
    enteredByName: string;
    enteredByUserId?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  let nightlyRaw = input.nightlyRaw.trim();
  let sourceUrlRaw = (input.sourceUrlRaw ?? "").trim();

  if (looksLikeUrl(nightlyRaw) && !sourceUrlRaw) {
    sourceUrlRaw = nightlyRaw;
    nightlyRaw = "";
  }

  const nightlyUsd = parseNightlyUsd(nightlyRaw);
  if (nightlyUsd == null) {
    return { ok: false, error: "Enter a nightly rate in USD (e.g. $240)." };
  }

  const feesUsd = parseFeesUsd(input.feesRaw);
  const sourceUrl = normalizeSourceUrl(sourceUrlRaw);
  const stay = weekendStayDates(trip.selectedWeekendFriday);
  const headcount = trip.planHeadcount ?? 1;
  const householdCount = await householdCountForTrip(trip.id);

  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const option = findLocationById(locations, input.optionId);
  if (!option?.lodging) return { ok: false, error: "Place not found." };

  const lodging = normalizeLodgingBundle(option.lodging);
  const pricing = buildOrganizerPricing({
    nightlyUsd,
    feesUsd,
    sourceUrl,
    nights: stay.nights,
    householdCount,
    headcount,
    enteredByName: input.enteredByName,
    enteredByUserId: input.enteredByUserId,
  });

  const nextLodging = applyRateToBundle(
    lodging,
    input.propertyId,
    pricing,
    stay.nights,
    sourceUrl,
  );
  if (!nextLodging) return { ok: false, error: "Rental not found." };

  const next = locations.map((l) =>
    l.id === input.optionId ? { ...l, lodging: nextLodging } : l,
  );
  await updateTripById(trip.id, { locationOptions: next });

  revalidatePath(`/t/${trip.slug}`);
  revalidatePath(`/t/${trip.slug}/place/${input.optionId}`);
  revalidatePath(`/o/${trip.shareOptionsToken}/price/${input.optionId}`);
  return { ok: true };
}

/** Persist an organizer-entered nightly rate (organizer session or share token). */
export async function saveLodgingRateAction(input: {
  slug?: string;
  shareToken?: string;
  optionId: string;
  propertyId: string;
  nightlyRaw: string;
  feesRaw?: string;
  sourceUrlRaw?: string;
  enteredByName?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const optionId = input.optionId.trim();
  const propertyId = input.propertyId.trim();
  if (!optionId || !propertyId) {
    return { ok: false, error: "Missing rental." };
  }

  let trip: Trip | null = null;
  let enteredByName =
    input.enteredByName?.trim() ||
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    "";
  const enteredByUserId = session?.user?.id;

  if (input.slug?.trim()) {
    if (!session?.user?.id) return { ok: false, error: "Sign in required." };
    const access = await getTripForOrganizer(
      input.slug.trim(),
      session.user.id,
    );
    if (!access) return { ok: false, error: "Trip not found." };
    trip = access.trip;
  } else if (input.shareToken?.trim()) {
    trip = await getTripByShareToken(input.shareToken.trim());
    if (!trip) return { ok: false, error: "Link expired or invalid." };
    if (!enteredByName) enteredByName = "A family member";
  } else {
    return { ok: false, error: "Missing trip." };
  }

  if (!enteredByName) enteredByName = "Someone";

  return persistRateOnTrip(trip, {
    optionId,
    propertyId,
    nightlyRaw: input.nightlyRaw,
    feesRaw: input.feesRaw,
    sourceUrlRaw: input.sourceUrlRaw,
    enteredByName,
    enteredByUserId,
  });
}

/**
 * Email household reps a tokenized link to help enter rates (no account required).
 * Always returns the shareable priceUrl so the organizer can copy it when no emails exist.
 */
export async function askFamilyToPriceLodgingAction(
  slug: string,
  optionId: string,
): Promise<
  | { ok: true; sent: number; priceUrl: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const access = await getTripForOrganizer(slug, session.user.id);
  if (!access) return { ok: false, error: "Trip not found." };

  const { trip } = access;
  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const option = findLocationById(locations, optionId);
  if (!option) return { ok: false, error: "Place not found." };

  const lodging = normalizeLodgingBundle(option.lodging);
  const unpriced = lodging.properties.filter(
    (p) => p.pricing.kind === "unknown",
  );
  if (unpriced.length === 0) {
    return { ok: false, error: "Every rental already has a rate." };
  }

  const survey = await getSurveyByTripId(trip.id);
  const responses = survey ? await listSurveyResponses(survey.id) : [];
  const emails = [
    ...new Set(
      responses
        .map((r) => r.respondentEmail?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];

  const priceUrl = `${appOrigin()}/o/${trip.shareOptionsToken}/price/${optionId}`;
  const organizerName =
    session.user.name?.trim() || session.user.email?.trim() || "Your organizer";
  const placeName = option.title.split(",")[0]?.trim() || option.title;

  if (emails.length === 0) {
    return { ok: true, sent: 0, priceUrl };
  }

  let sent = 0;
  for (const to of emails) {
    const result = await sendLodgingPriceHelpEmail(to, {
      tripName: trip.name,
      placeName,
      organizerName,
      priceUrl,
      rentalNames: unpriced.map((p) => p.name).slice(0, 12),
    });
    if (result.ok) sent += 1;
  }

  return { ok: true, sent, priceUrl };
}
