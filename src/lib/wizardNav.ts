/** Shared trip-hub wizard step navigation (localStorage-backed). */

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
    const fromUrl = params.get("step");
    if (fromUrl && validIds.includes(fromUrl)) {
      localStorage.setItem(storageKey, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(storageKey);
    if (saved && validIds.includes(saved)) return saved;
  } catch {
    /* private mode */
  }
  return validIds[0] ?? "";
}

export function writeWizardStep(storageKey: string, stepId: string) {
  try {
    localStorage.setItem(storageKey, stepId);
  } catch {
    /* private mode */
  }
  emitWizardStep(storageKey);
}

/** Jump the hub wizard to a step (e.g. after publishing places → survey). */
export function goToTripHubStep(slug: string, stepId: string) {
  writeWizardStep(tripHubStepKey(slug), stepId);
}
