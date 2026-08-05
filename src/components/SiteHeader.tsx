"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { APP_TAGLINE } from "@/lib/brand";

export function SiteHeader({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const isTripHub = pathname?.startsWith("/t/");
  const isMarketingHome = pathname === "/";
  const isPlan = pathname === "/plan" || pathname?.startsWith("/plan/");
  const isDashboard = pathname === "/dashboard";
  const quietChrome = isPlan || isDashboard || isTripHub;

  const topbarClass = [
    "shell",
    "topbar",
    isMarketingHome ? "topbar--marketing" : "",
    quietChrome ? "topbar--quiet" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={topbarClass}>
      <BrandMark
        variant={isMarketingHome ? "on-dark" : quietChrome ? "compact" : "default"}
        showTagline={!isMarketingHome && !quietChrome}
        tagline={APP_TAGLINE}
      />
      <nav className={`nav-actions${quietChrome ? " nav-actions--quiet" : ""}`}>
        {session?.user ? (
          <>
            {!isPlan ? (
              <Link
                className={
                  isMarketingHome
                    ? "landing-nav-link"
                    : quietChrome
                      ? "nav-text-link"
                      : "btn btn-secondary"
                }
                href="/plan"
              >
                Plan a trip
              </Link>
            ) : null}
            {!isDashboard ? (
              <Link
                className={
                  isMarketingHome
                    ? "landing-nav-link"
                    : quietChrome
                      ? "nav-text-link"
                      : "btn btn-secondary"
                }
                href="/dashboard"
              >
                Trips
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className={
                  isMarketingHome
                    ? "landing-nav-link"
                    : quietChrome
                      ? "nav-text-link"
                      : "btn btn-secondary"
                }
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            {!isPlan ? (
              <Link
                className={
                  isMarketingHome
                    ? "landing-nav-link"
                    : quietChrome
                      ? "nav-text-link"
                      : "btn btn-secondary"
                }
                href="/plan"
              >
                Plan a trip
              </Link>
            ) : null}
            <Link
              className={
                isMarketingHome
                  ? "landing-nav-link"
                  : quietChrome
                    ? "nav-text-link nav-text-link--emphasis"
                    : "btn btn-primary"
              }
              href="/login"
            >
              Sign in
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
