"use client";

import { cityOnly } from "@/lib/driveTimes";
import { placeStillUrl } from "@/lib/placeImages";
import type { PlacesDraftItem } from "@/lib/placesDraft";
import { formatCityState, formatDriveTime } from "@/lib/units";

const CROWD_LABELS: Record<NonNullable<PlacesDraftItem["crowdLevel"]>, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  busy: "Busy",
};

function placeName(title: string): string {
  const idx = title.indexOf(",");
  return (idx === -1 ? title : title.slice(0, idx)).trim();
}

function placeCityStateLine(item: PlacesDraftItem): string {
  const city = placeName(item.title);
  if (item.state) return formatCityState(city, item.state);
  const parts = item.title.split(",").map((s) => s.trim());
  if (parts.length >= 2 && parts[1].length === 2) {
    return formatCityState(parts[0], parts[1]);
  }
  return "";
}

function drivePill(item: PlacesDraftItem): string {
  const from = item.originMetro ? cityOnly(item.originMetro) : undefined;
  return formatDriveTime(item.driveMinutesFromOrigin, from);
}

export function LiveShortlist({
  places,
  onToggle,
  onConfirm,
  onDifferentIdeas,
  groupDriveSummary,
  farthestHouseholds,
  confirmBusy,
  emptyHint = "As you chat, destinations appear here with a scenic still.",
}: {
  places: PlacesDraftItem[];
  onToggle: (title: string) => void;
  onConfirm: () => void;
  onDifferentIdeas?: () => void;
  groupDriveSummary?: string;
  farthestHouseholds?: string;
  confirmBusy?: boolean;
  emptyHint?: string;
}) {
  const picked = places.filter((p) => p.selected !== false);
  const total = places.length;
  const pickedCount = picked.length;

  return (
    <aside className="live-shortlist" aria-label="Live shortlist">
      <header className="live-shortlist-head">
        <h3 className="live-shortlist-title">Live shortlist</h3>
        {total > 0 ? (
          <span className="live-shortlist-count" aria-live="polite">
            {pickedCount} of {total} picked
          </span>
        ) : null}
      </header>

      {places.length === 0 ? (
        <div className="live-shortlist-empty">
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {emptyHint}
          </p>
        </div>
      ) : (
        <ul className="live-shortlist-list">
          {places.map((place) => {
            const checked = place.selected !== false;
            const cityState = placeCityStateLine(place);
            const driveLabel = groupDriveSummary || drivePill(place);
            const crowdLabel = place.crowdLevel
              ? CROWD_LABELS[place.crowdLevel]
              : null;

            return (
              <li key={place.title}>
                <label className={`live-shortlist-card${checked ? " is-checked" : ""}`}>
                  <div className="live-shortlist-row">
                    <div className="live-shortlist-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={placeStillUrl(place.title, place.summary)}
                        alt=""
                        width={88}
                        height={62}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="live-shortlist-body">
                      <span className="live-shortlist-check-wrap">
                        <input
                          type="checkbox"
                          className="live-shortlist-check"
                          checked={checked}
                          onChange={() => onToggle(place.title)}
                          aria-label={`Include ${placeName(place.title)}`}
                        />
                      </span>
                      <span className="live-shortlist-text">
                        <strong className="live-shortlist-name">
                          {placeName(place.title)}
                        </strong>
                        {cityState ? (
                          <span className="live-shortlist-city">{cityState}</span>
                        ) : null}
                        <span className="live-shortlist-pills">
                          {driveLabel ? (
                            <span
                              className="live-shortlist-pill"
                              title={
                                groupDriveSummary && farthestHouseholds
                                  ? farthestHouseholds
                                  : undefined
                              }
                            >
                              {driveLabel}
                            </span>
                          ) : null}
                          {crowdLabel ? (
                            <span className="live-shortlist-pill">{crowdLabel}</span>
                          ) : null}
                        </span>
                      </span>
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="live-shortlist-foot">
        <button
          type="button"
          className="btn btn-berry live-shortlist-cta"
          disabled={confirmBusy || pickedCount === 0}
          onClick={onConfirm}
        >
          {confirmBusy
            ? "Saving…"
            : pickedCount > 0
              ? `These ${pickedCount} feel right →`
              : "Pick at least one"}
        </button>
        {onDifferentIdeas ? (
          <button
            type="button"
            className="live-shortlist-alt"
            disabled={confirmBusy}
            onClick={onDifferentIdeas}
          >
            Show me different ideas
          </button>
        ) : null}
      </div>
    </aside>
  );
}
