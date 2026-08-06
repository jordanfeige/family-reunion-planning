"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  getLodging,
  lodgingResultToBundle,
} from "@/lib/lodging";
import {
  findLocationById,
  normalizeLocationOptions,
  type LocationOption,
} from "@/lib/locations";
import { weekendStayDates } from "@/lib/stayDates";
import {
  getTripForOrganizer,
  updateTripById,
} from "@/lib/supabase/queries";

async function hydrateOne(
  option: LocationOption,
  checkIn: string,
  checkOut: string,
  headcount: number,
): Promise<LocationOption> {
  const result = await getLodging({
    area: option.title,
    checkIn,
    checkOut,
    headcount: Math.max(1, headcount),
  });
  return {
    ...option,
    lodging: lodgingResultToBundle(result),
  };
}

/** Pull provider lodging for every shortlisted place (publish / refresh). */
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

  const next: LocationOption[] = [];
  for (const loc of locations) {
    next.push(await hydrateOne(loc, stay.checkIn, stay.checkOut, headcount));
  }

  await updateTripById(trip.id, { locationOptions: next });
  revalidatePath(`/t/${slug}`);
  for (const loc of next) {
    revalidatePath(`/t/${slug}/place/${loc.id}`);
  }
  return { ok: true, updated: next.length };
}

/** Refresh prices for one destination option. */
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
  const updated = await hydrateOne(
    option,
    stay.checkIn,
    stay.checkOut,
    headcount,
  );
  const next = locations.map((l) => (l.id === optionId ? updated : l));
  await updateTripById(trip.id, { locationOptions: next });
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/place/${optionId}`);
  return { ok: true };
}
