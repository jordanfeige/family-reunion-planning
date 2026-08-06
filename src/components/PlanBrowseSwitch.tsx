import Link from "next/link";

/** Equal-weight door between composer and browse (R11). */
export function PlanBrowseSwitch({
  active,
}: {
  active: "plan" | "browse";
}) {
  return (
    <nav className="two-door-switch" aria-label="How do you want to start?">
      <Link
        href="/plan"
        scroll={false}
        className={`two-door-switch-btn${active === "plan" ? " is-active" : ""}`}
        aria-current={active === "plan" ? "page" : undefined}
      >
        <span className="two-door-switch-text">Tell me what you want</span>
      </Link>
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
