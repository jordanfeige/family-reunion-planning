"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { sortOptionsByVotes, type OptionVoteTally } from "@/lib/ballotResults";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
  venuesForPublicShowcase,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export function TripBallotResults({
  slug,
  venues,
  tallies,
  voterCount,
  selectedVenueId,
}: {
  slug: string;
  venues: VenueOption[];
  tallies: Map<string, OptionVoteTally>;
  voterCount: number;
  selectedVenueId: string | null;
}) {
  const visible = venuesForPublicShowcase(venues);
  const categoriesInResults = useMemo(
    () =>
      VENUE_CATEGORIES.filter((c) =>
        visible.some((v) => v.category === c),
      ) as VenueCategory[],
    [visible],
  );

  const [stepIdx, setStepIdx] = useState(0);
  const stepCount = categoriesInResults.length;
  const stepSafe = stepCount > 0 ? Math.min(stepIdx, stepCount - 1) : 0;
  const activeCategory = categoriesInResults[stepSafe];

  if (visible.length === 0) return null;

  const itemsThisStep = sortOptionsByVotes(
    visible.filter((v) => v.category === activeCategory),
    tallies,
  );

  return (
    <div className="stack planner-ballot-results">
      <h3 style={{ margin: 0, color: "var(--color-fjord)" }}>Vote results</h3>
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
        {voterCount} ballot{voterCount === 1 ? "" : "s"} cast. Net score is 👍 minus 👎 (family
        only sees totals).
      </p>

      <div className="ballot-step-shell card planner-ballot-results-shell">
        <div className="ballot-step-progress" aria-label="Results by category">
          {categoriesInResults.map((cat, i) => (
            <button
              key={cat}
              type="button"
              className={`ballot-step-dot${i === stepSafe ? " is-current" : ""}`}
              onClick={() => setStepIdx(i)}
            >
              <span className="ballot-step-dot-label">{VENUE_CATEGORY_LABELS[cat]}</span>
            </button>
          ))}
        </div>
        <p className="ballot-step-caption">
          {VENUE_CATEGORY_LABELS[activeCategory]} · {itemsThisStep.length} option
          {itemsThisStep.length === 1 ? "" : "s"}
        </p>

        <ul className="ballot-results-list">
          {itemsThisStep.map((venue) => {
            const t = tallies.get(venue.id) ?? { up: 0, down: 0, net: 0 };
            const isBase = selectedVenueId === venue.id;
            return (
              <li key={venue.id} className="ballot-results-row card">
                <div className="ballot-results-row-main">
                  <div className="ballot-results-title-row">
                    <Link href={`/t/${slug}/venues/${venue.id}`} className="ballot-results-link">
                      {venue.title}
                    </Link>
                    {isBase ? (
                      <span className="venue-base-camp-badge">Home base</span>
                    ) : null}
                  </div>
                  <p className="ballot-results-price">{formatVenuePrice(venue)}</p>
                </div>
                <div className="ballot-results-score-block" aria-label={`Net score ${t.net}`}>
                  <span className="ballot-results-net">
                    {t.net >= 0 ? `+${t.net}` : t.net} net
                  </span>
                  <span className="ballot-results-counts muted">
                    👍 {t.up} · 👎 {t.down}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {stepCount > 1 ? (
          <div className="ballot-step-nav">
            {stepSafe > 0 ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
              >
                ← {VENUE_CATEGORY_LABELS[categoriesInResults[stepSafe - 1]]}
              </button>
            ) : (
              <span />
            )}
            {stepSafe < stepCount - 1 ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStepIdx((s) => Math.min(stepCount - 1, s + 1))}
              >
                {VENUE_CATEGORY_LABELS[categoriesInResults[stepSafe + 1]]} →
              </button>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
