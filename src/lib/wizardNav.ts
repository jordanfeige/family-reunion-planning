/** Shared trip-hub trail navigation (localStorage + URL ?stop=). */

import { normalizeTrailStopId } from "@/lib/trailStops";

const listeners = new Map<string, Set<() => void>>();

export function tripHubStepKey(slug: string) {
  return `trip-hub-step-${slug}`;
}

export function subscribeWizardStep(storageKey: string, onChange: () => void) {
  let set = listeners.get(storageKey);
  if (!set) {
    set = new Set();
    listeners.set(storageKey, set);
  }
  set.add(onChange);
  return () => {
    set!.delete(onChange);
  };
}

export function emitWizardStep(storageKey: string) {
  listeners.get(storageKey)?.forEach((fn) => fn());
}

export function readWizardStep(storageKey: string, validIds: string[]): string {
  if (validIds.length === 0) return "";
  try {
    const params = new URLSearchParams(window.location.search);
    const fromStop = normalizeTrailStopId(params.get("stop"));
    if (fromStop && validIds.includes(fromStop)) {
      localStorage.setItem(storageKey, fromStop);
      return fromStop;
    }
    const fromStep = normalizeTrailStopId(params.get("step"));
    if (fromStep && validIds.includes(fromStep)) {
      localStorage.setItem(storageKey, fromStep);
      return fromStep;
    }
    const savedRaw = localStorage.getItem(storageKey);
    const saved = normalizeTrailStopId(savedRaw) ?? savedRaw;
    if (saved && validIds.includes(saved)) return saved;
  } catch {
    /* private mode */
  }
  return validIds[0] ?? "";
}

export function writeWizardStep(storageKey: string, stepId: string) {
  try {
    localStorage.setItem(storageKey, stepId);
    const url = new URL(window.location.href);
    url.searchParams.delete("step");
    if (url.searchParams.get("stop") !== stepId) {
      url.searchParams.set("stop", stepId);
    }
    const qs = url.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      qs ? `${url.pathname}?${qs}${url.hash}` : `${url.pathname}${url.hash}`,
    );
  } catch {
    /* private mode */
  }
  emitWizardStep(storageKey);
}

/** Jump the hub wizard to a trail stop (e.g. after publishing places → survey). */
export function goToTripHubStep(slug: string, stepId: string) {
  writeWizardStep(tripHubStepKey(slug), stepId);
}
