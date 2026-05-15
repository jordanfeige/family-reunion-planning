"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addLocationSuggestionAction,
  extractLocationSuggestionsAction,
  publishLocationsFromChatAction,
} from "@/app/actions/trips";
import type { LocationSuggestion } from "@/lib/locationSuggestions";
import { isLocationOnSurvey } from "@/lib/locationSuggestions";

type SuggestionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; locations: LocationSuggestion[] }
  | { status: "error"; message: string };

export function LocationSuggestionCards({
  slug,
  messageId,
  assistantText,
  existingLocationTitles,
  enabled,
}: {
  slug: string;
  messageId: string;
  assistantText: string;
  existingLocationTitles: string[];
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
        const locations = await extractLocationSuggestionsAction(slug, text);
        setState({ status: "done", locations });
      } catch (err) {
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Could not read location suggestions.",
        });
      }
    })();
  }, [assistantText, enabled, slug]);

  if (!enabled) return null;

  if (state.status === "idle" || state.status === "loading") {
    return (
      <p className="location-suggestion-status muted" aria-live="polite">
        {state.status === "loading" ? "Finding locations in this reply…" : null}
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

  if (state.locations.length === 0) {
    return null;
  }

  const pending = state.locations.filter(
    (loc) => !isLocationOnSurvey(loc.title, existingLocationTitles),
  );

  async function addOne(title: string, summary?: string) {
    const key = `${title}-${summary ?? ""}`;
    setAddingId(key);
    setFeedback(null);
    try {
      const result = await addLocationSuggestionAction(slug, title, summary);
      setFeedback(
        result.added
          ? `Added “${title}” to the survey.`
          : `“${title}” is already on the survey.`,
      );
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not add location.");
    } finally {
      setAddingId(null);
    }
  }

  async function addAll() {
    setAddingAll(true);
    setFeedback(null);
    try {
      const result = await publishLocationsFromChatAction(slug, assistantText);
      setFeedback(
        result.added > 0
          ? `Added ${result.added} location(s) to the survey.`
          : "All suggestions from this reply are already on the survey.",
      );
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not add locations.");
    } finally {
      setAddingAll(false);
    }
  }

  return (
    <div className="location-suggestion-cards">
      <div className="location-suggestion-cards-header">
        <span className="location-suggestion-cards-title">Suggested for survey</span>
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
        {state.locations.map((loc) => {
          const onSurvey = isLocationOnSurvey(loc.title, existingLocationTitles);
          const key = `${loc.title}-${loc.summary ?? ""}`;
          return (
            <li key={key} className="location-suggestion-card">
              <div className="location-suggestion-card-body">
                <strong className="location-suggestion-card-title">{loc.title}</strong>
                {loc.summary ? (
                  <p className="location-suggestion-card-summary muted">{loc.summary}</p>
                ) : null}
              </div>
              {onSurvey ? (
                <span className="location-suggestion-badge">On survey</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={addingId !== null || addingAll}
                  onClick={() => void addOne(loc.title, loc.summary)}
                >
                  {addingId === key ? "Adding…" : "Add to survey"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
