"use client";

import { WizardShell, type WizardPhaseDef, type WizardStepDef } from "@/components/WizardShell";

export type TripHubCompletion = {
  basics: boolean;
  locations: boolean;
  survey: boolean;
  ballot: boolean;
  blueprint: boolean;
  budget: boolean;
  confirmations: boolean;
  gallery: boolean;
};

export type TripHubPhaseSummaries = {
  decide?: string;
  shape?: string;
  gather?: string;
};

export function TripHubWizard({
  slug,
  completion,
  galleryUnlocked,
  phaseSummaries,
  basics,
  locations,
  survey,
  ballot,
  blueprint,
  budget,
  confirmations,
  gallery,
}: {
  slug: string;
  completion: TripHubCompletion;
  galleryUnlocked: boolean;
  phaseSummaries?: TripHubPhaseSummaries;
  basics: React.ReactNode;
  locations: React.ReactNode;
  survey: React.ReactNode;
  ballot: React.ReactNode;
  blueprint: React.ReactNode;
  budget: React.ReactNode;
  confirmations: React.ReactNode;
  gallery: React.ReactNode;
}) {
  const phases: WizardPhaseDef[] = [
    {
      id: "decide",
      label: "Decide",
      summary: phaseSummaries?.decide,
    },
    {
      id: "shape",
      label: "Shape",
      summary: phaseSummaries?.shape,
    },
    {
      id: "gather",
      label: "Gather",
      summary: phaseSummaries?.gather,
      muted: !galleryUnlocked,
    },
  ];

  const steps: WizardStepDef[] = [
    {
      id: "basics",
      phaseId: "decide",
      label: "Trip basics",
      shortLabel: "Basics",
      icon: "basics",
      description:
        "Name your reunion and pick candidate Fri–Sun weekends—these become options on the family survey.",
      complete: completion.basics,
      content: basics,
    },
    {
      id: "locations",
      phaseId: "decide",
      label: "Locations",
      shortLabel: "Places",
      icon: "locations",
      description:
        "Open WandrAI to pick destinations, publish them to the survey, then share the link.",
      complete: completion.locations,
      content: locations,
    },
    {
      id: "survey",
      phaseId: "decide",
      label: "Family survey",
      shortLabel: "Survey",
      icon: "survey",
      description:
        "Share the preference survey—family picks weekends and places (not a final commitment yet).",
      complete: completion.survey,
      content: survey,
    },
    {
      id: "ballot",
      phaseId: "shape",
      label: "Group vote",
      shortLabel: "Vote",
      icon: "ballot",
      description:
        "Lock where you’re going, add stays/meals/activities with AI, then let family thumbs-up or down each option.",
      complete: completion.ballot,
      content: ballot,
    },
    {
      id: "blueprint",
      phaseId: "shape",
      label: "Blueprint",
      shortLabel: "Plan",
      icon: "blueprint",
      description:
        "Build your Fri–Sun itinerary from the winning picks and publish the plan.",
      complete: completion.blueprint,
      content: blueprint,
    },
    {
      id: "budget",
      phaseId: "gather",
      label: "Budget",
      shortLabel: "Budget",
      icon: "budget",
      description:
        "Log shared costs, track who paid in, and see an even split estimate per confirmed household.",
      complete: completion.budget,
      content: budget,
    },
    {
      id: "confirmations",
      phaseId: "gather",
      label: "Confirmations",
      shortLabel: "RSVP",
      icon: "share",
      description: galleryUnlocked
        ? "Share the published plan link and track final yes/no RSVPs."
        : "Publish your plan in Blueprint first, then share the link for final RSVPs.",
      complete: completion.confirmations,
      content: confirmations,
    },
    {
      id: "gallery",
      phaseId: "gather",
      label: "Gallery & memories",
      shortLabel: "Photos",
      icon: "gallery",
      description: galleryUnlocked
        ? "Upload photos and videos after the trip."
        : "Opens after you publish the plan—save memories from the reunion here.",
      complete: completion.gallery,
      content: gallery,
    },
  ];

  return (
    <WizardShell
      storageKey={`trip-hub-step-${slug}`}
      phases={phases}
      steps={steps}
      lastStepLabel="Back to start"
    />
  );
}
