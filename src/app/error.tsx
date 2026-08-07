"use client";

import { useEffect } from "react";

/**
 * Soft-nav failures (Next E10 after rolling deploys) surface as this boundary.
 * One automatic hard reload recovers; a second failure shows a manual Reload.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const key = "wandr-e10-reload";
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <div className="shell" style={{ padding: "3rem 1.25rem", textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--font-newsreader), serif", fontSize: "1.75rem" }}>
        This page couldn&apos;t load
      </h1>
      <p className="muted">A server error occurred. Reload to try again.</p>
      <button
        type="button"
        className="btn btn-berry"
        onClick={() => {
          try {
            sessionStorage.removeItem("wandr-e10-reload");
          } catch {
            /* ignore */
          }
          reset();
          window.location.reload();
        }}
      >
        Reload
      </button>
    </div>
  );
}
