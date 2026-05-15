import {
  aggregateConfirmations,
  filterConfirmationsForPlan,
  type TripConfirmationRow,
} from "@/lib/confirmations";
import { partyAdults, partyKids } from "@/lib/partyCount";

export function PlanConfirmationSnapshot({
  confirmations,
  weekendFriday,
  locationId,
  locationTitle,
  weekendLabel,
}: {
  confirmations: TripConfirmationRow[];
  weekendFriday: string | null;
  locationId: string | null;
  locationTitle: string | null;
  weekendLabel: string | null;
}) {
  if (!weekendFriday || !locationId) {
    return (
      <div
        className="card"
        style={{
          padding: "1rem",
          background: "rgba(28, 61, 90, 0.04)",
        }}
      >
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Lock a location and weekend above, then publish your plan. Family will confirm
          yes or no on the share link—you&apos;ll see final headcount here.
        </p>
      </div>
    );
  }

  const forPlan = filterConfirmationsForPlan(
    confirmations,
    weekendFriday,
    locationId,
  );
  const totals = aggregateConfirmations(forPlan);

  return (
    <div
      className="card"
      style={{
        padding: "1rem",
        background: "rgba(94, 234, 212, 0.1)",
        border: "1px solid rgba(31, 74, 61, 0.2)",
      }}
    >
      <p className="pill" style={{ marginBottom: "0.5rem" }}>
        Final RSVP · {locationTitle ?? "Plan"} · {weekendLabel}
      </p>
      <div
        className="row"
        style={{ gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}
      >
        <div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-fjord)" }}>
            {totals.totalPeople}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            people confirmed
          </div>
        </div>
        <div className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
          <div>
            <strong>{totals.confirmedHouseholds}</strong> yes ·{" "}
            <strong>{totals.declinedHouseholds}</strong> no
          </div>
          <div>
            {totals.totalAdults} adults · {totals.totalKids} kids
          </div>
        </div>
      </div>

      {totals.responses.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          No confirmations yet—share your plan link so family can RSVP yes or no.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
          {totals.responses.map((r) => (
            <li
              key={r.id}
              style={{
                fontSize: "0.88rem",
                padding: "0.5rem 0",
                borderTop: "1px solid rgba(28,61,90,0.08)",
              }}
            >
              <strong>{r.respondentName}</strong>
              {" · "}
              {r.status === "confirmed" ? (
                <span style={{ color: "var(--color-spruce)" }}>
                  Yes — {partyAdults(r)} adult{partyAdults(r) === 1 ? "" : "s"}
                  {partyKids(r) > 0
                    ? `, ${partyKids(r)} kid${partyKids(r) === 1 ? "" : "s"}`
                    : ""}
                </span>
              ) : (
                <span className="muted">Can&apos;t make it</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
