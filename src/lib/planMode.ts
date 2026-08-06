/** Plan-scale capability flags (R3 / R9). */

export type PlanCapabilities = {
  voting: boolean;
  budgetFloors: boolean;
  splitLabels: boolean;
  farthestHousehold: boolean;
};

export function planCapabilities(input: {
  householdCount: number;
  headcount?: number | null;
}): PlanCapabilities {
  const households = Math.max(0, input.householdCount);
  const soloOrDuo = households <= 1;
  return {
    // Group voting UI only when multiple households can answer
    voting: households >= 2,
    // Ceiling / "clears all N" language needs more than one household
    budgetFloors: households >= 2,
    splitLabels: households >= 2,
    farthestHousehold: households >= 2,
  };
}
