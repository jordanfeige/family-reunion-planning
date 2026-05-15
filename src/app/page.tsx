import Link from "next/link";

import { auth } from "@/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="shell" style={{ paddingBottom: "3rem" }}>
      <section style={{ padding: "2.5rem 0 1rem" }}>
        <p className="pill">{APP_NAME}</p>
        <h1
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
            lineHeight: 1.1,
            margin: "1rem 0",
            color: "var(--color-fjord)",
          }}
        >
          {APP_TAGLINE}
        </h1>
        <p className="muted" style={{ maxWidth: "36rem", fontSize: "1.05rem" }}>
          One place to plan reunions and family trips: send date surveys, co-plan
          with AI, share the itinerary, and collect final RSVPs—without the
          spreadsheet chaos.
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
            tell you how many adults and kids—no spreadsheets, no drama.
          </p>
        </div>
        <div className="card">
          <h2>AI trip co-pilot</h2>
          <p className="muted">
            Chat through destinations, budget, meals, and activities. Get a
            structured plan you can publish for the whole crew.
          </p>
        </div>
        <div className="card">
          <h2>Showcase & share</h2>
          <p className="muted">
            Lock your weekend, publish the day-by-day plan, and let family
            confirm yes or no on the same link.
          </p>
        </div>
        <div className="card">
          <h2>Memory lane gallery</h2>
          <p className="muted">
            After the trip, drop in photos or short clips so everyone can relive
            the best moments.
          </p>
        </div>
      </div>
    </div>
  );
}
