import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { BallotVoteForm } from "@/components/BallotVoteForm";
import { GuestSaveSignIn, GuestSignedInBanner } from "@/components/GuestSaveSignIn";
import { voterKeyFromUserId } from "@/lib/ballotVoter";
import { tallyBallotVotes } from "@/lib/ballotResults";
import { APP_NAME } from "@/lib/brand";
import { appOrigin } from "@/lib/appOrigin";
import { guestSessionFromUser } from "@/lib/guestSession";
import { listBallotVotesForTrip, listBallotVotesForVoter } from "@/lib/supabase/ballotVotes";
import { getSurveyAndTripByPublicToken } from "@/lib/supabase/queries";
import { ballotOptionsForVoting } from "@/lib/venues";

export default async function BallotVotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ thanks?: string }>;
}) {
  const { token } = await params;
  const { thanks } = await searchParams;
  const data = await getSurveyAndTripByPublicToken(token);
  if (!data) notFound();

  const session = await auth();
  const guestSession = guestSessionFromUser(session?.user ?? {});
  const callbackUrl = `${appOrigin()}/r/${token}/vote`;

  const { survey, trip } = data;
  const options = ballotOptionsForVoting(trip.venueOptions ?? []);
  const voteRecords = await listBallotVotesForTrip(trip.id);
  const talliesMap = tallyBallotVotes(
    voteRecords.map((v) => ({ optionId: v.optionId, vote: v.vote })),
  );
  const tallies = Object.fromEntries(
    [...talliesMap.entries()].map(([id, t]) => [id, { up: t.up, down: t.down, net: t.net }]),
  );

  const showTallies = trip.ballotStatus === "open" || trip.ballotStatus === "closed";
  const planUrl = `${appOrigin()}/o/${trip.shareOptionsToken}`;

  let initialVotes: Record<string, "up" | "down"> = {};
  if (guestSession) {
    const myVotes = await listBallotVotesForVoter(
      trip.id,
      voterKeyFromUserId(guestSession.userId),
    );
    for (const v of myVotes) {
      initialVotes[v.optionId] = v.vote;
    }
  }

  if (trip.ballotStatus === "draft") {
    return (
      <div className="shell page-narrow page-public">
        <div className="card">
          <p className="pill">{APP_NAME}</p>
          <h1 style={{ color: "var(--color-fjord)" }}>Voting not open yet</h1>
          <p className="muted">
            The planners are still building the list of stays, meals, and activities. Check back
            soon.
          </p>
          <Link href={`/r/${token}`} className="btn btn-secondary" style={{ marginTop: "1rem" }}>
            Back to planning survey
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell page-narrow page-public">
      <header style={{ marginBottom: "1rem" }}>
        <p className="pill">{APP_NAME} · Group vote</p>
        <h1 style={{ color: "var(--color-fjord)", margin: "0.35rem 0" }}>{trip.name}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {trip.ballotStatus === "closed"
            ? "Voting is closed. You can still view options on the trip plan."
            : "Thumbs up or down on where to stay, eat, and what to do."}
        </p>
      </header>

      {thanks ? (
        <div className="success-banner" style={{ marginBottom: "1rem" }}>
          Thanks! Your votes are saved. You can change them anytime while voting is open.
        </div>
      ) : null}

      {trip.ballotStatus === "open" ? (
        <>
          {guestSession ? (
            <GuestSignedInBanner email={guestSession.email} />
          ) : (
            <GuestSaveSignIn callbackUrl={callbackUrl} />
          )}
          <BallotVoteForm
            surveyToken={token}
            tripName={trip.name}
            options={trip.venueOptions ?? []}
            initialVotes={initialVotes}
            showTallies={showTallies}
            tallies={tallies}
            guestSession={guestSession}
            initialName={guestSession?.name}
            initialEmail={guestSession?.email}
          />
        </>
      ) : (
        <p className="muted">
          Voting has ended.{" "}
          <Link href={planUrl}>View the shared trip plan</Link> to see group favorites.
        </p>
      )}

      <p style={{ marginTop: "1.5rem" }}>
        <Link href={planUrl} className="muted" style={{ fontSize: "0.9rem" }}>
          View trip plan →
        </Link>
      </p>
    </div>
  );
}
