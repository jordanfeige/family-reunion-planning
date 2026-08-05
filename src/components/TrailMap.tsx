"use client";

export type TrailMapStop = {
  id: string;
  label: string;
  complete?: boolean;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
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

function stopIcon(id: string, active: boolean) {
  if (active && (id === "destinations" || id === "places" || id === "create")) {
    return <PinIcon />;
  }
  return <span className="trail-map-dot" />;
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

  return (
    <nav className="trail-map" aria-label="Trip trail">
      <ol className="trail-map-list">
        {stops.map((stop, i) => {
          const isActive = stop.id === activeId;
          const done = Boolean(stop.complete) && !isActive;
          const ahead = i > activeIndex && !done;
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
                  {isNextPath ? (
                    <span className="trail-map-pulse" />
                  ) : null}
                </span>
              ) : null}
              <button
                type="button"
                className={[
                  "trail-map-node",
                  isActive ? "is-active" : "",
                  done ? "is-complete" : "",
                  ahead ? "is-ahead" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "step" : undefined}
                aria-label={stop.label}
                onClick={() => onSelect(stop.id)}
              >
                {done ? <CheckIcon /> : stopIcon(stop.id, isActive)}
              </button>
              <span
                className={[
                  "trail-map-label",
                  isActive ? "is-active" : "",
                  done ? "is-complete" : "",
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
