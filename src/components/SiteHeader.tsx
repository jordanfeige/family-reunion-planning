"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export function SiteHeader({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const isTripHub = pathname?.startsWith("/t/");
  const isMarketingHome = pathname === "/";

  const topbarClass = [
    "shell",
    "topbar",
    isTripHub ? "topbar--trip-hub" : "",
    isMarketingHome ? "topbar--marketing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={topbarClass}>
      <Link href="/" className="brand">
        <span>{APP_NAME}</span>
        {!isTripHub && !isMarketingHome ? <small>{APP_TAGLINE}</small> : null}
      </Link>
      {isTripHub ? null : (
        <nav className="nav-actions">
          {session?.user ? (
            <>
              <Link
                className={isMarketingHome ? "landing-nav-link" : "btn btn-secondary"}
                href="/dashboard"
              >
                Dashboard
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className={isMarketingHome ? "landing-nav-link" : "btn btn-secondary"}
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              className={isMarketingHome ? "landing-nav-link" : "btn btn-primary"}
              href="/login"
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
