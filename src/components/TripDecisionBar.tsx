import {
  aggregateLocationAvailability,
  aggregateWeekendAvailability,
  headcountForWeekend,
  type SurveyResponseRow,
} from "@/lib/availability";
import type { LocationOption } from "@/lib/locations";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";
import { updateTripPlanContextAction } from "@/app/actions/trips";

export function TripDecisionBar({
  slug,
  locations,
  weekendSlots,
  responses,
  selectedLocationId,
  selectedWeekendFriday,
  planHeadcount,
}: {
  slug: string;
  locations: LocationOption[];
  weekendSlots: string[];
  responses: SurveyResponseRow[];
  selectedLocationId: string | null;
  selectedWeekendFriday: string | null;
  planHeadcount: number | null;
}) {
  const locationVotes = aggregateLocationAvailability(locations, responses);
  const weekendVotes = aggregateWeekendAvailability(weekendSlots, responses);
  const defaultHeadcount =
    planHeadcount ??
    (selectedWeekendFriday
      ? headcountForWeekend(selectedWeekendFriday, weekendSlots, responses)
      : 0);

  return (
    <form action={updateTripPlanContextAction} className="stack">
      <input type="hidden" name="slug" value={slug} />
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Lock the location and weekend for your day-by-day itinerary. RSVP counts
        are shown as hints.
      </p>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="selected_location_id">Location</label>
          <select
            id="selected_location_id"
            name="selected_location_id"
            defaultValue={selectedLocationId ?? ""}
          >
            <option value="">Choose a location…</option>
            {locations.map((loc) => {
              const votes = locationVotes.find((v) => v.locationId === loc.id);
              const hint = votes?.totalAttendees
                ? ` · ${votes.totalAttendees} people`
                : "";
              return (
                <option key={loc.id} value={loc.id}>
                  {loc.title}
                  {hint}
                </option>
              );
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="selected_weekend_friday">Weekend</label>
          <select
            id="selected_weekend_friday"
            name="selected_weekend_friday"
            defaultValue={selectedWeekendFriday ?? ""}
          >
            <option value="">Choose a weekend…</option>
            {filterValidFridays(weekendSlots).map((iso) => {
              const votes = weekendVotes.find((v) => v.fridayIso === iso);
              const hint = votes?.totalAttendees
                ? ` · ${votes.totalAttendees} people`
                : "";
              return (
                <option key={iso} value={iso}>
                  {formatWeekendLabel(iso)}
                  {hint}
                </option>
              );
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="plan_headcount">Planning headcount</label>
          <input
            id="plan_headcount"
            name="plan_headcount"
            type="number"
            min={1}
            defaultValue={defaultHeadcount > 0 ? defaultHeadcount : 1}
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Save plan context
      </button>
    </form>
  );
}
