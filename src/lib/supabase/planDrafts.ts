import { cookies } from "next/headers";

import {
  PLAN_DRAFT_COOKIE,
  PLAN_DRAFT_TTL_DAYS,
  planDraftPayloadSchema,
  type PlanDraftPayload,
  type PlanDraftRecord,
} from "@/lib/planDraft";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { newSecretToken } from "@/lib/tokens";

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

function mapRow(row: Record<string, unknown>): PlanDraftRecord {
  const parsed = planDraftPayloadSchema.safeParse(row.payload ?? {});
  return {
    id: String(row.id),
    secret: String(row.secret),
    payload: parsed.success ? parsed.data : {},
    messageCount: Number(row.message_count ?? 0),
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
    claimedAt: row.claimed_at ? new Date(String(row.claimed_at)) : null,
    claimedTripId: row.claimed_trip_id ? String(row.claimed_trip_id) : null,
  };
}

export async function getPlanDraftBySecret(
  secret: string,
): Promise<PlanDraftRecord | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("plan_draft")
    .select("*")
    .eq("secret", secret)
    .maybeSingle();
  if (error) throwDb(error, "getPlanDraftBySecret");
  if (!data) return null;
  const draft = mapRow(data as Record<string, unknown>);
  if (draft.claimedAt) return null;
  if (draft.expiresAt.getTime() < Date.now()) return null;
  return draft;
}

export async function createPlanDraft(
  initial: PlanDraftPayload = {},
): Promise<PlanDraftRecord> {
  const supabase = createSupabaseAdmin();
  const id = crypto.randomUUID();
  const secret = newSecretToken();
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + PLAN_DRAFT_TTL_DAYS);

  const { data, error } = await supabase
    .from("plan_draft")
    .insert({
      id,
      secret,
      payload: initial,
      message_count: 0,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    })
    .select("*")
    .single();
  if (error) throwDb(error, "createPlanDraft");
  return mapRow(data as Record<string, unknown>);
}

export async function updatePlanDraftPayload(
  id: string,
  payload: PlanDraftPayload,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("plan_draft")
    .update({ payload })
    .eq("id", id)
    .is("claimed_at", null);
  if (error) throwDb(error, "updatePlanDraftPayload");
}

export async function incrementPlanDraftMessages(id: string): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("plan_draft")
    .select("message_count")
    .eq("id", id)
    .is("claimed_at", null)
    .maybeSingle();
  if (error) throwDb(error, "incrementPlanDraftMessages.read");
  if (!data) throw new Error("Draft not found.");
  const next = Number((data as { message_count: number }).message_count ?? 0) + 1;
  const { error: upErr } = await supabase
    .from("plan_draft")
    .update({ message_count: next })
    .eq("id", id);
  if (upErr) throwDb(upErr, "incrementPlanDraftMessages.write");
  return next;
}

export async function markPlanDraftClaimed(
  id: string,
  tripId: string,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("plan_draft")
    .update({
      claimed_at: new Date().toISOString(),
      claimed_trip_id: tripId,
    })
    .eq("id", id);
  if (error) throwDb(error, "markPlanDraftClaimed");
}

export async function readPlanDraftCookieSecret(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PLAN_DRAFT_COOKIE)?.value?.trim();
  return value || null;
}

export async function setPlanDraftCookie(secret: string): Promise<void> {
  const jar = await cookies();
  jar.set(PLAN_DRAFT_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAN_DRAFT_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearPlanDraftCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PLAN_DRAFT_COOKIE);
}

/** Get existing unclaimed draft from cookie, or create one. */
export async function ensurePlanDraft(): Promise<PlanDraftRecord> {
  const secret = await readPlanDraftCookieSecret();
  if (secret) {
    const existing = await getPlanDraftBySecret(secret);
    if (existing) return existing;
  }
  const draft = await createPlanDraft({ step: "create" });
  await setPlanDraftCookie(draft.secret);
  return draft;
}
