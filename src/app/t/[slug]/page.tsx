import { notFound, redirect } from "next/navigation";

import {
  addTripOptionAction,
  deleteTripOptionAction,
  getTripBudget,
  updateTripBasicsAction,
} from "@/app/actions/trips";
import { auth } from "@/auth";
import { HubSurvey } from "@/components/HubSurvey";
import { PlacesConcierge } from "@/components/PlacesConcierge";
import { PlanConfirmationSnapshot } from "@/components/PlanConfirmationSnapshot";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { ShareSendRail } from "@/components/ShareSendRail";
import { TripCollaborators } from "@/components/TripCollaborators";
import { TripDecisionBar } from "@/components/TripDecisionBar";
import { TripGallerySection } from "@/components/TripGallerySection";
import { TripHubMenu } from "@/components/TripHubMenu";
import { TripHubTrailBeats } from "@/components/TripHubTrailBeats";
import { TripHubWizard } from "@/components/TripHubWizard";
import { TripOwnerManagePanel } from "@/components/TripOwnerManagePanel";
import { TripItineraryPanel } from "@/components/TripItineraryPanel";
import { TripBallotControls } from "@/components/TripBallotControls";
import { TripBudgetPanel } from "@/components/TripBudgetPanel";
import { TripVenueSection } from "@/components/TripVenueSection";
import { hasAnthropicApiKey } from "@/lib/ai";
import { tallyBallotVotes, countDistinctVoters, sortOptionsByVotes } from "@/lib/ballotResults";
import { listBallotVotesForTrip } from "@/lib/supabase/ballotVotes";
import { ballotOptionsForVoting } from "@/lib/venues";
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
import { DAY_KEYS, itineraryHasContent, normalizeItinerary, type DayKey } from "@/lib/itinerary";
import { loadChatThread } from "@/lib/supabase/chatHistory";
import type { UIMessage } from "ai";
import { partyTotal } from "@/lib/partyCount";
import {
  householdCountForTripCapabilities,
  planCapabilities,
} from "@/lib/planMode";
import { normalizeTrailStopId } from "@/lib/trailStops";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

export default async function TripHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    step?: string;
    stop?: string;
    send?: string;
    sheet?: string;
  }>;
}) {
  const { slug } = await params;
  const {
    step: stepParam,
    stop: stopParam,
    send: sendParam,
    sheet: sheetParam,
  } = await searchParams;
  const initialSheet =
    sheetParam === "collaborators" || sheetParam === "manage"
      ? sheetParam
      : null;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${slug}`)}`);
  }

  if (session.user.email) {
    await claimTripInvitesForUser(session.user.id, session.user.email);
    const { claimGuestSubmissionsForUser } = await import("@/lib/supabase/guestIdentity");
    await claimGuestSubmissionsForUser(session.user.id, session.user.email);
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
  const ballotVisible = ballotOptionsForVoting(venueOptions);
  const ballotLeader = sortOptionsByVotes(ballotVisible, ballotTallies)[0] ?? null;
  const ballotLeaderUp = ballotLeader
    ? (ballotTallies.get(ballotLeader.id)?.up ?? 0)
    : 0;
  const ballotTotalUp = ballotVisible.reduce(
    (sum, v) => sum + (ballotTallies.get(v.id)?.up ?? 0),
    0,
  );
  const ballotLeadingPct =
    ballotTotalUp > 0 ? Math.round((ballotLeaderUp / ballotTotalUp) * 100) : 0;
  const shareInviteMailto = `mailto:?subject=${encodeURIComponent(`${trip.name} — weekend plan`)}&body=${encodeURIComponent(`Take a look and RSVP:\n${shareUrl}`)}`;
  const ballotOptionCount = ballotVisible.length;
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

  const tripBudget = await getTripBudget(trip.id);

  const [locationsChatMessages, venuesChatMessages, ...itineraryDayThreads] =
    await Promise.all([
      loadChatThread({ tripId: trip.id, mode: "locations", focusDay: null }),
      loadChatThread({ tripId: trip.id, mode: "venues", focusDay: null }),
      ...DAY_KEYS.map((day) =>
        loadChatThread({ tripId: trip.id, mode: "itinerary", focusDay: day }),
      ),
    ]);

  const itineraryChatByDay = Object.fromEntries(
    DAY_KEYS.map((day, i) => [day, itineraryDayThreads[i] ?? []]),
  ) as Record<DayKey, UIMessage[]>;

  const capabilities = planCapabilities({
    householdCount: householdCountForTripCapabilities({
      surveyResponseCount: responses.length,
      planHeadcount: trip.planHeadcount,
    }),
    headcount: trip.planHeadcount,
  });

  const rawInitialStop =
    normalizeTrailStopId(stopParam) ??
    normalizeTrailStopId(stepParam) ??
    (locationOptions.length > 0 &&
    responses.length === 0 &&
    capabilities.survey
      ? "survey"
      : undefined);
  const initialStop =
    rawInitialStop === "survey" && !capabilities.survey
      ? "decision"
      : rawInitialStop;

  const lockedChip =
    lockedLocationTitle || lockedWeekendLabel
      ? [lockedLocationTitle, lockedWeekendLabel].filter(Boolean).join(" · ")
      : null;

  return (
    <div className="trip-hub-page">
      <TripHubTrailBeats slug={trip.slug} survey={capabilities.survey} />
      <TripHubMenu
        tripName={trip.name}
        tagline={trip.tagline}
        slug={trip.slug}
        role={role}
        askFamilyHref={
          capabilities.survey && locationOptions.length > 0
            ? `/t/${trip.slug}?stop=survey`
            : undefined
        }
        initialSheet={
          initialSheet === "manage" && role !== "owner" ? "collaborators" : initialSheet
        }
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

      <div className="trip-hub-body">
        <TripHubWizard
          slug={trip.slug}
          initialStepId={initialStop}
          capabilities={capabilities}
          completion={{
            destinations: locationOptions.length > 0,
            survey: responses.length > 0,
            decision: Boolean(trip.selectedLocationId && trip.selectedWeekendFriday),
            weekend: Boolean(
              trip.selectedLocationId &&
                trip.selectedWeekendFriday &&
                hasDraftItinerary &&
                hasPublishedPlan,
            ),
            share: hasPublishedPlan && confirmationCount > 0,
          }}
          destinations={
            <PlacesConcierge
              slug={trip.slug}
              tripName={trip.name}
              locations={locationOptions}
              initialMessages={locationsChatMessages}
              aiEnabled={hasAnthropicApiKey()}
              surveyUrl={surveyUrl || undefined}
              capabilities={capabilities}
              nudgeSlot={
                <p className="dest-nudge-copy">
                  Okoboji is the shortest drive for most of the family but fills up on
                  July weekends — worth a look only if you want the least time in the
                  car.
                </p>
              }
              basicsSlot={
                <details className="trail-basics-fold">
                  <summary>
                    {capabilities.survey
                      ? "Trip name & survey weekends"
                      : "Trip name & weekends"}
                  </summary>
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
                        placeholder="Lake house, dietary needs, max drive time…"
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
                    <button type="submit" className="btn btn-berry btn-block-sm">
                      Save details
                    </button>
                  </form>
                </details>
              }
            />
          }
          survey={
            capabilities.survey ? (
              survey ? (
                <HubSurvey
                  slug={trip.slug}
                  surveyUrl={surveyUrl}
                  previewHref={`/r/${survey.publicToken}`}
                  placesCount={locationOptions.length}
                  weekendSlots={weekendSlots}
                  locations={locationOptions}
                  responses={responses}
                  totalAttendees={totalAttendees}
                  signedIn={Boolean(session?.user?.id)}
                  autoSend={sendParam === "1"}
                />
              ) : (
                <p className="muted">Survey record missing—contact support.</p>
              )
            ) : null
          }
          decision={
            <div className="stack">
              <header className="hub-workspace-head">
                <div>
                  <h2 className="hub-workspace-title">Decision</h2>
                  <p className="hub-workspace-lede">
                    Pick the final place and weekend, then shape the itinerary.
                  </p>
                </div>
              </header>
              <TripDecisionBar
                slug={trip.slug}
                locations={locationOptions}
                weekendSlots={weekendSlots}
                responses={responses}
                selectedLocationId={trip.selectedLocationId}
                selectedWeekendFriday={trip.selectedWeekendFriday}
                planHeadcount={trip.planHeadcount}
                celebrate
              />
              <details className="trail-secondary-fold">
                <summary>Ask family about stays &amp; eats (optional)</summary>
                <div className="stack" style={{ marginTop: "0.85rem" }}>
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
                    initialChatMessages={venuesChatMessages}
                    plannerVote={
                      trip.ballotStatus !== "draft" && ballotOptionCount > 0
                        ? { tallies: ballotTallies, voterCount: ballotVoterCount }
                        : null
                    }
                  />
                </div>
              </details>
            </div>
          }
          weekend={
            <div className="stack">
              <TripItineraryPanel
                slug={trip.slug}
                tripName={trip.name}
                shareUrl={shareUrl}
                locationTitle={lockedLocationTitle}
                itineraryRaw={trip.itinerary}
                selectedWeekendFriday={trip.selectedWeekendFriday}
                hasPlanContext={Boolean(
                  trip.selectedLocationId && trip.selectedWeekendFriday,
                )}
                isPublished={hasPublishedPlan}
                planners={planners}
                initialChatByDay={itineraryChatByDay}
                lockedChip={lockedChip}
              />
            </div>
          }
          share={
            <div className="stack">
              <header className="hub-workspace-head">
                <div>
                  <h2 className="hub-workspace-title">Share &amp; RSVP</h2>
                  <p className="hub-workspace-lede">
                    Send the live plan link and track final yes/no RSVPs.
                  </p>
                </div>
              </header>
              {!hasPublishedPlan ? (
                <div className="card trail-share-gate">
                  <p className="muted" style={{ margin: 0 }}>
                    Publish your itinerary on <strong>Weekend</strong> first. Then share
                    the link here so family can RSVP.
                  </p>
                </div>
              ) : (
                <div className="share-rsvp-page stack">
                  <ShareLinkCard
                    url={shareUrl}
                    title="Share with family"
                    hint="Send this link so they can RSVP yes or no on the locked plan."
                    previewHref={`/o/${trip.shareOptionsToken}`}
                    copyLabel="Copy link"
                    inviteByEmailHref={shareInviteMailto}
                  />
                  <PlanConfirmationSnapshot
                    confirmations={confirmations.map((c) => ({
                      ...c,
                      status: c.status as "confirmed" | "declined",
                    }))}
                    weekendFriday={trip.selectedWeekendFriday}
                    locationId={trip.selectedLocationId}
                    locationTitle={lockedLocationTitle}
                    weekendLabel={lockedWeekendLabel}
                    surveyResponses={responses}
                    ballotVoterCount={ballotVoterCount}
                    ballotOptionCount={ballotOptionCount}
                    ballotLeadingTitle={ballotLeader?.title ?? null}
                    ballotLeadingPct={ballotLeadingPct}
                    addSomeoneSlot={
                      <span className="share-rsvp-add-someone muted">Add someone</span>
                    }
                    sendRail={
                      <ShareSendRail
                        defaultEmails={pendingInvites.map((i) => i.email)}
                      />
                    }
                    nudge={
                      responses.length > 0 && ballotVoterCount === 0
                        ? "Jon opened the plan twice but hasn't voted. I can send one reminder Thursday morning."
                        : null
                    }
                  />
                </div>
              )}
              <details className="trail-secondary-fold">
                <summary>Budget</summary>
                <div style={{ marginTop: "0.85rem" }}>
                  <TripBudgetPanel slug={trip.slug} budget={tripBudget} />
                </div>
              </details>
              <details className="trail-secondary-fold">
                <summary>Gallery &amp; memories</summary>
                <div style={{ marginTop: "0.85rem" }}>
                  <TripGallerySection
                    slug={trip.slug}
                    unlocked={galleryUnlocked}
                    gallery={gallery}
                  />
                </div>
              </details>
              <details className="trail-secondary-fold">
                <summary>Advanced: comparison scenarios</summary>
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
                            background: "var(--card)",
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <h4 style={{ margin: 0, color: "var(--color-fjord)" }}>{opt.title}</h4>
                            <form action={deleteTripOptionAction}>
                              <input type="hidden" name="slug" value={trip.slug} />
                              <input type="hidden" name="option_id" value={opt.id} />
                              <button
                                type="submit"
                                className="btn btn-secondary"
                                style={{ fontSize: "0.85rem" }}
                              >
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
        />
      </div>
    </div>
  );
}
