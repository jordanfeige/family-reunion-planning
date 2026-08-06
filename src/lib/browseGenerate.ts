/**
 * Browse `/api/browse/generate` timing.
 * Local/dev is slow (cold LLM + Places); Vercel production stays under gateway limits.
 *
 * Note: AI SDK `generateObject` does not wire the `timeout` option (unlike
 * `generateText`). Always pass `abortSignal: AbortSignal.timeout(ms)`.
 */

const BROWSE_GENERATE_TIMEOUT_LOCAL_MS = 120_000;
/** Client must outlive server abort + response; keep under Vercel maxDuration. */
const BROWSE_GENERATE_TIMEOUT_REMOTE_MS = 50_000;

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

/** Next.js / Vercel route `maxDuration` (seconds) — must be a numeric literal in the route file. */
export const BROWSE_GENERATE_MAX_DURATION_SEC = isServerRelaxed() ? 120 : 60;

/**
 * Hard abort for `generateObject` via AbortSignal.timeout (see note above).
 * Leave headroom before Vercel FUNCTION_INVOCATION_TIMEOUT (~60s on Pro).
 */
export const BROWSE_GENERATE_MODEL_TIMEOUT_MS = isServerRelaxed()
  ? 90_000
  : 42_000;

/** Cap reverse-geocode / Mapbox before the model call. */
export const BROWSE_GENERATE_AREA_BUDGET_MS = isServerRelaxed() ? 8_000 : 4_000;

/**
 * Cap Places/Mapbox enrichment so a slow image pipeline cannot fail generation.
 * Production skips images on the critical path entirely (letter-block SoftImage).
 */
export const BROWSE_GENERATE_IMAGE_BUDGET_MS = isServerRelaxed()
  ? 25_000
  : 0;

/** Smaller decks finish structured generation well under the gateway limit. */
export const BROWSE_GENERATE_PROD_MAX_IDEAS = 6;
