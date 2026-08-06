"use client";

import { WizardShell, type WizardStepDef } from "@/components/WizardShell";
import type { PlanCapabilities } from "@/lib/planMode";
import { hubFlowSteps } from "@/lib/planSteps";

export type TripHubCompletion = {
  destinations: boolean;
  survey: boolean;
  decision: boolean;
  weekend: boolean;
  share: boolean;
};

export function TripHubWizard({
  slug,
  completion,
  initialStepId,
  trailAside,
  capabilities,
  destinations,
  survey,
  decision,
  weekend,
  share,
}: {
  slug: string;
  completion: TripHubCompletion;
  initialStepId?: string;
  trailAside?: React.ReactNode;
  capabilities: PlanCapabilities;
  destinations: React.ReactNode;
  survey: React.ReactNode;
  decision: React.ReactNode;
  weekend: React.ReactNode;
  share: React.ReactNode;
}) {
  const flow = hubFlowSteps(capabilities);
  const contentById: Record<string, React.ReactNode> = {
    destinations,
    survey,
    decision,
    weekend,
    share,
  };
  const completionById: Record<string, boolean> = {
    destinations: completion.destinations,
    survey: completion.survey,
    decision: completion.decision,
    weekend: completion.weekend,
    share: completion.share,
  };

  const steps: WizardStepDef[] = flow.map((s) => ({
    id: s.id,
    label: s.label,
    shortLabel: s.shortLabel,
    description:
      s.id === "destinations"
        ? capabilities.survey
          ? "Chat with WandrAI to build a shortlist."
          : "Chat with WandrAI to build your shortlist."
        : s.id === "survey"
          ? "Share the link so family can weigh in."
          : s.id === "decision"
            ? "Lock place and weekend for the itinerary."
            : s.id === "weekend"
              ? "Generate and publish the Fri–Sun itinerary."
              : "Share the live plan and track RSVPs.",
    complete: completionById[s.id],
    content: contentById[s.id],
  }));

  const safeInitial =
    initialStepId && steps.some((s) => s.id === initialStepId)
      ? initialStepId
      : initialStepId === "survey" && !capabilities.survey
        ? "decision"
        : undefined;

  return (
    <WizardShell
      storageKey={`trip-hub-step-${slug}`}
      steps={steps}
      initialStepId={safeInitial}
      trailAside={trailAside}
      lastStepLabel="Back to start"
    />
  );
}
