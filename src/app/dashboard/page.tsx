import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardToast } from "@/components/DashboardToast";
import { SoftImage } from "@/components/SoftImage";
import { TripDashboardCardActions } from "@/components/TripDashboardCardActions";
import { APP_TAGLINE } from "@/lib/brand";
import { dashboardTripCardMeta } from "@/lib/dashboardTripCard";
import { claimTripInvitesForUser } from "@/lib/supabase/collaborators";
import { claimGuestSubmissionsForUser } from "@/lib/supabase/guestIdentity";
import { listGuestTripsForUser } from "@/lib/supabase/guestTrips";
import { listTripsForUser } from "@/lib/supabase/queries";
import {
  getPlanDraftBySecret,
  readPlanDraftCookieSecret,
} from "@/lib/supabase/planDrafts";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const { deleted } = await searchParams;

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

  const secret = await readPlanDraftCookieSecret();
  const draft = secret ? await getPlanDraftBySecret(secret) : null;
  const hasDraft = Boolean(draft);

  const isGuestOnly = list.length === 0 && invitations.length > 0;
  const showPlanning = !isGuestOnly;
  const showInvitations = invitations.length > 0;

  return (
    <div className="shell dashboard-page">
      <DashboardToast
        message={deleted === "1" ? "Trip deleted." : null}
      />
      <header className="dashboard-header">
        <div className="dashboard-header-row">
          <div>
            <h1 className="dashboard-title">
              {isGuestOnly ? "Your invitations" : "Your trips"}
            </h1>
            <p className="muted dashboard-subtitle">{APP_TAGLINE}</p>
          </div>
          {showPlanning && list.length > 0 ? (
            <div className="dashboard-toolbar">
              {hasDraft ? (
                <a className="btn btn-secondary" href="/api/plan/start">
                  Resume draft
                </a>
              ) : null}
              <a className="btn btn-berry" href="/api/plan/start">
                + New trip
              </a>
            </div>
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
            Pick up where you left off in the hub, or start a new trip with WandrAI.
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
              <Link href="/login?callbackUrl=/dashboard">Sign in with a different Google account</Link>{" "}
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
              <div className="dashboard-toolbar dashboard-toolbar--empty">
                <div className="dashboard-empty">
                  <h2 className="dashboard-empty-title">Plan your next reunion</h2>
                  <p className="muted dashboard-empty-copy">
                    Chat with WandrAI to shape the trip, pick places, then build the plan.
                  </p>
                  {hasDraft ? (
                    <a className="btn btn-berry" href="/api/plan/start">
                      Resume your draft
                    </a>
                  ) : (
                    <a className="btn btn-berry" href="/api/plan/start">
                      Start with WandrAI
                    </a>
                  )}
                </div>
              </div>
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
              <ul className="dashboard-card-grid">
                {list.map((trip) => {
                  const card = dashboardTripCardMeta({
                    slug: trip.slug,
                    locationOptions: trip.locationOptions,
                    proposedDateSlots: trip.proposedDateSlots,
                    selectedLocationId: trip.selectedLocationId,
                    selectedWeekendFriday: trip.selectedWeekendFriday,
                    ballotStatus: trip.ballotStatus,
                    publishedItinerary: trip.publishedItinerary,
                    surveyResponseCount: trip.surveyResponseCount,
                    planHeadcount: trip.planHeadcount,
                  });
                  return (
                    <li key={trip.id} className="dashboard-card">
                      <Link href={card.href} className="dashboard-card-link">
                        <div className="dashboard-card-photo-wrap">
                          <SoftImage
                            src={card.photoUrl}
                            letter={trip.name}
                            className="dashboard-card-photo"
                          />
                          <span className="dashboard-card-status-chip">
                            {card.statusPrimary} · {card.statusSecondary}
                          </span>
                        </div>
                        <div className="dashboard-card-body">
                          <h3 className="dashboard-card-name">{trip.name}</h3>
                          {trip.access === "collaborator" ? (
                            <span className="pill dashboard-card-pill">Shared</span>
                          ) : null}
                          <p className="dashboard-card-meta muted">
                            {[card.dateRangeLabel, card.householdLabel]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <div
                            className="dashboard-card-progress"
                            aria-label={`${card.filledSegments} of 5 steps complete`}
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span
                                key={i}
                                className={`dashboard-card-progress-seg${i < card.filledSegments ? " is-filled" : ""}`}
                              />
                            ))}
                          </div>
                        </div>
                      </Link>
                      <div className="dashboard-card-foot">
                        <Link className="btn btn-primary btn-sm" href={card.href}>
                          {card.ctaLabel}
                        </Link>
                        <TripDashboardCardActions
                          slug={trip.slug}
                          tripName={trip.name}
                          access={trip.access}
                        />
                      </div>
                    </li>
                  );
                })}
                <li className="dashboard-card dashboard-card--new">
                  <a href="/api/plan/start" className="dashboard-card-new-link">
                    <span className="dashboard-card-new-title">Start something new</span>
                    <span className="muted dashboard-card-new-copy">A prompt is enough</span>
                  </a>
                </li>
              </ul>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
