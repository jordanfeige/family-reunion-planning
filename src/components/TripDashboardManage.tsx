import {
  deleteTripAction,
  resetTripPlanningAction,
} from "@/app/actions/trips";

export function TripDashboardManage({
  slug,
  tripName,
  access,
}: {
  slug: string;
  tripName: string;
  access: "owner" | "collaborator";
}) {
  if (access !== "owner") return null;

  const resetConfirmId = `reset-confirm-${slug}`;
  const deleteConfirmId = `delete-confirm-${slug}`;

  return (
    <details className="trip-dashboard-manage">
      <summary className="trip-dashboard-manage-summary">Manage</summary>
      <div className="trip-dashboard-manage-body stack">
        <div>
          <p className="trip-dashboard-manage-heading">Start planning over</p>
          <p className="muted trip-dashboard-manage-desc">
            Clears survey responses, locations, weekends, blueprint, and RSVPs. Keeps
            the trip name, collaborators, survey link, and gallery.
          </p>
          <form action={resetTripPlanningAction} className="stack">
            <input type="hidden" name="slug" value={slug} />
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={resetConfirmId}>
                Type <strong>{tripName}</strong> to confirm
              </label>
              <input
                id={resetConfirmId}
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
        <div className="divider" style={{ margin: "0.5rem 0" }} />
        <div>
          <p className="trip-dashboard-manage-heading">Delete trip</p>
          <p className="muted trip-dashboard-manage-desc">
            Permanently removes this trip and all data. Cannot be undone.
          </p>
          <form action={deleteTripAction} className="stack">
            <input type="hidden" name="slug" value={slug} />
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={deleteConfirmId}>
                Type <strong>{tripName}</strong> to confirm
              </label>
              <input
                id={deleteConfirmId}
                name="confirm"
                required
                autoComplete="off"
                placeholder={tripName}
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary btn-sm trip-dashboard-delete-btn"
            >
              Delete trip
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
