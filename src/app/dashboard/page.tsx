import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createTripAction } from "@/app/actions/trips";
import { getDb } from "@/db";
import { trips } from "@/db/schema";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const db = getDb();
  const list = await db
    .select({
      id: trips.id,
      name: trips.name,
      slug: trips.slug,
      tagline: trips.tagline,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.ownerId, session.user.id))
    .orderBy(desc(trips.createdAt));

  return (
    <div className="shell" style={{ padding: "1.5rem 1.25rem 3rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <p className="pill">Dashboard · Planlegg</p>
        <h1 style={{ color: "var(--color-fjord)", margin: "0.5rem 0 0" }}>
          Your gatherings
        </h1>
        <p className="muted" style={{ maxWidth: "40rem" }}>
          Each trip gets its own secret link. Share surveys and option decks
          publicly—your organizer view stays behind this magic-link login.
        </p>
      </header>

      <div className="grid-2">
        <div className="card section-anchor" id="new">
          <h2>Plan a new trip</h2>
          <p className="muted">
            Give it a spark of a name. You can tune dates, budgets, and survey
            windows inside the trip hub.
          </p>
          <form action={createTripAction} className="stack" style={{ marginTop: "1rem" }}>
            <div className="field">
              <label htmlFor="name">Trip name *</label>
              <input id="name" name="name" required placeholder="Feige fjord weekend" />
            </div>
            <div className="field">
              <label htmlFor="tagline">Tagline (optional)</label>
              <input
                id="tagline"
                name="tagline"
                placeholder="Salt air, silly games, serious smørrebrød"
              />
            </div>
            <div className="field">
              <label htmlFor="destination">Destination ideas (optional)</label>
              <textarea
                id="destination"
                name="destination"
                placeholder="Bergen? Lofoten? Grandma's lake house?"
              />
            </div>
            <div className="field">
              <label htmlFor="budget">Budget note (optional)</label>
              <input id="budget" name="budget" placeholder="$800–1200 per household" />
            </div>
            <button type="submit" className="btn btn-berry">
              Create trip hub
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Active trips</h2>
          {list.length === 0 ? (
            <p className="muted">
              No trips yet—start one on the left. Your first survey link will be
              ready instantly.
            </p>
          ) : (
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {list.map((trip) => (
                <li
                  key={trip.id}
                  style={{
                    border: "1px solid rgba(28,61,90,0.1)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ color: "var(--color-fjord)" }}>{trip.name}</strong>
                      {trip.tagline ? (
                        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                          {trip.tagline}
                        </p>
                      ) : null}
                    </div>
                    <Link className="btn btn-primary" href={`/t/${trip.slug}`}>
                      Open hub
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
