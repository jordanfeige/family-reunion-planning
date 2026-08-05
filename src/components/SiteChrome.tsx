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
  const isTripHub = pathname?.startsWith("/t/");

  return (
    <div
      className={[
        "site-chrome",
        isMarketingHome ? "site-chrome--marketing" : "",
        isTripHub ? "site-chrome--trip-hub" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isTripHub ? null : <SiteHeader session={session} />}
      <main>{children}</main>
      {isMarketingHome || isTripHub ? null : (
        <footer className="shell footer muted">
          {APP_NAME} · {APP_TAGLINE}
        </footer>
      )}
    </div>
  );
}
