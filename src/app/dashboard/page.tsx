import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createTripAction } from "@/app/actions/trips";
import { TripDashboardManage } from "@/components/TripDashboardManage";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { claimTripInvitesForUser } from "@/lib/supabase/collaborators";
import { listTripsForUser } from "@/lib/supabase/queries";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (session.user.email) {
    await claimTripInvitesForUser(session.user.id, session.user.email);
  }

  const list = await listTripsForUser(session.user.id);

  return (
    <div className="shell" style={{ padding: "1.5rem 1.25rem 3rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <p className="pill">{APP_NAME}</p>
        <h1 style={{ color: "var(--color-fjord)", margin: "0.5rem 0 0" }}>
          Your trips
        </h1>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.95rem" }}>
          {APP_TAGLINE}
        </p>
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
              <input id="name" name="name" required placeholder="Summer lake weekend" />
            </div>
            <div className="field">
              <label htmlFor="tagline">Tagline (optional)</label>
              <input
                id="tagline"
                name="tagline"
                placeholder="Salt air, silly games, serious open sandwiches"
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
                <li key={trip.id} className="trip-dashboard-item">
                  <div className="trip-dashboard-item-main">
                    <div>
                      <strong style={{ color: "var(--color-fjord)" }}>{trip.name}</strong>
                      {trip.access === "collaborator" ? (
                        <span className="pill" style={{ marginLeft: "0.5rem", fontSize: "0.72rem" }}>
                          Shared
                        </span>
                      ) : null}
                      {trip.tagline ? (
                        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                          {trip.tagline}
                        </p>
                      ) : null}
                    </div>
                    <div className="trip-dashboard-item-actions">
                      <Link className="btn btn-primary btn-sm" href={`/t/${trip.slug}`}>
                        Open hub
                      </Link>
                      <TripDashboardManage
                        slug={trip.slug}
                        tripName={trip.name}
                        access={trip.access}
                      />
                    </div>
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
