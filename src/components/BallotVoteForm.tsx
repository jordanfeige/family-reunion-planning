"use client";

import { useEffect, useMemo, useState } from "react";

import { submitBallotVotesAction } from "@/app/actions/trips";
import { VenueLinkButtons } from "@/components/LinkPreviewCard";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  ballotOptionsForVoting,
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
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
          Help plan <strong>{tripName}</strong>. Tap 👍 or 👎 for each option—you can skip any
          row.
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
        <div className="field">
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

      {VENUE_CATEGORIES.map((category) => {
        const items = ballotOptions.filter((o) => o.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="ballot-vote-section">
            <h2 className="ballot-vote-section-title">{VENUE_CATEGORY_LABELS[category]}</h2>
            <ul className="ballot-vote-list">
              {items.map((venue) => {
                const choice = votes[venue.id] ?? null;
                const tally = tallies[venue.id];
                return (
                  <li key={venue.id} className="ballot-vote-card card">
                    <div className="ballot-vote-card-head">
                      <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--color-fjord)" }}>
                        {venue.title}
                      </h3>
                      <p className="ballot-vote-price">{formatVenuePrice(venue)}</p>
                    </div>
                    {venue.summary ? (
                      <p className="muted" style={{ margin: "0 0 0.65rem", lineHeight: 1.45 }}>
                        {venue.summary}
                      </p>
                    ) : null}
                    <VenueLinkButtons venue={venue} />
                    {showTallies && tally ? (
                      <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
                        Group so far: 👍 {tally.up} · 👎 {tally.down}
                      </p>
                    ) : null}
                    <div className="ballot-vote-actions" role="group" aria-label={`Vote on ${venue.title}`}>
                      <button
                        type="button"
                        className={`ballot-thumb ballot-thumb--up${choice === "up" ? " is-active" : ""}`}
                        aria-pressed={choice === "up"}
                        onClick={() => setVote(venue.id, "up")}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className={`ballot-thumb ballot-thumb--down${choice === "down" ? " is-active" : ""}`}
                        aria-pressed={choice === "down"}
                        onClick={() => setVote(venue.id, "down")}
                      >
                        👎
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {error ? <p className="error-banner" style={{ margin: 0 }}>{error}</p> : null}

      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
        Rated {ratedCount} of {ballotOptions.length} options
      </p>
      <button type="submit" className="btn btn-primary btn-block-sm" disabled={submitting}>
        {submitting ? "Saving…" : "Submit my votes"}
      </button>
    </form>
  );
}
