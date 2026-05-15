"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  generateItineraryAction,
  publishItineraryAction,
  refineItineraryDayAction,
  unpublishItineraryAction,
  updateItineraryBlockStatusAction,
} from "@/app/actions/trips";
import {
  getBookingBlocks,
  normalizeItinerary,
  type BlockStatus,
  type DayKey,
} from "@/lib/itinerary";

const TYPE_LABELS: Record<string, string> = {
  activity: "Activity",
  meal: "Meal",
  lodging: "Lodging",
  travel: "Travel",
};

export function TripItineraryPanel({
  slug,
  shareUrl,
  itineraryRaw,
  selectedWeekendFriday,
  hasPlanContext,
  isPublished,
}: {
  slug: string;
  shareUrl: string;
  itineraryRaw: unknown;
  selectedWeekendFriday: string | null;
  hasPlanContext: boolean;
  isPublished: boolean;
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

  async function setBlockStatus(dayKey: DayKey, blockId: string, next: BlockStatus) {
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("day_key", dayKey);
    fd.set("block_id", blockId);
    fd.set("status", next);
    await updateItineraryBlockStatusAction(fd);
    router.refresh();
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
      <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <button
          type="button"
          className="btn btn-berry"
          disabled={busy}
          onClick={() => generate()}
        >
          {busy ? "Generating…" : hasBlocks ? "Regenerate full itinerary" : "Generate itinerary"}
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
        <div className="success-banner" style={{ margin: 0 }}>
          <strong>Live for family:</strong>{" "}
          <a href={shareUrl} target="_blank" rel="noreferrer">
            {shareUrl}
          </a>
          <span className="muted" style={{ display: "block", marginTop: "0.35rem", fontSize: "0.85rem" }}>
            Same link as Trip options below. Re-publish after edits to update what they see.
          </span>
        </div>
      ) : hasBlocks ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          When ready, publish so family can view the day-by-day plan at your share link (
          <span className="mono">{shareUrl}</span>).
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
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
                  {currentDay.blocks.map((block) => (
                    <li
                      key={block.id}
                      style={{
                        border: "1px solid rgba(28,61,90,0.12)",
                        borderRadius: "var(--radius-md)",
                        padding: "0.85rem 1rem",
                        background: "#fff",
                      }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                        <div>
                          <span className="pill" style={{ fontSize: "0.72rem", marginRight: "0.5rem" }}>
                            {TYPE_LABELS[block.type] ?? block.type}
                          </span>
                          {block.time ? (
                            <span className="muted" style={{ fontSize: "0.85rem" }}>
                              {block.time}
                            </span>
                          ) : null}
                        </div>
                        <select
                          value={block.status}
                          onChange={(e) =>
                            setBlockStatus(
                              currentDay.key,
                              block.id,
                              e.target.value as BlockStatus,
                            )
                          }
                          style={{ fontSize: "0.8rem" }}
                        >
                          <option value="idea">Idea</option>
                          <option value="to_book">To book</option>
                          <option value="booked">Booked</option>
                        </select>
                      </div>
                      <strong style={{ display: "block", marginTop: "0.35rem" }}>
                        {block.title}
                      </strong>
                      {block.notes ? (
                        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                          {block.notes}
                        </p>
                      ) : null}
                      {block.bookingUrl ? (
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                          <a href={block.bookingUrl} target="_blank" rel="noreferrer">
                            Booking link
                          </a>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <div className="card" style={{ padding: "1rem", background: "#fff" }}>
                <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
                  Refine this day with AI
                </p>
                <div className="row" style={{ alignItems: "flex-end", gap: "0.75rem" }}>
                  <div className="field" style={{ flex: 1, marginBottom: 0 }}>
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
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => refineDay()}
                  >
                    Update day
                  </button>
                </div>
              </div>
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
        <p className="muted" style={{ margin: 0 }}>
          Click <strong>Generate itinerary</strong> for a full Fri–Sun plan with activities,
          meals, and lodging ideas.
        </p>
      )}
    </div>
  );
}
