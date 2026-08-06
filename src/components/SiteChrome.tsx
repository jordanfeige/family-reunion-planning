"use client";

import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { PlanBrowseSwitch } from "@/components/PlanBrowseSwitch";
import { SiteHeader } from "@/components/SiteHeader";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export function SiteChrome({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const pathname = usePathname();
  const isMarketingHome = pathname === "/";
  const isPlanRoute =
    pathname === "/plan" || Boolean(pathname?.startsWith("/plan/"));
  const isBrowseRoute =
    Boolean(pathname?.startsWith("/browse")) ||
    Boolean(pathname?.startsWith("/inspiration"));
  const isAppShell =
    pathname === "/dashboard" ||
    isPlanRoute ||
    Boolean(pathname?.startsWith("/t/")) ||
    isBrowseRoute ||
    Boolean(pathname?.startsWith("/people")) ||
    Boolean(pathname?.startsWith("/library")) ||
    Boolean(pathname?.startsWith("/guides")) ||
    Boolean(pathname?.startsWith("/profile"));
  const hideFooter = isMarketingHome || isPlanRoute || isBrowseRoute;
  /** Shared top slot so /plan ↔ /browse doesn't teleport the two-door switch. */
  const showDoorSwitch = isPlanRoute || isBrowseRoute;

  return (
    <div
      className={[
        "site-chrome",
        isMarketingHome ? "site-chrome--marketing" : "",
        isAppShell ? "site-chrome--app" : "",
        isPlanRoute ? "site-chrome--plan" : "",
        isBrowseRoute ? "site-chrome--browse" : "",
        showDoorSwitch ? "site-chrome--doors" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SiteHeader session={session} />
      {showDoorSwitch ? (
        <div className="entry-door-rail">
          <div className="entry-door-rail-inner">
            <PlanBrowseSwitch active={isPlanRoute ? "plan" : "browse"} />
          </div>
        </div>
      ) : null}
      <main>{children}</main>
      {hideFooter ? null : (
        <footer className="shell footer muted">
          {APP_NAME} · {APP_TAGLINE}
        </footer>
      )}
    </div>
  );
}
