import { APP_NAME } from "@/lib/brand";

export function BrandMark({
  href = "/",
  variant = "default",
  showTagline = false,
  tagline,
}: {
  href?: string;
  variant?: "default" | "on-dark" | "compact";
  showTagline?: boolean;
  tagline?: string;
}) {
  const className = ["brand", "brand-mark", `brand-mark--${variant}`].join(" ");

  const inner = (
    <>
      <span className="brand-mark-badge" aria-hidden>
        <svg className="brand-mark-icon" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3.5c2.2 3.4 5.8 5.6 9 6.2-3.2.6-6.8 2.8-9 6.2-2.2-3.4-5.8-5.6-9-6.2 3.2-.6 6.8-2.8 9-6.2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </span>
      <span className="brand-mark-text">
        <span className="brand-mark-name">{APP_NAME}</span>
        {showTagline && tagline ? <small>{tagline}</small> : null}
      </span>
    </>
  );

  // Hard nav: `/` always server-redirects, and soft-nav after deploys can 500 (Next E10).
  return (
    <a href={href} className={className}>
      {inner}
    </a>
  );
}
