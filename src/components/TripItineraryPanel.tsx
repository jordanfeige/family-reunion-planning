"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addItineraryStopAction,
  applyItineraryComposerAction,
  generateItineraryAction,
  publishItineraryAction,
  refineItineraryDayAction,
  undoItineraryEditAction,
  unpublishItineraryAction,
} from "@/app/actions/trips";
import {
  ItineraryBlockCard,
  type PlannerOption,
} from "@/components/ItineraryBlockCard";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { queueTrailBeat } from "@/components/TrailBeat";
import {
  bookingSummary,
  DAY_KEYS,
  normalizeItinerary,
  type DayKey,
} from "@/lib/itinerary";
import { formatDateRangeUS } from "@/lib/units";
import { parseFridayIso, sundayFromFriday } from "@/lib/weekends";
import { goToTripHubStep } from "@/lib/wizardNav";

const DAY_TAB_LABELS: Record<DayKey, string> = {
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export function TripItineraryPanel({
  slug,
  tripName,
  shareUrl,
  locationTitle,
  itineraryRaw,
  selectedWeekendFriday,
  hasPlanContext,
  isPublished,
  planners,
  initialChatByDay = {},
  lockedChip,
}: {
  slug: string;
  tripName: string;
  shareUrl: string;
  locationTitle?: string | null;
  itineraryRaw: unknown;
  selectedWeekendFriday: string | null;
  hasPlanContext: boolean;
  isPublished: boolean;
  planners: PlannerOption[];
  initialChatByDay?: Partial<Record<DayKey, UIMessage[]>>;
  lockedChip?: string | null;
}) {
  void initialChatByDay;
  const router = useRouter();
  const itinerary = normalizeItinerary(itineraryRaw, selectedWeekendFriday);
  const [activeDay, setActiveDay] = useState<DayKey>(
    itinerary.days[0]?.key ?? "friday",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [askDraft, setAskDraft] = useState("");
  const [askWorking, setAskWorking] = useState(false);
  const [askLine, setAskLine] = useState<string | null>(null);
  const [diffLine, setDiffLine] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [bookingFilter, setBookingFilter] = useState<"all" | "booked" | "deposit">(
    "all",
  );
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const currentDay = itinerary.days.find((d) => d.key === activeDay);
  const summary = bookingSummary(itinerary);
  const hasBlocks = itinerary.days.some((d) => d.blocks.length > 0);

  const fri = selectedWeekendFriday ? parseFridayIso(selectedWeekendFriday) : null;
  const sun = selectedWeekendFriday ? sundayFromFriday(selectedWeekendFriday) : null;
  const headerTitle =
    locationTitle && fri && sun
      ? `${locationTitle}, ${formatDateRangeUS(fri, sun)}`
      : locationTitle ?? tripName;

  const saturdayCount =
    itinerary.days.find((d) => d.key === "saturday")?.blocks.length ?? 0;
  const sundayCount =
    itinerary.days.find((d) => d.key === "sunday")?.blocks.length ?? 0;
  const showSaturdayNudge =
    hasBlocks &&
    !suggestionDismissed &&
    saturdayCount > sundayCount &&
    saturdayCount >= 3;

  async function generate() {
    if (
      hasBlocks &&
      !window.confirm(
        "Regenerate replaces the current itinerary. In-place edits will be lost. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await generateItineraryAction(slug);
      setStatus("Itinerary generated—browse each day below.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAsk() {
    const text = askDraft.trim();
    if (!text || askWorking) return;
    setAskWorking(true);
    setAskLine("Working…");
    setStatus(null);
    try {
      const result = await Promise.race([
        applyItineraryComposerAction(slug, text, activeDay),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20000),
        ),
      ]);
      if (result.kind === "answer") {
        setAskLine(result.message);
        setDiffLine(null);
      } else {
        setAskLine(null);
        setDiffLine(result.message);
        const ids = new Set(
          (currentDay?.blocks ?? []).map((b) => b.id),
        );
        setHighlightIds(ids);
        window.setTimeout(() => setHighlightIds(new Set()), 2000);
        router.refresh();
      }
      setAskDraft("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't reach me just now.";
      if (msg === "timeout" || /network|fetch/i.test(msg)) {
        setAskLine("Couldn't reach me just now.");
      } else {
        setAskLine(msg);
      }
    } finally {
      setAskWorking(false);
    }
  }

  async function undo() {
    try {
      const res = await undoItineraryEditAction(slug);
      setDiffLine(`Undid: ${res.label}`);
      router.refresh();
    } catch {
      setDiffLine((prev) =>
        prev ? `${prev} — Couldn't undo.` : "Couldn't undo.",
      );
    }
  }

  if (!hasPlanContext) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Save a location and weekend on Decision, then generate your Fri–Sun itinerary.
      </p>
    );
  }

  return (
    <div className={`weekend-itinerary${hasBlocks ? " itinerary-reveal" : ""}`}>
      {lockedChip ? (
        <p className="trail-locked-chip" aria-label="Locked plan context">
          {lockedChip}
        </p>
      ) : null}

      <header className="weekend-itinerary-head">
        <h2 className="weekend-itinerary-title">{headerTitle}</h2>
        <p className="weekend-itinerary-lede">
          A loose plan — edit anything in place, or ask me to swap it.
        </p>
      </header>

      <div className="itinerary-ask">
        <div className="itinerary-ask-composer">
          <textarea
            className="itinerary-ask-input"
            rows={1}
            placeholder="Move the hike to Sunday, add a rainy-day option, ask me anything…"
            value={askDraft}
            onChange={(e) => setAskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitAsk();
              }
            }}
          />
          <span className="itinerary-ask-hold" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path
                d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0M12 19v3M8 22h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Hold to talk
          </span>
          <button
            type="button"
            className={`btn btn-berry itinerary-ask-send${askWorking ? " is-working" : ""}`}
            onClick={() => void submitAsk()}
          >
            Send
          </button>
        </div>
        {askLine ? (
          <p className="itinerary-ask-status">
            {askLine}{" "}
            {askLine.includes("Couldn't") || askLine.includes("Didn't") ? (
              <button type="button" className="itinerary-inline-retry" onClick={() => void submitAsk()}>
                Try again
              </button>
            ) : null}
          </p>
        ) : null}
        {diffLine ? (
          <p className="itinerary-ask-diff">
            {diffLine}{" "}
            <button type="button" onClick={() => void undo()}>
              Undo
            </button>
          </p>
        ) : null}
      </div>

      {showSaturdayNudge ? (
        <div className="itinerary-suggestion">
          <span>Saturday is the fullest day. Say the word and I&apos;ll move the hike to Sunday.</span>
          <button
            type="button"
            className="btn btn-berry btn-sm"
            disabled={busy || askWorking}
            onClick={async () => {
              setSuggestionDismissed(true);
              setAskDraft("Move the hike to Sunday");
              await refineItineraryDayAction(
                slug,
                "saturday",
                "Move the longest outdoor hike or walk from Saturday to Sunday morning.",
              );
              setDiffLine("Moved the hike toward Sunday.");
              router.refresh();
            }}
          >
            Move it
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSuggestionDismissed(true)}
          >
            Leave it
          </button>
        </div>
      ) : null}

      {!hasBlocks ? (
        <div className="action-stack" aria-label="Itinerary actions">
          <button
            type="button"
            className="btn btn-berry"
            disabled={busy}
            onClick={() => generate()}
          >
            {busy ? "Generating…" : "Generate itinerary"}
          </button>
          <p className="muted" style={{ margin: 0 }}>
            Or let me draft three days from your dates — use Generate above.
          </p>
        </div>
      ) : null}

      {status ? (
        <p
          className={status.includes("Could not") ? "error-banner" : "success-banner"}
          style={{ margin: 0 }}
        >
          {status}
        </p>
      ) : null}

      {hasBlocks ? (
        <>
          {summary.total > 0 ? (
            <p className="itinerary-booking-summary">
              <button
                type="button"
                className="itinerary-booking-seg is-action"
                onClick={() => setBookingFilter("booked")}
              >
                <span className="itinerary-booking-count">{summary.booked}</span>
                <span className="itinerary-booking-label">
                  {" "}
                  of {summary.total} booked
                </span>
              </button>
              {summary.needDeposit > 0 ? (
                <>
                  <span className="itinerary-booking-dot" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    className="itinerary-booking-seg is-action"
                    onClick={() => setBookingFilter("deposit")}
                  >
                    <span className="itinerary-booking-count">
                      {summary.needDeposit}
                    </span>
                    <span className="itinerary-booking-label"> need deposits</span>
                  </button>
                </>
              ) : null}
              {bookingFilter !== "all" ? (
                <>
                  <span className="itinerary-booking-dot" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    className="itinerary-booking-seg is-action"
                    onClick={() => setBookingFilter("all")}
                  >
                    Show all
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="weekend-day-tabs" role="tablist" aria-label="Weekend days">
            {itinerary.days.map((day) => (
              <button
                key={day.key}
                type="button"
                role="tab"
                aria-selected={activeDay === day.key}
                className={`weekend-day-tab${activeDay === day.key ? " is-active" : ""}`}
                onClick={() => setActiveDay(day.key)}
              >
                {DAY_TAB_LABELS[day.key]}
              </button>
            ))}
          </div>

          {currentDay ? (
            <div className="weekend-timeline-wrap">
              {currentDay.blocks.length === 0 ? (
                <p className="muted weekend-timeline-empty">
                  Nothing planned yet — a free day is a legitimate choice.
                </p>
              ) : (
                <ul className="weekend-timeline">
                  {currentDay.blocks.map((block, blockIndex) => {
                    const dimmed =
                      bookingFilter === "booked"
                        ? !(block.status === "booked" || block.status === "paid")
                        : bookingFilter === "deposit"
                          ? block.status !== "to_book"
                          : false;
                    return (
                      <ItineraryBlockCard
                        key={block.id}
                        slug={slug}
                        dayKey={currentDay.key}
                        block={block}
                        planners={planners}
                        timeline
                        dayKeys={[...DAY_KEYS]}
                        dimmed={dimmed}
                        highlighted={highlightIds.has(block.id)}
                        isLast={blockIndex === currentDay.blocks.length - 1}
                      />
                    );
                  })}
                </ul>
              )}

              <button
                type="button"
                className="weekend-ghost-row"
                onClick={async () => {
                  await addItineraryStopAction(slug, activeDay);
                  router.refresh();
                }}
              >
                + Add a stop
              </button>
            </div>
          ) : null}

          <div className="weekend-itinerary-foot">
            <button
              type="button"
              className="btn btn-berry weekend-share-cta"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setStatus(null);
                try {
                  await publishItineraryAction(slug);
                  if (!isPublished) {
                    queueTrailBeat(slug, "plan");
                    goToTripHubStep(slug, "share");
                  } else {
                    setStatus("Published plan updated.");
                  }
                  router.refresh();
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "Could not publish.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Publishing…" : "Share with the family →"}
            </button>

            <div className="weekend-itinerary-actions-secondary">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => generate()}
              >
                Regenerate
              </button>
              {isPublished ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setStatus(null);
                    try {
                      await unpublishItineraryAction(slug);
                      setStatus("Unpublished—the share link no longer shows the itinerary.");
                      router.refresh();
                    } catch (err) {
                      setStatus(err instanceof Error ? err.message : "Could not unpublish.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Unpublish
                </button>
              ) : null}
            </div>
          </div>

          {isPublished ? (
            <ShareLinkCard
              url={shareUrl}
              title="Live for family"
              hint="Same link as Share. Re-publish after edits to update what they see."
              bare
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
