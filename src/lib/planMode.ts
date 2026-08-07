/**
 * Sole party-size branching (§6). Nothing else may branch on headcount/households.
 */

export type PlanMode = "solo" | "duo" | "small" | "group";

/** @deprecated Prefer PlanMode — kept for call-site compatibility. */
export type PlanScale = PlanMode | "unresolved";

export type PlanDepth = "single-outing" | "day-or-weekend" | "multi-day";

export type PlanCapabilities = {
  survey: boolean;
  voting: boolean;
  budgetFloors: boolean;
  nudges: boolean;
  households: boolean;
  maxQuestions: number;
  optionCount: number;
  depth: PlanDepth;
  requireAuth: boolean;
  /** Alias of households — legacy hub UI. */
  splitLabels: boolean;
  /** Alias of households — legacy hub UI. */
  farthestHousehold: boolean;
};

export type PlanModeDraft = {
  partySize?: number | null;
  headcount?: number | null;
  households?: number | null;
  householdCount?: number | null;
};

function partySizeOf(draft: PlanModeDraft): number | null {
  const n = draft.partySize ?? draft.headcount ?? null;
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function householdsOf(draft: PlanModeDraft): number | null {
  const n = draft.households ?? draft.householdCount ?? null;
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Derive plan mode from draft fields — the only branching point for scale. */
export function deriveMode(draft: PlanModeDraft): PlanMode | "unresolved" {
  const partySize = partySizeOf(draft);
  const households = householdsOf(draft);

  if (households != null && households >= 3) return "group";
  if (partySize != null && partySize >= 6) return "group";
  if (partySize != null && partySize >= 3 && partySize <= 5) return "small";
  if (partySize === 2) return "duo";
  if (partySize != null && partySize <= 1) return "solo";

  if (households != null && households >= 2) {
    // Two households without a clear headcount → treat as group (multi-household).
    return "group";
  }
  if (households === 1 && partySize == null) return "solo";

  return "unresolved";
}

const CAPS: Record<PlanMode, PlanCapabilities> = {
  solo: {
    survey: false,
    voting: false,
    budgetFloors: false,
    nudges: false,
    households: false,
    maxQuestions: 1,
    optionCount: 3,
    depth: "single-outing",
    requireAuth: false,
    splitLabels: false,
    farthestHousehold: false,
  },
  duo: {
    survey: false,
    voting: false,
    budgetFloors: false,
    nudges: false,
    households: false,
    maxQuestions: 1,
    optionCount: 3,
    depth: "single-outing",
    requireAuth: false,
    splitLabels: false,
    farthestHousehold: false,
  },
  small: {
    survey: false,
    voting: true,
    budgetFloors: false,
    nudges: false,
    households: false,
    maxQuestions: 2,
    optionCount: 3,
    depth: "day-or-weekend",
    requireAuth: false,
    splitLabels: false,
    farthestHousehold: false,
  },
  group: {
    survey: true,
    voting: true,
    budgetFloors: true,
    nudges: true,
    households: true,
    maxQuestions: 2,
    optionCount: 3,
    depth: "multi-day",
    requireAuth: true,
    splitLabels: true,
    farthestHousehold: true,
  },
};

export function capabilitiesForMode(mode: PlanMode | "unresolved"): PlanCapabilities {
  if (mode === "unresolved") return CAPS.duo; // safe default: no survey/family chrome
  return CAPS[mode];
}

/**
 * Capability flags from draft — sole entry for survey/voting/budget gates.
 * Accepts legacy { householdCount, headcount } or R12 { partySize, households }.
 */
export function planCapabilities(input: PlanModeDraft): PlanCapabilities {
  return capabilitiesForMode(deriveMode(input));
}

/**
 * Household count for capability flags on an owned trip.
 * - 2+ survey responses → that count
 * - planHeadcount 1–2 with fewer than 2 responses → solo/duo (no survey)
 * - otherwise default toward group (classic multi-household trips)
 */
export function householdCountForTripCapabilities(input: {
  surveyResponseCount: number;
  planHeadcount?: number | null;
}): number {
  const responses = Math.max(0, input.surveyResponseCount);
  if (responses >= 2) return responses;
  if (input.planHeadcount != null && input.planHeadcount <= 2) return 1;
  if (input.planHeadcount != null && input.planHeadcount <= 5) return 1;
  return Math.max(responses, 3);
}

export function isDuoScale(input: PlanModeDraft): boolean {
  return deriveMode(input) === "duo";
}

/** @deprecated Prefer deriveMode. */
export function resolvePlanScale(input: PlanModeDraft): PlanScale {
  return deriveMode(input);
}

export type ScaleInference = {
  scale: PlanMode;
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

  const peopleMatch = t.match(
    /\b(\d{1,2})\s*(people|persons|folks|of us|guests)\b/,
  );
  if (peopleMatch) {
    const n = Number(peopleMatch[1]);
    if (Number.isFinite(n) && n >= 6) {
      return { scale: "group", householdCount: 3, headcount: n };
    }
    if (Number.isFinite(n) && n >= 3 && n <= 5) {
      return { scale: "small", householdCount: 1, headcount: n };
    }
  }

  if (
    /\b(reunion|family reunion|extended family|whole family|our family|my family|the family|cousins?|households?|multi[- ]household|relatives)\b/.test(
      t,
    ) ||
    /\b(\d{1,2})\s*(households?|families)\b/.test(t)
  ) {
    const m = t.match(/\b(\d{1,2})\s*(households?|families)\b/);
    const n = m ? Number(m[1]) : 3;
    return {
      scale: "group",
      householdCount: Math.max(3, Number.isFinite(n) ? n : 3),
      headcount: Math.max(6, Number.isFinite(n) ? n * 2 : 8),
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

  const current = deriveMode({
    householdCount: prior.householdCount,
    headcount: prior.headcount,
  });

  // Never downgrade an established group to solo/duo/small from a later cue.
  if (current === "group" && inferred.scale !== "group") return prior;

  return {
    ...prior,
    householdCount: inferred.householdCount,
    headcount: inferred.headcount,
  };
}

/** One-line announcement when mode tier changes mid-conversation. */
export function modeChangeLine(
  from: PlanMode | "unresolved",
  to: PlanMode,
): string | null {
  if (from === to || from === "unresolved") return null;
  if (to === "group") {
    return "Thirty people — turning on households, budget floors and reminders.";
  }
  if (to === "small") {
    return "A few of you — turning on voting so everyone can weigh in.";
  }
  if (to === "duo") {
    return "Just the two of you — keeping this light, no survey.";
  }
  if (to === "solo") {
    return "Just you — skipping anything that needs a group.";
  }
  return null;
}

export function scalePromptHint(scale: PlanScale): string {
  if (scale === "duo") {
    return "Scale: duo (2 people, 1 household). Do NOT ask about households, family size, surveys, voting, or who else is coming. Ask only trip-facing details (dates, place, vibe, budget). Output venues priced for two.";
  }
  if (scale === "solo") {
    return "Scale: solo (1 person). Do NOT ask about households, family, surveys, or voting. Ask only trip-facing details.";
  }
  if (scale === "small") {
    return "Scale: small (3–5 people). Voting may apply; no survey, no household budget floors. Depth: day or weekend.";
  }
  if (scale === "group") {
    return "Scale: group / multi-household. Survey (offered, not required), voting, budget floors, and nudges apply. Ask household count only if still unknown. Output multi-day itineraries with lodging that sleeps the headcount.";
  }
  return "Scale: unresolved. Ask what they're planning in neutral terms — do not presume a reunion, family gathering, or voting until scale is clear.";
}

/** Step-count eyebrow derived from capabilities — never invent steps. */
export function stepEyebrow(
  currentIndex: number,
  capabilities: PlanCapabilities,
): string {
  const total = capabilities.survey ? 3 : 2;
  const n = Math.min(Math.max(1, currentIndex), total);
  return `STEP ${n} OF ${total}`;
}
