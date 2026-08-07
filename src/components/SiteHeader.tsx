"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import { signOutAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { SoftImage } from "@/components/SoftImage";

/** §2b / §4b — Home · Trips · Saved · People only */
const APP_LINKS = [
  {
    href: "/",
    label: "Home",
    match: (p: string) => p === "/",
  },
  {
    href: "/dashboard",
    label: "Trips",
    match: (p: string) =>
      p === "/dashboard" || p.startsWith("/plan") || p.startsWith("/t/"),
  },
  {
    href: "/browse/saved",
    label: "Saved",
    match: (p: string) => p.startsWith("/browse/saved"),
  },
  {
    href: "/people",
    label: "People",
    match: (p: string) => p.startsWith("/people"),
  },
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
  const letter = (session.user?.name ?? session.user?.email ?? "?")
    .slice(0, 1)
    .toUpperCase();

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
  forDrawer,
  onNavigate,
}: {
  session: Session | null;
  pathname: string;
  forDrawer?: boolean;
  onNavigate?: () => void;
}) {
  const cls = (active: boolean) =>
    forDrawer
      ? `nav-drawer-link${active ? " is-active" : ""}`
      : `nav-text-link${active ? " is-active" : ""}`;

  if (!session?.user) {
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
        <Link
          className={forDrawer ? "nav-drawer-link" : "nav-text-link is-active"}
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
      {forDrawer ? (
        <>
          <hr className="nav-drawer-rule" style={{ border: "none", borderTop: "1px solid var(--hairline)", margin: "8px 0" }} />
          <form action={signOutAction} className="nav-drawer-signout">
            <button type="submit" className="nav-drawer-link nav-drawer-link--signout">
              Sign out
            </button>
          </form>
        </>
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
  const isTripHub = pathname.startsWith("/t/");

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

  const closeDrawer = () => setDrawerOpen(false);

  if (isSurveyLink) {
    return (
      <header className="topbar topbar--full topbar--quiet topbar--survey-link">
        <div className="topbar-inner">
          <div className="topbar-bar">
            <BrandMark variant="compact" showTagline={false} />
          </div>
        </div>
      </header>
    );
  }

  // Trip hub: back + title chrome handled in page; keep compact brand + hamburger
  return (
    <header className="topbar topbar--full topbar--quiet">
      <div className="topbar-inner">
        <div className="topbar-bar">
          <BrandMark variant="compact" showTagline={false} />
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
        </div>

        <nav
          className="nav-actions nav-actions--desktop nav-actions--quiet nav-actions--r12"
          aria-label="Primary"
        >
          <HeaderNavLinks session={session} pathname={pathname} />
        </nav>
      </div>

      {drawerOpen ? (
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
              forDrawer
              onNavigate={closeDrawer}
            />
          </nav>
        </>
      ) : null}
      {isTripHub ? null : null}
    </header>
  );
}
