"use client";

import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

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
  const isChatShell = isPlanRoute;
  const isAppShell =
    pathname === "/dashboard" ||
    isPlanRoute ||
    Boolean(pathname?.startsWith("/t/")) ||
    isBrowseRoute ||
    Boolean(pathname?.startsWith("/people")) ||
    Boolean(pathname?.startsWith("/library")) ||
    Boolean(pathname?.startsWith("/guides")) ||
    Boolean(pathname?.startsWith("/profile")) ||
    isMarketingHome;
  const hideFooter = isMarketingHome || isPlanRoute || isBrowseRoute;

  return (
    <div
      className={[
        "site-chrome",
        isMarketingHome ? "site-chrome--marketing" : "",
        isAppShell ? "site-chrome--app" : "",
        isPlanRoute ? "site-chrome--plan" : "",
        isBrowseRoute ? "site-chrome--browse" : "",
        isChatShell ? "site-chrome--chat" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SiteHeader session={session} />
      <main>{children}</main>
      {hideFooter ? null : (
        <footer className="shell footer muted">
          {APP_NAME} · {APP_TAGLINE}
        </footer>
      )}
    </div>
  );
}
