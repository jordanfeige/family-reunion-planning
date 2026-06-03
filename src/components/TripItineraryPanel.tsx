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
import { TripItineraryChat } from "@/components/TripItineraryChat";
import {
  getBookingBlocks,
  normalizeItinerary,
  type DayKey,
} from "@/lib/itinerary";

export function TripItineraryPanel({
  slug,
  tripName,
  shareUrl,
  itineraryRaw,
  selectedWeekendFriday,
  hasPlanContext,
  isPublished,
  planners,
  initialChatByDay = {},
}: {
  slug: string;
  tripName: string;
  shareUrl: string;
  itineraryRaw: unknown;
  selectedWeekendFriday: string | null;
  hasPlanContext: boolean;
  isPublished: boolean;
  planners: PlannerOption[];
  initialChatByDay?: Partial<Record<DayKey, UIMessage[]>>;
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
        Select a location and weekend above, then generate your Fri–Sun itinerary.
      </p>
    );
  }

  return (
    <div className="stack">
      <div className="action-stack" aria-label="Itinerary actions">
        <p className="action-stack-caption">Itinerary</p>
        <button
          type="button"
          className="btn btn-berry"
          disabled={busy}
          onClick={() => generate()}
        >
          {busy ? "Generating…" : hasBlocks ? "Regenerate itinerary" : "Generate itinerary"}
        </button>
        {hasBlocks ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setStatus(null);
              try {
                await publishItineraryAction(slug);
                setStatus("Published! Family can view the plan at your share link.");
                router.refresh();
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Could not publish.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Publishing…" : isPublished ? "Update published plan" : "Publish to family"}
          </button>
        ) : null}
        {isPublished ? (
          <button
            type="button"
            className="btn btn-secondary"
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

      {isPublished ? (
        <ShareLinkCard
          url={shareUrl}
          title="Live for family"
          hint="Same link as Confirmations. Re-publish after edits to update what they see."
        />
      ) : hasBlocks ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          When ready, publish so family can view the day-by-day plan at your share link.
        </p>
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
          <div className="day-tabs">
            {itinerary.days.map((day) => (
              <button
                key={day.key}
                type="button"
                className={activeDay === day.key ? "btn btn-primary" : "btn btn-secondary"}
                style={{ fontSize: "0.85rem" }}
                onClick={() => setActiveDay(day.key)}
              >
                {day.label.split(",")[0]}
              </button>
            ))}
          </div>

          {currentDay ? (
            <div className="stack" style={{ gap: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "var(--color-fjord)" }}>{currentDay.label}</h3>
              {currentDay.blocks.length === 0 ? (
                <p className="muted">Nothing planned this day yet.</p>
              ) : (
                <ul className="itinerary-block-list">
                  {currentDay.blocks.map((block) => (
                    <ItineraryBlockCard
                      key={block.id}
                      slug={slug}
                      dayKey={currentDay.key}
                      block={block}
                      planners={planners}
                    />
                  ))}
                </ul>
              )}


              <div className="card" style={{ padding: "1rem", background: "#fff" }}>
                <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
                  Refine this day with AI
                </p>
                <div className="refine-row">
                  <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 0 }}>
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
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-block-sm"
                    disabled={busy}
                    onClick={() => refineDay()}
                  >
                    Update day
                  </button>
                </div>
              </div>

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
                    focusDayLabel={currentDay?.label ?? activeDay}
                    hasBlocks={hasBlocks}
                    initialMessages={initialChatByDay[activeDay] ?? []}
                  />
                </div>
              </details>
            </div>
          ) : null}

          {bookingItems.length > 0 ? (
            <div>
              <h3 style={{ margin: "1rem 0 0.5rem" }}>Booking checklist</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
                {bookingItems.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      border: "1px solid rgba(28,61,90,0.1)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.65rem 0.85rem",
                      background: "rgba(94, 234, 212, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span className="muted"> · {item.dayLabel}</span>
                    <span className="pill" style={{ marginLeft: "0.5rem", fontSize: "0.7rem" }}>
                      {item.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
