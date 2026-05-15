import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { submitSurveyResponseAction } from "@/app/actions/trips";
import { getDb } from "@/db";
import { surveys, trips } from "@/db/schema";

export default async function PublicSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ thanks?: string }>;
}) {
  const { token } = await params;
  const { thanks } = await searchParams;
  const db = getDb();

  const row = await db
    .select({ survey: surveys, trip: trips })
    .from(surveys)
    .innerJoin(trips, eq(surveys.tripId, trips.id))
    .where(eq(surveys.publicToken, token))
    .limit(1);

  const data = row[0];
  if (!data) notFound();

  const { survey, trip } = data;
  const slots = trip.proposedDateSlots ?? [];

  return (
    <div className="shell" style={{ maxWidth: "640px", padding: "2rem 1.25rem" }}>
      <div className="card">
        <p className="pill">Feige Gatherings RSVP</p>
        <h1 style={{ marginTop: "0.5rem", color: "var(--color-fjord)" }}>{survey.title}</h1>
        <p className="muted">
          Help plan <strong>{trip.name}</strong>. Pick the windows that work and
          tell us how many Feiges you are bringing.
        </p>

        {thanks ? (
          <div className="success-banner" style={{ marginBottom: "1rem" }}>
            Tusen takk! Your availability is in—happy planning, Feige fam.
          </div>
        ) : null}
        <form action={submitSurveyResponseAction} className="stack" style={{ marginTop: "1.25rem" }}>
          <input type="hidden" name="token" value={token} />
          <div className="field">
            <label htmlFor="name">Your name *</label>
            <input id="name" name="name" required placeholder="Jordan Feige" />
          </div>
          <div className="field">
            <label htmlFor="email">Email (optional)</label>
            <input id="email" name="email" type="email" placeholder="for reminders only" />
          </div>
          <div className="field">
            <label htmlFor="attendee_count">How many in your party?</label>
            <input
              id="attendee_count"
              name="attendee_count"
              type="number"
              min={1}
              defaultValue={1}
            />
          </div>

          <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-slate)" }}>
              Which options work?
            </legend>
            {slots.length === 0 ? (
              <p className="muted" style={{ marginTop: "0.35rem" }}>
                The organizer has not listed specific slots yet—leave a note
                below with what works for you.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
                {slots.map((slot) => (
                  <li key={slot} style={{ marginBottom: "0.5rem" }}>
                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                      <input type="checkbox" name="slot" value={slot} />
                      <span>{slot}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="field">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="We can only join Saturday daytime, but flexible on lodging."
            />
          </div>

          <button type="submit" className="btn btn-berry">
            Send my availability
          </button>
        </form>

        <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.85rem" }}>
          Need to change your answer later? Ask the organizer for a fresh link
          or have them nudge us to add edits—coming soon.
        </p>
      </div>
    </div>
  );
}
