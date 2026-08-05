"use client";

import { useMemo, useState } from "react";

import {
  filterValidFridays,
  formatWeekendLabel,
  formatWeekendLabelShort,
  getFridaysInMonth,
  parseFridayIso,
} from "@/lib/weekends";

export function WeekendDatePicker({
  name = "proposed_weekends",
  defaultSelected = [],
  onChange,
}: {
  name?: string;
  defaultSelected?: string[];
  onChange?: (selected: string[]) => void;
}) {
  const initial = filterValidFridays(defaultSelected);
  const [selected, setSelected] = useState<string[]>(initial);
  const [viewDate, setViewDate] = useState(() => {
    const first = initial[0] ? parseFridayIso(initial[0]) : new Date();
    return first ?? new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthFridays = useMemo(() => getFridaysInMonth(year, month), [year, month]);

  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const sortedSelected = filterValidFridays(selected);

  function toggleFriday(iso: string) {
    setSelected((prev) => {
      const next = prev.includes(iso) ? prev.filter((s) => s !== iso) : [...prev, iso];
      const sorted = filterValidFridays(next);
      onChange?.(sorted);
      return next;
    });
  }

  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label>Candidate Fri–Sun weekends</label>
      <p className="muted" style={{ margin: "0.35rem 0 0.75rem", fontSize: "0.9rem" }}>
        Each option is a full Fri–Sun weekend for your family survey—same format
        guests see when they RSVP.
      </p>

      <input type="hidden" name={name} value={sortedSelected.join(",")} />

      <div className="weekend-picker card">
        <div className="weekend-picker-nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Previous month"
            onClick={() => setViewDate(new Date(year, month - 1, 1, 12, 0, 0, 0))}
          >
            ←
          </button>
          <strong className="weekend-picker-month">{monthLabel}</strong>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Next month"
            onClick={() => setViewDate(new Date(year, month + 1, 1, 12, 0, 0, 0))}
          >
            →
          </button>
        </div>

        {monthFridays.length === 0 ? (
          <p className="muted weekend-picker-empty">No Fridays in this month.</p>
        ) : (
          <ul className="choice-list weekend-picker-list">
            {monthFridays.map((iso) => {
              const isSelected = selected.includes(iso);
              return (
                <li key={iso}>
                  <label className="choice-card">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFriday(iso)}
                    />
                    <span className="choice-card-body">
                      <span className="choice-check" aria-hidden />
                      <span className="weekend-picker-row-text">
                        <span className="weekend-picker-row-primary">
                          {formatWeekendLabelShort(iso)}
                        </span>
                        <span className="muted weekend-picker-row-year">
                          {parseFridayIso(iso)?.getFullYear()}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="weekend-picker-selected">
        <p className="weekend-picker-selected-label">
          Selected for survey
          {sortedSelected.length > 0 ? (
            <span className="pill" style={{ marginLeft: "0.5rem", fontSize: "0.72rem" }}>
              {sortedSelected.length}
            </span>
          ) : null}
        </p>
        {sortedSelected.length > 0 ? (
          <ul className="weekend-picker-pills">
            {sortedSelected.map((iso) => (
              <li key={iso}>
                <span className="pill weekend-picker-pill">
                  <span className="weekend-picker-pill-text">{formatWeekendLabel(iso)}</span>
                  <button
                    type="button"
                    onClick={() => toggleFriday(iso)}
                    aria-label={`Remove ${formatWeekendLabel(iso)}`}
                    className="weekend-picker-pill-remove"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            No weekends selected yet—check one or more weekends above.
          </p>
        )}
      </div>
    </div>
  );
}
