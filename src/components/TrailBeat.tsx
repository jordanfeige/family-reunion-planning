"use client";

import { useEffect, useState } from "react";

export type TrailBeatKind = "shortlist" | "decision" | "plan";

const BEAT_COPY: Record<
  TrailBeatKind,
  { title: string; sub: string; cta: string }
> = {
  shortlist: {
    title: "Shortlist ready for the family",
    sub: "Your destinations are on the trail — time to share the survey.",
    cta: "Continue to Survey",
  },
  decision: {
    title: "We’re going",
    sub: "Place and weekend are set. Shape the Fri–Sun plan next.",
    cta: "Plan the weekend",
  },
  plan: {
    title: "Plan is live",
    sub: "Family can open the share link and RSVP on the locked itinerary.",
    cta: "Open Share",
  },
};

export const TRAIL_BEAT_EVENT = "wandrai:trail-beat";

export function TrailBeat({
  kind,
  names,
  detail,
  onContinue,
  autoMs = 1400,
}: {
  kind: TrailBeatKind;
  names?: string[];
  detail?: string | null;
  onContinue: () => void;
  autoMs?: number;
}) {
  const copy = BEAT_COPY[kind];
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const delay = mq.matches ? 0 : autoMs;
    const t = window.setTimeout(onContinue, delay);
    return () => window.clearTimeout(t);
  }, [autoMs, onContinue]);

  return (
    <div
      className={`trail-beat trail-beat--${kind}${reduced ? " is-reduced" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trail-beat-title"
    >
      <div className="trail-beat-wash" aria-hidden />
      <div className="trail-beat-inner">
        {names && names.length > 0 ? (
          <ul className="trail-beat-names" aria-hidden>
            {names.map((name, i) => (
              <li
                key={name}
                className="trail-beat-name"
                style={{ animationDelay: `${0.08 + i * 0.1}s` }}
              >
                {name}
              </li>
            ))}
          </ul>
        ) : null}
        {detail ? <p className="trail-beat-detail">{detail}</p> : null}
        <h2 id="trail-beat-title" className="trail-beat-title">
          {copy.title}
        </h2>
        <p className="trail-beat-sub">{copy.sub}</p>
        <button type="button" className="btn btn-berry" onClick={onContinue}>
          {copy.cta}
        </button>
      </div>
    </div>
  );
}

const beatKey = (slug: string, kind: TrailBeatKind) =>
  `trail-beat-pending-${slug}-${kind}`;

export function queueTrailBeat(slug: string, kind: TrailBeatKind, payload?: string) {
  const value = payload ?? "1";
  try {
    sessionStorage.setItem(beatKey(slug, kind), value);
  } catch {
    /* private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TRAIL_BEAT_EVENT, {
        detail: { slug, kind, payload: value },
      }),
    );
  }
}

export function consumeTrailBeat(
  slug: string,
  kind: TrailBeatKind,
): string | null {
  try {
    const key = beatKey(slug, kind);
    const v = sessionStorage.getItem(key);
    if (!v) return null;
    sessionStorage.removeItem(key);
    return v;
  } catch {
    return null;
  }
}
