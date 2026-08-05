"use client";

import { WizardIcon, type WizardIconName } from "@/components/wizard-icons";

export type WizardStepperItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: WizardIconName;
  complete?: boolean;
};

/** Compact step chips for the active phase — secondary to trip content. */
export function WizardStepper({
  steps,
  activeId,
  onSelect,
  canSelect,
}: {
  steps: WizardStepperItem[];
  activeId: string;
  onSelect: (id: string) => void;
  canSelect?: (step: WizardStepperItem, index: number) => boolean;
}) {
  return (
    <div className="wizard-stepper" role="tablist" aria-label="Steps in this phase">
      {steps.map((step, idx) => {
        const isActive = step.id === activeId;
        const isComplete = Boolean(step.complete);
        const selectable = canSelect ? canSelect(step, idx) : true;

        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "step" : undefined}
            disabled={!selectable}
            className={[
              "wizard-step-chip",
              isActive ? "is-active" : "",
              isComplete ? "is-complete" : "",
              !selectable ? "is-locked" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => selectable && onSelect(step.id)}
          >
            {isComplete && !isActive ? (
              <svg className="wizard-step-chip-check" viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M3.5 8.2 6.4 11 12.5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : step.icon ? (
              <WizardIcon name={step.icon} className="wizard-step-chip-icon" />
            ) : null}
            <span>{step.shortLabel ?? step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
