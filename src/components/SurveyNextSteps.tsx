"use client";

import Link from "next/link";

import type { SurveyNextStep } from "@/lib/surveyNextSteps";

export function SurveyNextSteps({
  steps,
  planUrl,
  showPlanLink = false,
  variant = "card",
}: {
  steps: SurveyNextStep[];
  planUrl?: string | null;
  showPlanLink?: boolean;
  variant?: "card" | "inline";
}) {
  const showPlanCta = Boolean(planUrl && showPlanLink);

  const className =
    variant === "card" ? "survey-next-steps card" : "survey-next-steps";

  return (
    <section className={className} aria-labelledby="survey-next-steps-heading">
      <h3 id="survey-next-steps-heading" className="survey-next-steps-title">
        What happens next
      </h3>
      <p className="muted survey-next-steps-lead">
        No need to check back here—here is how planning usually unfolds.
      </p>

      <ol className="survey-next-steps-list">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`survey-next-step survey-next-step--${step.status}`}
          >
            <span className="survey-next-step-marker" aria-hidden>
              {step.status === "done" ? "✓" : index + 1}
            </span>
            <span className="survey-next-step-body">
              <strong>{step.title}</strong>
              <span className="muted">{step.description}</span>
            </span>
          </li>
        ))}
      </ol>

      {showPlanCta ? (
        <p style={{ margin: "1rem 0 0" }}>
          <Link className="btn btn-secondary" href={planUrl!} target="_blank" rel="noreferrer">
            Open shared trip plan
          </Link>
        </p>
      ) : null}
    </section>
  );
}
