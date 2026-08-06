import type { PlanCapabilities } from "@/lib/planMode";
import type { TrailStopId } from "@/lib/trailStops";
import type { PlanStepId } from "@/lib/planTripDraft";

export type PlanFlowStep = {
  id: PlanStepId;
  label: string;
};

export type HubFlowStep = {
  id: TrailStopId;
  label: string;
  shortLabel: string;
};

/** /plan trail steps — survey only when capability.survey. */
export function planFlowSteps(capabilities: PlanCapabilities): PlanFlowStep[] {
  const steps: PlanFlowStep[] = [
    { id: "create", label: "Basics" },
    { id: "places", label: "Destinations" },
  ];
  if (capabilities.survey) {
    steps.push({ id: "survey", label: "Survey" });
  }
  return steps;
}

/** Trip hub trail stops — survey only when capability.survey. */
export function hubFlowSteps(capabilities: PlanCapabilities): HubFlowStep[] {
  const steps: HubFlowStep[] = [
    {
      id: "destinations",
      label: "Destinations",
      shortLabel: "Destinations",
    },
  ];
  if (capabilities.survey) {
    steps.push({
      id: "survey",
      label: "Ask the family",
      shortLabel: "Survey",
    });
  }
  steps.push(
    {
      id: "decision",
      label: "Decision",
      shortLabel: "Decision",
    },
    {
      id: "weekend",
      label: "Weekend plan",
      shortLabel: "Weekend",
    },
    {
      id: "share",
      label: "Share & RSVP",
      shortLabel: "Share",
    },
  );
  return steps;
}

/** First hub stop after publishing a shortlist. */
export function hubStopAfterShortlist(capabilities: PlanCapabilities): TrailStopId {
  return capabilities.survey ? "survey" : "decision";
}

/** Claim / save redirect stop. */
export function claimStopForCapabilities(capabilities: PlanCapabilities): TrailStopId {
  return capabilities.survey ? "survey" : "decision";
}
