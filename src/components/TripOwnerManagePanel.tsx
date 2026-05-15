import {
  deleteTripAction,
  resetTripPlanningAction,
} from "@/app/actions/trips";
import type { TripOrganizerRole } from "@/lib/tripAccess";

export function TripOwnerManagePanel({
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
    <div className="trip-hub-manage-panel stack">
      <div>
        <h3 className="trip-hub-sheet-heading">Start planning over</h3>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
          Clears survey responses, weekends, locations, blueprint, and RSVPs. Keeps the trip
          name, collaborators, survey link, and gallery.
        </p>
        <form action={resetTripPlanningAction} className="stack">
          <input type="hidden" name="slug" value={slug} />
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="hub_reset_confirm">
              Type <strong>{tripName}</strong> to confirm
            </label>
            <input
              id="hub_reset_confirm"
              name="confirm"
              required
              autoComplete="off"
              placeholder={tripName}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Reset trip
          </button>
        </form>
      </div>
      <div className="divider" />
      <div>
        <h3 className="trip-hub-sheet-heading">Delete trip</h3>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
          Permanently removes this trip and all data. Cannot be undone.
        </p>
        <form action={deleteTripAction} className="stack">
          <input type="hidden" name="slug" value={slug} />
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="hub_delete_confirm">
              Type <strong>{tripName}</strong> to confirm
            </label>
            <input
              id="hub_delete_confirm"
              name="confirm"
              required
              autoComplete="off"
              placeholder={tripName}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm trip-dashboard-delete-btn">
            Delete trip
          </button>
        </form>
      </div>
    </div>
  );
}
