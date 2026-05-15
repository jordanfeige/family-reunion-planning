"use client";

import { useCallback, useEffect, useState } from "react";

import { WizardFooter, WizardFooterSentinel } from "@/components/WizardFooter";
import { WizardStepper, type WizardStepperItem } from "@/components/WizardStepper";
import { useWizardFooterReveal } from "@/components/useWizardFooterReveal";
import { WizardIcon, type WizardIconName } from "@/components/wizard-icons";

export type WizardStepDef = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: WizardIconName;
  description?: string;
  complete?: boolean;
  content: React.ReactNode;
};

export function WizardShell({
  storageKey,
  steps,
  header,
  progressEyebrow,
  lastStepLabel = "Back to start",
}: {
  storageKey: string;
  steps: WizardStepDef[];
  header?: React.ReactNode;
  progressEyebrow?: string;
  lastStepLabel?: string;
}) {
  const [activeId, setActiveId] = useState(steps[0]?.id ?? "");
  const { sentinelRef, revealed } = useWizardFooterReveal(activeId);

  const hydrate = useCallback(() => {
    if (typeof window === "undefined" || steps.length === 0) return;
    const saved = localStorage.getItem(storageKey);
    if (saved && steps.some((s) => s.id === saved)) {
      setActiveId(saved);
    } else {
      setActiveId(steps[0].id);
    }
  }, [storageKey, steps]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!activeId || typeof window === "undefined") return;
    localStorage.setItem(storageKey, activeId);
  }, [activeId, storageKey]);

  const activeIndex = steps.findIndex((s) => s.id === activeId);
  const activeStep = steps[activeIndex] ?? steps[0];
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= steps.length - 1;

  const stepperItems: WizardStepperItem[] = steps.map((s) => ({
    id: s.id,
    label: s.label,
    shortLabel: s.shortLabel,
    icon: s.icon,
    complete: s.complete,
  }));

  function goTo(id: string) {
    if (steps.some((s) => s.id === id)) setActiveId(id);
  }

  function goNext() {
    if (!isLast) goTo(steps[activeIndex + 1].id);
  }

  function goBack() {
    if (!isFirst) goTo(steps[activeIndex - 1].id);
  }

  if (!activeStep) return null;

  return (
    <div className="wizard">
      <WizardStepper
        steps={stepperItems}
        activeId={activeId}
        onSelect={goTo}
        eyebrow={progressEyebrow}
      />

      {header}

      <section
        key={activeStep.id}
        className="card wizard-panel wizard-panel-enter"
        role="tabpanel"
        aria-labelledby={`step-${activeStep.id}`}
      >
        <div className="wizard-panel-intro">
          {activeStep.icon ? (
            <div className="wizard-panel-icon" aria-hidden>
              <WizardIcon name={activeStep.icon} className="wizard-panel-icon-svg" />
            </div>
          ) : null}
          <div className="wizard-panel-intro-text">
            <p className="pill wizard-panel-step-pill">
              Step {activeIndex + 1} of {steps.length}
            </p>
            <h2 id={`step-${activeStep.id}`}>{activeStep.label}</h2>
            {activeStep.description ? (
              <p className="muted wizard-panel-desc">{activeStep.description}</p>
            ) : null}
          </div>
        </div>

        <div className="wizard-panel-body">
          {activeStep.content}
          <WizardFooterSentinel sentinelRef={sentinelRef} />
        </div>

        <WizardFooter
          stepCount={steps.length}
          activeIndex={activeIndex}
          revealed={revealed}
          isFirst={isFirst}
          isLast={isLast}
          onBack={goBack}
          onContinue={isLast ? () => goTo(steps[0].id) : goNext}
          lastStepLabel={lastStepLabel}
          lastStepClassName="btn btn-secondary"
        />
      </section>
    </div>
  );
}
