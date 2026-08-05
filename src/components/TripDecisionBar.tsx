"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateTripPlanContextAction } from "@/app/actions/trips";
import { CompactSelect } from "@/components/CompactSelect";
import { queueTrailBeat } from "@/components/TrailBeat";
import {
  aggregateLocationAvailability,
  aggregateWeekendAvailability,
  headcountForWeekend,
  type SurveyResponseRow,
} from "@/lib/availability";
import type { LocationOption } from "@/lib/locations";
import { findLocationById } from "@/lib/locations";
import { goToTripHubStep } from "@/lib/wizardNav";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

export function TripDecisionBar({
  slug,
  locations,
  weekendSlots,
  responses,
  selectedLocationId,
  selectedWeekendFriday,
  planHeadcount,
  celebrate = false,
}: {
  slug: string;
  locations: LocationOption[];
  weekendSlots: string[];
  responses: SurveyResponseRow[];
  selectedLocationId: string | null;
  selectedWeekendFriday: string | null;
  planHeadcount: number | null;
  /** When true, saving a full place+weekend queues the We’re going beat. */
  celebrate?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
    <form
      className="stack plan-context-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          await updateTripPlanContextAction(data);
          const loc = String(data.get("selected_location_id") ?? "").trim();
          const weekend = String(data.get("selected_weekend_friday") ?? "").trim();
          const changed =
            loc !== (selectedLocationId ?? "") ||
            weekend !== (selectedWeekendFriday ?? "");
          if (celebrate && loc && weekend && (changed || !selectedLocationId || !selectedWeekendFriday)) {
            const title = findLocationById(locations, loc)?.title ?? "Your destination";
            const label = formatWeekendLabel(weekend);
            queueTrailBeat(slug, "decision", `${title}|${label}`);
            goToTripHubStep(slug, "weekend");
          }
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Soft-lock the location and weekend for your day-by-day itinerary. You can
        change them later. RSVP counts are shown as hints.
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
      <button type="submit" className="btn btn-berry btn-block-sm" disabled={pending}>
        {pending ? "Saving…" : "Save location & weekend"}
      </button>
    </form>
  );
}
