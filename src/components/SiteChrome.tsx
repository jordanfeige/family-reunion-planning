import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import Link from "next/link";

export function SiteChrome({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <>
      <header className="shell topbar">
        <Link href="/" className="brand">
          <span>{APP_NAME}</span>
          <small>{APP_TAGLINE}</small>
        </Link>
        <nav className="nav-actions">
          {session?.user ? (
            <>
              <Link className="btn btn-secondary" href="/dashboard">
                Dashboard
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="btn btn-secondary">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link className="btn btn-primary" href="/login">
              Magic link sign in
            </Link>
          )}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="shell footer muted">
        {APP_NAME} · {APP_TAGLINE}
      </footer>
    </>
  );
}
