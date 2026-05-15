import type { ReactNode } from "react";

export type WizardIconName =
  | "basics"
  | "locations"
  | "survey"
  | "ballot"
  | "blueprint"
  | "share"
  | "gallery"
  | "party"
  | "weekends"
  | "notes";

const paths: Record<WizardIconName, ReactNode> = {
  basics: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  locations: (
    <>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  survey: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m4 6 8 7 8-7" />
    </>
  ),
  ballot: (
    <>
      <path d="M7 10v4M12 8v8M17 11v2" />
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </>
  ),
  blueprint: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 3.9M15.4 7.6 8.6 10.5" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="m21 16-5-5-8 8" />
    </>
  ),
  party: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 11h6M19 8v6" />
    </>
  ),
  weekends: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M8 14h2M12 14h2M16 14h2" />
    </>
  ),
  notes: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </>
  ),
};

export function WizardIcon({
  name,
  className,
}: {
  name: WizardIconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
