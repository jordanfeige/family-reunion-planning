"use client";

import { useEffect } from "react";

/**
 * Hard-navigate to the cookie-setting start route.
 *
 * Server Components must not `redirect("/api/plan/start")` during soft
 * navigation — Next.js returns the default global 500 ("This page couldn't
 * load") when an RSC flight redirects into a Route Handler.
 */
export function PlanDraftBootstrap({ error }: { error?: string }) {
  useEffect(() => {
    const qs = error ? `?error=${encodeURIComponent(error)}` : "";
    window.location.replace(`/api/plan/start${qs}`);
  }, [error]);

  return (
    <div className="shell plan-shell" aria-busy="true">
      <p className="muted">Starting your trip…</p>
    </div>
  );
}
