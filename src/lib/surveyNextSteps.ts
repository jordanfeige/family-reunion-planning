export type SurveyNextStep = {
  title: string;
  description: string;
  status: "done" | "current" | "upcoming";
};

export type SurveyNextStepsInput = {
  planReady: boolean;
  planPublished: boolean;
  lockedLocationTitle?: string | null;
  lockedWeekendLabel?: string | null;
  /** After the respondent has submitted the planning survey */
  submitted?: boolean;
};

function shiftAfterSubmit(steps: SurveyNextStep[]): SurveyNextStep[] {
  const doneCount = steps.findIndex((s) => s.status === "current");
  if (doneCount < 0) return steps;

  return steps.map((step, i) => {
    if (i < doneCount) return { ...step, status: "done" as const };
    if (i === doneCount) return { ...step, status: "current" as const };
    return { ...step, status: "upcoming" as const };
  });
}

export function getSurveyNextSteps(input: SurveyNextStepsInput): SurveyNextStep[] {
  const locked =
    input.lockedLocationTitle && input.lockedWeekendLabel
      ? `${input.lockedLocationTitle} · ${input.lockedWeekendLabel}`
      : null;

  if (input.planReady && input.planPublished) {
    const steps: SurveyNextStep[] = [
      {
        title: "You shared your preferences",
        description: "Your locations, weekends, and party size are in.",
        status: "done",
      },
      {
        title: "Planners picked the trip",
        description: locked
          ? `The group is heading to ${locked}.`
          : "Location and weekend are locked.",
        status: "done",
      },
      {
        title: "Browse the weekend plan",
        description:
          "See activities, meals, and lodging on the shared trip page.",
        status: "current",
      },
      {
        title: "Confirm your final RSVP",
        description:
          "Say yes or no and update headcount when you know for sure.",
        status: "upcoming",
      },
    ];
    return steps;
  }

  if (input.planReady) {
    const steps: SurveyNextStep[] = [
      {
        title: "You shared your preferences",
        description: "Your locations, weekends, and party size are in.",
        status: "done",
      },
      {
        title: "Planners picked the trip",
        description: locked
          ? `Locked: ${locked}.`
          : "Location and weekend are locked.",
        status: "done",
      },
      {
        title: "Confirm your final RSVP",
        description:
          "Open the shared plan link to say yes or no and set headcount.",
        status: "current",
      },
      {
        title: "Itinerary details roll out",
        description:
          "Activities and bookings may still be added—check the plan page for updates.",
        status: "upcoming",
      },
    ];
    return steps;
  }

  const steps: SurveyNextStep[] = [
    {
      title: "You send your preferences",
      description:
        "Locations, weekends, and who is coming—everything on this form.",
      status: "current",
    },
    {
      title: "Planners compare the group",
      description:
        "They look at which places and dates work for the most families.",
      status: "upcoming",
    },
    {
      title: "A place & weekend get picked",
      description:
        "The organizers lock location and dates on the trip blueprint.",
      status: "upcoming",
    },
    {
      title: "Final RSVP on the shared plan",
      description:
        "You will get the trip link to confirm yes/no and headcount when plans firm up.",
      status: "upcoming",
    },
  ];
  return input.submitted ? shiftAfterSubmit(steps) : steps;
}

export function formatSurveyNextStepsText(steps: SurveyNextStep[]): string {
  return steps
    .map((s, i) => `${i + 1}. ${s.title} — ${s.description}`)
    .join("\n");
}
