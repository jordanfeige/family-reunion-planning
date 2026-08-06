"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { updateItineraryBlockAction } from "@/app/actions/trips";
import { CompactSelect } from "@/components/CompactSelect";
import { FormattedTimeOfDay } from "@/components/FormattedTimeOfDay";
import { SoftImage } from "@/components/SoftImage";
import {
  blockStartTime,
  blockTagLabel,
  type BlockStatus,
  type DayKey,
  type ItineraryBlock,
} from "@/lib/itinerary";
import { formatUsd } from "@/lib/units";

const STATUS_OPTIONS: { value: BlockStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "to_book", label: "To book" },
  { value: "booked", label: "Booked" },
];

export type PlannerOption = {
  userId: string;
  label: string;
};

export function ItineraryBlockCard({
  slug,
  dayKey,
  block,
  planners,
  timeline = false,
}: {
  slug: string;
  dayKey: DayKey;
  block: ItineraryBlock;
  planners: PlannerOption[];
  timeline?: boolean;
}) {
  const router = useRouter();
  const [notesDraft, setNotesDraft] = useState(block.plannerNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const startTime = blockStartTime(block);
  const tag = blockTagLabel(block);

  useEffect(() => {
    setNotesDraft(block.plannerNotes ?? "");
  }, [block.id, block.plannerNotes]);

  async function patch(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("day_key", dayKey);
    fd.set("block_id", block.id);
    for (const [key, value] of Object.entries(fields)) {
      fd.set(key, value);
    }
    await updateItineraryBlockAction(fd);
    router.refresh();
  }

  async function saveNotes() {
    const trimmed = notesDraft.trim();
    if (trimmed === (block.plannerNotes ?? "").trim()) return;
    setSavingNotes(true);
    try {
      await patch({ planner_notes: trimmed });
    } finally {
      setSavingNotes(false);
    }
  }

  if (timeline) {
    return (
      <li className="weekend-timeline-row">
        <div className="weekend-timeline-gutter">
          {startTime ? (
            <FormattedTimeOfDay value={startTime} className="weekend-timeline-time" />
          ) : (
            <span className="weekend-timeline-time is-empty">—</span>
          )}
          <span className="weekend-timeline-connector" aria-hidden="true">
            <span className="weekend-timeline-dot" />
          </span>
        </div>
        <article className="weekend-timeline-card">
          <div className="weekend-timeline-card-head">
            <strong className="weekend-timeline-title">{block.title}</strong>
            <span className={`weekend-tag-chip is-${tag}`}>{tag}</span>
          </div>
          {block.notes || block.costUsd !== undefined ? (
            <p className="weekend-timeline-note">
              {block.notes}
              {block.notes && block.costUsd !== undefined ? " · " : null}
              {block.costUsd !== undefined ? formatUsd(block.costUsd) : null}
            </p>
          ) : null}
          {block.photoUrl ? (
            <SoftImage
              src={block.photoUrl}
              letter={block.title}
              className="weekend-timeline-photo"
              width={96}
              height={70}
            />
          ) : null}
        </article>
      </li>
    );
  }

  return (
    <li className="itinerary-block-card">
      <div className="itinerary-block-card-top">
        <div className="itinerary-block-meta">
          <span className={`weekend-tag-chip is-${tag}`}>{tag}</span>
          {startTime ? (
            <FormattedTimeOfDay value={startTime} className="muted itinerary-block-time" />
          ) : null}
        </div>
      </div>

      <strong className="itinerary-block-title">{block.title}</strong>

      {block.notes ? (
        <p className="muted itinerary-block-ai-notes">{block.notes}</p>
      ) : null}

      {block.costUsd !== undefined ? (
        <p className="itinerary-block-cost">{formatUsd(block.costUsd)}</p>
      ) : null}

      {block.bookingUrl ? (
        <p className="itinerary-block-booking">
          <a href={block.bookingUrl} target="_blank" rel="noreferrer">
            Booking link
          </a>
        </p>
      ) : null}

      <div className="itinerary-block-controls">
        <div className="itinerary-block-field">
          <span className="itinerary-block-label">Status</span>
          <div className="status-segment" role="group" aria-label="Booking status">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`status-segment-btn${block.status === opt.value ? " is-active" : ""}`}
                aria-pressed={block.status === opt.value}
                onClick={() => {
                  if (block.status === opt.value) return;
                  void patch({ status: opt.value });
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {planners.length > 0 ? (
          <div className="itinerary-block-field">
            <CompactSelect
              id={`assign-${block.id}`}
              aria-label="Assigned to"
              value={block.assignedToUserId ?? ""}
              options={[
                { value: "", label: "Unassigned" },
                ...planners.map((p) => ({ value: p.userId, label: p.label })),
              ]}
              onChange={(next) => {
                void patch({ assigned_to_user_id: next });
              }}
            />
          </div>
        ) : null}

        <div className="itinerary-block-field itinerary-block-field--grow">
          <label className="itinerary-block-label" htmlFor={`notes-${block.id}`}>
            Team notes
          </label>
          <textarea
            id={`notes-${block.id}`}
            className="itinerary-block-notes"
            rows={2}
            placeholder="Who's booking this, dietary needs, links…"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => void saveNotes()}
          />
          {savingNotes ? (
            <span className="itinerary-block-notes-hint">Saving…</span>
          ) : notesDraft !== (block.plannerNotes ?? "") ? (
            <span className="itinerary-block-notes-hint">Tap away to save</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
