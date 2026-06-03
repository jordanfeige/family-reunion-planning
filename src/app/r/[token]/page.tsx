import { notFound } from "next/navigation";

import { submitSurveyResponseAction } from "@/app/actions/trips";
import { auth } from "@/auth";
import { GuestSaveSignIn, GuestSignedInBanner } from "@/components/GuestSaveSignIn";
import { PublicSurveyForm } from "@/components/PublicSurveyForm";
import { guestSessionFromUser } from "@/lib/guestSession";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import { APP_NAME } from "@/lib/brand";
import { appOrigin } from "@/lib/appOrigin";
import { itineraryHasContent, normalizeItinerary, type PublishedItinerary } from "@/lib/itinerary";
import { getSurveyNextSteps } from "@/lib/surveyNextSteps";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";
import { SurveyNextSteps } from "@/components/SurveyNextSteps";
import {
  getSurveyAndTripByPublicToken,
  getSurveyResponseByUserId,
} from "@/lib/supabase/queries";

export default async function PublicSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ thanks?: string; emailed?: string }>;
}) {
  const { token } = await params;
  const { thanks, emailed } = await searchParams;
  const data = await getSurveyAndTripByPublicToken(token);
  if (!data) notFound();

  const session = await auth();
  const guestSession = guestSessionFromUser(session?.user ?? {});
  const callbackUrl = `${appOrigin()}/r/${token}`;

  const { survey, trip } = data;
  const existingResponse =
    guestSession != null
      ? await getSurveyResponseByUserId(survey.id, guestSession.userId)
      : null;
  const slots = filterValidFridays(trip.proposedDateSlots ?? []);
  const locations = normalizeLocationOptions(trip.locationOptions ?? []);
  const planReady = Boolean(trip.selectedLocationId && trip.selectedWeekendFriday);
  const publishedRaw = trip.publishedItinerary as PublishedItinerary | null;
  const planPublished = Boolean(
    publishedRaw && itineraryHasContent(normalizeItinerary(publishedRaw)),
  );
  const lockedLocation = trip.selectedLocationId
    ? findLocationById(locations, trip.selectedLocationId)
    : null;
  const lockedWeekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;
  const planUrl = `${appOrigin()}/o/${trip.shareOptionsToken}`;
  const voteUrl = `${appOrigin()}/r/${token}/vote`;
  const nextSteps = getSurveyNextSteps({
    planReady,
    planPublished,
    lockedLocationTitle: lockedLocation?.title ?? null,
    lockedWeekendLabel,
    ballotOpen: trip.ballotStatus === "open",
    submitted: Boolean(thanks),
  });

  return (
    <div className="shell page-narrow page-public">
      <div className="card">
        <p className="pill">{APP_NAME} · Planning survey</p>
        <h1 style={{ marginTop: "0.5rem", color: "var(--color-fjord)" }}>{survey.title}</h1>
        <p className="muted">
          Help plan <strong>{trip.name}</strong>. Vote on locations and weekends that
          work for your crew, and tell us who is coming.
        </p>

        {thanks ? (
          <div className="success-banner" style={{ marginBottom: "1rem" }}>
            Thank you! Your availability is in—happy planning.
            {emailed ? " We also emailed you a copy of your responses." : ""}
          </div>
        ) : null}

        {thanks ? (
          <>
            <SurveyNextSteps
              steps={nextSteps}
              planUrl={planUrl}
              showPlanLink={planReady}
            />
            {trip.ballotStatus === "open" ? (
              <p style={{ marginTop: "1rem" }}>
                <a href={voteUrl} className="btn btn-primary btn-block-sm">
                  Vote on stays, meals & activities
                </a>
              </p>
            ) : null}
          </>
        ) : null}

        {!thanks ? (
          <>
            {guestSession ? (
              <GuestSignedInBanner email={guestSession.email} />
            ) : (
              <GuestSaveSignIn callbackUrl={callbackUrl} />
            )}
            <PublicSurveyForm
              action={submitSurveyResponseAction}
              token={token}
              tripName={trip.name}
              slots={slots}
              locations={locations}
              nextSteps={nextSteps}
              planUrl={planUrl}
              showPlanLink={planReady}
              guestSession={guestSession}
              initialResponse={
                existingResponse
                  ? {
                      respondentName: existingResponse.respondentName,
                      respondentEmail: existingResponse.respondentEmail,
                      adultCount: existingResponse.adultCount,
                      kidCount: existingResponse.kidCount,
                      notes: existingResponse.notes,
                      selectedLocations: existingResponse.selectedLocations,
                      selectedSlots: existingResponse.selectedSlots,
                    }
                  : null
              }
            />
          </>
        ) : null}

        {thanks && guestSession ? (
          <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.85rem" }}>
            You can return to this page anytime while signed in to update your answers.
          </p>
        ) : null}
      </div>
    </div>
  );
}
