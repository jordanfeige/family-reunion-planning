"use client";

import { WizardShell, type WizardStepDef } from "@/components/WizardShell";

export type TripHubCompletion = {
  basics: boolean;
  locations: boolean;
  survey: boolean;
  ballot: boolean;
  blueprint: boolean;
  confirmations: boolean;
  gallery: boolean;
};

export function TripHubWizard({
  slug,
  completion,
  galleryUnlocked,
  basics,
  locations,
  survey,
  ballot,
  blueprint,
  confirmations,
  gallery,
}: {
  slug: string;
  completion: TripHubCompletion;
  galleryUnlocked: boolean;
  basics: React.ReactNode;
  locations: React.ReactNode;
  survey: React.ReactNode;
  ballot: React.ReactNode;
  blueprint: React.ReactNode;
  confirmations: React.ReactNode;
  gallery: React.ReactNode;
}) {
  const steps: WizardStepDef[] = [
    {
      id: "basics",
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
      label: "Locations",
      shortLabel: "Places",
      icon: "locations",
      description:
        "Brainstorm destinations with WandrAI, then add choices so family can vote.",
      complete: completion.locations,
      content: locations,
    },
    {
      id: "survey",
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
      label: "Blueprint",
      shortLabel: "Plan",
      icon: "blueprint",
      description:
        "Build your Fri–Sun itinerary from the winning picks and publish the plan.",
      complete: completion.blueprint,
      content: blueprint,
    },
    {
      id: "confirmations",
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
      steps={steps}
      progressEyebrow="WandrAI trip planner"
    />
  );
}
