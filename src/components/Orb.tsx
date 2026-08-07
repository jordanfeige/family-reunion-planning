"use client";

export type OrbState = "idle" | "thinking" | "speaking";

/**
 * WandrAI presence mark — breathes idle, spins while working.
 * Never an emoji, sparkle, or robot icon.
 */
export function Orb({
  state = "idle",
  size = "md",
  className,
  "aria-label": ariaLabel = "WandrAI",
}: {
  state?: OrbState;
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={["wa-orb", `wa-orb--${size}`, `wa-orb--${state}`, className]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={ariaLabel}
      data-state={state}
    >
      <span className="wa-orb-ring" aria-hidden />
    </div>
  );
}
