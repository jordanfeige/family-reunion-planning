"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { updateItineraryBlockAction } from "@/app/actions/trips";
import { FormattedTimeOfDay } from "@/components/FormattedTimeOfDay";
import { SoftImage } from "@/components/SoftImage";
import {
  blockStartTime,
  blockTagLabel,
  bookingStatusLabel,
  nextBookingStatus,
  type DayKey,
  type ItineraryBlock,
} from "@/lib/itinerary";
import { formatTimeOfDay } from "@/lib/datetime";
import { formatUsd } from "@/lib/units";

export type PlannerOption = {
  userId: string;
  label: string;
};

function InlineField({
  value,
  className,
  wrapClassName,
  multiline,
  maxLength,
  emptyLabel,
  displayValue,
  validate,
  onCommit,
}: {
  value: string;
  className?: string;
  wrapClassName?: string;
  multiline?: boolean;
  maxLength?: number;
  emptyLabel?: string;
  displayValue?: string;
  validate?: (next: string) => string | null;
  onCommit: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [forceSave, setForceSave] = useState(false);
  const failCount = useRef(0);
  const prior = useRef(value);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
      prior.current = value;
    }
  }, [value, editing]);

  async function commit() {
    const next = draft.trim();
    const validation = validate?.(next) ?? null;
    if (validation) {
      setError(validation);
      setDraft(prior.current);
      setEditing(false);
      return;
    }
    if (next === prior.current.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    const snapshot = prior.current;
    if (!forceSave) {
      setEditing(false);
      prior.current = next;
    }
    try {
      await onCommit(next);
      failCount.current = 0;
      setForceSave(false);
      setError(null);
      setEditing(false);
      prior.current = next;
    } catch {
      prior.current = snapshot;
      setDraft(draft);
      setEditing(true);
      failCount.current += 1;
      if (failCount.current >= 2) setForceSave(true);
      setError("Didn't save. Try again");
    }
  }

  if (!editing) {
    const shown = value
      ? displayValue ?? value
      : emptyLabel ?? (
          <span className="muted">{multiline ? "Add note…" : "—"}</span>
        );
    return (
      <div className={wrapClassName}>
        <button
          type="button"
          className={`itinerary-stop-edit ${className ?? ""}`}
          onClick={() => {
            setDraft(value);
            setEditing(true);
            setError(null);
          }}
        >
          {shown}
        </button>
        {error ? (
          <p className="itinerary-stop-error">
            {error}.{" "}
            <button
              type="button"
              className="itinerary-inline-retry"
              onClick={() => {
                setEditing(true);
                setError(null);
              }}
            >
              Try again
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  const remaining =
    maxLength != null ? maxLength - draft.length : null;

  return (
    <div className={wrapClassName}>
      {multiline ? (
        <textarea
          className="itinerary-stop-input"
          rows={2}
          value={draft}
          maxLength={maxLength}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(prior.current);
              setEditing(false);
            }
          }}
        />
      ) : (
        <input
          className="itinerary-stop-input"
          value={draft}
          maxLength={maxLength}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setDraft(prior.current);
              setEditing(false);
            }
          }}
        />
      )}
      {remaining != null && remaining <= 40 ? (
        <p className="itinerary-stop-error">{remaining} left</p>
      ) : null}
      {forceSave ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void commit()}>
          Save
        </button>
      ) : null}
      {error ? <p className="itinerary-stop-error">{error}</p> : null}
    </div>
  );
}

export function ItineraryBlockCard({
  slug,
  dayKey,
  block,
  planners,
  timeline = false,
  canEdit = true,
  dimmed = false,
  highlighted = false,
  isLast = false,
  onRemoved,
  dayKeys,
}: {
  slug: string;
  dayKey: DayKey;
  block: ItineraryBlock;
  planners: PlannerOption[];
  timeline?: boolean;
  canEdit?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  isLast?: boolean;
  onRemoved?: () => void;
  dayKeys?: DayKey[];
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hourWarn, setHourWarn] = useState<string | null>(null);
  const startTime = blockStartTime(block);
  const tag = blockTagLabel(block);
  const timeDisplay = startTime ? formatTimeOfDay(startTime) || startTime : "";

  async function patch(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("day_key", dayKey);
    fd.set("block_id", block.id);
    if (block.updatedAt) fd.set("client_updated_at", block.updatedAt);
    for (const [key, value] of Object.entries(fields)) {
      fd.set(key, value);
    }
    await updateItineraryBlockAction(fd);
    router.refresh();
  }

  async function cycleStatus() {
    if (!canEdit) return;
    const next = nextBookingStatus(block.status);
    await patch({ status: next });
  }

  if (timeline) {
    return (
      <li
        className={`weekend-timeline-row${highlighted ? " is-highlight" : ""}${
          dimmed ? " is-filter-dim" : ""
        }${isLast ? " is-last" : ""}`}
      >
        <div className="weekend-timeline-time-cell">
          {canEdit ? (
            <InlineField
              value={startTime ?? ""}
              className="weekend-timeline-time"
              wrapClassName="weekend-timeline-time-wrap"
              emptyLabel="—"
              displayValue={timeDisplay}
              validate={(next) => {
                if (!next) return null;
                const m = /^(\d{1,2}):(\d{2})$/.exec(next);
                if (!m) return "Use 24h time like 09:30.";
                const h = Number(m[1]);
                if (h < 5 || h > 23) {
                  setHourWarn("Unusual hour — keep it?");
                } else {
                  setHourWarn(null);
                }
                return null;
              }}
              onCommit={async (next) => {
                await patch({ start_time: next });
              }}
            />
          ) : startTime ? (
            <FormattedTimeOfDay value={startTime} className="weekend-timeline-time" />
          ) : (
            <span className="weekend-timeline-time is-empty">—</span>
          )}
        </div>

        <div className="weekend-timeline-rail" aria-hidden="true">
          <span className="weekend-timeline-rail-line" />
          <span className="weekend-timeline-dot" />
        </div>

        <article className="weekend-timeline-card">
          <div className="weekend-timeline-card-head">
            {canEdit ? (
              <span className="weekend-drag-handle" aria-hidden>
                ⋮⋮
              </span>
            ) : null}
            {canEdit ? (
              <InlineField
                value={block.title}
                className="weekend-timeline-title"
                wrapClassName="weekend-timeline-title-wrap"
                validate={(next) => (next ? null : "A stop needs a name.")}
                onCommit={async (next) => {
                  await patch({ title: next });
                }}
              />
            ) : (
              <strong className="weekend-timeline-title">{block.title}</strong>
            )}
            <span className={`weekend-tag-chip is-${tag}`}>{tag}</span>
            <button
              type="button"
              className={`itinerary-status-pill is-${block.status}`}
              onClick={() => void cycleStatus()}
              disabled={!canEdit}
            >
              {bookingStatusLabel(block.status)}
            </button>
            {canEdit ? (
              <div className="itinerary-kebab">
                <button
                  type="button"
                  className="itinerary-kebab-btn"
                  aria-label="Stop actions"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  ⋮
                </button>
                {menuOpen ? (
                  <div className="itinerary-kebab-menu" role="menu">
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        await patch({ action: "duplicate" });
                        onRemoved?.();
                      }}
                    >
                      Duplicate
                    </button>
                    {(dayKeys ?? [])
                      .filter((k) => k !== dayKey)
                      .map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={async () => {
                            setMenuOpen(false);
                            await patch({ action: "move", target_day: k });
                            onRemoved?.();
                          }}
                        >
                          Move to {k}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        await patch({ action: "remove" });
                        onRemoved?.();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {hourWarn ? <p className="itinerary-stop-error">{hourWarn}</p> : null}
          {canEdit || block.notes ? (
            canEdit ? (
              <InlineField
                value={block.notes ?? ""}
                className="weekend-timeline-note"
                wrapClassName="weekend-timeline-note-wrap"
                multiline
                maxLength={280}
                onCommit={async (next) => {
                  await patch({ notes: next });
                }}
              />
            ) : (
              <p className="weekend-timeline-note">
                {block.notes}
                {block.notes && block.costUsd !== undefined ? " · " : null}
                {block.costUsd !== undefined ? formatUsd(block.costUsd) : null}
              </p>
            )
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
          {block.updatedByName ? (
            <p className="itinerary-ask-status">Updated by {block.updatedByName}.</p>
          ) : null}
        </article>
      </li>
    );
  }

  // Legacy non-timeline edit card — unused on R5 itinerary route
  void planners;
  return (
    <li className="itinerary-block-card">
      <strong className="itinerary-block-title">{block.title}</strong>
      <span className="pill">{bookingStatusLabel(block.status)}</span>
    </li>
  );
}
