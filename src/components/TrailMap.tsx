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

  return (
    <nav className="trail-map" aria-label="Trip trail">
      <ol className="trail-map-list">
        {stops.map((stop, i) => {
          const isActive = stop.id === activeId;
          const done = Boolean(stop.complete) && !isActive;
          const ahead = i > activeIndex && !done;
          return (
            <li key={stop.id} className="trail-map-item">
              {i > 0 ? (
                <span
                  className={[
                    "trail-map-path",
                    i <= activeIndex || done ? "is-drawn" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                />
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
                {done ? <CheckIcon /> : <span className="trail-map-dot" />}
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
