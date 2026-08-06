"use client";

/**
 * Adjacent hint for a primary CTA when something is required.
 * Prefer validating on click + focusBlockingField; use this for hard blocks
 * (e.g. no AI key) where the action truly cannot run.
 */
export function CtaRequirementHint({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <p className="cta-requirement-hint" role="status">
      {children}
    </p>
  );
}
