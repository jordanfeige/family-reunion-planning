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

  return (
    <div className={isMarketingHome ? "site-chrome site-chrome--marketing" : "site-chrome"}>
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
