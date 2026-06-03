import { createSupabaseAdmin } from "@/lib/supabase/server";

function supabase() {
  return createSupabaseAdmin();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

export type BallotVoteRecord = {
  id: string;
  tripId: string;
  optionId: string;
  vote: "up" | "down";
  userId: string | null;
  surveyResponseId: string | null;
  voterName: string | null;
  voterEmail: string | null;
  voterKey: string;
  votedAt: Date;
};

type VoteRow = {
  id: string;
  trip_id: string;
  option_id: string;
  vote: string;
  user_id: string | null;
  survey_response_id: string | null;
  voter_name: string | null;
  voter_email: string | null;
  voter_key: string;
  voted_at: string;
};

function mapVote(row: VoteRow): BallotVoteRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    optionId: row.option_id,
    vote: row.vote as "up" | "down",
    userId: row.user_id,
    surveyResponseId: row.survey_response_id,
    voterName: row.voter_name,
    voterEmail: row.voter_email,
    voterKey: row.voter_key,
    votedAt: new Date(row.voted_at),
  };
}

export async function listBallotVotesForTrip(tripId: string): Promise<BallotVoteRecord[]> {
  const { data, error } = await supabase()
    .from("trip_ballot_vote")
    .select("*")
    .eq("trip_id", tripId);

  if (error) throwDb(error, "listBallotVotesForTrip");
  return ((data ?? []) as VoteRow[]).map(mapVote);
}

export async function listBallotVotesForVoter(
  tripId: string,
  voterKey: string,
): Promise<BallotVoteRecord[]> {
  const { data, error } = await supabase()
    .from("trip_ballot_vote")
    .select("*")
    .eq("trip_id", tripId)
    .eq("voter_key", voterKey);

  if (error) throwDb(error, "listBallotVotesForVoter");
  return ((data ?? []) as VoteRow[]).map(mapVote);
}

export async function upsertBallotVotes(input: {
  tripId: string;
  userId: string | null;
  voterKey: string;
  voterName: string;
  voterEmail: string | null;
  surveyResponseId: string | null;
  votes: { optionId: string; vote: "up" | "down" }[];
}): Promise<void> {
  const rows = input.votes.map((v) => ({
    id: crypto.randomUUID(),
    trip_id: input.tripId,
    option_id: v.optionId,
    vote: v.vote,
    user_id: input.userId,
    survey_response_id: input.surveyResponseId,
    voter_name: input.voterName,
    voter_email: input.voterEmail,
    voter_key: input.voterKey,
    voted_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return;

  const { error } = await supabase()
    .from("trip_ballot_vote")
    .upsert(rows, { onConflict: "trip_id,option_id,voter_key" });

  if (error) throwDb(error, "upsertBallotVotes");
}

export async function deleteBallotVotesForVoter(
  tripId: string,
  voterKey: string,
  optionIds: string[],
): Promise<void> {
  if (optionIds.length === 0) return;
  const { error } = await supabase()
    .from("trip_ballot_vote")
    .delete()
    .eq("trip_id", tripId)
    .eq("voter_key", voterKey)
    .in("option_id", optionIds);

  if (error) throwDb(error, "deleteBallotVotesForVoter");
}

export async function findSurveyResponseByEmail(
  surveyId: string,
  email: string,
): Promise<{ id: string; respondentName: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase()
    .from("survey_response")
    .select("id, respondent_name, respondent_email")
    .eq("survey_id", surveyId);

  if (error) throwDb(error, "findSurveyResponseByEmail");

  for (const row of data ?? []) {
    const r = row as { id: string; respondent_name: string; respondent_email: string | null };
    if ((r.respondent_email ?? "").trim().toLowerCase() === normalized) {
      return { id: r.id, respondentName: r.respondent_name };
    }
  }
  return null;
}
