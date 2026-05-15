import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addTripOptionAction,
  deleteSurveyResponseAction,
  deleteTripOptionAction,
  updateTripBasicsAction,
} from "@/app/actions/trips";
import { auth } from "@/auth";
import { AvailabilitySnapshot } from "@/components/AvailabilitySnapshot";
import { CopyButton } from "@/components/CopyButton";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { LocationOptionsManager } from "@/components/LocationOptionsManager";
import { PlanConfirmationSnapshot } from "@/components/PlanConfirmationSnapshot";
import { TripCollaborators } from "@/components/TripCollaborators";
import { TripDecisionBar } from "@/components/TripDecisionBar";
import { TripGallerySection } from "@/components/TripGallerySection";
import { TripHubMenu } from "@/components/TripHubMenu";
import { TripHubWizard } from "@/components/TripHubWizard";
import { TripOwnerManagePanel } from "@/components/TripOwnerManagePanel";
import { TripItineraryPanel } from "@/components/TripItineraryPanel";
import { TripBallotControls } from "@/components/TripBallotControls";
import { TripVenueSection } from "@/components/TripVenueSection";
import { tallyBallotVotes, countDistinctVoters } from "@/lib/ballotResults";
import { listBallotVotesForTrip } from "@/lib/supabase/ballotVotes";
import { ballotOptionsForVoting } from "@/lib/venues";
import { TripPlannerChat } from "@/components/TripPlannerChat";
import { WeekendDatePicker } from "@/components/WeekendDatePicker";
import {
  getTripForOrganizer,
  getSurveyByTripId,
  listGalleryItems,
  listSurveyResponses,
  listTripConfirmations,
  listTripOptions,
} from "@/lib/supabase/queries";
import {
  claimTripInvitesForUser,
  getUserById,
  listTripInvites,
  listTripMembers,
} from "@/lib/supabase/collaborators";
import { appOrigin } from "@/lib/appOrigin";
import { findLocationById, normalizeLocationOptions } from "@/lib/locations";
import { normalizeVenueOptions } from "@/lib/venues";
import { itineraryHasContent, normalizeItinerary } from "@/lib/itinerary";
import { partyAdults, partyKids, partyTotal } from "@/lib/partyCount";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

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

  if (session.user.email) {
    await claimTripInvitesForUser(session.user.id, session.user.email);
  }

  const access = await getTripForOrganizer(slug, session.user.id);
  if (!access) notFound();
  const { trip, role } = access;

  const owner = await getUserById(trip.ownerId);
  const ownerLabel = owner?.name || owner?.email || "Trip owner";
  const members = await listTripMembers(trip.id);
  const pendingInvites = await listTripInvites(trip.id);

  const survey = await getSurveyByTripId(trip.id);
  const options = await listTripOptions(trip.id);
  const gallery = await listGalleryItems(trip.id);
  const responses = survey ? await listSurveyResponses(survey.id) : [];
  const confirmations = await listTripConfirmations(trip.id);

  const origin = appOrigin();
  const surveyUrl = survey ? `${origin}/r/${survey.publicToken}` : "";
  const shareUrl = `${origin}/o/${trip.shareOptionsToken}`;

  const weekendSlots = filterValidFridays(trip.proposedDateSlots ?? []);
  const locationOptions = normalizeLocationOptions(trip.locationOptions ?? []);
  const venueOptions = normalizeVenueOptions(trip.venueOptions ?? []);
  const ballotVoteRecords = await listBallotVotesForTrip(trip.id);
  const ballotTallies = tallyBallotVotes(
    ballotVoteRecords.map((v) => ({ optionId: v.optionId, vote: v.vote })),
  );
  const ballotVoterCount = countDistinctVoters(ballotVoteRecords);
  const ballotOptionCount = ballotOptionsForVoting(venueOptions).length;
  const voteUrl = survey ? `${origin}/r/${survey.publicToken}/vote` : "";
  const totalAttendees = responses.reduce((sum, r) => sum + partyTotal(r), 0);
  const lockedLocationTitle = trip.selectedLocationId
    ? findLocationById(locationOptions, trip.selectedLocationId)?.title ?? null
    : null;
  const lockedWeekendLabel = trip.selectedWeekendFriday
    ? formatWeekendLabel(trip.selectedWeekendFriday)
    : null;
  const hasPublishedPlan = itineraryHasContent(
    normalizeItinerary(trip.publishedItinerary, trip.selectedWeekendFriday),
  );
  const hasDraftItinerary = itineraryHasContent(
    normalizeItinerary(trip.itinerary, trip.selectedWeekendFriday),
  );
  const galleryUnlocked = hasPublishedPlan;
  const planners = [
    { userId: trip.ownerId, label: ownerLabel },
    ...members.map((m) => ({
      userId: m.userId,
      label: m.name?.trim() || m.email || "Co-planner",
    })),
  ];

  const confirmationCount = confirmations.filter(
    (c) =>
      c.weekendFriday === trip.selectedWeekendFriday &&
      c.locationId === trip.selectedLocationId,
  ).length;

  return (
    <div className="shell trip-hub-page">
      <TripHubMenu
        tripName={trip.name}
        slug={trip.slug}
        role={role}
        collaborators={
          <TripCollaborators
            slug={trip.slug}
            role={role}
            ownerLabel={ownerLabel}
            members={members}
            pendingInvites={pendingInvites}
          />
        }
        manage={
          <TripOwnerManagePanel slug={trip.slug} tripName={trip.name} role={role} />
        }
      />

      <TripHubWizard
        slug={trip.slug}
        galleryUnlocked={galleryUnlocked}
        completion={{
          basics: weekendSlots.length > 0,
          locations: locationOptions.length > 0,
          survey: responses.length > 0,
          ballot:
            trip.ballotStatus !== "draft" &&
            ballotOptionCount > 0 &&
            Boolean(trip.selectedLocationId),
          blueprint: Boolean(
            trip.selectedLocationId &&
              trip.selectedWeekendFriday &&
              hasDraftItinerary &&
              hasPublishedPlan,
          ),
          confirmations: hasPublishedPlan && confirmationCount > 0,
          gallery: galleryUnlocked && gallery.length > 0,
        }}
        basics={
        <>
        <form action={updateTripBasicsAction} className="stack trip-basics-form">
          <input type="hidden" name="slug" value={trip.slug} />
          <div className="field">
            <label htmlFor="name">Trip name</label>
            <input id="name" name="name" defaultValue={trip.name} required />
          </div>
          <div className="field">
            <label htmlFor="destination">Destination ideas</label>
            <textarea
              id="destination"
              name="destination"
              placeholder="Bergen, lake house, dietary needs…"
              defaultValue={trip.destinationNotes ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="budget">Budget note (optional)</label>
            <input
              id="budget"
              name="budget"
              placeholder="$800–1200 per household"
              defaultValue={trip.targetBudget ?? ""}
            />
          </div>
          <WeekendDatePicker defaultSelected={weekendSlots} />
          <button type="submit" className="btn btn-primary btn-block-sm">
            Save details
          </button>
        </form>
        </>
        }
        locations={
        <div className="stack">
          <TripPlannerChat
            slug={trip.slug}
            tripName={trip.name}
            existingLocationTitles={locationOptions.map((l) => l.title)}
          />
          <div className="divider" />
          <h3 style={{ marginTop: 0, color: "var(--color-fjord)" }}>Survey location options</h3>
          <LocationOptionsManager slug={trip.slug} locations={locationOptions} />
        </div>
        }
        survey={
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Share the preference survey—family picks weekends and places. This is not
            their final yes/no yet.
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
                      <div className="row" style={{ justifyContent: "space-between", gap: "0.75rem" }}>
                        <strong>
                          {r.respondentName} · {partyAdults(r)} adult
                          {partyAdults(r) === 1 ? "" : "s"}
                          {partyKids(r) > 0
                            ? `, ${partyKids(r)} kid${partyKids(r) === 1 ? "" : "s"}`
                            : ""}
                        </strong>
                        <form action={deleteSurveyResponseAction}>
                          <input type="hidden" name="slug" value={trip.slug} />
                          <input type="hidden" name="response_id" value={r.id} />
                          <button
                            type="submit"
                            className="btn btn-secondary"
                            style={{ fontSize: "0.8rem" }}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                      {(r.selectedLocations ?? []).length > 0 ? (
                        <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                          Locations:{" "}
                          {(r.selectedLocations ?? [])
                            .map((id) => findLocationById(locationOptions, id)?.title ?? id)
                            .join(" · ")}
                        </div>
                      ) : null}
                      <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                        {(r.selectedSlots ?? []).length
                          ? `Weekends: ${(r.selectedSlots ?? [])
                              .map((s) => formatWeekendLabel(s))
                              .join(" · ")}`
                          : "No weekends selected"}
                      </div>
                      {r.notes ? (
                        <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                          Note: {r.notes}
                        </div>
                      ) : null}
                      <FormattedDateTime
                        value={r.submittedAt}
                        className="muted"
                        style={{ fontSize: "0.75rem", marginTop: "0.35rem", display: "block" }}
                      />
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
          <div className="divider" />
          <h3 style={{ marginTop: 0, color: "var(--color-fjord)" }}>Availability snapshot</h3>
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>
            Live rollup from RSVPs—use when locking a weekend in the group vote step.
          </p>
          <AvailabilitySnapshot proposedSlots={weekendSlots} responses={responses} />
        </div>
        }
        ballot={
        <div className="stack">
          <TripDecisionBar
            slug={trip.slug}
            locations={locationOptions}
            weekendSlots={weekendSlots}
            responses={responses}
            selectedLocationId={trip.selectedLocationId}
            selectedWeekendFriday={trip.selectedWeekendFriday}
            planHeadcount={trip.planHeadcount}
          />
          <TripBallotControls
            slug={trip.slug}
            ballotStatus={trip.ballotStatus}
            voteUrl={voteUrl}
            optionCount={ballotOptionCount}
            locationLocked={Boolean(trip.selectedLocationId)}
          />
          <TripVenueSection
            slug={trip.slug}
            lockedLocationTitle={lockedLocationTitle}
            headcount={trip.planHeadcount}
            venues={venueOptions}
            selectedVenueId={trip.selectedVenueId}
            locationLocked={Boolean(trip.selectedLocationId)}
            plannerVote={
              trip.ballotStatus !== "draft" && ballotOptionCount > 0
                ? { tallies: ballotTallies, voterCount: ballotVoterCount }
                : null
            }
          />
        </div>
        }
        blueprint={
        <div className="stack">
        <TripDecisionBar
          slug={trip.slug}
          locations={locationOptions}
          weekendSlots={weekendSlots}
          responses={responses}
          selectedLocationId={trip.selectedLocationId}
          selectedWeekendFriday={trip.selectedWeekendFriday}
          planHeadcount={trip.planHeadcount}
        />
        <div className="divider" />
        <TripItineraryPanel
          slug={trip.slug}
          tripName={trip.name}
          shareUrl={shareUrl}
          itineraryRaw={trip.itinerary}
          selectedWeekendFriday={trip.selectedWeekendFriday}
          hasPlanContext={Boolean(
            trip.selectedLocationId && trip.selectedWeekendFriday,
          )}
          isPublished={hasPublishedPlan}
          planners={planners}
        />
        </div>
        }
        confirmations={
        <div className="stack">
        {!hasPublishedPlan ? (
          <div
            className="card"
            style={{ padding: "1rem", background: "rgba(28, 61, 90, 0.04)" }}
          >
            <p className="muted" style={{ margin: 0 }}>
              Publish your itinerary in <strong>Blueprint</strong> first. Then share the
              link here so family can RSVP yes or no on the locked plan.
            </p>
          </div>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Family sees the published plan and confirms yes or no with headcount.
            </p>
            <ShareLinkCard
              url={shareUrl}
              title="Share with family"
              hint="Send this link so they can RSVP yes or no on the locked plan."
              previewHref={`/o/${trip.shareOptionsToken}`}
            />
          </>
        )}
        <div className="divider" />
        <PlanConfirmationSnapshot
          confirmations={confirmations.map((c) => ({
            ...c,
            status: c.status as "confirmed" | "declined",
          }))}
          weekendFriday={trip.selectedWeekendFriday}
          locationId={trip.selectedLocationId}
          locationTitle={lockedLocationTitle}
          weekendLabel={lockedWeekendLabel}
        />
        <details style={{ marginTop: "0.5rem" }}>
          <summary className="muted" style={{ cursor: "pointer", fontSize: "0.9rem" }}>
            Advanced: comparison scenarios (optional)
          </summary>
          <div className="stack" style={{ marginTop: "0.75rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              Legacy markdown options—only shown on the public page if you have not
              published an itinerary.
            </p>
            <form action={addTripOptionAction} className="stack">
              <input type="hidden" name="slug" value={trip.slug} />
              <div className="field">
                <label htmlFor="opt_title">Title</label>
                <input id="opt_title" name="title" required placeholder="Scenario A" />
              </div>
              <div className="field">
                <label htmlFor="opt_summary">One-line pitch</label>
                <input id="opt_summary" name="summary" placeholder="Optional summary" />
              </div>
              <div className="field">
                <label htmlFor="opt_content">Full breakdown</label>
                <textarea id="opt_content" name="content" required rows={4} />
              </div>
              <button type="submit" className="btn btn-berry">
                Save scenario
              </button>
            </form>
            {options.length === 0 ? (
              <p className="muted">No saved scenarios.</p>
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
                  </article>
                ))}
              </div>
            )}
          </div>
        </details>
        </div>
        }

        gallery={
        <TripGallerySection slug={trip.slug} unlocked={galleryUnlocked} gallery={gallery} />
        }
      />

    </div>
  );
}

