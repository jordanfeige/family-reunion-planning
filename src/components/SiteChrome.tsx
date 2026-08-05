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
  const isAppShell =
    pathname === "/dashboard" ||
    pathname === "/plan" ||
    pathname?.startsWith("/plan/") ||
    pathname?.startsWith("/t/");

  return (
    <div
      className={[
        "site-chrome",
        isMarketingHome ? "site-chrome--marketing" : "",
        isAppShell ? "site-chrome--app" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SiteHeader session={session} />
      <main>{children}</main>
      {isMarketingHome ? null : (
        <footer className="shell footer muted">
          {APP_NAME} · {APP_TAGLINE}
        </footer>
      )}
    </div>
  );
}
