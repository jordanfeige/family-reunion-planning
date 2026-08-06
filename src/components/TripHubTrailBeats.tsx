"use client";

import { useCallback, useEffect, useState } from "react";

import {
  TRAIL_BEAT_EVENT,
  TrailBeat,
  consumeTrailBeat,
  type TrailBeatKind,
} from "@/components/TrailBeat";

type ActiveBeat = {
  kind: TrailBeatKind;
  names?: string[];
  detail?: string;
};

function beatFromPayload(kind: TrailBeatKind, payload: string): ActiveBeat {
  if (kind === "shortlist") {
    const names = payload === "1" ? undefined : payload.split("|").filter(Boolean);
    return { kind, names };
  }
  if (kind === "decision") {
    const [title, weekend] = payload.split("|");
    return {
      kind,
      detail: [title, weekend].filter(Boolean).join(" · "),
    };
  }
  return { kind };
}

/**
 * Renders trail celebration beats. Listens for live queue events and
 * sessionStorage leftovers after navigation/refresh.
 */
export function TripHubTrailBeats({
  slug,
  survey = true,
}: {
  slug: string;
  survey?: boolean;
}) {
  const [beat, setBeat] = useState<ActiveBeat | null>(null);

  useEffect(() => {
    const kinds: TrailBeatKind[] = ["shortlist", "decision", "plan"];
    for (const kind of kinds) {
      const payload = consumeTrailBeat(slug, kind);
      if (payload) {
        setBeat(beatFromPayload(kind, payload));
        return;
      }
    }

    function onBeat(e: Event) {
      const detail = (e as CustomEvent).detail as {
        slug: string;
        kind: TrailBeatKind;
        payload: string;
      };
      if (detail.slug !== slug) return;
      consumeTrailBeat(slug, detail.kind);
      setBeat(beatFromPayload(detail.kind, detail.payload));
    }

    window.addEventListener(TRAIL_BEAT_EVENT, onBeat);
    return () => window.removeEventListener(TRAIL_BEAT_EVENT, onBeat);
  }, [slug]);

  const dismiss = useCallback(() => {
    setBeat(null);
  }, []);

  if (!beat) return null;

  return (
    <TrailBeat
      kind={beat.kind}
      names={beat.names}
      detail={beat.detail}
      survey={survey}
      onContinue={dismiss}
    />
  );
}
