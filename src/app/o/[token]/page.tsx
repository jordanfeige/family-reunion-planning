import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import { tripOptions, trips } from "@/db/schema";

export default async function PublicOptionsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.shareOptionsToken, token))
    .limit(1);

  if (!trip) notFound();

  const options = await db
    .select()
    .from(tripOptions)
    .where(eq(tripOptions.tripId, trip.id))
    .orderBy(asc(tripOptions.sortOrder), asc(tripOptions.createdAt));

  return (
    <div className="shell" style={{ padding: "2rem 1.25rem 3rem", maxWidth: "800px" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="pill">Shared trip deck · read only</p>
        <h1 style={{ color: "var(--color-fjord)", margin: "0.35rem 0" }}>{trip.name}</h1>
        {trip.tagline ? <p className="muted">{trip.tagline}</p> : null}
        <p className="muted">
          The Feige crew is comparing a few vibes—here is what the planners saved
          for you. Reply in the family thread with your favorite letter.
        </p>
      </header>

      {options.length === 0 ? (
        <div className="card">
          <p className="muted">
            No published scenarios yet. Poke the organizer—they might still be
            sipping coffee and debating fjord vs forest.
          </p>
        </div>
      ) : (
        <div className="stack">
          {options.map((opt, idx) => (
            <article key={opt.id} className="card">
              <p className="pill">
                Option {String.fromCharCode(65 + idx)}
              </p>
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
    </div>
  );
}
