"use client";

import Link from "next/link";
import { useState } from "react";

import {
  addVenueOptionAction,
  clearPrimaryVenueAction,
  deleteVenueOptionAction,
  setPrimaryVenueAction,
} from "@/app/actions/trips";
import { ManualAddDrawer } from "@/components/ManualAddDrawer";
import { VenueLinkButtons } from "@/components/LinkPreviewCard";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  VENUE_BOOKING_STATUS_LABELS,
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export function VenueOptionsManager({
  slug,
  venues,
  selectedVenueId,
}: {
  slug: string;
  venues: VenueOption[];
  selectedVenueId: string | null;
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
  const activeCategory = VENUE_CATEGORIES[stepIdx] as VenueCategory;
  const items = grouped[activeCategory];

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

        {items.length === 0 ? (
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>
            Nothing here yet—ask WandrAI above or use <strong>Add manually</strong>.
          </p>
        ) : (
          <ul className="venue-options-list">
            {items.map((venue) => {
              const isBase = selectedVenueId === venue.id;
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
