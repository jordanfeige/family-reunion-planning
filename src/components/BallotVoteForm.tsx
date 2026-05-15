"use client";

import { useEffect, useMemo, useState } from "react";

import { submitBallotVotesAction } from "@/app/actions/trips";
import { VenueLinkButtons } from "@/components/LinkPreviewCard";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  ballotOptionsForVoting,
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

const GUEST_KEY = "wandr-ballot-guest-id";

type VoteChoice = "up" | "down" | null;

export function BallotVoteForm({
  surveyToken,
  tripName,
  options,
  initialVotes,
  showTallies,
  tallies,
}: {
  surveyToken: string;
  tripName: string;
  options: VenueOption[];
  initialVotes: Record<string, VoteChoice>;
  showTallies: boolean;
  tallies: Record<string, { up: number; down: number; net: number }>;
}) {
  const ballotOptions = useMemo(() => ballotOptionsForVoting(options), [options]);
  const categoriesInBallot = useMemo(
    () =>
      VENUE_CATEGORIES.filter((c) =>
        ballotOptions.some((o) => o.category === c),
      ) as VenueCategory[],
    [ballotOptions],
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteChoice>>(initialVotes);
  const [guestId, setGuestId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_KEY, id);
    }
    setGuestId(id);
  }, []);

  const currentCategory = categoriesInBallot[stepIdx];
  const stepCount = categoriesInBallot.length;
  const stepSafe = stepCount > 0 ? Math.min(stepIdx, stepCount - 1) : 0;
  const activeCategory = categoriesInBallot[stepSafe] ?? categoriesInBallot[0];

  const itemsThisStep = useMemo(
    () => ballotOptions.filter((o) => o.category === activeCategory),
    [ballotOptions, activeCategory],
  );

  const ratedInCategory = itemsThisStep.filter((v) => {
    const ch = votes[v.id];
    return ch === "up" || ch === "down";
  }).length;

  const ratedCount = Object.values(votes).filter((v) => v === "up" || v === "down").length;

  function setVote(optionId: string, choice: VoteChoice) {
    setVotes((prev) => {
      const current = prev[optionId] ?? null;
      const next = current === choice ? null : choice;
      return { ...prev, [optionId]: next };
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = Object.entries(votes)
        .filter((entry): entry is [string, "up" | "down"] => {
          const v = entry[1];
          return v === "up" || v === "down";
        })
        .map(([optionId, vote]) => ({ optionId, vote }));

      const fd = new FormData();
      fd.set("survey_token", surveyToken);
      fd.set("voter_name", name.trim());
      if (email.trim()) fd.set("voter_email", email.trim());
      fd.set("guest_id", guestId);
      fd.set("votes_json", JSON.stringify(payload));
      await submitBallotVotesAction(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save votes.");
      setSubmitting(false);
    }
  }

  if (ballotOptions.length === 0) {
    return (
      <p className="muted">The planners have not added options to vote on yet.</p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="stack ballot-vote-form">
      <div className="card" style={{ padding: "1rem" }}>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
          Help plan <strong>{tripName}</strong>. We&apos;ll walk through{" "}
          <strong>Stay</strong>, <strong>Eat</strong>, and <strong>Do</strong> in order—tap 👍 or
          👎; skip any row.
        </p>
        <div className="field">
          <label htmlFor="voter_name">Your name</label>
          <input
            id="voter_name"
            name="voter_name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="voter_email">Email (optional)</label>
          <input
            id="voter_email"
            type="email"
            placeholder="Matches planning survey if you used one"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="ballot-step-shell card">
        <div className="ballot-step-progress" role="navigation" aria-label="Voting steps">
          {categoriesInBallot.map((cat, i) => (
            <button
              key={cat}
              type="button"
              className={`ballot-step-dot${i === stepSafe ? " is-current" : ""}${i < stepSafe ? " is-done" : ""}`}
              onClick={() => setStepIdx(i)}
              aria-current={i === stepSafe ? "step" : undefined}
            >
              <span className="ballot-step-dot-label">{VENUE_CATEGORY_LABELS[cat]}</span>
            </button>
          ))}
        </div>
        <p className="ballot-step-caption">
          Step {stepSafe + 1} of {stepCount} · <strong>{VENUE_CATEGORY_LABELS[activeCategory]}</strong>
          <span className="muted"> · {ratedInCategory} of {itemsThisStep.length} rated here</span>
        </p>

        <ul className="ballot-vote-list">
          {itemsThisStep.map((venue) => {
            const choice = votes[venue.id] ?? null;
            const tally = tallies[venue.id];
            return (
              <li key={venue.id} className="ballot-vote-card card">
                <div className="ballot-vote-card-head">
                  <h3 className="ballot-vote-card-title">{venue.title}</h3>
                  <p className="ballot-vote-price">{formatVenuePrice(venue)}</p>
                </div>
                {venue.summary ? (
                  <p className="muted ballot-vote-summary">{venue.summary}</p>
                ) : null}
                <details className="ballot-vote-details">
                  <summary className="ballot-vote-details-summary">Links &amp; booking</summary>
                  <div className="ballot-vote-details-body">
                    <VenueLinkButtons venue={venue} />
                  </div>
                </details>
                {showTallies && tally ? (
                  <p className="muted ballot-vote-tally-line">
                    Group so far: 👍 {tally.up} · 👎 {tally.down}
                  </p>
                ) : null}
                <div
                  className="ballot-vote-actions"
                  role="group"
                  aria-label={`Vote on ${venue.title}`}
                >
                  <button
                    type="button"
                    className={`ballot-thumb ballot-thumb--up${choice === "up" ? " is-active" : ""}`}
                    aria-pressed={choice === "up"}
                    onClick={() => setVote(venue.id, "up")}
                  >
                    👍 Up
                  </button>
                  <button
                    type="button"
                    className={`ballot-thumb ballot-thumb--down${choice === "down" ? " is-active" : ""}`}
                    aria-pressed={choice === "down"}
                    onClick={() => setVote(venue.id, "down")}
                  >
                    👎 Down
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="ballot-step-nav">
          {stepSafe > 0 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          {stepSafe < stepCount - 1 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setStepIdx((s) => Math.min(stepCount - 1, s + 1))}
            >
              Next: {VENUE_CATEGORY_LABELS[categoriesInBallot[stepSafe + 1]]} →
            </button>
          ) : (
            <span className="muted ballot-step-nav-end">Last section—submit when ready</span>
          )}
        </div>
      </div>

      {error ? <p className="error-banner" style={{ margin: 0 }}>{error}</p> : null}

      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
        <strong>{ratedCount}</strong> of {ballotOptions.length} options rated overall
      </p>
      <button type="submit" className="btn btn-primary btn-block-sm" disabled={submitting}>
        {submitting ? "Saving…" : "Save my votes"}
      </button>
    </form>
  );
}
