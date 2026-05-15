import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addTripOptionAction,
  deleteGalleryItemAction,
  deleteSurveyResponseAction,
  deleteTripOptionAction,
  updateTripBasicsAction,
} from "@/app/actions/trips";
import { auth } from "@/auth";
import { AvailabilitySnapshot } from "@/components/AvailabilitySnapshot";
import { CopyButton } from "@/components/CopyButton";
import { GalleryUploader } from "@/components/GalleryUploader";
import { LocationOptionsManager } from "@/components/LocationOptionsManager";
import { PlanConfirmationSnapshot } from "@/components/PlanConfirmationSnapshot";
import { TripDecisionBar } from "@/components/TripDecisionBar";
import { TripHubWizard } from "@/components/TripHubWizard";
import { TripItineraryPanel } from "@/components/TripItineraryPanel";
import { TripPlannerChat } from "@/components/TripPlannerChat";
import { WeekendDatePicker } from "@/components/WeekendDatePicker";
import {
  getOwnedTripBySlug,
  getSurveyByTripId,
  listGalleryItems,
  listSurveyResponses,
  listTripConfirmations,
  listTripOptions,
} from "@/lib/supabase/queries";
import { appOrigin } from "@/lib/appOrigin";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import { itineraryHasContent, normalizeItinerary } from "@/lib/itinerary";
import { partyAdults, partyKids, partyTotal } from "@/lib/partyCount";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

export default async function TripHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${slug}`)}`);
  }

  const trip = await getOwnedTripBySlug(slug, session.user.id);
  if (!trip) notFound();

  const survey = await getSurveyByTripId(trip.id);
  const options = await listTripOptions(trip.id);
  const gallery = await listGalleryItems(trip.id);
  const responses = survey ? await listSurveyResponses(survey.id) : [];
  const confirmations = await listTripConfirmations(trip.id);

  const origin = appOrigin();
  const surveyUrl = survey ? `${origin}/r/${survey.publicToken}` : "";
  const shareUrl = `${origin}/o/${trip.shareOptionsToken}`;

  const weekendSlots = filterValidFridays(trip.proposedDateSlots ?? []);
  const locationOptions = normalizeLocationOptions(trip.locationOptions ?? []);
  const totalAttendees = responses.reduce((sum, r) => sum + partyTotal(r), 0);
  const lockedLocationTitle = trip.selectedLocationId
    ? findLocationById(locationOptions, trip.selectedLocationId)?.title ?? null
    : null;
  const lockedWeekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;
  const hasPublishedPlan = itineraryHasContent(
    normalizeItinerary(trip.publishedItinerary, trip.selectedWeekendFriday),
  );
  const hasDraftItinerary = itineraryHasContent(
    normalizeItinerary(trip.itinerary, trip.selectedWeekendFriday),
  );

  return (
    <div className="shell" style={{ padding: "1rem 1.25rem 3rem" }}>
      <nav className="row hub-jump-nav" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <Link href="/dashboard">← Dashboard</Link>
      </nav>

      <header className="trip-hub-header" style={{ marginBottom: "1rem" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="pill">Trip hub · {trip.slug}</p>
            <h1 style={{ color: "var(--color-fjord)", margin: "0.35rem 0" }}>{trip.name}</h1>
            {trip.tagline ? <p className="muted">{trip.tagline}</p> : null}
          </div>
          {trip.tripStart ? (
            <span className="pill">
              Target start:{" "}
              {trip.tripStart.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          ) : null}
        </div>
      </header>

      <TripHubWizard
        slug={trip.slug}
        completion={{
          basics: weekendSlots.length > 0,
          locations: locationOptions.length > 0,
          survey: responses.length > 0,
          blueprint: Boolean(
            trip.selectedLocationId && trip.selectedWeekendFriday && hasDraftItinerary,
          ),
          share: hasPublishedPlan || options.length > 0,
        }}
        basics={
        <form action={updateTripBasicsAction} className="stack">
          <input type="hidden" name="slug" value={trip.slug} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Trip name</label>
              <input id="name" name="name" defaultValue={trip.name} required />
            </div>
            <div className="field">
              <label htmlFor="tagline">Tagline</label>
              <input id="tagline" name="tagline" defaultValue={trip.tagline ?? ""} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="destination">Destination ideas</label>
              <textarea
                id="destination"
                name="destination"
                defaultValue={trip.destinationNotes ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="budget">Budget note</label>
              <input id="budget" name="budget" defaultValue={trip.targetBudget ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="trip_start">Target start</label>
              <input
                id="trip_start"
                name="trip_start"
                type="datetime-local"
                defaultValue={toLocalInput(trip.tripStart)}
              />
            </div>
            <div className="field">
              <label htmlFor="trip_end">Target end</label>
              <input
                id="trip_end"
                name="trip_end"
                type="datetime-local"
                defaultValue={toLocalInput(trip.tripEnd)}
              />
            </div>
            <WeekendDatePicker defaultSelected={weekendSlots} />
          </div>
          <button type="submit" className="btn btn-primary btn-block-sm">
            Save details
          </button>
        </form>
        }
        locations={
        <div className="stack">
          <TripPlannerChat slug={trip.slug} tripName={trip.name} defaultMode="locations" />
          <div className="divider" />
          <h3 style={{ marginTop: 0, color: "var(--color-fjord)" }}>Survey location options</h3>
          <LocationOptionsManager slug={trip.slug} locations={locationOptions} />
        </div>
        }
        survey={
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Share this RSVP link with family—no login required. Works great on phones.
          </p>
          {survey ? (
            <>
              <p className="mono" style={{ marginTop: "0.75rem" }}>
                {surveyUrl}
              </p>
              <div className="row" style={{ marginTop: "0.75rem" }}>
                <CopyButton text={surveyUrl} label="Copy survey link" />
              </div>
              <div className="divider" />
              <h3 style={{ marginTop: 0 }}>Responses ({responses.length})</h3>
              {responses.length === 0 ? (
                <p className="muted">Waiting for the first RSVPs…</p>
              ) : (
                <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {responses.map((r) => (
                    <li
                      key={r.id}
                      style={{
                        border: "1px solid rgba(28,61,90,0.1)",
                        borderRadius: "var(--radius-md)",
                        padding: "0.75rem 1rem",
                      }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", gap: "0.75rem" }}>
                        <strong>
                          {r.respondentName} · {partyAdults(r)} adult
                          {partyAdults(r) === 1 ? "" : "s"}
                          {partyKids(r) > 0
                            ? `, ${partyKids(r)} kid${partyKids(r) === 1 ? "" : "s"}`
                            : ""}
                        </strong>
                        <form action={deleteSurveyResponseAction}>
                          <input type="hidden" name="slug" value={trip.slug} />
                          <input type="hidden" name="response_id" value={r.id} />
                          <button
                            type="submit"
                            className="btn btn-secondary"
                            style={{ fontSize: "0.8rem" }}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                      {(r.selectedLocations ?? []).length > 0 ? (
                        <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                          Locations:{" "}
                          {(r.selectedLocations ?? [])
                            .map((id) => findLocationById(locationOptions, id)?.title ?? id)
                            .join(" · ")}
                        </div>
                      ) : null}
                      <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                        {(r.selectedSlots ?? []).length
                          ? `Weekends: ${(r.selectedSlots ?? [])
                              .map((s) => formatWeekendLabel(s))
                              .join(" · ")}`
                          : "No weekends selected"}
                      </div>
                      {r.notes ? (
                        <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                          Note: {r.notes}
                        </div>
                      ) : null}
                      <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
                        {r.submittedAt?.toLocaleString?.() ?? ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
                Headcount running total (self-reported):{" "}
                <strong>{totalAttendees}</strong>
              </p>
            </>
          ) : (
            <p className="muted">Survey record missing—contact support.</p>
          )}
          <div className="divider" />
          <h3 style={{ marginTop: 0, color: "var(--color-fjord)" }}>Availability snapshot</h3>
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>
            Live rollup from RSVPs—use when locking a weekend in the blueprint step.
          </p>
          <AvailabilitySnapshot proposedSlots={weekendSlots} responses={responses} />
        </div>
        }
        blueprint={
        <div className="stack">
        <TripDecisionBar
          slug={trip.slug}
          locations={locationOptions}
          weekendSlots={weekendSlots}
          responses={responses}
          selectedLocationId={trip.selectedLocationId}
          selectedWeekendFriday={trip.selectedWeekendFriday}
          planHeadcount={trip.planHeadcount}
        />
        <PlanConfirmationSnapshot
          confirmations={confirmations.map((c) => ({
            ...c,
            status: c.status as "confirmed" | "declined",
          }))}
          weekendFriday={trip.selectedWeekendFriday}
          locationId={trip.selectedLocationId}
          locationTitle={lockedLocationTitle}
          weekendLabel={lockedWeekendLabel}
        />
        <div className="divider" />
        <TripItineraryPanel
          slug={trip.slug}
          shareUrl={shareUrl}
          itineraryRaw={trip.itinerary}
          selectedWeekendFriday={trip.selectedWeekendFriday}
          hasPlanContext={Boolean(
            trip.selectedLocationId && trip.selectedWeekendFriday,
          )}
          isPublished={hasPublishedPlan}
        />
        </div>
        }
        share={
        <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          Publish your itinerary in the blueprint step, then share this link with family.
        </p>
        <p className="mono" style={{ marginTop: "0.75rem" }}>
          {shareUrl}
        </p>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <CopyButton text={shareUrl} label="Copy share link" />
          <Link className="btn btn-secondary" href={`/o/${trip.shareOptionsToken}`} target="_blank">
            Preview public page
          </Link>
        </div>

        <div className="divider" />

        <h3 style={{ marginTop: 0 }}>Add a saved option</h3>
        <form action={addTripOptionAction} className="stack">
          <input type="hidden" name="slug" value={trip.slug} />
          <div className="field">
            <label htmlFor="opt_title">Title</label>
            <input id="opt_title" name="title" required placeholder="Scenario A · Fjord calm" />
          </div>
          <div className="field">
            <label htmlFor="opt_summary">One-line pitch</label>
            <input id="opt_summary" name="summary" placeholder="Slow mornings, big dinners, one hike" />
          </div>
          <div className="field">
            <label htmlFor="opt_content">Full breakdown</label>
            <textarea
              id="opt_content"
              name="content"
              required
              placeholder={"## Day 1\n- ...\n\n## Budget notes\n- ..."}
            />
          </div>
          <button type="submit" className="btn btn-berry">
            Save option
          </button>
        </form>

        <div className="divider" />

        <h3>Your saved options</h3>
        {options.length === 0 ? (
          <p className="muted">Nothing saved yet—start from WandrAI in the Locations step.</p>
        ) : (
          <div className="stack">
            {options.map((opt) => (
              <article
                key={opt.id}
                style={{
                  border: "1px solid rgba(28,61,90,0.12)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  background: "#fff",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h4 style={{ margin: 0, color: "var(--color-fjord)" }}>{opt.title}</h4>
                  <form action={deleteTripOptionAction}>
                    <input type="hidden" name="slug" value={trip.slug} />
                    <input type="hidden" name="option_id" value={opt.id} />
                    <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
                      Remove
                    </button>
                  </form>
                </div>
                {opt.summary ? <p className="muted">{opt.summary}</p> : null}
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    margin: "0.75rem 0 0",
                    lineHeight: 1.5,
                  }}
                >
                  {opt.contentMarkdown}
                </pre>
              </article>
            ))}
          </div>
        )}
        </div>
        }
        more={
        <div className="stack">
        <GalleryUploader slug={trip.slug} />
        <div className="divider" />
        <div
          className="grid-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {gallery.map((item) => (
            <figure
              key={item.id}
              style={{
                margin: 0,
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid rgba(28,61,90,0.1)",
                background: "#fff",
              }}
            >
              {item.mediaType === "video" ? (
                <video src={item.url} controls style={{ width: "100%", display: "block" }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption ?? ""} style={{ width: "100%", display: "block" }} />
              )}
              <figcaption style={{ padding: "0.65rem", fontSize: "0.85rem" }}>
                {item.caption ?? <span className="muted">No caption</span>}
                <form action={deleteGalleryItemAction} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="slug" value={trip.slug} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
                    Remove
                  </button>
                </form>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="divider" />
        <h3 style={{ marginTop: 0, color: "var(--color-fjord)" }}>Helpful extras</h3>
        <ul className="muted" style={{ lineHeight: 1.6, margin: 0, paddingLeft: "1.1rem" }}>
          <li>
            <strong>Weather sanity check:</strong> add a 10-day forecast peek the
            week before—Norwegian coasts love a plot twist.
          </li>
          <li>
            <strong>Dietary map:</strong> keep a running note of allergies in the
            trip description so chefs and AI suggestions stay kind.
          </li>
          <li>
            <strong>Shared kitty:</strong> decide if you are splitting a cabin,
            groceries, or rides—surface that in your trip option write-ups.
          </li>
          <li>
            <strong>After the hugs:</strong> export your gallery as a shared album
            backup—this hub stays your living scrapbook.
          </li>
        </ul>
        </div>
        }
      />
    </div>
  );
}

function toLocalInput(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
