"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  sendSurveyToFamilyAction,
} from "@/app/actions/trips";
import { savePlanSurveyDraftAction } from "@/app/actions/planDraft";
import { SignInToSendSheet } from "@/components/SignInToSendSheet";
import { SurveySegmentGroup } from "@/components/SurveySegmentGroup";
import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { WeekendDatePicker } from "@/components/WeekendDatePicker";
import { focusBlockingField } from "@/lib/formFocus";
import type { LocationOption } from "@/lib/locations";
import type { SurveyPrefs } from "@/lib/surveyPrefs";
import {
  locationMatchScore,
  SURVEY_BUDGET_OPTIONS,
  SURVEY_LODGING_OPTIONS,
  SURVEY_MUST_HAVE_OPTIONS,
  SURVEY_PACE_OPTIONS,
  SURVEY_TRAVEL_OPTIONS,
  surveyNudgeCopy,
} from "@/lib/surveyPrefs";
import { abbreviateState, formatDateNumericUS, formatDateProseUS } from "@/lib/units";
import { filterValidFridays, parseFridayIso, sundayFromFriday } from "@/lib/weekends";

function formatSurveyWeekendLabel(fridayIso: string): { prose: string; numeric: string } {
  const fri = parseFridayIso(fridayIso);
  const sun = sundayFromFriday(fridayIso);
  if (!fri || !sun) {
    return { prose: fridayIso, numeric: fridayIso };
  }
  const prose = `${formatDateProseUS(fri)} – ${formatDateProseUS(sun)}`;
  const numeric = formatDateNumericUS(fri);
  return { prose, numeric };
}

export function HubSurveyComposer({
  slug,
  signedIn,
  locations,
  initialPrefs,
  initialWeekends = [],
  onSent,
  autoSend = false,
  planDraftMode = false,
}: {
  slug?: string;
  signedIn: boolean;
  locations: LocationOption[];
  initialPrefs?: SurveyPrefs;
  initialWeekends?: string[];
  onSent?: () => void;
  autoSend?: boolean;
  planDraftMode?: boolean;
}) {
  const [prefs, setPrefs] = useState<SurveyPrefs>(() => ({
    pace: initialPrefs?.pace ?? "balanced",
    lodging: initialPrefs?.lodging ?? "rental",
    mustHave: initialPrefs?.mustHave ?? "swimming",
    budget: initialPrefs?.budget ?? "middle",
    travel: initialPrefs?.travel ?? "driving",
    homeCity: initialPrefs?.homeCity ?? "",
    homeState: initialPrefs?.homeState ?? "",
    proposedWeekends: filterValidFridays(
      initialPrefs?.proposedWeekends ?? initialWeekends,
    ),
  }));
  const [weekends, setWeekends] = useState<string[]>(() =>
    filterValidFridays(initialPrefs?.proposedWeekends ?? initialWeekends),
  );
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const ranked = useMemo(() => {
    return [...locations]
      .map((loc) => ({
        loc,
        score: locationMatchScore(loc as LocationOption & Record<string, unknown>, prefs),
      }))
      .sort((a, b) => b.score - a.score);
  }, [locations, prefs]);

  const nudge = surveyNudgeCopy(prefs, locations.length);

  const patchPrefs = useCallback((patch: Partial<SurveyPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setError(null);
  }, []);

  function validate(): string | null {
    if (locations.length === 0) {
      return "Add at least one destination on Destinations before sending the survey.";
    }
    if (!prefs.homeCity?.trim()) return "Enter your home city before sending.";
    if (!prefs.homeState?.trim()) return "Enter your home state before sending.";
    if (weekends.length === 0) return "Pick at least one weekend for the survey.";
    return null;
  }

  function focusValidationTarget(message: string) {
    if (message.includes("destination")) {
      focusBlockingField(".hub-survey-rerank-empty, .hub-survey-rerank");
    } else if (message.includes("city")) {
      focusBlockingField("#organizer_home_city");
    } else if (message.includes("state")) {
      focusBlockingField("#organizer_home_state");
    } else if (message.includes("weekend")) {
      focusBlockingField(".weekend-date-picker, .survey-weekend-slots");
    }
  }

  function authCallbackUrl(): string {
    if (planDraftMode || !slug) {
      return "/api/plan/claim?send=1";
    }
    return `/t/${slug}?stop=survey&send=1`;
  }

  function persistDraftThenAuth() {
    startTransition(async () => {
      try {
        if (planDraftMode) {
          await savePlanSurveyDraftAction({
            surveyPrefs: { ...prefs, proposedWeekends: weekends },
            step: "survey",
          });
        }
        setShowAuthSheet(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save draft.");
      }
    });
  }

  function doSend() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      focusValidationTarget(validationError);
      return;
    }

    if (!signedIn) {
      persistDraftThenAuth();
      return;
    }

    if (planDraftMode) {
      startTransition(async () => {
        try {
          await savePlanSurveyDraftAction({
            surveyPrefs: { ...prefs, proposedWeekends: weekends },
            step: "survey",
          });
          window.location.href = "/api/plan/claim?send=1";
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save draft.");
        }
      });
      return;
    }

    if (!slug) {
      persistDraftThenAuth();
      return;
    }

    startTransition(async () => {
      try {
        await sendSurveyToFamilyAction({
          slug,
          ...prefs,
          homeCity: prefs.homeCity!.trim(),
          homeState: abbreviateState(prefs.homeState!),
          proposedWeekends: weekends,
        });
        setSent(true);
        setError(null);
        onSent?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send survey.");
      }
    });
  }

  useEffect(() => {
    if (!autoSend) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("send") !== "1") return;

    params.delete("send");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);

    if (signedIn && slug) {
      doSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount when send=1
  }, [autoSend, signedIn, slug]);

  return (
    <div className="hub-survey-compose">
      <div className="hub-survey-compose-grid">
        <div className="hub-survey-compose-main stack">
          <SurveySegmentGroup
            legend="Pace"
            name="pace"
            options={SURVEY_PACE_OPTIONS}
            value={prefs.pace}
            onChange={(pace) => patchPrefs({ pace })}
          />
          <SurveySegmentGroup
            legend="Where everyone sleeps"
            name="lodging"
            options={SURVEY_LODGING_OPTIONS}
            value={prefs.lodging}
            onChange={(lodging) => patchPrefs({ lodging })}
          />
          <SurveySegmentGroup
            legend="Must-haves"
            name="must_have"
            options={SURVEY_MUST_HAVE_OPTIONS}
            value={prefs.mustHave}
            onChange={(mustHave) => patchPrefs({ mustHave })}
          />
          <SurveySegmentGroup
            legend="Budget per household"
            name="budget"
            options={SURVEY_BUDGET_OPTIONS}
            value={prefs.budget}
            onChange={(budget) => patchPrefs({ budget })}
          />
          <SurveySegmentGroup
            legend="Travel"
            name="travel"
            options={SURVEY_TRAVEL_OPTIONS}
            value={prefs.travel}
            onChange={(travel) => patchPrefs({ travel })}
          />

          <fieldset className="survey-segment-group">
            <legend className="survey-segment-legend">Where you&apos;re coming from</legend>
            <p className="survey-home-helper">
              So we can show everyone their own drive time.
            </p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="organizer_home_city">City</label>
                <input
                  id="organizer_home_city"
                  value={prefs.homeCity ?? ""}
                  placeholder="Sioux Falls"
                  autoComplete="address-level2"
                  onChange={(e) => patchPrefs({ homeCity: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="organizer_home_state">State</label>
                <input
                  id="organizer_home_state"
                  value={prefs.homeState ?? ""}
                  placeholder="SD"
                  maxLength={2}
                  autoComplete="address-level1"
                  onChange={(e) =>
                    patchPrefs({ homeState: e.target.value.toUpperCase().slice(0, 2) })
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="survey-segment-group">
            <legend className="survey-segment-legend">Weekend</legend>
            <div className="survey-weekend-slots">
              {weekends.length === 0 ? (
                <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
                  Pick candidate weekends below — family will tap the ones that work.
                </p>
              ) : (
                <ul className="survey-weekend-slot-list">
                  {weekends.map((iso) => {
                    const { prose, numeric } = formatSurveyWeekendLabel(iso);
                    return (
                      <li key={iso} className="survey-weekend-slot">
                        <span className="survey-weekend-slot-prose">{prose}</span>
                        <span className="survey-weekend-slot-numeric">{numeric}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <WeekendDatePicker
              name="proposed_weekends"
              defaultSelected={weekends}
              onChange={setWeekends}
            />
          </fieldset>
        </div>

        <aside className="hub-survey-rerank" aria-label="Destination re-ranking">
          <p className="hub-survey-rerank-eyebrow">Re-ranking</p>
          <h3 className="hub-survey-rerank-title">Updates as you answer</h3>
          {locations.length === 0 ? (
            <p className="muted hub-survey-rerank-empty">Add places on Destinations first.</p>
          ) : (
            <ul className="hub-survey-rerank-list">
              {ranked.map(({ loc, score }) => (
                <li key={loc.id} className="hub-survey-rerank-row">
                  <div className="hub-survey-rerank-row-head">
                    <span className="hub-survey-rerank-name">{loc.title}</span>
                    <span className="hub-survey-rerank-pct">{score}% match</span>
                  </div>
                  <div className="hub-survey-rerank-bar" aria-hidden>
                    <span className="hub-survey-rerank-fill" style={{ width: `${score}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {nudge ? (
        <p className="trail-nudge hub-survey-nudge">{nudge}</p>
      ) : null}

      {showAuthSheet ? (
        <SignInToSendSheet
          callbackUrl={authCallbackUrl()}
          onDismiss={() => setShowAuthSheet(false)}
        />
      ) : null}

      <div className="hub-survey-compose-footer">
        <button
          type="button"
          className="btn btn-berry"
          disabled={pending}
          onClick={doSend}
        >
          {pending ? "Sending…" : sent ? "Survey sent" : "Send survey to family"}
        </button>
        <CtaRequirementHint>
          {locations.length === 0
            ? "Add at least one destination on Destinations before sending."
            : error}
        </CtaRequirementHint>
      </div>
    </div>
  );
}
