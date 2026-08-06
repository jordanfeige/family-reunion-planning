import Link from "next/link";

/** Equal-weight door between composer and browse (R11). */
export function PlanBrowseSwitch({
  active,
}: {
  active: "plan" | "browse";
}) {
  return (
    <nav className="two-door-switch" aria-label="How do you want to start?">
      {/* Plain <a> so missing-draft visits hard-nav to the cookie route (RSC soft-nav to /plan 500s). */}
      <a
        href="/api/plan/start"
        className={`two-door-switch-btn${active === "plan" ? " is-active" : ""}`}
        aria-current={active === "plan" ? "page" : undefined}
      >
        <span className="two-door-switch-text">Tell me what you want</span>
      </a>
      <Link
        href="/browse?stay=1"
        scroll={false}
        className={`two-door-switch-btn${active === "browse" ? " is-active" : ""}`}
        aria-current={active === "browse" ? "page" : undefined}
      >
        <span className="two-door-switch-text">Show me ideas</span>
      </Link>
    </nav>
  );
}
