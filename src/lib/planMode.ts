/** Plan-scale capability flags (R3 / R9 / R10 / R11). */

export type PlanCapabilities = {
  /** Group survey / "ask the family" — offered only at multi-household scale. */
  survey: boolean;
  voting: boolean;
  budgetFloors: boolean;
  splitLabels: boolean;
  farthestHousehold: boolean;
};

/** Resolved party scale for prompts and gating. */
export type PlanScale = "solo" | "duo" | "group" | "unresolved";

export function planCapabilities(input: {
  householdCount: number;
  headcount?: number | null;
}): PlanCapabilities {
  const households = Math.max(0, input.householdCount);
  const group = households >= 2;
  return {
    survey: group,
    voting: group,
    budgetFloors: group,
    splitLabels: group,
    farthestHousehold: group,
  };
}

/**
 * Household count for capability flags on an owned trip.
 * - 2+ survey responses → that count
 * - planHeadcount 1–2 with fewer than 2 responses → solo/duo (no survey)
 * - otherwise default to group (classic family-reunion trips)
 */
export function householdCountForTripCapabilities(input: {
  surveyResponseCount: number;
  planHeadcount?: number | null;
}): number {
  const responses = Math.max(0, input.surveyResponseCount);
  if (responses >= 2) return responses;
  if (input.planHeadcount != null && input.planHeadcount <= 2) return 1;
  return Math.max(responses, 2);
}

/** Duo (not group): one household, two people — lightweight share OK, no survey. */
export function isDuoScale(input: {
  householdCount: number;
  headcount?: number | null;
}): boolean {
  return resolvePlanScale(input) === "duo";
}

/** Derive scale from structured draft fields (R3 sufficiency). */
export function resolvePlanScale(input: {
  householdCount?: number | null;
  headcount?: number | null;
}): PlanScale {
  const hh = input.householdCount ?? null;
  const hc = input.headcount ?? null;

  if (hh != null && hh >= 2) return "group";
  if (hh != null && hh <= 1) {
    if (hc === 1) return "solo";
    if (hc === 2) return "duo";
    if (hc != null && hc > 2) return "group";
    return "solo";
  }
  if (hc === 1) return "solo";
  if (hc === 2) return "duo";
  if (hc != null && hc >= 3) return "group";
  return "unresolved";
}

export type ScaleInference = {
  scale: Exclude<PlanScale, "unresolved">;
  householdCount: number;
  headcount: number;
};

/**
 * Deterministic scale cues from free text — runs before the LLM so the next
 * turn never asks a group question after a clear duo/solo signal.
 */
export function inferScaleFromText(text: string): ScaleInference | null {
  const t = text.toLowerCase();

  if (
    /\b(wife|husband|girlfriend|boyfriend|partner|fiancé|fiance|fiancée|spouse|date\s*night|just the two of us|the two of us|my better half)\b/.test(
      t,
    )
  ) {
    return { scale: "duo", householdCount: 1, headcount: 2 };
  }

  if (
    /\b(just me|by myself|on my own|solo (trip|weekend|getaway)|traveling alone|travelling alone|myself only)\b/.test(
      t,
    )
  ) {
    return { scale: "solo", householdCount: 1, headcount: 1 };
  }

  if (
    /\b(reunion|family reunion|extended family|whole family|our family|my family|the family|cousins?|households?|multi[- ]household|relatives)\b/.test(
      t,
    ) ||
    /\b(\d{1,2})\s*(households?|families)\b/.test(t)
  ) {
    const m = t.match(/\b(\d{1,2})\s*(households?|families)\b/);
    const n = m ? Number(m[1]) : 2;
    return {
      scale: "group",
      householdCount: Math.max(2, Number.isFinite(n) ? n : 2),
      headcount: Math.max(2, Number.isFinite(n) ? n * 2 : 4),
    };
  }

  return null;
}

/** Merge text-inferred scale onto a draft without wiping stronger group facts. */
export function applyScaleInference<
  T extends { householdCount?: number | null; headcount?: number | null },
>(prior: T, message: string): T {
  const inferred = inferScaleFromText(message);
  if (!inferred) return prior;

  const current = resolvePlanScale({
    householdCount: prior.householdCount,
    headcount: prior.headcount,
  });

  // Never downgrade an established group to solo/duo from a later cue.
  if (current === "group" && inferred.scale !== "group") return prior;

  return {
    ...prior,
    householdCount: inferred.householdCount,
    headcount: inferred.headcount,
  };
}

export function scalePromptHint(scale: PlanScale): string {
  if (scale === "duo") {
    return "Scale: duo (2 people, 1 household). Do NOT ask about households, family size, surveys, voting, or who else is coming. Ask only trip-facing details (dates, place, vibe, budget).";
  }
  if (scale === "solo") {
    return "Scale: solo (1 person). Do NOT ask about households, family, surveys, or voting. Ask only trip-facing details.";
  }
  if (scale === "group") {
    return "Scale: group / multi-household. Survey and voting capabilities may apply. Ask household count only if still unknown.";
  }
  return "Scale: unresolved. Ask what they're planning in neutral terms — do not presume a reunion, family gathering, or voting until scale is clear.";
}
