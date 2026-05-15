"use client";

import { useMemo, useState } from "react";

import {
  filterValidFridays,
  formatWeekendLabel,
  fridayIsoFromDate,
  getCalendarDays,
  parseFridayIso,
} from "@/lib/weekends";

export function WeekendDatePicker({
  name = "proposed_weekends",
  defaultSelected = [],
}: {
  name?: string;
  defaultSelected?: string[];
}) {
  const initial = filterValidFridays(defaultSelected);
  const [selected, setSelected] = useState<string[]>(initial);
  const [viewDate, setViewDate] = useState(() => {
    const first = initial[0] ? parseFridayIso(initial[0]) : new Date();
    return first ?? new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = useMemo(() => getCalendarDays(year, month), [year, month]);

  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function toggleFriday(iso: string) {
    setSelected((prev) =>
      prev.includes(iso) ? prev.filter((s) => s !== iso) : [...prev, iso],
    );
  }

  const sortedSelected = filterValidFridays(selected);

  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label>Candidate Fri–Sun weekends</label>
      <p className="muted" style={{ margin: "0.35rem 0 0.75rem", fontSize: "0.9rem" }}>
        Select Fri–Sun weekends your family can consider. Only Fridays are
        clickable—each adds that full weekend as one survey option.
      </p>

      <input type="hidden" name={name} value={sortedSelected.join(",")} />

      <div
        className="card"
        style={{
          padding: "1rem",
          background: "#fff",
          marginBottom: "0.75rem",
        }}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
            onClick={() =>
              setViewDate(new Date(year, month - 1, 1, 12, 0, 0, 0))
            }
          >
            ←
          </button>
          <strong style={{ color: "var(--color-fjord)" }}>{monthLabel}</strong>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
            onClick={() =>
              setViewDate(new Date(year, month + 1, 1, 12, 0, 0, 0))
            }
          >
            →
          </button>
        </div>

        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="muted" style={{ fontWeight: 600 }}>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const iso = fridayIsoFromDate(day);
            const inMonth = day.getMonth() === month;
            const isFri = day.getDay() === 5;
            const isSelected = selected.includes(iso);

            if (!isFri) {
              return (
                <div
                  key={iso + day.getTime()}
                  style={{
                    padding: "0.5rem 0.25rem",
                    borderRadius: "var(--radius-sm)",
                    opacity: inMonth ? 0.35 : 0.2,
                    color: "var(--color-slate)",
                  }}
                >
                  {day.getDate()}
                </div>
              );
            }

            return (
              <button
                key={iso}
                type="button"
                className="calendar-day-btn"
                onClick={() => toggleFriday(iso)}
                style={{
                  padding: "0.5rem 0.25rem",
                  borderRadius: "var(--radius-sm)",
                  border: isSelected
                    ? "2px solid var(--color-berry)"
                    : "1px solid rgba(28,61,90,0.2)",
                  background: isSelected
                    ? "rgba(212, 90, 58, 0.15)"
                    : inMonth
                      ? "#fff"
                      : "rgba(255,255,255,0.6)",
                  color: "var(--color-fjord)",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  opacity: inMonth ? 1 : 0.65,
                }}
                title={formatWeekendLabel(iso)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {sortedSelected.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {sortedSelected.map((iso) => (
            <li key={iso}>
              <span
                className="pill"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {formatWeekendLabel(iso)}
                <button
                  type="button"
                  onClick={() => toggleFriday(iso)}
                  aria-label={`Remove ${formatWeekendLabel(iso)}`}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                    color: "var(--color-berry)",
                    fontWeight: 700,
                  }}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          No weekends selected yet—click a Friday on the calendar.
        </p>
      )}
    </div>
  );
}
