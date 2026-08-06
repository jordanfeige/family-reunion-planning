"use client";

import { useCallback, useSyncExternalStore } from "react";

import { TrailMap } from "@/components/TrailMap";
import { WizardFooter, WizardFooterSentinel } from "@/components/WizardFooter";
import { useWizardFooterReveal } from "@/components/useWizardFooterReveal";
import {
  readWizardStep,
  subscribeWizardStep,
  writeWizardStep,
} from "@/lib/wizardNav";

export type WizardStepDef = {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  complete?: boolean;
  content: React.ReactNode;
};

export function WizardShell({
  storageKey,
  steps,
  header,
  trailAside,
  lastStepLabel = "Back to start",
  initialStepId,
}: {
  storageKey: string;
  steps: WizardStepDef[];
  header?: React.ReactNode;
  trailAside?: React.ReactNode;
  lastStepLabel?: string;
  initialStepId?: string;
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

  const { sentinelRef } = useWizardFooterReveal(activeId);

  const activeIndex = steps.findIndex((s) => s.id === activeId);
  const activeStep = steps[activeIndex] ?? steps[0];
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= steps.length - 1;

  function goTo(id: string) {
    if (!steps.some((s) => s.id === id)) return;
    writeWizardStep(storageKey, id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goNext() {
    if (!isLast) goTo(steps[activeIndex + 1].id);
  }

  function goBack() {
    if (!isFirst) goTo(steps[activeIndex - 1].id);
  }

  if (!activeStep) return null;

  return (
    <div className="wizard wizard--trail">
      {header}

      <div className="trail-layout trail-layout--eyebrow">
        <TrailMap
          stops={steps.map((s) => ({
            id: s.id,
            label: s.shortLabel ?? s.label,
            complete: s.complete,
          }))}
          activeId={activeId}
        />
        {trailAside ? <div className="trail-aside-slot">{trailAside}</div> : null}

        <section
          key={activeStep.id}
          className="wizard-panel wizard-panel-enter wizard-panel--workspace"
          role="tabpanel"
          aria-labelledby={`step-${activeStep.id}`}
        >
          <h2 id={`step-${activeStep.id}`} className="sr-only">
            {activeStep.label}
          </h2>

          <div className="wizard-panel-body">
            {activeStep.content}
            <WizardFooterSentinel sentinelRef={sentinelRef} />
          </div>

          <WizardFooter
            revealed
            isFirst={isFirst}
            isLast={isLast}
            onBack={goBack}
            onContinue={isLast ? () => goTo(steps[0].id) : goNext}
            lastStepLabel={lastStepLabel}
            lastStepClassName="btn btn-secondary"
          />
        </section>
      </div>
    </div>
  );
}
