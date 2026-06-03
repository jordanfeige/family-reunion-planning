import { householdKey } from "@/lib/budget";
import {
  mapTripContribution,
  mapTripExpense,
  type TripContribution,
  type TripExpense,
} from "@/lib/supabase/mappers";
import { listTripConfirmations } from "@/lib/supabase/queries";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ExpenseRow = Database["public"]["Tables"]["trip_expense"]["Row"];
type ContributionRow = Database["public"]["Tables"]["trip_contribution"]["Row"];

function supabase() {
  return createSupabaseAdmin();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

function newId() {
  return crypto.randomUUID();
}

export async function listTripExpenses(tripId: string): Promise<TripExpense[]> {
  const { data, error } = await supabase()
    .from("trip_expense")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throwDb(error, "listTripExpenses");
  return ((data ?? []) as ExpenseRow[]).map(mapTripExpense);
}

export async function getTripExpenseById(
  tripId: string,
  expenseId: string,
): Promise<TripExpense | null> {
  const { data, error } = await supabase()
    .from("trip_expense")
    .select("*")
    .eq("trip_id", tripId)
    .eq("id", expenseId)
    .maybeSingle();

  if (error) throwDb(error, "getTripExpenseById");
  return data ? mapTripExpense(data as ExpenseRow) : null;
}

export async function insertTripExpense(input: {
  tripId: string;
  title: string;
  category: string;
  amountCents: number;
  splitMethod: string;
  paidByName: string | null;
  notes: string | null;
  sortOrder: number;
}): Promise<TripExpense> {
  const now = new Date().toISOString();
  const row = {
    id: newId(),
    trip_id: input.tripId,
    title: input.title,
    category: input.category,
    amount_cents: input.amountCents,
    split_method: input.splitMethod,
    paid_by_name: input.paidByName,
    notes: input.notes,
    sort_order: input.sortOrder,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase()
    .from("trip_expense")
    .insert(row)
    .select("*")
    .single();

  if (error) throwDb(error, "insertTripExpense");
  return mapTripExpense(data as ExpenseRow);
}

export async function updateTripExpenseRow(
  tripId: string,
  expenseId: string,
  patch: Database["public"]["Tables"]["trip_expense"]["Update"],
): Promise<void> {
  const { error } = await supabase()
    .from("trip_expense")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("id", expenseId);

  if (error) throwDb(error, "updateTripExpenseRow");
}

export async function deleteTripExpenseRow(tripId: string, expenseId: string): Promise<void> {
  const { error } = await supabase()
    .from("trip_expense")
    .delete()
    .eq("trip_id", tripId)
    .eq("id", expenseId);

  if (error) throwDb(error, "deleteTripExpenseRow");
}

export async function countTripExpenses(tripId: string): Promise<number> {
  const { count, error } = await supabase()
    .from("trip_expense")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if (error) throwDb(error, "countTripExpenses");
  return count ?? 0;
}

export async function listTripContributions(tripId: string): Promise<TripContribution[]> {
  const { data, error } = await supabase()
    .from("trip_contribution")
    .select("*")
    .eq("trip_id", tripId)
    .order("household_name", { ascending: true });

  if (error) throwDb(error, "listTripContributions");
  return ((data ?? []) as ContributionRow[]).map(mapTripContribution);
}

export async function getTripContributionById(
  tripId: string,
  contributionId: string,
): Promise<TripContribution | null> {
  const { data, error } = await supabase()
    .from("trip_contribution")
    .select("*")
    .eq("trip_id", tripId)
    .eq("id", contributionId)
    .maybeSingle();

  if (error) throwDb(error, "getTripContributionById");
  return data ? mapTripContribution(data as ContributionRow) : null;
}

export async function upsertTripContributionRow(input: {
  tripId: string;
  id?: string;
  householdName: string;
  householdEmail: string | null;
  amountCents: number;
  status: string;
  method: string | null;
  paidAt: string | null;
}): Promise<TripContribution> {
  const now = new Date().toISOString();
  const row = {
    id: input.id ?? newId(),
    trip_id: input.tripId,
    household_name: input.householdName,
    household_email: input.householdEmail,
    amount_cents: input.amountCents,
    status: input.status,
    method: input.method,
    paid_at: input.paidAt,
    updated_at: now,
    ...(input.id ? {} : { created_at: now }),
  };

  const { data, error } = await supabase()
    .from("trip_contribution")
    .upsert(row, { onConflict: "trip_id,household_name" })
    .select("*")
    .single();

  if (error) throwDb(error, "upsertTripContributionRow");
  return mapTripContribution(data as ContributionRow);
}

export async function updateTripContributionRow(
  tripId: string,
  contributionId: string,
  patch: Database["public"]["Tables"]["trip_contribution"]["Update"],
): Promise<void> {
  const { error } = await supabase()
    .from("trip_contribution")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("id", contributionId);

  if (error) throwDb(error, "updateTripContributionRow");
}

export async function deleteTripContributionRow(
  tripId: string,
  contributionId: string,
): Promise<void> {
  const { error } = await supabase()
    .from("trip_contribution")
    .delete()
    .eq("trip_id", tripId)
    .eq("id", contributionId);

  if (error) throwDb(error, "deleteTripContributionRow");
}

/** Add $0 pending rows for each confirmed household not yet on the ledger. */
export async function ensureBudgetContributionsFromConfirmations(
  tripId: string,
): Promise<void> {
  const confirmations = await listTripConfirmations(tripId);
  const existing = await listTripContributions(tripId);
  const existingKeys = new Set(
    existing.map((c) => householdKey(c.householdName, c.householdEmail)),
  );

  const seen = new Set<string>();
  for (const conf of confirmations) {
    if (conf.status !== "confirmed") continue;
    const key = householdKey(conf.respondentName, conf.respondentEmail);
    if (seen.has(key) || existingKeys.has(key)) {
      seen.add(key);
      continue;
    }
    seen.add(key);
    await upsertTripContributionRow({
      tripId,
      householdName: conf.respondentName.trim(),
      householdEmail: conf.respondentEmail,
      amountCents: 0,
      status: "pending",
      method: null,
      paidAt: null,
    });
    existingKeys.add(key);
  }
}

export function countConfirmedHouseholds(
  confirmations: { status: string; respondentName: string; respondentEmail: string | null }[],
): number {
  const keys = new Set<string>();
  for (const c of confirmations) {
    if (c.status !== "confirmed") continue;
    keys.add(householdKey(c.respondentName, c.respondentEmail));
  }
  return keys.size;
}
