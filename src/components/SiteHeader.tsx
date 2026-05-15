"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export function SiteHeader({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const isTripHub = pathname?.startsWith("/t/");

  return (
    <header className={`shell topbar${isTripHub ? " topbar--trip-hub" : ""}`}>
      <Link href="/" className="brand">
        <span>{APP_NAME}</span>
        {!isTripHub ? <small>{APP_TAGLINE}</small> : null}
      </Link>
      {isTripHub ? null : (
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
      )}
    </header>
  );
}
