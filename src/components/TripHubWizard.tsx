"use client";

import { WizardShell, type WizardStepDef } from "@/components/WizardShell";

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
  destinations,
  survey,
  decision,
  weekend,
  share,
}: {
  slug: string;
  completion: TripHubCompletion;
  initialStepId?: string;
  destinations: React.ReactNode;
  survey: React.ReactNode;
  decision: React.ReactNode;
  weekend: React.ReactNode;
  share: React.ReactNode;
}) {
  const steps: WizardStepDef[] = [
    {
      id: "destinations",
      label: "Destinations",
      shortLabel: "Destinations",
      description: "Chat with WandrAI to build a survey shortlist.",
      complete: completion.destinations,
      content: destinations,
    },
    {
      id: "survey",
      label: "Family survey",
      shortLabel: "Survey",
      description: "Share the link so family can weigh in.",
      complete: completion.survey,
      content: survey,
    },
    {
      id: "decision",
      label: "Decision",
      shortLabel: "Decision",
      description: "Lock place and weekend for the itinerary.",
      complete: completion.decision,
      content: decision,
    },
    {
      id: "weekend",
      label: "Weekend plan",
      shortLabel: "Weekend",
      description: "Generate and publish the Fri–Sun itinerary.",
      complete: completion.weekend,
      content: weekend,
    },
    {
      id: "share",
      label: "Share & RSVP",
      shortLabel: "Share",
      description: "Share the live plan and track RSVPs.",
      complete: completion.share,
      content: share,
    },
  ];

  return (
    <WizardShell
      storageKey={`trip-hub-step-${slug}`}
      steps={steps}
      initialStepId={initialStepId}
      lastStepLabel="Back to start"
    />
  );
}
