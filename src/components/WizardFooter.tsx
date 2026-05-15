"use client";

type WizardFooterProps = {
  stepCount: number;
  activeIndex: number;
  revealed: boolean;
  isFirst: boolean;
  isLast: boolean;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  lastStepLabel?: string;
  lastStepType?: "button" | "submit";
  lastStepClassName?: string;
};

export function WizardFooter({
  stepCount,
  activeIndex,
  revealed,
  isFirst,
  isLast,
  onBack,
  onContinue,
  continueLabel = "Continue →",
  lastStepLabel = "Finish",
  lastStepType = "button",
  lastStepClassName = "btn btn-primary",
}: WizardFooterProps) {
  return (
    <footer
      className={`wizard-footer${revealed ? " is-revealed" : " is-pending"}`}
    >
      {!revealed ? (
        <p className="wizard-footer-hint" aria-live="polite">
          Scroll down for Back &amp; Continue
        </p>
      ) : null}

      <div className="wizard-footer-inner" hidden={!revealed}>
        <div className="wizard-footer-progress" aria-label={`Step ${activeIndex + 1} of ${stepCount}`}>
          <span className="wizard-footer-dots" aria-hidden>
            {Array.from({ length: stepCount }, (_, i) => (
              <span
                key={i}
                className={`wizard-footer-dot${i === activeIndex ? " is-active" : ""}${i < activeIndex ? " is-done" : ""}`}
              />
            ))}
          </span>
          <span className="wizard-footer-step-label">
            Step {activeIndex + 1} of {stepCount}
          </span>
        </div>

        <div className="wizard-footer-actions">
          {!isFirst && onBack ? (
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              ← Back
            </button>
          ) : null}
          {isLast ? (
            lastStepType === "submit" ? (
              <button type="submit" className={lastStepClassName}>
                {lastStepLabel}
              </button>
            ) : (
              <button type="button" className={lastStepClassName} onClick={onContinue}>
                {lastStepLabel}
              </button>
            )
          ) : (
            <button type="button" className="btn btn-primary" onClick={onContinue}>
              {continueLabel}
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}

export function WizardFooterSentinel({
  sentinelRef,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return <div ref={sentinelRef} className="wizard-footer-sentinel" aria-hidden />;
}
