"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { deleteTripAction } from "@/app/actions/trips";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="7"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19 8v6M22 11h-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TripDashboardCardActions({
  slug,
  tripName,
  access,
}: {
  slug: string;
  tripName: string;
  access: "owner" | "collaborator";
}) {
  const panelId = useId();
  const deleteConfirmId = useId();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = access === "owner";

  useEffect(() => {
    if (!deleteOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [deleteOpen]);

  return (
    <>
      <div className="dashboard-card-actions">
        <Link
          href={`/t/${slug}?sheet=collaborators`}
          className="dashboard-card-icon-btn"
          aria-label="Invite collaborator"
        >
          <PersonIcon />
        </Link>
        {canDelete ? (
          <button
            type="button"
            className="dashboard-card-icon-btn dashboard-card-icon-btn--danger"
            aria-label="Delete trip"
            aria-expanded={deleteOpen}
            aria-controls={deleteOpen ? panelId : undefined}
            onClick={() => setDeleteOpen(true)}
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>

      {deleteOpen ? (
        <div className="trip-hub-sheet-root" id={panelId}>
          <button
            type="button"
            className="trip-hub-sheet-backdrop"
            aria-label="Close"
            onClick={() => setDeleteOpen(false)}
          />
          <div
            className="trip-hub-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-title`}
          >
            <div className="trip-hub-sheet-header">
              <h2 id={`${panelId}-title`} className="trip-hub-sheet-title">
                Delete trip
              </h2>
              <button
                type="button"
                className="trip-hub-sheet-close"
                aria-label="Close"
                onClick={() => setDeleteOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="trip-hub-sheet-body">
              <div className="trip-hub-sheet-panel stack">
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>
                  Permanently removes this trip and all data. Cannot be undone.
                </p>
                <form action={deleteTripAction} className="stack">
                  <input type="hidden" name="slug" value={slug} />
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor={deleteConfirmId}>
                      Type <strong>{tripName}</strong> to confirm
                    </label>
                    <input
                      id={deleteConfirmId}
                      name="confirm"
                      required
                      autoComplete="off"
                      placeholder={tripName}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-secondary btn-sm trip-dashboard-delete-btn"
                  >
                    Delete trip
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
