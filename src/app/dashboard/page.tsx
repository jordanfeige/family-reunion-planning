import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CreateTripLauncher } from "@/components/CreateTripSheet";
import { TripDashboardManage } from "@/components/TripDashboardManage";
import { hasAnthropicApiKey } from "@/lib/ai";
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
  const aiEnabled = hasAnthropicApiKey();

  return (
    <div className="shell dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-row">
          <div>
            <h1 className="dashboard-title">
              {isGuestOnly ? "Your invitations" : "Your trips"}
            </h1>
            <p className="muted dashboard-subtitle">{APP_TAGLINE}</p>
          </div>
          {showPlanning && list.length > 0 ? (
            <CreateTripLauncher aiEnabled={aiEnabled} hasTrips />
          ) : null}
        </div>
        {isGuestOnly ? (
          <p className="muted dashboard-lede">
            Answers are tied to <strong>{session.user.email}</strong> so you can
            come back anytime. This account doesn&apos;t include organizer
            tools—only family-facing pages from your invite links.
          </p>
        ) : list.length > 0 ? (
          <p className="muted dashboard-lede">
            Open a hub to plan, or start a new trip with WandrAI.
          </p>
        ) : null}
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
        <section className="dashboard-section" aria-labelledby="planning-heading">
          {list.length === 0 ? (
            <>
              <h2 id="planning-heading" className="sr-only">
                Plan a trip
              </h2>
              <CreateTripLauncher aiEnabled={aiEnabled} hasTrips={false} />
            </>
          ) : (
            <>
              {showInvitations ? (
                <h2 id="planning-heading" className="dashboard-section-title">
                  Planning
                </h2>
              ) : (
                <h2 id="planning-heading" className="sr-only">
                  Active trips
                </h2>
              )}
              <ul className="trip-list">
                {list.map((trip) => (
                  <li key={trip.id} className="trip-list-row">
                    <div className="trip-list-main">
                      <div>
                        <strong className="trip-list-name">{trip.name}</strong>
                        {trip.access === "collaborator" ? (
                          <span className="pill trip-list-pill">Shared</span>
                        ) : null}
                        {trip.tagline ? (
                          <p className="muted trip-list-tagline">{trip.tagline}</p>
                        ) : null}
                      </div>
                      <div className="trip-list-actions">
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
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
