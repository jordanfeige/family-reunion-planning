"use client";

import { useState } from "react";

import {
  normalizeItinerary,
  type DayKey,
  type PublishedItinerary,
} from "@/lib/itinerary";

const TYPE_LABELS: Record<string, string> = {
  activity: "Activity",
  meal: "Meal",
  lodging: "Lodging",
  travel: "Travel",
};

export function PublicItineraryView({
  published,
}: {
  published: PublishedItinerary;
}) {
  const itinerary = normalizeItinerary(published);
  const [activeDay, setActiveDay] = useState<DayKey>(
    itinerary.days.find((d) => d.blocks.length > 0)?.key ?? "friday",
  );

  const currentDay = itinerary.days.find((d) => d.key === activeDay);
  const daysWithContent = itinerary.days.filter((d) => d.blocks.length > 0);

  return (
    <div className="stack">
      {(published.locationTitle || published.weekendLabel || published.headcount) && (
        <div
          className="card"
          style={{
            padding: "1rem",
            background: "rgba(94, 234, 212, 0.12)",
            marginBottom: "0.25rem",
          }}
        >
          {published.locationTitle ? (
            <p style={{ margin: 0, fontWeight: 600, color: "var(--color-fjord)" }}>
              {published.locationTitle}
            </p>
          ) : null}
          <p className="muted" style={{ margin: published.locationTitle ? "0.35rem 0 0" : 0 }}>
            {[published.weekendLabel, published.headcount ? `${published.headcount} people` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}

      <div className="day-tabs">
        {daysWithContent.map((day) => (
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
        <article className="card">
          <h2 style={{ marginTop: 0, color: "var(--color-fjord)" }}>{currentDay.label}</h2>
          {currentDay.blocks.length === 0 ? (
            <p className="muted">Nothing scheduled this day.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
              {currentDay.blocks.map((block) => (
                <li
                  key={block.id}
                  style={{
                    borderTop: "1px solid rgba(28,61,90,0.08)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                    {block.time ? (
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: "var(--color-fjord)",
                          minWidth: "3.5rem",
                        }}
                      >
                        {block.time}
                      </span>
                    ) : null}
                    <span className="pill" style={{ fontSize: "0.7rem" }}>
                      {TYPE_LABELS[block.type] ?? block.type}
                    </span>
                  </div>
                  <strong style={{ display: "block", marginTop: "0.25rem" }}>{block.title}</strong>
                  {block.notes ? (
                    <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                      {block.notes}
                    </p>
                  ) : null}
                  {block.bookingUrl ? (
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                      <a href={block.bookingUrl} target="_blank" rel="noreferrer">
                        More info
                      </a>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}
    </div>
  );
}
