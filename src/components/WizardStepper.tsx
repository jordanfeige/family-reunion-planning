"use client";

import { WizardIcon, type WizardIconName } from "@/components/wizard-icons";

export type WizardStepperItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: WizardIconName;
  complete?: boolean;
};

export function WizardStepper({
  steps,
  activeId,
  onSelect,
  canSelect,
  progressLabel,
  eyebrow = "Your planning journey",
}: {
  steps: WizardStepperItem[];
  activeId: string;
  onSelect: (id: string) => void;
  canSelect?: (step: WizardStepperItem, index: number) => boolean;
  progressLabel?: string;
  eyebrow?: string;
}) {
  const activeIndex = steps.findIndex((s) => s.id === activeId);
  const completedCount = steps.filter((s) => s.complete).length;
  const fillPct = Math.min(
    100,
    Math.max(
      completedCount > 0 ? (completedCount / steps.length) * 100 : 0,
      activeIndex >= 0 ? ((activeIndex + 1) / steps.length) * 100 : 0,
    ),
  );

  return (
    <div className="wizard-rail">
      <div className="wizard-progress-header">
        <div className="wizard-progress-copy">
          <span className="wizard-progress-eyebrow">{eyebrow}</span>
          <span className="wizard-progress-label">
            {progressLabel ??
              (completedCount > 0
                ? `${completedCount} of ${steps.length} milestones complete`
                : "Tap a step below to jump in")}
          </span>
        </div>
        <span className="wizard-progress-pct">{Math.round(fillPct)}%</span>
      </div>

      <div
        className="wizard-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(fillPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
      >
        <div className="wizard-progress-fill" style={{ width: `${fillPct}%` }} />
      </div>

      <div className="wizard-stepper" role="tablist" aria-label="Steps">
        {steps.map((step, idx) => {
          const isActive = step.id === activeId;
          const isComplete = Boolean(step.complete);
          const selectable = canSelect ? canSelect(step, idx) : true;
          const connectorFilled = idx > 0 && (steps[idx - 1]?.complete || idx <= activeIndex);

          return (
            <div key={step.id} className="wizard-step-wrap">
              {idx > 0 ? (
                <div
                  className={`wizard-step-connector${connectorFilled ? " is-filled" : ""}`}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                disabled={!selectable}
                className={[
                  "wizard-step-btn",
                  isActive ? "is-active" : "",
                  isComplete ? "is-complete" : "",
                  !selectable ? "is-locked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectable && onSelect(step.id)}
              >
                <span className="wizard-step-node" aria-hidden>
                  {isComplete && !isActive ? (
                    <svg className="wizard-step-check-icon" viewBox="0 0 16 16" aria-hidden>
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
                    <WizardIcon name={step.icon} className="wizard-step-icon" />
                  ) : (
                    <span className="wizard-step-fallback-num">{idx + 1}</span>
                  )}
                </span>
                <span className="wizard-step-label">
                  <span className="wizard-step-label-full">{step.label}</span>
                  {step.shortLabel ? (
                    <span className="wizard-step-label-short">{step.shortLabel}</span>
                  ) : null}
                </span>
                {isComplete && !isActive ? (
                  <span className="wizard-step-badge">Done</span>
                ) : isActive ? (
                  <span className="wizard-step-badge is-current">Now</span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
