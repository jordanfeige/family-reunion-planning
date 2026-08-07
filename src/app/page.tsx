import { auth } from "@/auth";
import { HomeExperience } from "@/components/HomeExperience";
import { getHomeFallthrough } from "@/lib/homeFallthrough";
import { geocodeArea } from "@/lib/lodging/geocode";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import {
  householdCountForTripCapabilities,
  planCapabilities,
} from "@/lib/planMode";
import { getUserById, listTripsForUser } from "@/lib/supabase/collaborators";
import {
  getSurveyByTripId,
  getTripBySlug,
  listSurveyResponses,
} from "@/lib/supabase/queries";
import { formatDateRangeUS } from "@/lib/units";
import { parseFridayIso, sundayFromFriday } from "@/lib/weekends";

export default async function HomePage() {
  const session = await auth();
  let locationLabel: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  let activeTrip: {
    name: string;
    href: string;
    meta: string;
    blocker: string | null;
    remindHref?: string | null;
  } | null = null;

  if (session?.user?.id) {
    try {
      const user = await getUserById(session.user.id);
      if (user?.home_city) {
        const state = user.home_state?.trim();
        locationLabel = state
          ? `${user.home_city.trim()}, ${state.toUpperCase().slice(0, 2)}`
          : user.home_city.trim();
        const geo = await geocodeArea(locationLabel);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          locationLabel = geo.label || locationLabel;
        }
      }
    } catch {
      locationLabel = null;
    }

    try {
      const trips = await listTripsForUser(session.user.id);
      const first = trips[0];
      if (first) {
        const trip = await getTripBySlug(first.slug);
        if (trip) {
          const places = normalizeLocationOptions(trip.locationOptions);
          const leading = trip.selectedLocationId
            ? findLocationById(places, trip.selectedLocationId)
            : places[0];
          const friday =
            trip.selectedWeekendFriday ?? trip.proposedDateSlots?.[0] ?? null;
          let dates = "";
          if (friday) {
            const fri = parseFridayIso(friday);
            const sun = sundayFromFriday(friday);
            if (fri && sun) dates = formatDateRangeUS(fri, sun);
          }
          const survey = await getSurveyByTripId(trip.id);
          const responses = survey
            ? await listSurveyResponses(survey.id)
            : [];
          const responseCount = responses.length;
          const caps = planCapabilities({
            householdCount: householdCountForTripCapabilities({
              surveyResponseCount: responseCount,
              planHeadcount: trip.planHeadcount,
            }),
            headcount: trip.planHeadcount,
          });

          let blocker: string | null = null;
          let remindHref: string | null = null;
          if (caps.survey && survey && responseCount === 0) {
            blocker = "No replies yet";
            remindHref = `/t/${trip.slug}?stop=survey`;
          } else if (caps.nudges && survey && responseCount > 0 && responseCount < 3) {
            const pending = 3 - responseCount;
            blocker = `${pending} haven't replied`;
            remindHref = `/t/${trip.slug}?stop=survey`;
          } else if (!leading) {
            blocker = "No places yet";
          }

          const metaBits = [dates, leading?.title].filter(Boolean);
          activeTrip = {
            name: trip.name?.trim() || "Name this later",
            href: `/t/${trip.slug}`,
            meta: metaBits.join(" · ") || "In progress",
            blocker,
            remindHref,
          };
        }
      }
    } catch {
      activeTrip = null;
    }
  }

  let fallthrough: Awaited<ReturnType<typeof getHomeFallthrough>> = [];
  if (locationLabel && lat != null && lng != null) {
    try {
      fallthrough = await getHomeFallthrough(locationLabel, lat, lng);
    } catch {
      fallthrough = [];
    }
  }

  return (
    <HomeExperience
      locationLabel={locationLabel}
      activeTrip={activeTrip}
      fallthrough={fallthrough}
    />
  );
}
