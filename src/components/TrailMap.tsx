"use client";

export type TrailMapStop = {
  id: string;
  label: string;
  complete?: boolean;
};

/**
 * Progress is a mono eyebrow only — numbered-circle steppers are banned.
 * Export name preserved for existing call sites.
 */
export function TrailMap({
  stops,
  activeId,
}: {
  stops: TrailMapStop[];
  activeId: string;
  onSelect?: (id: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    stops.findIndex((s) => s.id === activeId),
  );
  const active = stops[activeIndex];
  if (!active) return null;

  return (
    <p className="step-progress-eyebrow" aria-live="polite">
      Step {activeIndex + 1} of {stops.length} · {active.label}
    </p>
  );
}
