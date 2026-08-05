/** Trail Map stop IDs and legacy step → stop migration. */

export const TRAIL_STOP_IDS = [
  "destinations",
  "survey",
  "decision",
  "weekend",
  "share",
] as const;

export type TrailStopId = (typeof TRAIL_STOP_IDS)[number];

const LEGACY_STEP_TO_STOP: Record<string, TrailStopId> = {
  basics: "destinations",
  locations: "destinations",
  destinations: "destinations",
  survey: "survey",
  ballot: "decision",
  decision: "decision",
  blueprint: "weekend",
  weekend: "weekend",
  budget: "share",
  confirmations: "share",
  gallery: "share",
  share: "share",
};

export function normalizeTrailStopId(
  raw: string | null | undefined,
): TrailStopId | null {
  if (!raw) return null;
  const mapped = LEGACY_STEP_TO_STOP[raw];
  return mapped ?? null;
}

export function isTrailStopId(id: string): id is TrailStopId {
  return (TRAIL_STOP_IDS as readonly string[]).includes(id);
}
