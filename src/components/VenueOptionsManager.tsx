"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  addVenueOptionAction,
  clearPrimaryVenueAction,
  deleteVenueOptionAction,
  setPrimaryVenueAction,
} from "@/app/actions/trips";
import { ManualAddDrawer } from "@/components/ManualAddDrawer";
import { VenueLinkButtons } from "@/components/LinkPreviewCard";
import {
  categoryVoteRollup,
  sortOptionsByVotes,
  sortPlannerCategoryVenues,
  type OptionVoteTally,
} from "@/lib/ballotResults";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  VENUE_BOOKING_STATUS_LABELS,
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
  venuesForPublicShowcase,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export function VenueOptionsManager({
  slug,
  venues,
  selectedVenueId,
  plannerVote,
}: {
  slug: string;
  venues: VenueOption[];
  selectedVenueId: string | null;
  plannerVote?: { tallies: Map<string, OptionVoteTally>; voterCount: number } | null;
}) {
  const grouped: Record<VenueCategory, VenueOption[]> = {
    stay: [],
    eat: [],
    do: [],
  };
  for (const v of venues) {
    grouped[v.category].push(v);
  }

  const [stepIdx, setStepIdx] = useState(0);
  const [scoresFocus, setScoresFocus] = useState(false);
  const activeCategory = VENUE_CATEGORIES[stepIdx] as VenueCategory;
  const items = useMemo(
    () => sortPlannerCategoryVenues(venues, activeCategory, plannerVote?.tallies),
    [venues, activeCategory, plannerVote],
  );
  const visibleInCategory = useMemo(
    () => venuesForPublicShowcase(venues.filter((v) => v.category === activeCategory)),
    [venues, activeCategory],
  );
  const rollup = useMemo(
    () =>
      plannerVote && visibleInCategory.length > 0
        ? categoryVoteRollup(visibleInCategory, plannerVote.tallies)
        : null,
    [plannerVote, visibleInCategory],
  );
  const ballotScoreRows = useMemo(
    () =>
      plannerVote && visibleInCategory.length > 0
        ? sortOptionsByVotes(visibleInCategory, plannerVote.tallies)
        : [],
    [plannerVote, visibleInCategory],
  );

  useEffect(() => {
    setScoresFocus(false);
  }, [activeCategory]);

  return (
    <div className="stack venue-options-manager">
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Shortlist stays, meals, and activities by section. Mark one <strong>Stay</strong> as home
        base for the itinerary.
      </p>

      <div className="ballot-step-shell card planner-venue-shell">
        <div className="ballot-step-progress" aria-label="Option categories">
          {VENUE_CATEGORIES.map((cat, i) => {
            const count = grouped[cat].length;
            return (
              <button
                key={cat}
                type="button"
                className={`ballot-step-dot${i === stepIdx ? " is-current" : ""}`}
                onClick={() => setStepIdx(i)}
              >
                <span className="ballot-step-dot-label">
                  {VENUE_CATEGORY_LABELS[cat]}
                  <span className="ballot-step-dot-count">{count}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="ballot-step-caption">
          <strong>{VENUE_CATEGORY_LABELS[activeCategory]}</strong>
          <span className="muted">
            {" "}
            · {items.length} option{items.length === 1 ? "" : "s"}
          </span>
        </p>

        {plannerVote ? (
          <>
            <p className="planner-ballot-meta muted" style={{ margin: "0 0 0.65rem", fontSize: "0.88rem" }}>
              {plannerVote.voterCount} ballot{plannerVote.voterCount === 1 ? "" : "s"} · Votes show as
              👍 / 👎 (family only sees totals). Net is 👍 minus 👎.
            </p>
            {rollup ? (
              <details className="ballot-vote-details planner-category-vote-details">
                <summary className="ballot-vote-details-summary">
                  {VENUE_CATEGORY_LABELS[activeCategory]} vote totals
                </summary>
                <div className="ballot-vote-details-body planner-category-vote-details-body">
                  <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
                    Sums all 👍 and 👎 on the{" "}
                    <strong>{visibleInCategory.length}</strong> ballot option
                    {visibleInCategory.length === 1 ? "" : "s"} in this category (passed options are
                    excluded from the group vote).
                  </p>
                  <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--color-fjord)" }}>
                    {rollup.totalUp} 👍 · {rollup.totalDown} 👎
                  </p>
                  {rollup.totalUp + rollup.totalDown > 0 && rollup.leader ? (
                    <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                      Leading:{" "}
                      <Link
                        href={`/t/${slug}/venues/${rollup.leader.venue.id}`}
                        className="ballot-results-link"
                      >
                        {rollup.leader.venue.title}
                      </Link>
                      <span className="muted">
                        {" "}
                        (
                        {rollup.leader.tally.net >= 0
                          ? `+${rollup.leader.tally.net}`
                          : rollup.leader.tally.net}{" "}
                        net)
                      </span>
                    </p>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                      No votes in this category yet.
                    </p>
                  )}
                </div>
              </details>
            ) : null}
            <div
              className="planner-vote-view-toggle"
              role="group"
              aria-label="How to view this category"
            >
              <button
                type="button"
                className={!scoresFocus ? "is-active" : ""}
                onClick={() => setScoresFocus(false)}
              >
                Manage places
              </button>
              <button
                type="button"
                className={scoresFocus ? "is-active" : ""}
                onClick={() => setScoresFocus(true)}
              >
                Scores only
              </button>
            </div>
          </>
        ) : null}

        <div
          className="row"
          style={{ flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}
        >
          <ManualAddDrawer
            key={activeCategory}
            title={`Add to ${VENUE_CATEGORY_LABELS[activeCategory]}`}
            triggerLabel="Add manually"
          >
            {({ close }) => (
              <form
                className="stack"
                action={async (formData) => {
                  await addVenueOptionAction(formData);
                  close();
                }}
              >
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="category" value={activeCategory} />
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Adds to the <strong>{VENUE_CATEGORY_LABELS[activeCategory]}</strong> shortlist (
                  current tab).
                </p>
                <div className="field">
                  <label htmlFor={`venue_title_${activeCategory}`}>Name</label>
                  <input
                    id={`venue_title_${activeCategory}`}
                    name="title"
                    required
                    placeholder={
                      activeCategory === "stay"
                        ? "Eagle Ridge Resort"
                        : activeCategory === "eat"
                          ? "Riverbend Grill"
                          : "Kayak rental / hike"
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor={`venue_summary_${activeCategory}`}>Notes (optional)</label>
                  <textarea
                    id={`venue_summary_${activeCategory}`}
                    name="summary"
                    placeholder="Capacity, vibe, parking…"
                  />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor={`venue_booking_${activeCategory}`}>Booking URL (optional)</label>
                    <input
                      id={`venue_booking_${activeCategory}`}
                      name="booking_url"
                      type="url"
                      placeholder="https://…"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`venue_maps_${activeCategory}`}>Map link (optional)</label>
                    <input
                      id={`venue_maps_${activeCategory}`}
                      name="maps_url"
                      type="url"
                      placeholder="https://maps…"
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-berry" style={{ alignSelf: "flex-start" }}>
                  Add to shortlist
                </button>
              </form>
            )}
          </ManualAddDrawer>
        </div>

        {plannerVote && scoresFocus ? (
          ballotScoreRows.length > 0 ? (
            <ul className="planner-scores-compact-list" aria-label="Vote scores for this category">
              {ballotScoreRows.map((venue) => {
                const t = plannerVote.tallies.get(venue.id) ?? { up: 0, down: 0, net: 0 };
                const isBase = selectedVenueId === venue.id;
                return (
                  <li key={venue.id} className="planner-scores-compact-row card">
                    <div className="planner-scores-compact-main">
                      <Link href={`/t/${slug}/venues/${venue.id}`} className="ballot-results-link">
                        {venue.title}
                      </Link>
                      {isBase ? <span className="venue-base-camp-badge">Base camp</span> : null}
                    </div>
                    <div className="planner-scores-compact-score" aria-label={`Net score ${t.net}`}>
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
          ) : (
            <p className="muted" style={{ margin: "0 0 0.75rem" }}>
              No options on the family ballot in this category (for example, all places here might be
              marked passed).
            </p>
          )
        ) : items.length === 0 ? (
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>
            Nothing here yet—ask WandrAI above or use <strong>Add manually</strong>.
          </p>
        ) : (
          <ul className="venue-options-list">
            {items.map((venue) => {
              const isBase = selectedVenueId === venue.id;
              const tally = plannerVote?.tallies.get(venue.id) ?? {
                up: 0,
                down: 0,
                net: 0,
              };
              const showVoteStrip =
                Boolean(plannerVote) && venuesForPublicShowcase([venue]).length > 0;
              return (
                <li key={venue.id} className="venue-option-card venue-option-card--stacked">
                  <div className="venue-option-card-main">
                    <div className="venue-option-card-head">
                      <strong>{venue.title}</strong>
                      {isBase ? (
                        <span className="venue-base-camp-badge">Base camp</span>
                      ) : null}
                    </div>
                    <p className="ballot-vote-price venue-option-price">
                      {formatVenuePrice(venue)}
                    </p>
                    {venue.summary ? (
                      <p className="muted venue-option-summary">{venue.summary}</p>
                    ) : null}
                    <p className="muted venue-option-meta">
                      {VENUE_BOOKING_STATUS_LABELS[venue.bookingStatus ?? "idea"]}
                      {venue.sourceLabel ? ` · via ${venue.sourceLabel}` : null}
                    </p>
                    <details className="ballot-vote-details">
                      <summary className="ballot-vote-details-summary">Links &amp; booking</summary>
                      <div className="ballot-vote-details-body">
                        <VenueLinkButtons venue={venue} />
                      </div>
                    </details>
                  </div>
                  {showVoteStrip ? (
                    <div
                      className="venue-option-vote-strip"
                      aria-label={`Votes for ${venue.title}`}
                    >
                      <span className="venue-option-vote-net">
                        {tally.net >= 0 ? `+${tally.net}` : tally.net} net
                      </span>
                      <span className="muted venue-option-vote-counts">
                        👍 {tally.up} · 👎 {tally.down}
                      </span>
                    </div>
                  ) : null}
                  <div className="venue-option-actions venue-option-actions--stacked">
                    <Link
                      href={`/t/${slug}/venues/${venue.id}`}
                      className="btn btn-primary btn-sm btn-block-sm"
                    >
                      View / edit details
                    </Link>
                    {activeCategory === "stay" && !isBase ? (
                      <form action={setPrimaryVenueAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="venue_id" value={venue.id} />
                        <button type="submit" className="btn btn-secondary btn-sm btn-block-sm">
                          Set home base
                        </button>
                      </form>
                    ) : null}
                    {activeCategory === "stay" && isBase ? (
                      <form action={clearPrimaryVenueAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <button type="submit" className="btn btn-secondary btn-sm btn-block-sm">
                          Clear home base
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteVenueOptionAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="venue_id" value={venue.id} />
                      <button type="submit" className="btn btn-secondary btn-sm btn-block-sm">
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="ballot-step-nav">
          {stepIdx > 0 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
            >
              ← {VENUE_CATEGORY_LABELS[VENUE_CATEGORIES[stepIdx - 1]]}
            </button>
          ) : (
            <span />
          )}
          {stepIdx < VENUE_CATEGORIES.length - 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStepIdx((s) => Math.min(VENUE_CATEGORIES.length - 1, s + 1))}
            >
              {VENUE_CATEGORY_LABELS[VENUE_CATEGORIES[stepIdx + 1]]} →
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}
