"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { TripOrganizerRole } from "@/lib/tripAccess";

type SheetView = "menu" | "collaborators" | "manage";

export function TripHubMenu({
  tripName,
  tagline,
  role,
  collaborators,
  manage,
}: {
  tripName: string;
  tagline?: string | null;
  slug: string;
  role: TripOrganizerRole;
  collaborators: React.ReactNode;
  manage: React.ReactNode;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SheetView>("menu");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (view !== "menu") setView("menu");
        else setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, view]);

  function close() {
    setOpen(false);
    setView("menu");
  }

  const sheetTitle =
    view === "collaborators"
      ? "Collaborators"
      : view === "manage"
        ? "Manage trip"
        : "Trip menu";

  return (
    <>
      <header className="trip-hub-header">
        <div className="trip-hub-header-row">
          <div>
            <h1 className="trip-hub-title">{tripName}</h1>
            {tagline ? <p className="muted trip-hub-tagline">{tagline}</p> : null}
            {role === "editor" ? (
              <span className="pill trip-hub-role-pill">Co-planner</span>
            ) : null}
          </div>
          <button
            type="button"
            className="trip-hub-menu-btn"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label="Trip menu"
            onClick={() => {
              if (open && view !== "menu") {
                setView("menu");
                return;
              }
              setOpen((o) => !o);
              if (!open) setView("menu");
            }}
          >
            <span className="trip-hub-menu-icon" aria-hidden />
          </button>
        </div>
      </header>

      {open ? (
        <div className="trip-hub-sheet-root" id={menuId}>
          <button
            type="button"
            className="trip-hub-sheet-backdrop"
            aria-label="Close menu"
            onClick={close}
          />
          <div
            className="trip-hub-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${menuId}-title`}
          >
            <div className="trip-hub-sheet-header">
              {view !== "menu" ? (
                <button
                  type="button"
                  className="trip-hub-sheet-back"
                  onClick={() => setView("menu")}
                >
                  ← Back
                </button>
              ) : null}
              <h2 id={`${menuId}-title`} className="trip-hub-sheet-title">
                {sheetTitle}
              </h2>
              <button
                type="button"
                className="trip-hub-sheet-close"
                aria-label="Close"
                onClick={close}
              >
                ×
              </button>
            </div>

            <div className="trip-hub-sheet-body">
              {view === "menu" ? (
                <nav className="trip-hub-sheet-nav" aria-label="Trip hub">
                  <Link
                    href="/dashboard"
                    className="trip-hub-sheet-link"
                    onClick={close}
                  >
                    All trips
                  </Link>
                  <button
                    type="button"
                    className="trip-hub-sheet-link"
                    onClick={() => setView("collaborators")}
                  >
                    Collaborators
                  </button>
                  {role === "owner" && manage ? (
                    <button
                      type="button"
                      className="trip-hub-sheet-link"
                      onClick={() => setView("manage")}
                    >
                      Manage trip
                    </button>
                  ) : null}
                </nav>
              ) : null}
              {view === "collaborators" ? (
                <div className="trip-hub-sheet-panel">{collaborators}</div>
              ) : null}
              {view === "manage" ? (
                <div className="trip-hub-sheet-panel">{manage}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
