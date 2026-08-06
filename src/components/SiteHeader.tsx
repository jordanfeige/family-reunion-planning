"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { SoftImage } from "@/components/SoftImage";
import { APP_TAGLINE } from "@/lib/brand";

const APP_LINKS = [
  { href: "/dashboard", label: "Trips", match: (p: string) => p === "/dashboard" },
  {
    href: "/browse",
    label: "Browse",
    match: (p: string) => p.startsWith("/browse") || p.startsWith("/inspiration"),
  },
  { href: "/library", label: "Library", match: (p: string) => p.startsWith("/library") },
  { href: "/guides", label: "Guides", match: (p: string) => p.startsWith("/guides") },
] as const;

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      {open ? (
        <path
          d="M6 6l12 12M18 6 6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function AvatarMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const letter = (session.user?.name ?? session.user?.email ?? "?").slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="nav-avatar-menu" ref={rootRef}>
      <button
        type="button"
        className="nav-avatar-trigger"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {session.user?.image ? (
          <SoftImage
            src={session.user.image}
            letter={letter}
            className="nav-avatar soft-image--avatar"
            width={32}
            height={32}
          />
        ) : (
          <span className="nav-avatar nav-avatar--fallback" aria-hidden>
            {letter}
          </span>
        )}
      </button>
      {open ? (
        <div id={menuId} className="nav-avatar-dropdown" role="menu">
          <Link
            href="/profile"
            className="nav-avatar-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <form action={signOutAction} className="nav-avatar-dropdown-signout">
            <button type="submit" className="nav-avatar-dropdown-item" role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function HeaderNavLinks({
  session,
  pathname,
  isPlan,
  isMarketingHome,
  quietChrome,
  forDrawer,
  onNavigate,
}: {
  session: Session | null;
  pathname: string;
  isPlan: boolean;
  isMarketingHome: boolean;
  quietChrome: boolean;
  forDrawer?: boolean;
  onNavigate?: () => void;
}) {
  const desktopLink = (active: boolean) =>
    isMarketingHome
      ? "landing-nav-link"
      : quietChrome
        ? `nav-text-link${active ? " nav-text-link--emphasis" : ""}`
        : "btn btn-secondary";

  const cls = (active: boolean) =>
    forDrawer
      ? `nav-drawer-link${active ? " is-active" : ""}`
      : desktopLink(active);

  if (!session?.user) {
    return (
      <>
        {!isPlan ? (
          <Link className={cls(false)} href="/plan" onClick={onNavigate}>
            Plan a trip
          </Link>
        ) : null}
        <Link
          className={
            forDrawer
              ? "nav-drawer-link"
              : isMarketingHome
                ? "landing-nav-link"
                : quietChrome
                  ? "nav-text-link nav-text-link--emphasis"
                  : "btn btn-primary"
          }
          href="/login"
          onClick={onNavigate}
        >
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      {APP_LINKS.map((link) => (
        <Link
          key={link.href}
          className={cls(link.match(pathname))}
          href={link.href}
          aria-current={link.match(pathname) ? "page" : undefined}
          onClick={onNavigate}
        >
          {link.label}
        </Link>
      ))}
      {!isPlan ? (
        <Link className={cls(false)} href="/plan" onClick={onNavigate}>
          Plan a trip
        </Link>
      ) : null}
      {forDrawer ? (
        <div className="nav-drawer-account">
          <Link
            href="/profile"
            className="nav-drawer-link"
            onClick={onNavigate}
            aria-current={pathname.startsWith("/profile") ? "page" : undefined}
          >
            Profile
          </Link>
          <form action={signOutAction} className="nav-drawer-signout">
            <button type="submit" className="nav-drawer-link nav-drawer-link--signout">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <AvatarMenu session={session} />
      )}
    </>
  );
}

export function SiteHeader({ session }: { session: Session | null }) {
  const pathname = usePathname() ?? "";
  const drawerId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isSurveyLink = pathname.startsWith("/r/");
  const isMarketingHome = pathname === "/";
  const isPlan = pathname === "/plan" || pathname.startsWith("/plan/");
  const isTripHub = pathname.startsWith("/t/");
  const isAppSurface =
    isPlan ||
    pathname === "/dashboard" ||
    isTripHub ||
    pathname.startsWith("/browse") ||
    pathname.startsWith("/inspiration") ||
    pathname.startsWith("/people") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/guides") ||
    pathname.startsWith("/profile");
  const quietChrome = isAppSurface;

  useEffect(() => {
    if (!drawerOpen) {
      document.body.classList.remove("nav-drawer-open");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("nav-drawer-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-drawer-open");
    };
  }, [drawerOpen]);

  const topbarClass = [
    "topbar",
    "topbar--full",
    isMarketingHome ? "topbar--marketing" : "",
    quietChrome ? "topbar--quiet" : "",
    isSurveyLink ? "topbar--survey-link" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <header className={topbarClass}>
      <div className="topbar-inner">
        <div className="topbar-bar">
          <BrandMark
            variant={quietChrome || isMarketingHome ? "compact" : "default"}
            showTagline={!isMarketingHome && !quietChrome && !isSurveyLink}
            tagline={APP_TAGLINE}
          />
          {isSurveyLink ? null : (
            <button
              type="button"
              className="nav-hamburger"
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              onClick={() => setDrawerOpen((o) => !o)}
            >
              <HamburgerIcon open={drawerOpen} />
            </button>
          )}
        </div>

        {isSurveyLink ? null : (
          <nav
            className={`nav-actions nav-actions--desktop${quietChrome ? " nav-actions--quiet" : ""}`}
            aria-label="Primary"
          >
            <HeaderNavLinks
              session={session}
              pathname={pathname}
              isPlan={isPlan}
              isMarketingHome={isMarketingHome}
              quietChrome={quietChrome}
            />
          </nav>
        )}
      </div>

      {isSurveyLink || !drawerOpen ? null : (
        <>
          <button
            type="button"
            className="nav-drawer-backdrop"
            aria-label="Close menu"
            onClick={closeDrawer}
          />
          <nav id={drawerId} className="nav-drawer" aria-label="Menu">
            <HeaderNavLinks
              session={session}
              pathname={pathname}
              isPlan={isPlan}
              isMarketingHome={isMarketingHome}
              quietChrome={quietChrome}
              forDrawer
              onNavigate={closeDrawer}
            />
          </nav>
        </>
      )}
    </header>
  );
}
