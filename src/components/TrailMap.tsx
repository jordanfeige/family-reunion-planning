"use client";

export type TrailMapStop = {
  id: string;
  label: string;
  complete?: boolean;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d="M3.5 8.2 6.6 11.2 12.5 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none">
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** True when all prior stops are complete (or index is 0). */
function isStopUnlocked(stops: TrailMapStop[], index: number) {
  if (index <= 0) return true;
  return stops.slice(0, index).every((s) => Boolean(s.complete));
}

function nodeGlyph(
  stop: TrailMapStop,
  index: number,
  isActive: boolean,
  done: boolean,
) {
  if (done) return <CheckIcon />;
  if (
    isActive &&
    (stop.id === "destinations" || stop.id === "places" || stop.id === "create")
  ) {
    return <PinIcon />;
  }
  return <span className="trail-map-step-num">{index + 1}</span>;
}

export function TrailMap({
  stops,
  activeId,
  onSelect,
}: {
  stops: TrailMapStop[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    stops.findIndex((s) => s.id === activeId),
  );
  const nextIndex =
    activeIndex >= 0 && activeIndex < stops.length - 1 ? activeIndex + 1 : -1;
  const activeStop = stops[activeIndex];
  const stepCaption = activeStop
    ? `Step ${activeIndex + 1} of ${stops.length} · ${activeStop.label}`
    : null;

  return (
    <nav className="trail-map" aria-label="Trip trail">
      {stepCaption ? (
        <p className="trail-map-caption" aria-live="polite">
          {stepCaption}
        </p>
      ) : null}
      <ol className="trail-map-list">
        {stops.map((stop, i) => {
          const isActive = stop.id === activeId;
          const done = Boolean(stop.complete) && !isActive;
          const unlocked = isStopUnlocked(stops, i);
          const upcoming = !done && !isActive && !unlocked;
          const isNextPath = i === nextIndex;

          return (
            <li key={stop.id} className="trail-map-item">
              {i > 0 ? (
                <span
                  className={[
                    "trail-map-path",
                    i <= activeIndex || done ? "is-drawn" : "",
                    isNextPath ? "is-next" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                >
                  {isNextPath ? <span className="trail-map-pulse" /> : null}
                </span>
              ) : null}
              <button
                type="button"
                className={[
                  "trail-map-node",
                  isActive ? "is-active" : "",
                  done ? "is-complete" : "",
                  upcoming ? "is-upcoming" : "",
                  !upcoming && !done && !isActive ? "is-ready" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "step" : undefined}
                aria-label={stop.label}
                aria-disabled={upcoming || undefined}
                onClick={() => {
                  if (upcoming) return;
                  if (!unlocked && !done && !isActive) return;
                  onSelect(stop.id);
                }}
              >
                {nodeGlyph(stop, i, isActive, done)}
              </button>
              <span
                className={[
                  "trail-map-label",
                  isActive ? "is-active" : "",
                  done ? "is-complete" : "",
                  upcoming ? "is-upcoming" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {stop.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
