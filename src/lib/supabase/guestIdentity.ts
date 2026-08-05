import { voterKeyFromUserId } from "@/lib/ballotVoter";
import { createSupabaseAdmin } from "@/lib/supabase/server";

function supabase() {
  return createSupabaseAdmin();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when the user has family participation but no organizer trips. */
export async function userHasGuestParticipation(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = email ? normalizeEmail(email) : null;

  const { count: byUserSurvey, error: e1 } = await supabase()
    .from("survey_response")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (e1) throwDb(e1, "userHasGuestParticipation.survey.user");
  if ((byUserSurvey ?? 0) > 0) return true;

  const { count: byUserConfirm, error: e2 } = await supabase()
    .from("trip_confirmation")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (e2) throwDb(e2, "userHasGuestParticipation.confirm.user");
  if ((byUserConfirm ?? 0) > 0) return true;

  const { count: byUserBallot, error: e3 } = await supabase()
    .from("trip_ballot_vote")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (e3) throwDb(e3, "userHasGuestParticipation.ballot.user");
  if ((byUserBallot ?? 0) > 0) return true;

  if (!normalized) return false;

  if (await tableHasEmailMatch("survey_response", "respondent_email", normalized)) {
    return true;
  }
  if (await tableHasEmailMatch("trip_confirmation", "respondent_email", normalized)) {
    return true;
  }
  return tableHasEmailMatch("trip_ballot_vote", "voter_email", normalized);
}

async function tableHasEmailMatch(
  table: "survey_response" | "trip_confirmation" | "trip_ballot_vote",
  emailColumn: "respondent_email" | "voter_email",
  normalizedEmail: string,
): Promise<boolean> {
  const { data, error } = await supabase()
    .from(table)
    .select(emailColumn)
    .not(emailColumn, "is", null)
    .limit(200);
  if (error) throwDb(error, `tableHasEmailMatch.${table}`);
  for (const row of data ?? []) {
    const r = row as Record<string, string | null>;
    if ((r[emailColumn] ?? "").trim().toLowerCase() === normalizedEmail) return true;
  }
  return false;
}

/**
 * After Google sign-in, attach prior anonymous rows that used the same email.
 */
export async function claimGuestSubmissionsForUser(
  userId: string,
  email: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const userKey = voterKeyFromUserId(userId);

  await claimRowsByEmail("survey_response", "respondent_email", userId, normalized);
  await claimRowsByEmail("trip_confirmation", "respondent_email", userId, normalized);

  const { data: ballotRows, error: ballotListErr } = await supabase()
    .from("trip_ballot_vote")
    .select("id, voter_email")
    .is("user_id", null)
    .not("voter_email", "is", null);
  if (ballotListErr) throwDb(ballotListErr, "claimGuestSubmissions.ballot.list");

  for (const row of ballotRows ?? []) {
    const r = row as { id: string; voter_email: string | null };
    if ((r.voter_email ?? "").trim().toLowerCase() !== normalized) continue;
    const { error } = await supabase()
      .from("trip_ballot_vote")
      .update({ user_id: userId, voter_key: userKey })
      .eq("id", r.id);
    if (error) throwDb(error, "claimGuestSubmissions.ballot.update");
  }
}

async function claimRowsByEmail(
  table: "survey_response" | "trip_confirmation",
  emailColumn: "respondent_email",
  userId: string,
  normalizedEmail: string,
) {
  const { data, error } = await supabase()
    .from(table)
    .select(`id, ${emailColumn}`)
    .is("user_id", null)
    .not(emailColumn, "is", null);
  if (error) throwDb(error, `claimGuestSubmissions.${table}`);

  for (const row of data ?? []) {
    const r = row as { id: string; respondent_email: string | null };
    if ((r.respondent_email ?? "").trim().toLowerCase() !== normalizedEmail) continue;
    const { error: updateErr } = await supabase()
      .from(table)
      .update({ user_id: userId })
      .eq("id", r.id);
    if (updateErr) throwDb(updateErr, `claimGuestSubmissions.${table}.update`);
  }
}
