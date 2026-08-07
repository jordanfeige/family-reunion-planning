"use client";

import type { OrbState } from "@/components/Orb";
import { Orb } from "@/components/Orb";

export type ThinkingStep = {
  id: string;
  label: string;
  status: "active" | "done";
};

const STEP_LABELS: Record<string, string> = {
  extracting: "Reading what you said",
  "mode:solo": "Just you",
  "mode:duo": "Just the two of you",
  "mode:small": "A small group",
  "mode:group": "Planning for the whole group",
  "graph:loaded": "Checking what I know",
  "tool:driveTime": "Measuring drive times",
  "tool:places": "Looking up nearby places",
  filtering: "Ruling out mismatches",
  generating: "Writing options",
};

export function labelForThinkingEvent(event: string): string {
  if (STEP_LABELS[event]) return STEP_LABELS[event];
  if (event.startsWith("graph:loaded:")) {
    const name = event.slice("graph:loaded:".length);
    return `Checking what I know about ${name}`;
  }
  if (event.startsWith("tool:places:")) {
    const n = event.slice("tool:places:".length);
    return `${n} places nearby`;
  }
  return event;
}

/**
 * §1c Thinking panel — real instrumented steps only. Replaced when first token arrives.
 */
export function ThinkingPanel({
  steps,
  orbState = "thinking",
}: {
  steps: ThinkingStep[];
  orbState?: OrbState;
}) {
  if (!steps.length) return null;
  return (
    <div className="wa-asst-row wa-msg-enter">
      <Orb state={orbState} size="md" />
      <div className="wa-bubble-asst" aria-live="polite">
        <div className="wa-think-header">
          <span className="wa-think-dots" aria-hidden>
            <span className="wa-think-dot" />
            <span className="wa-think-dot" />
            <span className="wa-think-dot" />
          </span>
          <span className="wa-think-label">Working</span>
        </div>
        {steps.map((s) => (
          <div
            key={s.id}
            className={`wa-step-row ${s.status === "done" ? "is-done" : "is-active"}`}
          >
            <span aria-hidden>{s.status === "done" ? "✓" : "·"}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
