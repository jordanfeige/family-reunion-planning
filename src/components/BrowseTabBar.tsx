"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/browse",
    label: "Browse",
    match: (path: string) =>
      path === "/browse" || (path.startsWith("/browse") && !path.startsWith("/browse/saved")),
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 3.75c2.2 2.4 3.5 5.2 3.5 8.25S14.2 17.85 12 20.25c-2.2-2.4-3.5-5.2-3.5-8.25S9.8 6.15 12 3.75z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M4.2 9.5h15.6M4.2 14.5h15.6" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: "/browse/saved",
    label: "Saved",
    match: (path: string) => path.startsWith("/browse/saved"),
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path
          d="M12 19.2l-6.4-5.7C3.8 11.8 3.9 8.7 6.2 7c1.7-1.2 4-.8 5.2.7 1.2-1.5 3.5-1.9 5.2-.7 2.3 1.7 2.4 4.8.6 6.5L12 19.2z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Trips",
    match: (path: string) =>
      path === "/dashboard" || path.startsWith("/plan") || path.startsWith("/t/"),
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <rect
          x="4.5"
          y="7.5"
          width="15"
          height="11"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M8 7.5V6.2A1.7 1.7 0 0 1 9.7 4.5h4.6A1.7 1.7 0 0 1 16 6.2V7.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M4.5 12.5h15" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    match: (path: string) =>
      path.startsWith("/profile") || path.startsWith("/login"),
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <circle cx="12" cy="9" r="3.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5.5 18.5c1.6-2.4 3.8-3.6 6.5-3.6s4.9 1.2 6.5 3.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

/** Mobile Browse shell tab bar — matches session-stakes mock. */
export function BrowseTabBar() {
  const pathname = usePathname() || "/browse";

  return (
    <nav className="browse-tabbar" aria-label="Browse">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`browse-tabbar-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="browse-tabbar-icon">{tab.icon}</span>
            <span className="browse-tabbar-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
