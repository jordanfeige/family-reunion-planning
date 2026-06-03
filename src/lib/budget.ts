export const EXPENSE_CATEGORIES = [
  "lodging",
  "food",
  "activity",
  "travel",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  lodging: "Lodging",
  food: "Food",
  activity: "Activity",
  travel: "Travel",
  other: "Other",
};

export const SPLIT_METHODS = [
  "even_per_household",
  "per_person",
  "custom",
] as const;

export type SplitMethod = (typeof SPLIT_METHODS)[number];

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  even_per_household: "Even per household",
  per_person: "Per person",
  custom: "Custom",
};

export const CONTRIBUTION_STATUSES = ["pending", "paid"] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
}

/** Parse a dollar string from a form field into integer cents. */
export function parseDollarsToCents(value: string): number {
  const trimmed = value.trim().replace(/[$,]/g, "");
  if (!trimmed) throw new Error("Amount is required.");
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Enter a valid dollar amount.");
  }
  return Math.round(num * 100);
}

export function normalizeExpenseCategory(value: string): ExpenseCategory {
  const v = value.trim() as ExpenseCategory;
  if (!EXPENSE_CATEGORIES.includes(v)) {
    throw new Error("Invalid expense category.");
  }
  return v;
}

export function normalizeSplitMethod(value: string): SplitMethod {
  const v = value.trim() as SplitMethod;
  if (!SPLIT_METHODS.includes(v)) {
    throw new Error("Invalid split method.");
  }
  return v;
}

export function householdKey(name: string, email: string | null | undefined): string {
  const n = name.trim().toLowerCase();
  const e = (email ?? "").trim().toLowerCase();
  return e ? `${n}|${e}` : n;
}
