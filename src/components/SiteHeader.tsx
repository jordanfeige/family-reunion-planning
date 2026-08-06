"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { SoftImage } from "@/components/SoftImage";
import { APP_TAGLINE } from "@/lib/brand";

const APP_LINKS = [
  { href: "/dashboard", label: "Trips", match: (p: string) => p === "/dashboard" },
  {
    href: "/inspiration",
    label: "Inspiration",
    match: (p: string) => p.startsWith("/inspiration"),
  },
  { href: "/library", label: "Library", match: (p: string) => p.startsWith("/library") },
  { href: "/guides", label: "Guides", match: (p: string) => p.startsWith("/guides") },
  { href: "/profile", label: "Profile", match: (p: string) => p.startsWith("/profile") },
] as const;

export function SiteHeader({ session }: { session: Session | null }) {
  const pathname = usePathname() ?? "";
  const isSurveyLink = pathname.startsWith("/r/");
  const isMarketingHome = pathname === "/";
  const isPlan = pathname === "/plan" || pathname.startsWith("/plan/");
  const isTripHub = pathname.startsWith("/t/");
  const isAppSurface =
    isPlan ||
    pathname === "/dashboard" ||
    isTripHub ||
    pathname.startsWith("/inspiration") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/guides") ||
    pathname.startsWith("/profile");
  const quietChrome = isAppSurface;

  const topbarClass = [
    "shell",
    "topbar",
    isMarketingHome ? "topbar--marketing" : "",
    quietChrome ? "topbar--quiet" : "",
    isSurveyLink ? "topbar--survey-link" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const linkClass = (active: boolean) =>
    isMarketingHome
      ? "landing-nav-link"
      : quietChrome
        ? `nav-text-link${active ? " nav-text-link--emphasis" : ""}`
        : "btn btn-secondary";

  return (
    <header className={topbarClass}>
      <BrandMark
        variant={isMarketingHome ? "on-dark" : quietChrome ? "compact" : "default"}
        showTagline={!isMarketingHome && !quietChrome && !isSurveyLink}
        tagline={APP_TAGLINE}
      />
      {isSurveyLink ? null : (
        <nav className={`nav-actions${quietChrome ? " nav-actions--quiet" : ""}`}>
          {session?.user ? (
            <>
              {APP_LINKS.map((link) => (
                <Link
                  key={link.href}
                  className={linkClass(link.match(pathname))}
                  href={link.href}
                  aria-current={link.match(pathname) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
              {!isPlan ? (
                <Link className={linkClass(false)} href="/plan">
                  Plan a trip
                </Link>
              ) : null}
              {session.user.image ? (
                <SoftImage
                  src={session.user.image}
                  letter={session.user.name ?? session.user.email ?? "?"}
                  className="nav-avatar soft-image--avatar"
                  width={32}
                  height={32}
                />
              ) : (
                <Link className="nav-avatar nav-avatar--fallback" href="/profile" aria-label="Profile">
                  {(session.user.name ?? session.user.email ?? "?").slice(0, 1).toUpperCase()}
                </Link>
              )}
              <form action={signOutAction}>
                <button type="submit" className={linkClass(false)}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              {!isPlan ? (
                <Link className={linkClass(false)} href="/plan">
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
      )}
    </header>
  );
}
