/**
 * Privacy: individual household budget ceilings must never appear in client payloads.
 * Callers pass a JSON-serializable value that will be sent to the browser.
 */
export function assertNoHouseholdCeilings(payload: unknown, path = "payload"): void {
  if (payload == null) return;
  if (typeof payload === "string") {
    if (/\b(budgetCeiling|ceilingUsd|privateCeiling|householdCeiling)\b/i.test(payload)) {
      throw new Error(`Privacy violation: ceiling key leaked in ${path}`);
    }
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((item, i) => assertNoHouseholdCeilings(item, `${path}[${i}]`));
    return;
  }
  if (typeof payload === "object") {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (
        /^(budgetCeiling|ceilingUsd|privateCeiling|householdCeiling)$/i.test(key)
      ) {
        throw new Error(`Privacy violation: ${path}.${key}`);
      }
      assertNoHouseholdCeilings(value, `${path}.${key}`);
    }
  }
}
