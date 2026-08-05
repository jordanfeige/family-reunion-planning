"use client";

type WizardFooterProps = {
  revealed: boolean;
  isFirst: boolean;
  isLast: boolean;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  lastStepLabel?: string;
  lastStepType?: "button" | "submit";
  lastStepClassName?: string;
  phaseLabel?: string;
};

export function WizardFooter({
  revealed,
  isFirst,
  isLast,
  onBack,
  onContinue,
  continueLabel = "Continue →",
  lastStepLabel = "Finish",
  lastStepType = "button",
  lastStepClassName = "btn btn-primary",
  phaseLabel,
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
        {phaseLabel ? (
          <p className="wizard-footer-phase muted">{phaseLabel}</p>
        ) : (
          <span />
        )}

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
