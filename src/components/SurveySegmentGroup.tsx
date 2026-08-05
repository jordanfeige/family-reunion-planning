"use client";

import type { SurveySegmentOption } from "@/lib/surveyPrefs";

export function SurveySegmentGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: SurveySegmentOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="survey-segment-group">
      <legend className="survey-segment-legend">{legend}</legend>
      <div className="survey-segment" role="group" aria-label={legend}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            name={name}
            className={`survey-segment-btn${value === opt.value ? " is-active" : ""}`}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            <span className="survey-segment-label">{opt.label}</span>
            <span className="survey-segment-note">{opt.note}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
