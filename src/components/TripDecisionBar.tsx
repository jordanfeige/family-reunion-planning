"use client";

import { useState } from "react";

import { updateTripPlanContextAction } from "@/app/actions/trips";
import { CompactSelect } from "@/components/CompactSelect";
import {
  aggregateLocationAvailability,
  aggregateWeekendAvailability,
  headcountForWeekend,
  type SurveyResponseRow,
} from "@/lib/availability";
import type { LocationOption } from "@/lib/locations";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

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

  const [locationId, setLocationId] = useState(selectedLocationId ?? "");
  const [weekendFriday, setWeekendFriday] = useState(selectedWeekendFriday ?? "");

  const locationOptions = [
    { value: "", label: "Choose a location…" },
    ...locations.map((loc) => {
      const votes = locationVotes.find((v) => v.locationId === loc.id);
      const hint = votes?.totalAttendees ? ` · ${votes.totalAttendees} people` : "";
      return { value: loc.id, label: `${loc.title}${hint}` };
    }),
  ];

  const weekendOptions = [
    { value: "", label: "Choose a weekend…" },
    ...filterValidFridays(weekendSlots).map((iso) => {
      const votes = weekendVotes.find((v) => v.fridayIso === iso);
      const hint = votes?.totalAttendees ? ` · ${votes.totalAttendees} people` : "";
      return { value: iso, label: `${formatWeekendLabel(iso)}${hint}` };
    }),
  ];

  return (
    <form action={updateTripPlanContextAction} className="stack plan-context-form">
      <input type="hidden" name="slug" value={slug} />
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Lock the location and weekend for your day-by-day itinerary. RSVP counts
        are shown as hints.
      </p>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="selected_location_id">Location</label>
          <CompactSelect
            id="selected_location_id"
            name="selected_location_id"
            value={locationId}
            options={locationOptions}
            onChange={setLocationId}
            placeholder="Choose a location…"
          />
        </div>
        <div className="field">
          <label htmlFor="selected_weekend_friday">Weekend</label>
          <CompactSelect
            id="selected_weekend_friday"
            name="selected_weekend_friday"
            value={weekendFriday}
            options={weekendOptions}
            onChange={setWeekendFriday}
            placeholder="Choose a weekend…"
          />
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
      <button type="submit" className="btn btn-primary btn-block-sm">
        Save location &amp; weekend
      </button>
    </form>
  );
}
