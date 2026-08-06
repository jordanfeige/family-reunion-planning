"use client";

import { useEffect } from "react";

import { listLocalFacts } from "@/lib/peopleGraph";

/**
 * If the visitor has local people-graph facts but no server trips,
 * `/` landed them on Browse — bounce once to the composer.
 * Skipped when `?stay=1` (intentional Browse via the two-door switch).
 */
export function ReturningFactsUpgrade() {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (new URLSearchParams(window.location.search).get("stay") === "1") return;
      if (listLocalFacts().length > 0) {
        window.location.replace("/api/plan/start");
      }
    } catch {
      /* stay on browse */
    }
  }, []);

  return null;
}
