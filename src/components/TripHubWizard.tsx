"use client";

import { WizardShell, type WizardStepDef } from "@/components/WizardShell";

export type TripHubCompletion = {
  basics: boolean;
  locations: boolean;
  survey: boolean;
  blueprint: boolean;
  share: boolean;
};

export function TripHubWizard({
  slug,
  completion,
  basics,
  locations,
  survey,
  blueprint,
  share,
  more,
}: {
  slug: string;
  completion: TripHubCompletion;
  basics: React.ReactNode;
  locations: React.ReactNode;
  survey: React.ReactNode;
  blueprint: React.ReactNode;
  share: React.ReactNode;
  more: React.ReactNode;
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
      label: "Survey & RSVPs",
      shortLabel: "RSVP",
      icon: "survey",
      description:
        "Share the RSVP link with family (works great on phones). Watch responses and availability here.",
      complete: completion.survey,
      content: survey,
    },
    {
      id: "blueprint",
      label: "Blueprint",
      shortLabel: "Plan",
      icon: "blueprint",
      description:
        "Lock the winning location and weekend, generate your Fri–Sun itinerary, and track bookings.",
      complete: completion.blueprint,
      content: blueprint,
    },
    {
      id: "share",
      label: "Share plan",
      shortLabel: "Share",
      icon: "share",
      description:
        "Publish the day-by-day plan for family, and optionally save extra comparison scenarios.",
      complete: completion.share,
      content: share,
    },
    {
      id: "more",
      label: "Gallery & tips",
      shortLabel: "Photos",
      icon: "gallery",
      description: "Upload memories after the trip and keep helpful planning notes handy.",
      content: more,
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
