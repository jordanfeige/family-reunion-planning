import Link from "next/link";
import { notFound } from "next/navigation";

import { BallotVoteForm } from "@/components/BallotVoteForm";
import { tallyBallotVotes } from "@/lib/ballotResults";
import { APP_NAME } from "@/lib/brand";
import { appOrigin } from "@/lib/appOrigin";
import { listBallotVotesForTrip } from "@/lib/supabase/ballotVotes";
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
        <BallotVoteForm
          surveyToken={token}
          tripName={trip.name}
          options={trip.venueOptions ?? []}
          initialVotes={{}}
          showTallies={showTallies}
          tallies={tallies}
        />
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
