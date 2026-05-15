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
  return (
    <>
      <SiteHeader session={session} />
      <main>{children}</main>
      <footer className="shell footer muted">
        {APP_NAME} · {APP_TAGLINE}
      </footer>
    </>
  );
}
