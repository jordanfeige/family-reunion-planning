import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addTripOptionAction,
  deleteGalleryItemAction,
  deleteTripOptionAction,
  updateTripBasicsAction,
} from "@/app/actions/trips";
import { auth } from "@/auth";
import { CopyButton } from "@/components/CopyButton";
import { GalleryUploader } from "@/components/GalleryUploader";
import { TripPlannerChat } from "@/components/TripPlannerChat";
import { getDb } from "@/db";
import {
  galleryItems,
  surveyResponses,
  surveys,
  tripOptions,
  trips,
} from "@/db/schema";
import { appOrigin } from "@/lib/appOrigin";

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

  const db = getDb();

  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.slug, slug))
    .limit(1);

  if (!trip || trip.ownerId !== session.user.id) {
    notFound();
  }

  const [survey] = await db
    .select()
    .from(surveys)
    .where(eq(surveys.tripId, trip.id))
    .limit(1);

  const options = await db
    .select()
    .from(tripOptions)
    .where(eq(tripOptions.tripId, trip.id))
    .orderBy(asc(tripOptions.sortOrder), asc(tripOptions.createdAt));

  const gallery = await db
    .select()
    .from(galleryItems)
    .where(eq(galleryItems.tripId, trip.id))
    .orderBy(desc(galleryItems.createdAt));

  const responses = survey
    ? await db
        .select({
          id: surveyResponses.id,
          respondentName: surveyResponses.respondentName,
          attendeeCount: surveyResponses.attendeeCount,
          selectedSlots: surveyResponses.selectedSlots,
          notes: surveyResponses.notes,
          submittedAt: surveyResponses.submittedAt,
        })
        .from(surveyResponses)
        .where(eq(surveyResponses.surveyId, survey.id))
        .orderBy(desc(surveyResponses.submittedAt))
    : [];

  const origin = appOrigin();
  const surveyUrl = survey ? `${origin}/r/${survey.publicToken}` : "";
  const shareUrl = `${origin}/o/${trip.shareOptionsToken}`;

  const totalAttendees = responses.reduce((sum, r) => sum + (r.attendeeCount ?? 0), 0);

  return (
    <div className="shell" style={{ padding: "1rem 1.25rem 3rem" }}>
      <nav className="row" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <Link href="/dashboard">← Dashboard</Link>
        <span className="muted">·</span>
        <a href="#details">Details</a>
        <a href="#survey">Survey</a>
        <a href="#planner">AI planner</a>
        <a href="#options">Trip options</a>
        <a href="#gallery">Gallery</a>
        <a href="#extras">Extras</a>
      </nav>

      <header style={{ marginBottom: "1.5rem" }}>
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

      <section id="details" className="card section-anchor" style={{ marginBottom: "1.25rem" }}>
        <h2>Trip details & date windows</h2>
        <p className="muted">
          Proposed slots power the RSVP checkboxes. One human-readable line per
          slot works great (example: “Fri Aug 8 · afternoon arrival”).
        </p>
        <form action={updateTripBasicsAction} className="stack" style={{ marginTop: "1rem" }}>
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
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="proposed_slots">Proposed date / time options (one per line)</label>
              <textarea
                id="proposed_slots"
                name="proposed_slots"
                defaultValue={(trip.proposedDateSlots ?? []).join("\n")}
                placeholder={"Fri Jul 18 · evening welcome dinner\nSat Jul 19 · all day adventure\nSun Jul 20 · brunch & hugs"}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Save details
          </button>
        </form>
      </section>

      <div className="grid-2">
        <section id="survey" className="card section-anchor">
          <h2>Survey link</h2>
          <p className="muted">
            Share this RSVP link with family—no login required. You will see
            responses below.
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
                      <strong>{r.respondentName}</strong> · {r.attendeeCount} attending
                      <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                        {(r.selectedSlots ?? []).length
                          ? `Picks: ${(r.selectedSlots ?? []).join(" · ")}`
                          : "No date checkboxes selected"}
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
        </section>

        <section id="planner" className="card section-anchor">
          <h2>Nordic co-planner</h2>
          <TripPlannerChat slug={trip.slug} tripName={trip.name} />
        </section>
      </div>

      <section id="options" className="card section-anchor" style={{ marginTop: "1.25rem" }}>
        <h2>Trip options · share with family</h2>
        <p className="muted">
          Save polished scenarios here (paste from the AI planner or write your
          own). The public link hides organizer controls—perfect for the group
          chat.
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
          <p className="muted">Nothing saved yet—start from the AI planner above.</p>
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
      </section>

      <section id="gallery" className="card section-anchor" style={{ marginTop: "1.25rem" }}>
        <h2>Memory lane gallery</h2>
        <p className="muted">
          Upload highlights after the trip (or during!). Videos should stay
          short for smooth loading.
        </p>
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
      </section>

      <section id="extras" className="card section-anchor" style={{ marginTop: "1.25rem" }}>
        <h2>Helpful extras</h2>
        <ul className="muted" style={{ lineHeight: 1.6 }}>
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
      </section>
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
