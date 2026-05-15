import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
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
          <span>Feige Gatherings</span>
          <small>Velkommen</small>
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
        Feige family adventures · inspired by Nordic light, fjord calm, and a
        little cloudberry mischief.
      </footer>
    </>
  );
}
