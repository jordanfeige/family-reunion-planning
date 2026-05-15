"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addVenueSuggestionAction,
  extractVenueSuggestionsAction,
  publishVenuesFromChatAction,
} from "@/app/actions/trips";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  isVenueOnShortlist,
  VENUE_CATEGORY_LABELS,
  type VenueOption,
} from "@/lib/venues";
import type { VenueSuggestion } from "@/lib/venueSuggestions";

function suggestionToOption(s: VenueSuggestion): VenueOption {
  return {
    id: "",
    title: s.title,
    summary: s.summary,
    category: s.category,
    priceType: s.priceType,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    priceUnit: s.priceUnit,
    priceNotes: s.priceNotes,
  };
}

type SuggestionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; venues: VenueSuggestion[] }
  | { status: "error"; message: string };

export function VenueSuggestionCards({
  slug,
  assistantText,
  existingVenues,
  enabled,
}: {
  slug: string;
  assistantText: string;
  existingVenues: VenueOption[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<SuggestionState>({ status: "idle" });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    const text = assistantText.trim();
    if (text.length < 40) return;

    fetchedRef.current = true;
    setState({ status: "loading" });

    void (async () => {
      try {
        const venues = await extractVenueSuggestionsAction(slug, text);
        setState({ status: "done", venues });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not read venue suggestions.",
        });
      }
    })();
  }, [assistantText, enabled, slug]);

  if (!enabled) return null;

  if (state.status === "idle" || state.status === "loading") {
    return (
      <p className="location-suggestion-status muted" aria-live="polite">
        {state.status === "loading" ? "Finding places in this reply…" : null}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p className="location-suggestion-status muted" style={{ margin: 0 }}>
        {state.message}
      </p>
    );
  }

  if (state.venues.length === 0) return null;

  const pending = state.venues.filter(
    (v) => !isVenueOnShortlist(v.title, v.category, existingVenues),
  );

  async function addOne(venue: VenueSuggestion) {
    const key = `${venue.category}-${venue.title}`;
    setAddingId(key);
    setFeedback(null);
    try {
      const result = await addVenueSuggestionAction(
        slug,
        venue.title,
        venue.category,
        venue.summary,
        venue.bookingUrl,
        venue.mapsUrl,
      );
      setFeedback(
        result.added
          ? `Added “${venue.title}” to your shortlist.`
          : `“${venue.title}” is already on the shortlist.`,
      );
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not add venue.");
    } finally {
      setAddingId(null);
    }
  }

  async function addAll() {
    setAddingAll(true);
    setFeedback(null);
    try {
      const result = await publishVenuesFromChatAction(slug, assistantText);
      setFeedback(
        result.added > 0
          ? `Added ${result.added} place(s) to your shortlist.`
          : "All suggestions from this reply are already on the shortlist.",
      );
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not add venues.");
    } finally {
      setAddingAll(false);
    }
  }

  return (
    <div className="location-suggestion-cards">
      <div className="location-suggestion-cards-header">
        <span className="location-suggestion-cards-title">Suggested places</span>
        {pending.length > 0 ? (
          <button
            type="button"
            className="btn btn-berry btn-sm"
            disabled={addingAll || addingId !== null}
            onClick={() => void addAll()}
          >
            {addingAll ? "Adding…" : `Add all (${pending.length})`}
          </button>
        ) : null}
      </div>

      {feedback ? (
        <p
          className={
            feedback.includes("Could not") ? "error-banner" : "success-banner"
          }
          style={{ margin: 0, fontSize: "0.82rem" }}
        >
          {feedback}
        </p>
      ) : null}

      <ul className="location-suggestion-list">
        {state.venues.map((venue) => {
          const onList = isVenueOnShortlist(venue.title, venue.category, existingVenues);
          const key = `${venue.category}-${venue.title}`;
          return (
            <li key={key} className="location-suggestion-card">
              <div className="location-suggestion-card-body">
                <span className="venue-category-pill">
                  {VENUE_CATEGORY_LABELS[venue.category]}
                </span>
                <strong className="location-suggestion-card-title">{venue.title}</strong>
                <p className="ballot-vote-price" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>
                  {formatVenuePrice(suggestionToOption(venue))}
                </p>
                {venue.summary ? (
                  <p className="location-suggestion-card-summary muted">{venue.summary}</p>
                ) : null}
              </div>
              {onList ? (
                <span className="location-suggestion-badge">On shortlist</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={addingId !== null || addingAll}
                  onClick={() => void addOne(venue)}
                >
                  {addingId === key ? "Adding…" : "Add"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
