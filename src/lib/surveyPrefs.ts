import type { LocationOption } from "@/lib/locations";
import { formatUsd, formatUsdRange } from "@/lib/units";

export type SurveyPace = "easy" | "balanced" | "full";
export type SurveyLodging = "rental" | "hotel" | "cabins";
export type SurveyMustHave = "swimming" | "walks" | "dinner";
export type SurveyBudget = "lean" | "middle" | "comfortable";
export type SurveyTravel = "driving" | "mixed" | "flying";

export type SurveyPrefs = {
  pace?: SurveyPace;
  lodging?: SurveyLodging;
  mustHave?: SurveyMustHave;
  budget?: SurveyBudget;
  travel?: SurveyTravel;
  homeCity?: string;
  homeState?: string;
  proposedWeekends?: string[];
};

export type SurveySegmentOption<T extends string> = {
  value: T;
  label: string;
  note: string;
};

export const SURVEY_PACE_OPTIONS: SurveySegmentOption<SurveyPace>[] = [
  { value: "easy", label: "Easy", note: "one thing a day" },
  { value: "balanced", label: "Balanced", note: "a hike plus downtime" },
  { value: "full", label: "Full", note: "up early, out late" },
];

export const SURVEY_LODGING_OPTIONS: SurveySegmentOption<SurveyLodging>[] = [
  { value: "rental", label: "Rental house", note: "kitchen, one roof" },
  { value: "hotel", label: "Hotel block", note: "own rooms, breakfast" },
  { value: "cabins", label: "Cabins + campsites", note: "mixed budget" },
];

export const SURVEY_MUST_HAVE_OPTIONS: SurveySegmentOption<SurveyMustHave>[] = [
  { value: "swimming", label: "Swimming", note: "lake or pool" },
  { value: "walks", label: "Easy walks", note: "stroller and grandparent friendly" },
  { value: "dinner", label: "Big shared dinner", note: "one long table" },
];

export const SURVEY_BUDGET_OPTIONS: SurveySegmentOption<SurveyBudget>[] = [
  { value: "lean", label: "Lean", note: `under ${formatUsd(800)}` },
  { value: "middle", label: "Middle", note: formatUsdRange(800, 1500) },
  { value: "comfortable", label: "Comfortable", note: `${formatUsd(1500)}+` },
];

export const SURVEY_TRAVEL_OPTIONS: SurveySegmentOption<SurveyTravel>[] = [
  { value: "driving", label: "Driving", note: "under 5 hr" },
  { value: "mixed", label: "Mixed", note: "some fly in" },
  { value: "flying", label: "Flying", note: "nearest major airport" },
];

/** Simple match score for re-ranking rail (0–100). */
export function locationMatchScore(
  loc: LocationOption & {
    driveMinutesFromOrigin?: number;
    crowdLevel?: string;
    typicalLodgingUsd?: number;
  },
  prefs: SurveyPrefs,
): number {
  let score = 55;
  const drive = loc.driveMinutesFromOrigin;
  if (prefs.travel === "driving" && drive != null) {
    if (drive <= 300) score += 18;
    else if (drive <= 420) score += 8;
    else score -= 10;
  }
  if (prefs.travel === "flying" && loc.nearestAirportCode) score += 12;
  if (prefs.budget === "lean" && (loc.typicalLodgingUsd ?? 9999) <= 900) score += 10;
  if (prefs.budget === "comfortable" && (loc.typicalLodgingUsd ?? 0) >= 1200) score += 6;
  if (prefs.mustHave === "swimming") score += 4;
  if (prefs.lodging === "rental") score += 5;
  if (loc.crowdLevel === "quiet" && prefs.pace === "easy") score += 8;
  if (loc.crowdLevel === "busy" && prefs.pace === "full") score += 5;
  return Math.max(12, Math.min(98, score));
}

export function surveyNudgeCopy(prefs: SurveyPrefs, placesCount: number): string | null {
  if (prefs.lodging !== "rental" || placesCount < 2) return null;
  const open = Math.max(1, placesCount - 1);
  return `You picked a rental house — ${open} of the ${placesCount} spots still have one open on your dates.`;
}
