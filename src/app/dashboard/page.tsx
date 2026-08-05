import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createTripAction } from "@/app/actions/trips";
import { TripDashboardManage } from "@/components/TripDashboardManage";
import { APP_TAGLINE } from "@/lib/brand";
import { claimTripInvitesForUser } from "@/lib/supabase/collaborators";
import { claimGuestSubmissionsForUser } from "@/lib/supabase/guestIdentity";
import { listGuestTripsForUser } from "@/lib/supabase/guestTrips";
import { listTripsForUser } from "@/lib/supabase/queries";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (session.user.email) {
    await claimTripInvitesForUser(session.user.id, session.user.email);
    await claimGuestSubmissionsForUser(session.user.id, session.user.email);
  }

  const list = await listTripsForUser(session.user.id);
  const invitations = await listGuestTripsForUser(
    session.user.id,
    session.user.email,
    list.map((t) => t.id),
  );

  const isGuestOnly = list.length === 0 && invitations.length > 0;
  const showPlanning = !isGuestOnly;
  const showInvitations = invitations.length > 0;

  return (
    <div className="shell dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">
          {isGuestOnly ? "Your invitations" : "Your trips"}
        </h1>
        <p className="muted dashboard-subtitle">{APP_TAGLINE}</p>
        {isGuestOnly ? (
          <p className="muted dashboard-lede">
            Answers are tied to <strong>{session.user.email}</strong> so you can
            come back anytime. This account doesn&apos;t include organizer
            tools—only family-facing pages from your invite links.
          </p>
        ) : (
          <p className="muted dashboard-lede">
            Each trip gets its own hub. Share surveys and ballots with family—your
            organizer view stays behind this magic-link login.
          </p>
        )}
      </header>

      {showInvitations ? (
        <section className="dashboard-section" aria-labelledby="invitations-heading">
          {!isGuestOnly ? (
            <h2 id="invitations-heading" className="dashboard-section-title">
              You&apos;re invited
            </h2>
          ) : (
            <h2 id="invitations-heading" className="sr-only">
              Invitations
            </h2>
          )}
          <ul className="participation-list">
            {invitations.map((item) => (
              <li key={item.tripId} className="participation-row">
                <div className="participation-row-main">
                  <div>
                    <strong className="participation-name">{item.tripName}</strong>
                    {item.tagline ? (
                      <p className="muted participation-tagline">{item.tagline}</p>
                    ) : null}
                  </div>
                  <span className="participation-stage">{item.stageLabel}</span>
                </div>
                <Link className="btn btn-primary btn-sm participation-cta" href={item.href}>
                  {item.ctaLabel}
                </Link>
              </li>
            ))}
          </ul>
          {isGuestOnly ? (
            <p className="muted dashboard-footnote">
              Planning the reunion yourself?{" "}
              <Link href="/login?callbackUrl=/dashboard">Sign in with a different email</Link>{" "}
              or ask the organizer to invite you as a co-planner.
            </p>
          ) : null}
        </section>
      ) : null}

      {showPlanning ? (
        <div className={`dashboard-planning${showInvitations ? " dashboard-planning--split" : ""}`}>
          {showInvitations ? (
            <h2 className="dashboard-section-title">Planning</h2>
          ) : null}
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
                            <span
                              className="pill"
                              style={{ marginLeft: "0.5rem", fontSize: "0.72rem" }}
                            >
                              Shared
                            </span>
                          ) : null}
                          {trip.tagline ? (
                            <p
                              className="muted"
                              style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}
                            >
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
      ) : null}
    </div>
  );
}
