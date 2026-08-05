"use client";

import { useCallback, useSyncExternalStore } from "react";

import { WizardFooter, WizardFooterSentinel } from "@/components/WizardFooter";
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

function CheckIcon() {
  return (
    <svg
      className="wizard-step-chip-check"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
    >
      <path
        d="M3.5 8.2 6.6 11.2 12.5 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WizardShell({
  storageKey,
  phases,
  steps,
  header,
  lastStepLabel = "Back to start",
  initialStepId,
  quiet = true,
}: {
  storageKey: string;
  phases: WizardPhaseDef[];
  steps: WizardStepDef[];
  header?: React.ReactNode;
  lastStepLabel?: string;
  /** Prefer this step on first paint (e.g. from ?step=). */
  initialStepId?: string;
  /** Slim progress + borderless panel (default for trip hub). */
  quiet?: boolean;
}) {
  const getSnapshot = useCallback(() => {
    const ids = steps.map((s) => s.id);
    const raw = readWizardStep(storageKey, ids);
    if (raw && ids.includes(raw)) return raw;
    const firstIncomplete = steps.find((s) => !s.complete);
    return firstIncomplete?.id ?? steps[0]?.id ?? "";
  }, [storageKey, steps]);

  const getServerSnapshot = useCallback(() => {
    if (initialStepId && steps.some((s) => s.id === initialStepId)) {
      return initialStepId;
    }
    const firstIncomplete = steps.find((s) => !s.complete);
    return firstIncomplete?.id ?? steps[0]?.id ?? "";
  }, [initialStepId, steps]);

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
  const phaseStepNumber = Math.max(1, phaseStepIndex + 1);
  const phaseStepTotal = Math.max(1, activePhaseSteps.length);
  const phaseProgress = phaseStepNumber / phaseStepTotal;

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

  const progressLabel = `${activePhase.label} · ${phaseStepNumber} of ${activePhaseSteps.length}`;

  return (
    <div className={`wizard${quiet ? " wizard--quiet" : ""}`}>
      {header}

      {quiet ? (
        <nav className="wizard-quiet-rail" aria-label="Planning steps">
          <div className="wizard-phase-segment" role="tablist" aria-label="Phases">
            {phases.map((phase) => {
              const isActive = phase.id === activePhaseId;
              const done = phaseComplete(phase.id);
              return (
                <button
                  key={phase.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={[
                    "wizard-phase-segment-btn",
                    isActive ? "is-active" : "",
                    done && !isActive ? "is-done" : "",
                    phase.muted && !isActive ? "is-muted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => goToPhase(phase.id)}
                >
                  {done && !isActive ? <CheckIcon /> : null}
                  {phase.label}
                </button>
              );
            })}
          </div>

          <div className="wizard-quiet-progress">
            <p className="wizard-quiet-progress-label">
              {activePhase.label} · {phaseStepNumber}/{phaseStepTotal}
            </p>
            <div
              className="wizard-quiet-progress-track"
              role="progressbar"
              aria-valuenow={phaseStepNumber}
              aria-valuemin={1}
              aria-valuemax={phaseStepTotal}
              aria-label={`${activePhase.label} progress`}
            >
              <span
                className="wizard-quiet-progress-fill"
                style={{ width: `${Math.round(phaseProgress * 100)}%` }}
              />
            </div>
          </div>

          <div
            className="wizard-step-chips"
            role="tablist"
            aria-label={`${activePhase.label} steps`}
          >
            {activePhaseSteps.map((step) => {
              const isActive = step.id === activeId;
              const done = Boolean(step.complete) && !isActive;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={[
                    "wizard-step-chip",
                    isActive ? "is-active" : "",
                    done ? "is-complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => goTo(step.id)}
                >
                  {done ? <CheckIcon /> : null}
                  {step.shortLabel ?? step.label}
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
        <div className="wizard-rail wizard-rail--compact">
          <div className="wizard-progress-header wizard-progress-header--compact">
            <span className="wizard-progress-label">{progressLabel}</span>
          </div>
          <div className="wizard-phase-rail" role="tablist" aria-label="Planning phases">
            {phases.map((phase) => {
              const isActive = phase.id === activePhaseId;
              const done = phaseComplete(phase.id);
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
        </div>
      )}

      <section
        key={activeStep.id}
        className={`wizard-panel wizard-panel-enter${quiet ? " wizard-panel--quiet" : " card"}`}
        role="tabpanel"
        aria-labelledby={`step-${activeStep.id}`}
      >
        {quiet ? (
          <h2 id={`step-${activeStep.id}`} className="sr-only">
            {activeStep.label}
          </h2>
        ) : (
          <div className="wizard-panel-intro wizard-panel-intro--quiet">
            <h2 id={`step-${activeStep.id}`} className="wizard-panel-title-quiet">
              {activeStep.label}
            </h2>
            {activeStep.description ? (
              <p className="muted wizard-panel-desc">{activeStep.description}</p>
            ) : null}
          </div>
        )}

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
          phaseLabel={quiet ? undefined : progressLabel}
        />
      </section>
    </div>
  );
}

export { tripHubStepKey };
