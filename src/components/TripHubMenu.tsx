"use client";

import { useEffect, useId, useState } from "react";

import type { TripOrganizerRole } from "@/lib/tripAccess";

type SheetView = "collaborators" | "manage";

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
  const [view, setView] = useState<SheetView>("collaborators");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function openSheet(next: SheetView) {
    setView(next);
    setOpen(true);
  }

  const sheetTitle = view === "manage" ? "Manage trip" : "Collaborators";

  return (
    <>
      <header className="trip-hub-header">
        <div className="trip-hub-header-row">
          <div className="trip-hub-header-main">
            <h1 className="trip-hub-title">
              {tripName}
              {role === "owner" ? (
                <button
                  type="button"
                  className="trip-hub-edit"
                  aria-label="Edit trip"
                  onClick={() => openSheet("manage")}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none">
                    <path
                      d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
            </h1>
            {tagline ? <p className="muted trip-hub-tagline">{tagline}</p> : null}
            {role === "editor" ? (
              <span className="pill trip-hub-role-pill">Co-planner</span>
            ) : null}
          </div>
          <button
            type="button"
            className="trip-hub-collaborators-btn"
            aria-expanded={open && view === "collaborators"}
            aria-controls={menuId}
            onClick={() => openSheet("collaborators")}
          >
            Collaborators
          </button>
        </div>
      </header>

      {open ? (
        <div className="trip-hub-sheet-root" id={menuId}>
          <button
            type="button"
            className="trip-hub-sheet-backdrop"
            aria-label="Close"
            onClick={close}
          />
          <div
            className="trip-hub-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${menuId}-title`}
          >
            <div className="trip-hub-sheet-header">
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
              {view === "collaborators" ? (
                <div className="trip-hub-sheet-panel">{collaborators}</div>
              ) : null}
              {view === "manage" && role === "owner" && manage ? (
                <div className="trip-hub-sheet-panel">{manage}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
