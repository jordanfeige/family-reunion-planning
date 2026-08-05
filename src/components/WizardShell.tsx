"use client";

import { useCallback, useSyncExternalStore } from "react";

import { WizardFooter, WizardFooterSentinel } from "@/components/WizardFooter";
import { WizardStepper, type WizardStepperItem } from "@/components/WizardStepper";
import { useWizardFooterReveal } from "@/components/useWizardFooterReveal";
import type { WizardIconName } from "@/components/wizard-icons";
import {
  readWizardStep,
  subscribeWizardStep,
  tripHubStepKey,
  writeWizardStep,
} from "@/lib/wizardNav";

export type WizardStepDef = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: WizardIconName;
  description?: string;
  complete?: boolean;
  content: React.ReactNode;
  phaseId: string;
};

export type WizardPhaseDef = {
  id: string;
  label: string;
  summary?: string;
  muted?: boolean;
};

export function WizardShell({
  storageKey,
  phases,
  steps,
  header,
  lastStepLabel = "Back to start",
}: {
  storageKey: string;
  phases: WizardPhaseDef[];
  steps: WizardStepDef[];
  header?: React.ReactNode;
  lastStepLabel?: string;
}) {
  const getSnapshot = useCallback(() => {
    const ids = steps.map((s) => s.id);
    const raw = readWizardStep(storageKey, ids);
    if (raw && ids.includes(raw)) return raw;
    const firstIncomplete = steps.find((s) => !s.complete);
    return firstIncomplete?.id ?? steps[0]?.id ?? "";
  }, [storageKey, steps]);

  const getServerSnapshot = useCallback(() => steps[0]?.id ?? "", [steps]);

  const activeId = useSyncExternalStore(
    (onStoreChange) => subscribeWizardStep(storageKey, onStoreChange),
    getSnapshot,
    getServerSnapshot,
  );

  const { sentinelRef, revealed } = useWizardFooterReveal(activeId);

  const activeIndex = steps.findIndex((s) => s.id === activeId);
  const activeStep = steps[activeIndex] ?? steps[0];
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= steps.length - 1;

  const activePhaseId = activeStep?.phaseId ?? phases[0]?.id;
  const activePhase = phases.find((p) => p.id === activePhaseId) ?? phases[0];
  const activePhaseSteps = steps.filter((s) => s.phaseId === activePhaseId);
  const phaseStepIndex = activePhaseSteps.findIndex((s) => s.id === activeId);

  const stepperItems: WizardStepperItem[] = activePhaseSteps.map((s) => ({
    id: s.id,
    label: s.label,
    shortLabel: s.shortLabel,
    icon: s.icon,
    complete: s.complete,
  }));

  function goTo(id: string) {
    if (!steps.some((s) => s.id === id)) return;
    writeWizardStep(storageKey, id);
  }

  function goToPhase(phaseId: string) {
    const phaseSteps = steps.filter((s) => s.phaseId === phaseId);
    if (phaseSteps.length === 0) return;
    const incomplete = phaseSteps.find((s) => !s.complete);
    goTo(incomplete?.id ?? phaseSteps[0].id);
  }

  function goNext() {
    if (!isLast) goTo(steps[activeIndex + 1].id);
  }

  function goBack() {
    if (!isFirst) goTo(steps[activeIndex - 1].id);
  }

  function phaseComplete(phaseId: string) {
    const phaseSteps = steps.filter((s) => s.phaseId === phaseId);
    return phaseSteps.length > 0 && phaseSteps.every((s) => s.complete);
  }

  if (!activeStep || !activePhase) return null;

  const progressLabel = `${activePhase.label} · ${phaseStepIndex + 1} of ${activePhaseSteps.length}`;

  return (
    <div className="wizard">
      {header}

      <div className="wizard-rail wizard-rail--compact">
        <div className="wizard-progress-header wizard-progress-header--compact">
          <span className="wizard-progress-label">{progressLabel}</span>
          <div
            className="wizard-progress-track wizard-progress-track--slim"
            role="progressbar"
            aria-valuenow={phaseStepIndex + 1}
            aria-valuemin={0}
            aria-valuemax={activePhaseSteps.length}
            aria-label={`${activePhase.label} progress`}
          >
            <div
              className="wizard-progress-fill"
              style={{
                width: `${((phaseStepIndex + 1) / Math.max(activePhaseSteps.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="wizard-phase-rail" role="tablist" aria-label="Planning phases">
          {phases.map((phase) => {
            const isActive = phase.id === activePhaseId;
            const done = phaseComplete(phase.id);
            const collapsed = done && !isActive;

            if (collapsed) {
              return (
                <button
                  key={phase.id}
                  type="button"
                  className="wizard-phase-summary"
                  onClick={() => goToPhase(phase.id)}
                  aria-label={`${phase.label} complete. ${phase.summary ?? "Tap to revisit."}`}
                >
                  <span className="wizard-phase-summary-check" aria-hidden>
                    ✓
                  </span>
                  <span className="wizard-phase-summary-label">{phase.label}</span>
                  {phase.summary ? (
                    <span className="wizard-phase-summary-detail">{phase.summary}</span>
                  ) : null}
                </button>
              );
            }

            return (
              <button
                key={phase.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={[
                  "wizard-phase-tab",
                  isActive ? "is-active" : "",
                  done ? "is-complete" : "",
                  phase.muted && !isActive ? "is-muted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => goToPhase(phase.id)}
              >
                {phase.label}
              </button>
            );
          })}
        </div>

        <WizardStepper steps={stepperItems} activeId={activeId} onSelect={goTo} />
      </div>

      <section
        key={activeStep.id}
        className="card wizard-panel wizard-panel-enter"
        role="tabpanel"
        aria-labelledby={`step-${activeStep.id}`}
      >
        <div className="wizard-panel-intro wizard-panel-intro--quiet">
          <p className="wizard-panel-step-meta">
            {activePhase.label} · {activeStep.shortLabel ?? activeStep.label}
          </p>
          <h2 id={`step-${activeStep.id}`} className="wizard-panel-title-quiet">
            {activeStep.label}
          </h2>
          {activeStep.description ? (
            <p className="muted wizard-panel-desc">{activeStep.description}</p>
          ) : null}
        </div>

        <div className="wizard-panel-body">
          {activeStep.content}
          <WizardFooterSentinel sentinelRef={sentinelRef} />
        </div>

        <WizardFooter
          revealed={revealed}
          isFirst={isFirst}
          isLast={isLast}
          onBack={goBack}
          onContinue={isLast ? () => goTo(steps[0].id) : goNext}
          lastStepLabel={lastStepLabel}
          lastStepClassName="btn btn-secondary"
          phaseLabel={progressLabel}
        />
      </section>
    </div>
  );
}

export { tripHubStepKey };
