import Link from "next/link";

import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="shell" style={{ paddingBottom: "3rem" }}>
      <section style={{ padding: "2.5rem 0 1rem" }}>
        <p className="pill">Hei, Feige-familien</p>
        <h1
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
            lineHeight: 1.1,
            margin: "1rem 0",
            color: "var(--color-fjord)",
          }}
        >
          Gatherings that feel like{" "}
          <span style={{ color: "var(--color-berry)" }}>Norwegian summer</span>
          —bright, breezy, unforgettable.
        </h1>
        <p className="muted" style={{ maxWidth: "36rem", fontSize: "1.05rem" }}>
          One link for your dashboard: send date surveys, riff with an AI
          co-planner on food and fun, save trip scenarios to share, and stash
          photos when the hugs actually happen.
        </p>
        <div className="row" style={{ marginTop: "1.75rem" }}>
          {session?.user ? (
            <Link className="btn btn-primary" href="/dashboard">
              Go to your dashboard
            </Link>
          ) : (
            <Link className="btn btn-primary" href="/login">
              Start with a magic link
            </Link>
          )}
          <Link className="btn btn-secondary" href="/login">
            How sign-in works
          </Link>
        </div>
      </section>

      <div className="grid-2" style={{ marginTop: "2.5rem" }}>
        <div className="card section-anchor" id="survey">
          <h2>Date pulse surveys</h2>
          <p className="muted">
            Ship a friendly RSVP link. Loved ones tick the windows that work and
            tell you how many seats they need—no spreadsheets, no drama.
          </p>
        </div>
        <div className="card">
          <h2>AI trip co-pilot</h2>
          <p className="muted">
            Chat through destination, budget, bites, hikes, and reservations.
            Get a structured breakdown you can save as shareable “trip
            options” for the group chat.
          </p>
        </div>
        <div className="card">
          <h2>Showcase & share</h2>
          <p className="muted">
            Curate a few scenarios—from cabin cozy to city sparkle—and publish a
            read-only link so cousins can compare before anyone books flights.
          </p>
        </div>
        <div className="card">
          <h2>Memory lane gallery</h2>
          <p className="muted">
            After the reunion, drop in photos or short clips so the youngest
            Feiges can scroll the story for years to come.
          </p>
        </div>
      </div>
    </div>
  );
}
