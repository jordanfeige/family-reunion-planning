/**
 * Browse `/api/browse/generate` timing.
 * Local/dev is slow (cold LLM + Places); Vercel production stays under gateway limits.
 */

const BROWSE_GENERATE_TIMEOUT_LOCAL_MS = 120_000;
const BROWSE_GENERATE_TIMEOUT_REMOTE_MS = 55_000;

/** Server-only: `next dev`, local `next start`, or non-Vercel hosts. */
function isServerRelaxed(): boolean {
  return process.env.NODE_ENV !== "production" || !process.env.VERCEL;
}

/**
 * Client fetch AbortSignal. Uses NODE_ENV (inlined) plus localhost hostname
 * so local `next start` also gets headroom — never trust `VERCEL` in the browser.
 */
export function browseGenerateClientTimeoutMs(): number {
  if (process.env.NODE_ENV !== "production") {
    return BROWSE_GENERATE_TIMEOUT_LOCAL_MS;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      return BROWSE_GENERATE_TIMEOUT_LOCAL_MS;
    }
  }
  return BROWSE_GENERATE_TIMEOUT_REMOTE_MS;
}

/** Next.js / Vercel route `maxDuration` (seconds). */
export const BROWSE_GENERATE_MAX_DURATION_SEC = isServerRelaxed() ? 120 : 60;

/** `generateObject` abort before the route is killed. */
export const BROWSE_GENERATE_MODEL_TIMEOUT_MS = isServerRelaxed()
  ? 90_000
  : 35_000;

/**
 * Cap Places/Mapbox enrichment so a slow image pipeline cannot fail generation.
 * Ideas return without images (SoftImage letter fallback) if the budget elapses.
 */
export const BROWSE_GENERATE_IMAGE_BUDGET_MS = isServerRelaxed()
  ? 25_000
  : 10_000;
