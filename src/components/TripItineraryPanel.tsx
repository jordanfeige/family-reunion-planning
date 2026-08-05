"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  generateItineraryAction,
  publishItineraryAction,
  refineItineraryDayAction,
  unpublishItineraryAction,
} from "@/app/actions/trips";
import {
  ItineraryBlockCard,
  type PlannerOption,
} from "@/components/ItineraryBlockCard";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { queueTrailBeat } from "@/components/TrailBeat";
import { TripItineraryChat } from "@/components/TripItineraryChat";
import {
  getBookingBlocks,
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
  const router = useRouter();
  const itinerary = normalizeItinerary(itineraryRaw, selectedWeekendFriday);
  const [activeDay, setActiveDay] = useState<DayKey>(
    itinerary.days[0]?.key ?? "friday",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [refineDraft, setRefineDraft] = useState("");

  const currentDay = itinerary.days.find((d) => d.key === activeDay);
  const bookingItems = getBookingBlocks(itinerary);
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
    hasBlocks && saturdayCount > sundayCount && saturdayCount >= 3;

  async function generate() {
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

  async function refineDay() {
    const text = refineDraft.trim();
    if (!text) return;
    setBusy(true);
    setStatus(null);
    try {
      await refineItineraryDayAction(slug, activeDay, text);
      setRefineDraft("");
      setStatus(`Updated ${activeDay}.`);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not refine day.");
    } finally {
      setBusy(false);
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
          A loose plan — drag anything, or ask me to swap it.
        </p>
      </header>

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
                <p className="muted weekend-timeline-empty">Nothing planned this day yet.</p>
              ) : (
                <ul className="weekend-timeline">
                  {currentDay.blocks.map((block) => (
                    <ItineraryBlockCard
                      key={block.id}
                      slug={slug}
                      dayKey={currentDay.key}
                      block={block}
                      planners={planners}
                      timeline
                    />
                  ))}
                </ul>
              )}

              <button type="button" className="weekend-ghost-row">
                + Add a stop, or ask WandrAI for an idea
              </button>

              <details className="weekend-block-details">
                <summary>Edit stops &amp; booking status</summary>
                <ul className="itinerary-block-list">
                  {currentDay.blocks.map((block) => (
                    <ItineraryBlockCard
                      key={`edit-${block.id}`}
                      slug={slug}
                      dayKey={currentDay.key}
                      block={block}
                      planners={planners}
                    />
                  ))}
                </ul>
              </details>

              <details className="itinerary-chat-details">
                <summary className="itinerary-chat-details-summary">
                  Ask WandrAI about this plan
                </summary>
                <div className="itinerary-chat-details-body">
                  <div className="field" style={{ marginBottom: "0.75rem" }}>
                    <label htmlFor={`refine-${activeDay}`} className="sr-only">
                      Refine day
                    </label>
                    <textarea
                      id={`refine-${activeDay}`}
                      style={{ minHeight: "72px", width: "100%" }}
                      placeholder='e.g. "Make Saturday lighter for toddlers"'
                      value={refineDraft}
                      onChange={(e) => setRefineDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-block-sm"
                      disabled={busy}
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => refineDay()}
                    >
                      Update day
                    </button>
                  </div>
                  <TripItineraryChat
                    key={activeDay}
                    slug={slug}
                    tripName={tripName}
                    focusDay={activeDay}
                    focusDayLabel={currentDay?.label ?? activeDay}
                    hasBlocks={hasBlocks}
                    initialMessages={initialChatByDay[activeDay] ?? []}
                  />
                </div>
              </details>
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

          {showSaturdayNudge ? (
            <p className="weekend-itinerary-nudge">
              Saturday is the fullest day. Say the word and I&apos;ll move the hike to
              Sunday.
            </p>
          ) : null}

          {isPublished ? (
            <ShareLinkCard
              url={shareUrl}
              title="Live for family"
              hint="Same link as Share. Re-publish after edits to update what they see."
              bare
            />
          ) : null}

          {bookingItems.length > 0 ? (
            <details className="weekend-block-details">
              <summary>Booking checklist ({bookingItems.length})</summary>
              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
                {bookingItems.map((item) => (
                  <li key={item.id} className="weekend-booking-row">
                    <strong>{item.title}</strong>
                    <span className="muted"> · {item.dayLabel}</span>
                    <span className="pill">{item.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <>
          <details className="itinerary-chat-details">
            <summary className="itinerary-chat-details-summary">
              Ask WandrAI about this plan
            </summary>
            <div className="itinerary-chat-details-body">
              <TripItineraryChat
                key={activeDay}
                slug={slug}
                tripName={tripName}
                focusDay={activeDay}
                focusDayLabel={
                  itinerary.days.find((d) => d.key === activeDay)?.label ?? activeDay
                }
                hasBlocks={false}
                initialMessages={initialChatByDay[activeDay] ?? []}
              />
            </div>
          </details>
          <p className="muted" style={{ margin: 0 }}>
            Click <strong>Generate itinerary</strong> for a full Fri–Sun plan with activities,
            meals, and lodging ideas.
          </p>
        </>
      )}
    </div>
  );
}
