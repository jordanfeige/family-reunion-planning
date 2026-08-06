"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateTripPlanContextAction } from "@/app/actions/trips";
import { CompactSelect } from "@/components/CompactSelect";
import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { queueTrailBeat } from "@/components/TrailBeat";
import Link from "next/link";
import {
  aggregateLocationAvailability,
  aggregateWeekendAvailability,
  getBestOverlapWeekends,
  headcountForWeekend,
  type SurveyResponseRow,
} from "@/lib/availability";
import { cityOnly } from "@/lib/driveTimes";
import { focusBlockingField } from "@/lib/formFocus";
import type { LocationOption } from "@/lib/locations";
import { findLocationById } from "@/lib/locations";
import { goToTripHubStep } from "@/lib/wizardNav";
import { formatDriveTime, formatFahrenheit, formatUsd } from "@/lib/units";
import { filterValidFridays, formatWeekendLabel } from "@/lib/weekends";

const CROWD_LABELS: Record<NonNullable<LocationOption["crowdLevel"]>, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  busy: "Busy",
};

type CriteriaRow = {
  key: string;
  label: string;
  values: string[];
};

function placeDisplayName(title: string): string {
  const idx = title.indexOf(",");
  return (idx === -1 ? title : title.slice(0, idx)).trim();
}

function criteriaForLocation(loc: LocationOption): {
  drive: string;
  rentals: string;
  weather: string;
  crowds: string;
} {
  const driveFrom = loc.originMetro ? cityOnly(loc.originMetro) : undefined;
  const drive =
    loc.driveMinutesFromOrigin != null
      ? formatDriveTime(loc.driveMinutesFromOrigin, driveFrom) || "—"
      : "—";
  const rentals =
    loc.typicalLodgingUsd != null
      ? formatUsd(loc.typicalLodgingUsd, { perLabel: "per household" })
      : "—";
  const weather =
    loc.avgHighF != null ? formatFahrenheit(loc.avgHighF) : "—";
  const crowds = loc.crowdLevel ? CROWD_LABELS[loc.crowdLevel] : "—";
  return { drive, rentals, weather, crowds };
}

function matchLabel(votes: { households: number; totalAttendees: number }): string {
  if (votes.totalAttendees > 0) {
    return `${votes.totalAttendees} people`;
  }
  if (votes.households > 0) {
    return `${votes.households} household${votes.households === 1 ? "" : "s"}`;
  }
  return "No votes yet";
}

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
  /** When true, saving a full place+weekend queues the We're going beat. */
  celebrate?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locationVotes = aggregateLocationAvailability(locations, responses);
  const weekendVotes = aggregateWeekendAvailability(weekendSlots, responses);
  const bestWeekends = getBestOverlapWeekends(weekendVotes);
  const defaultWeekend =
    selectedWeekendFriday ??
    bestWeekends[0]?.fridayIso ??
    filterValidFridays(weekendSlots)[0] ??
    "";
  const defaultHeadcount =
    planHeadcount ??
    (defaultWeekend
      ? headcountForWeekend(defaultWeekend, weekendSlots, responses)
      : 0);

  const [locationId, setLocationId] = useState(selectedLocationId ?? "");
  const [weekendFriday, setWeekendFriday] = useState(defaultWeekend);
  const [ctaHint, setCtaHint] = useState<string | null>(null);

  const ranked = useMemo(() => {
    return [...locations].sort((a, b) => {
      const va = locationVotes.find((v) => v.locationId === a.id)?.totalAttendees ?? 0;
      const vb = locationVotes.find((v) => v.locationId === b.id)?.totalAttendees ?? 0;
      if (vb !== va) return vb - va;
      const ha = locationVotes.find((v) => v.locationId === a.id)?.households ?? 0;
      const hb = locationVotes.find((v) => v.locationId === b.id)?.households ?? 0;
      return hb - ha;
    });
  }, [locations, locationVotes]);

  const recommendedId = ranked[0]?.id ?? "";
  const activeLocationId = locationId || recommendedId;
  const activeLocation = findLocationById(locations, activeLocationId);

  const criteriaRows: CriteriaRow[] = [
    {
      key: "drive",
      label: "Drive",
      values: ranked.map((loc) => criteriaForLocation(loc).drive),
    },
    {
      key: "rentals",
      label: "Rentals",
      values: ranked.map((loc) => criteriaForLocation(loc).rentals),
    },
    {
      key: "weather",
      label: "Weather",
      values: ranked.map((loc) => criteriaForLocation(loc).weather),
    },
    {
      key: "crowds",
      label: "Crowds",
      values: ranked.map((loc) => criteriaForLocation(loc).crowds),
    },
  ];

  const weekendOptions = [
    { value: "", label: "Choose a weekend…" },
    ...filterValidFridays(weekendSlots).map((iso) => {
      const votes = weekendVotes.find((v) => v.fridayIso === iso);
      const hint = votes?.totalAttendees ? ` · ${votes.totalAttendees} people` : "";
      return { value: iso, label: `${formatWeekendLabel(iso)}${hint}` };
    }),
  ];

  const rationalePlace = activeLocation ? placeDisplayName(activeLocation.title) : "";
  const rationaleBody =
    activeLocation?.summary?.trim() ||
    (activeLocation
      ? (() => {
          const votes = locationVotes.find((v) => v.locationId === activeLocation.id);
          if (votes && votes.totalAttendees > 0) {
            return `${votes.totalAttendees} people from ${votes.households} household${votes.households === 1 ? "" : "s"} picked this on the survey — strongest match so far.`;
          }
          return "Survey votes are still coming in — compare drive, stays, weather, and crowds below.";
        })()
      : "Pick a finalist to see why it might fit your crew.");

  function submit() {
    if (pending) return;
    if (!activeLocationId) {
      setCtaHint("Choose a destination first — Lock it in or Choose on a card above.");
      focusBlockingField(".decision-compare-cards, .decision-card");
      return;
    }
    if (!weekendFriday) {
      setCtaHint("Pick a weekend before building the itinerary.");
      focusBlockingField(`#decision-weekend-${slug}, .decision-weekend-field`);
      return;
    }
    setCtaHint(null);
    const form = new FormData();
    form.set("slug", slug);
    form.set("selected_location_id", activeLocationId);
    form.set("selected_weekend_friday", weekendFriday);
    form.set(
      "plan_headcount",
      String(defaultHeadcount > 0 ? defaultHeadcount : 1),
    );
    startTransition(async () => {
      await updateTripPlanContextAction(form);
      const changed =
        activeLocationId !== (selectedLocationId ?? "") ||
        weekendFriday !== (selectedWeekendFriday ?? "");
      if (
        celebrate &&
        activeLocationId &&
        weekendFriday &&
        (changed || !selectedLocationId || !selectedWeekendFriday)
      ) {
        const title =
          findLocationById(locations, activeLocationId)?.title ?? "Your destination";
        const label = formatWeekendLabel(weekendFriday);
        queueTrailBeat(slug, "decision", `${title}|${label}`);
        goToTripHubStep(slug, "weekend");
      }
      router.refresh();
    });
  }

  if (locations.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Add destinations on the survey first, then compare finalists here.
      </p>
    );
  }

  return (
    <div className="decision-compare">
      <div className="decision-compare-cards" aria-label="Finalist destinations">
        {ranked.map((loc) => {
          const votes =
            locationVotes.find((v) => v.locationId === loc.id) ?? {
              locationId: loc.id,
              title: loc.title,
              households: 0,
              totalAttendees: 0,
            };
          const isRecommended = loc.id === recommendedId;
          const isSelected = loc.id === activeLocationId;
          const criteria = criteriaForLocation(loc);

          return (
            <article
              key={loc.id}
              className={`decision-card${isRecommended ? " is-recommended" : ""}${isSelected ? " is-selected" : ""}`}
            >
              <header className="decision-card-head">
                <h3 className="decision-card-title">
                  <Link
                    href={`/t/${slug}/place/${loc.id}`}
                    className="decision-card-title-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {placeDisplayName(loc.title)}
                  </Link>
                </h3>
                <span className="decision-match-chip">{matchLabel(votes)}</span>
              </header>
              <dl className="decision-card-criteria">
                <div>
                  <dt>Drive</dt>
                  <dd>{criteria.drive}</dd>
                </div>
                <div>
                  <dt>Rentals</dt>
                  <dd>{criteria.rentals}</dd>
                </div>
                <div>
                  <dt>Weather</dt>
                  <dd>{criteria.weather}</dd>
                </div>
                <div>
                  <dt>Crowds</dt>
                  <dd>{criteria.crowds}</dd>
                </div>
              </dl>
              <button
                type="button"
                className={`decision-card-pick${isRecommended ? " decision-card-pick--lock" : ""}`}
                aria-pressed={isSelected}
                onClick={() => {
                  setCtaHint(null);
                  setLocationId(loc.id);
                }}
              >
                {isRecommended ? "Lock it in" : "Choose"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="decision-compare-table-wrap" aria-label="Destination comparison">
        <table className="decision-compare-table">
          <thead>
            <tr>
              <th scope="col" className="decision-table-criteria-head">
                Criteria
              </th>
              {ranked.map((loc) => {
                const isRecommended = loc.id === recommendedId;
                const votes = locationVotes.find((v) => v.locationId === loc.id);
                return (
                  <th
                    key={loc.id}
                    scope="col"
                    className={`decision-table-place-head${isRecommended ? " is-recommended" : ""}`}
                  >
                    <span className="decision-table-place-name">
                      <Link
                        href={`/t/${slug}/place/${loc.id}`}
                        className="decision-card-title-link"
                      >
                        {placeDisplayName(loc.title)}
                      </Link>
                    </span>
                    <span className="decision-match-chip">
                      {matchLabel(
                        votes ?? {
                          locationId: loc.id,
                          title: loc.title,
                          households: 0,
                          totalAttendees: 0,
                        },
                      )}
                    </span>
                    <button
                      type="button"
                      className={`decision-table-pick${isRecommended ? " decision-table-pick--lock" : ""}`}
                      aria-pressed={loc.id === activeLocationId}
                      onClick={() => {
                  setCtaHint(null);
                  setLocationId(loc.id);
                }}
                    >
                      {isRecommended ? "Lock it in" : "Choose"}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {criteriaRows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="decision-table-row-label">
                  {row.label}
                </th>
                {row.values.map((value, i) => {
                  const loc = ranked[i]!;
                  const isRecommended = loc.id === recommendedId;
                  return (
                    <td
                      key={loc.id}
                      className={isRecommended ? "is-recommended" : undefined}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rationalePlace ? (
        <div className="decision-rationale">
          <p className="decision-rationale-eyebrow">WHY I LEAN {rationalePlace.toUpperCase()}</p>
          <p className="decision-rationale-body">{rationaleBody}</p>
        </div>
      ) : null}

      <div className="decision-compare-foot">
        <div className="decision-weekend-field">
          <label htmlFor={`decision-weekend-${slug}`}>Weekend</label>
          <CompactSelect
            id={`decision-weekend-${slug}`}
            name="selected_weekend_friday"
            value={weekendFriday}
            options={weekendOptions}
            onChange={(v) => {
              setCtaHint(null);
              setWeekendFriday(v);
            }}
            placeholder="Choose a weekend…"
          />
        </div>
        <div className="decision-build-wrap">
          <button
            type="button"
            className="btn btn-berry decision-build-cta"
            disabled={pending}
            onClick={submit}
          >
            {pending ? "Saving…" : "Build the weekend →"}
          </button>
          <CtaRequirementHint>{ctaHint}</CtaRequirementHint>
        </div>
      </div>
    </div>
  );
}
