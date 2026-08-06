import {
  aggregateWeekendAvailability,
  getBestOverlapWeekends,
  type SurveyResponseRow,
} from "@/lib/availability";
import { filterValidFridays } from "@/lib/weekends";

export function AvailabilitySnapshot({
  proposedSlots,
  responses,
}: {
  proposedSlots: string[];
  responses: SurveyResponseRow[];
}) {
  const slots = filterValidFridays(proposedSlots);
  const availability = aggregateWeekendAvailability(slots, responses);
  const best = getBestOverlapWeekends(availability);

  if (slots.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Add candidate Fri–Sun weekends above to start collecting availability.
      </p>
    );
  }

  if (responses.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        No RSVPs yet—share your survey link so family can mark which weekends
        work.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      {best.length > 0 ? (
        <div className="success-banner" style={{ margin: 0 }}>
          <strong>Best overlap:</strong>{" "}
          {best.map((b) => b.label).join("; ")} — {best[0]!.totalAttendees}{" "}
          people from {best[0]!.households} household
          {best[0]!.households === 1 ? "" : "s"}
        </div>
      ) : null}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
        {availability.map((a) => (
          <li
            key={a.fridayIso}
            style={{
              border: "1px solid rgba(28,61,90,0.1)",
              borderRadius: "var(--radius-md)",
              padding: "0.75rem 1rem",
              background: best.some((b) => b.fridayIso === a.fridayIso)
                ? "var(--canvas)"
                : "var(--card)",
            }}
          >
            <strong style={{ color: "var(--ink)" }}>{a.label}</strong>
            {a.households > 0 ? (
              <>
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                  {a.households} household{a.households === 1 ? "" : "s"} ·{" "}
                  {a.totalAttendees} people
                </p>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                  {a.respondents.map((r) => `${r.name} (${r.count})`).join(", ")}
                </p>
              </>
            ) : (
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                No RSVPs for this weekend yet
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
