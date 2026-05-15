import { notFound } from "next/navigation";

import { PlanConfirmationForm } from "@/components/PlanConfirmationForm";
import { PublicItineraryView } from "@/components/PublicItineraryView";
import { PublicVenuesShowcase } from "@/components/PublicVenuesShowcase";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import { normalizeVenueOptions } from "@/lib/venues";
import { itineraryHasContent, normalizeItinerary, type PublishedItinerary } from "@/lib/itinerary";
import { APP_NAME } from "@/lib/brand";
import { getTripByShareToken, listTripOptions } from "@/lib/supabase/queries";
import { formatWeekendLabel } from "@/lib/weekends";

export default async function PublicOptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { token } = await params;
  const { confirmed } = await searchParams;
  const trip = await getTripByShareToken(token);
  if (!trip) notFound();

  const options = await listTripOptions(trip.id);

  const publishedRaw = trip.publishedItinerary as PublishedItinerary | null;
  const published = publishedRaw
    ? ({ ...normalizeItinerary(publishedRaw), ...publishedRaw } as PublishedItinerary)
    : null;
  const showPublished = published && itineraryHasContent(published);

  const locationOptions = normalizeLocationOptions(trip.locationOptions ?? []);
  const lockedLocation = trip.selectedLocationId
    ? findLocationById(locationOptions, trip.selectedLocationId)
    : null;
  const weekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;
  const canConfirm = Boolean(trip.selectedLocationId && trip.selectedWeekendFriday);
  const venueOptions = normalizeVenueOptions(trip.venueOptions ?? []);

  return (
    <div className="shell page-public" style={{ maxWidth: "800px" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="pill">{APP_NAME} · Shared trip plan</p>
        <h1 style={{ color: "var(--color-fjord)", margin: "0.35rem 0" }}>{trip.name}</h1>
        {trip.tagline ? <p className="muted">{trip.tagline}</p> : null}
        <p className="muted">
          {showPublished
            ? "Browse the weekend plan below, then confirm if your crew is in."
            : "Here is what the planners saved for you to compare."}
        </p>
      </header>

      {confirmed ? (
        <div className="success-banner" style={{ marginBottom: "1rem" }}>
          Thanks! Your RSVP is saved—you can update it anytime on this page.
        </div>
      ) : null}

      {venueOptions.length > 0 ? (
        <PublicVenuesShowcase
          venues={venueOptions}
          selectedVenueId={trip.selectedVenueId}
          locationTitle={lockedLocation?.title ?? null}
        />
      ) : null}

      {venueOptions.length > 0 && (showPublished || options.length > 0) ? (
        <div className="divider" style={{ margin: "1.5rem 0" }} />
      ) : null}

      {showPublished ? (
        <PublicItineraryView published={published} />
      ) : options.length === 0 ? (
        <div className="card">
          <p className="muted">
            No published plan yet. The organizer may still be finalizing dates and
            activities—check back soon.
          </p>
        </div>
      ) : (
        <div className="stack">
          {options.map((opt, idx) => (
            <article key={opt.id} className="card">
              <p className="pill">Option {String.fromCharCode(65 + idx)}</p>
              <h2 style={{ marginTop: "0.5rem" }}>{opt.title}</h2>
              {opt.summary ? <p className="muted">{opt.summary}</p> : null}
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  marginTop: "1rem",
                  lineHeight: 1.55,
                }}
              >
                {opt.contentMarkdown}
              </pre>
            </article>
          ))}
        </div>
      )}

      <PlanConfirmationForm
        shareToken={token}
        weekendLabel={weekendLabel ?? "TBD"}
        locationTitle={lockedLocation?.title ?? "TBD"}
        canConfirm={canConfirm}
      />

      {showPublished && options.length > 0 ? (
        <>
          <div className="divider" style={{ margin: "2rem 0 1.25rem" }} />
          <h2 style={{ color: "var(--color-fjord)" }}>Other saved scenarios</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Earlier comparison options from the planners.
          </p>
          <div className="stack">
            {options.map((opt, idx) => (
              <article key={opt.id} className="card">
                <p className="pill">Option {String.fromCharCode(65 + idx)}</p>
                <h3 style={{ marginTop: "0.5rem" }}>{opt.title}</h3>
                {opt.summary ? <p className="muted">{opt.summary}</p> : null}
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    marginTop: "0.75rem",
                    lineHeight: 1.55,
                    fontSize: "0.9rem",
                  }}
                >
                  {opt.contentMarkdown}
                </pre>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
