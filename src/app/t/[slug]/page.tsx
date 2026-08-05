import { notFound, redirect } from "next/navigation";

import {
  addTripOptionAction,
  deleteSurveyResponseAction,
  deleteTripOptionAction,
  getTripBudget,
  updateTripBasicsAction,
} from "@/app/actions/trips";
import { auth } from "@/auth";
import { AvailabilitySnapshot } from "@/components/AvailabilitySnapshot";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { PlacesConcierge } from "@/components/PlacesConcierge";
import { PlanConfirmationSnapshot } from "@/components/PlanConfirmationSnapshot";
import { TripCollaborators } from "@/components/TripCollaborators";
import { TripDecisionBar } from "@/components/TripDecisionBar";
import { TripGallerySection } from "@/components/TripGallerySection";
import { TripHubMenu } from "@/components/TripHubMenu";
import { TripHubWizard } from "@/components/TripHubWizard";
import { TripOwnerManagePanel } from "@/components/TripOwnerManagePanel";
import { TripItineraryPanel } from "@/components/TripItineraryPanel";
import { TripBallotControls } from "@/components/TripBallotControls";
import { TripBudgetPanel } from "@/components/TripBudgetPanel";
import { TripVenueSection } from "@/components/TripVenueSection";
import { hasAnthropicApiKey } from "@/lib/ai";
import { tallyBallotVotes, countDistinctVoters } from "@/lib/ballotResults";
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
import { partyAdults, partyKids, partyTotal } from "@/lib/partyCount";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

export default async function TripHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { slug } = await params;
  const { step: stepParam } = await searchParams;
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

  return (
    <div className="shell trip-hub-page">
      <TripHubMenu
        tripName={trip.name}
        tagline={trip.tagline}
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
        initialStepId={
          stepParam &&
          [
            "basics",
            "locations",
            "survey",
            "ballot",
            "blueprint",
            "budget",
            "confirmations",
            "gallery",
          ].includes(stepParam)
            ? stepParam
            : locationOptions.length > 0 && responses.length === 0
              ? "survey"
              : undefined
        }
        galleryUnlocked={galleryUnlocked}
        phaseSummaries={{
          decide:
            locationOptions.length > 0 || weekendSlots.length > 0
              ? [
                  locationOptions.length
                    ? `${locationOptions.length} place${locationOptions.length === 1 ? "" : "s"}`
                    : null,
                  weekendSlots.length
                    ? `${weekendSlots.length} weekend${weekendSlots.length === 1 ? "" : "s"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Weekends & places set"
              : undefined,
          shape:
            lockedLocationTitle || lockedWeekendLabel
              ? [lockedLocationTitle, lockedWeekendLabel].filter(Boolean).join(" · ")
              : undefined,
          gather: hasPublishedPlan
            ? confirmationCount > 0
              ? `${confirmationCount} RSVP${confirmationCount === 1 ? "" : "s"}`
              : "Plan published"
            : undefined,
        }}
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
          budget: tripBudget.expenses.length > 0,
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
          <button type="submit" className="btn btn-primary btn-block-sm">
            Save details
          </button>
        </form>
        </>
        }
        locations={
        <PlacesConcierge
          slug={trip.slug}
          tripName={trip.name}
          locations={locationOptions}
          initialMessages={locationsChatMessages}
          aiEnabled={hasAnthropicApiKey()}
          surveyUrl={surveyUrl || undefined}
        />
        }
        survey={
        <div className="hub-survey">
          {survey ? (
            <>
              {locationOptions.length > 0 ? (
                <p className="hub-survey-meta">
                  {locationOptions.length} place
                  {locationOptions.length === 1 ? "" : "s"} on this survey
                </p>
              ) : (
                <p className="muted hub-survey-warn">
                  No places yet — add some in Places before family replies.
                </p>
              )}
              <ShareLinkCard
                url={surveyUrl}
                title="Share link"
                hint={
                  weekendSlots.length === 0
                    ? "Anyone with the link can respond. Tip: add weekends under Basics for date options."
                    : "Anyone with the link can respond."
                }
                previewHref={`/r/${survey.publicToken}`}
              />
              <div className="hub-survey-responses">
                <div className="hub-survey-responses-head">
                  <h3 className="hub-survey-responses-title">Responses</h3>
                  <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                    {responses.length === 0
                      ? "0 responses so far"
                      : `${responses.length} household${responses.length === 1 ? "" : "s"} replied`}
                  </p>
                </div>
                {responses.length === 0 ? (
                  <div className="hub-survey-empty">
                    <p className="hub-survey-empty-title">No responses yet</p>
                    <p className="muted" style={{ margin: 0 }}>
                      Replies will appear here as your family completes the survey.
                    </p>
                  </div>
                ) : (
                  <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {responses.map((r) => (
                      <li key={r.id} className="hub-survey-response-row">
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
                {responses.length > 0 ? (
                  <p className="muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
                    Headcount running total: <strong>{totalAttendees}</strong>
                  </p>
                ) : null}
              </div>
              {responses.length > 0 ? (
                <div className="hub-survey-snapshot">
                  <h3 className="hub-survey-responses-title">Availability</h3>
                  <p className="muted" style={{ margin: "0 0 0.75rem" }}>
                    Live rollup from replies — useful when locking a weekend later.
                  </p>
                  <AvailabilitySnapshot proposedSlots={weekendSlots} responses={responses} />
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">Survey record missing—contact support.</p>
          )}
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
            initialChatMessages={venuesChatMessages}
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
          initialChatByDay={itineraryChatByDay}
        />
        </div>
        }
        budget={<TripBudgetPanel slug={trip.slug} budget={tripBudget} />}
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

