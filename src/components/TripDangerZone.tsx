import {
  deleteTripAction,
  resetTripPlanningAction,
} from "@/app/actions/trips";
import type { TripOrganizerRole } from "@/lib/tripAccess";

export function TripDangerZone({
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
        marginTop: "2rem",
        border: "1px solid rgba(180, 60, 50, 0.25)",
        background: "rgba(180, 60, 50, 0.04)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 600,
          color: "var(--color-fjord)",
          listStylePosition: "outside",
        }}
      >
        Danger zone
      </summary>
      <div className="stack" style={{ marginTop: "1rem" }}>
        <div>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>Start planning over</h3>
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
            Clears all planning data (same as Reset trip on step 1). Keeps the trip name,
            collaborators, survey link, and gallery photos.
          </p>
          <form action={resetTripPlanningAction} className="stack">
            <input type="hidden" name="slug" value={slug} />
            <div className="field">
              <label htmlFor="reset_confirm">
                Type <strong>{tripName}</strong> to confirm
              </label>
              <input
                id="reset_confirm"
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
        <div className="divider" />
        <div>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>Delete trip</h3>
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
            Permanently removes this trip, all responses, photos, and collaborator access.
            This cannot be undone.
          </p>
          <form action={deleteTripAction} className="stack">
            <input type="hidden" name="slug" value={slug} />
            <div className="field">
              <label htmlFor="delete_confirm">
                Type <strong>{tripName}</strong> to confirm
              </label>
              <input
                id="delete_confirm"
                name="confirm"
                required
                autoComplete="off"
                placeholder={tripName}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ color: "#9b2c2c" }}>
              Delete trip forever
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
