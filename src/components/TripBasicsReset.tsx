import { resetTripPlanningAction } from "@/app/actions/trips";
import type { TripOrganizerRole } from "@/lib/tripAccess";

export function TripBasicsReset({
  slug,
  tripName,
  role,
}: {
  slug: string;
  tripName: string;
  role: TripOrganizerRole;
}) {
  if (role !== "owner") return null;

  return (
    <details
      className="card"
      style={{
        marginTop: "1.25rem",
        border: "1px solid rgba(180, 60, 50, 0.22)",
        background: "rgba(180, 60, 50, 0.04)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 600,
          color: "var(--color-fjord)",
          fontSize: "0.95rem",
        }}
      >
        Reset trip
      </summary>
      <div style={{ marginTop: "1rem" }}>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", lineHeight: 1.55 }}>
          Clears everything for this trip—survey responses, weekends, locations, blueprint,
          published plan, and final RSVPs. Keeps the trip name, collaborators, survey link, and
          gallery. You stay on this trip to start fresh.
        </p>
        <form action={resetTripPlanningAction} className="stack">
          <input type="hidden" name="slug" value={slug} />
          <div className="field">
            <label htmlFor="basics_reset_confirm">
              Type <strong>{tripName}</strong> to confirm
            </label>
            <input
              id="basics_reset_confirm"
              name="confirm"
              required
              autoComplete="off"
              placeholder={tripName}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Reset entire trip
          </button>
        </form>
      </div>
    </details>
  );
}
