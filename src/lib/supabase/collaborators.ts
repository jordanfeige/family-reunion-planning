import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isMissingTableError } from "@/lib/supabase/errors";
import { mapTrip, type Trip } from "@/lib/supabase/mappers";
import type { Database } from "@/lib/supabase/database.types";

type TripRow = Database["public"]["Tables"]["trip"]["Row"];
import type { TripOrganizerRole } from "@/lib/tripAccess";

type TripMemberRow = {
  id: string;
  trip_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type TripInviteRow = {
  id: string;
  trip_id: string;
  email: string;
  invited_by_user_id: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  home_city?: string | null;
  home_state?: string | null;
};

function supabase() {
  return createSupabaseAdmin();
}

function newId() {
  return crypto.randomUUID();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

const COLLABORATOR_MIGRATION_HINT =
  "Collaborator tables are missing. In Supabase → SQL Editor, run supabase/migrations/20260515100000_trip_collaborators.sql";

function throwDbCollaborator(error: { message: string } | null, context: string): never {
  if (isMissingTableError(error)) {
    throw new Error(COLLABORATOR_MIGRATION_HINT);
  }
  throwDb(error, context);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type TripListItem = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  createdAt: Date;
  access: "owner" | "collaborator";
  locationOptions: unknown;
  proposedDateSlots: string[];
  selectedLocationId: string | null;
  selectedWeekendFriday: string | null;
  ballotStatus: string;
  publishedItinerary: unknown;
  surveyResponseCount: number;
};

const TRIP_LIST_SELECT =
  "id, name, slug, tagline, created_at, location_options, proposed_date_slots, selected_location_id, selected_weekend_friday, ballot_status, published_itinerary";

function mapTripListRow(
  row: TripRow,
  access: "owner" | "collaborator",
  surveyResponseCount: number,
): TripListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    createdAt: new Date(row.created_at),
    access,
    locationOptions: row.location_options,
    proposedDateSlots: row.proposed_date_slots ?? [],
    selectedLocationId: row.selected_location_id,
    selectedWeekendFriday: row.selected_weekend_friday,
    ballotStatus: row.ballot_status ?? "draft",
    publishedItinerary: row.published_itinerary,
    surveyResponseCount,
  };
}

async function surveyResponseCountsByTripIds(
  tripIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (tripIds.length === 0) return counts;

  const { data: surveys, error: surveyErr } = await supabase()
    .from("survey")
    .select("id, trip_id")
    .in("trip_id", tripIds);
  if (surveyErr) throwDb(surveyErr, "surveyResponseCounts.surveys");

  const surveyToTrip = new Map<string, string>();
  for (const s of surveys ?? []) {
    surveyToTrip.set(
      (s as { id: string }).id,
      (s as { trip_id: string }).trip_id,
    );
  }
  const surveyIds = [...surveyToTrip.keys()];
  if (surveyIds.length === 0) return counts;

  const { data: responses, error: respErr } = await supabase()
    .from("survey_response")
    .select("survey_id")
    .in("survey_id", surveyIds);
  if (respErr) throwDb(respErr, "surveyResponseCounts.responses");

  for (const r of responses ?? []) {
    const tripId = surveyToTrip.get((r as { survey_id: string }).survey_id);
    if (!tripId) continue;
    counts.set(tripId, (counts.get(tripId) ?? 0) + 1);
  }
  return counts;
}

export type TripMemberWithUser = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: "editor";
  createdAt: Date;
};

export type TripInviteItem = {
  id: string;
  email: string;
  createdAt: Date;
};

export async function getTripBySlugRow(slug: string): Promise<TripRow | null> {
  const { data, error } = await supabase()
    .from("trip")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throwDb(error, "getTripBySlugRow");
  return data as TripRow | null;
}

export async function getTripForOrganizer(
  slug: string,
  userId: string,
): Promise<{ trip: Trip; role: TripOrganizerRole } | null> {
  const row = await getTripBySlugRow(slug);
  if (!row) return null;

  const trip = mapTrip(row as TripRow);
  if (row.owner_id === userId) {
    return { trip, role: "owner" };
  }

  const { data: member, error } = await supabase()
    .from("trip_member")
    .select("id")
    .eq("trip_id", row.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throwDb(error, "getTripForOrganizer.member");
  }
  if (member) return { trip, role: "editor" };

  return null;
}

export async function listTripsForUser(userId: string): Promise<TripListItem[]> {
  const { data: owned, error: ownedError } = await supabase()
    .from("trip")
    .select(TRIP_LIST_SELECT)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (ownedError) throwDb(ownedError, "listTripsForUser.owned");

  const ownedRows = (owned ?? []) as TripRow[];
  const ownedIds = new Set(ownedRows.map((t) => t.id));

  const { data: memberships, error: memberError } = await supabase()
    .from("trip_member")
    .select("trip_id")
    .eq("user_id", userId);

  if (memberError) {
    if (isMissingTableError(memberError)) {
      const counts = await surveyResponseCountsByTripIds(ownedRows.map((r) => r.id));
      return ownedRows.map((row) =>
        mapTripListRow(row, "owner", counts.get(row.id) ?? 0),
      );
    }
    throwDb(memberError, "listTripsForUser.members");
  }

  const sharedTripIds = (memberships ?? [])
    .map((m) => m.trip_id as string)
    .filter((id) => !ownedIds.has(id));

  let sharedRows: TripRow[] = [];
  if (sharedTripIds.length > 0) {
    const { data: shared, error: sharedError } = await supabase()
      .from("trip")
      .select(TRIP_LIST_SELECT)
      .in("id", sharedTripIds)
      .order("created_at", { ascending: false });

    if (sharedError) throwDb(sharedError, "listTripsForUser.shared");
    sharedRows = (shared ?? []) as TripRow[];
  }

  const allIds = [...ownedRows.map((r) => r.id), ...sharedRows.map((r) => r.id)];
  const counts = await surveyResponseCountsByTripIds(allIds);

  const items: TripListItem[] = [
    ...ownedRows.map((row) => mapTripListRow(row, "owner", counts.get(row.id) ?? 0)),
    ...sharedRows.map((row) =>
      mapTripListRow(row, "collaborator", counts.get(row.id) ?? 0),
    ),
  ];

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase()
    .from("user")
    .select("id, email, name")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throwDb(error, "getUserByEmail");
  return data as UserRow | null;
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabase()
    .from("user")
    .select("id, email, name, home_city, home_state")
    .eq("id", userId)
    .maybeSingle();

  if (error) throwDb(error, "getUserById");
  return data as UserRow | null;
}

export async function updateUserHome(
  userId: string,
  homeCity: string,
  homeState: string,
) {
  const { error } = await supabase()
    .from("user")
    .update({
      home_city: homeCity.trim() || null,
      home_state: homeState.trim().toUpperCase().slice(0, 2) || null,
    })
    .eq("id", userId);

  if (error) throwDb(error, "updateUserHome");
}

export async function listTripMembers(tripId: string): Promise<TripMemberWithUser[]> {
  const { data: members, error } = await supabase()
    .from("trip_member")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throwDb(error, "listTripMembers");
  }

  const result: TripMemberWithUser[] = [];
  for (const row of (members ?? []) as TripMemberRow[]) {
    const user = await getUserById(row.user_id);
    result.push({
      id: row.id,
      userId: row.user_id,
      name: user?.name ?? null,
      email: user?.email ?? null,
      role: "editor",
      createdAt: new Date(row.created_at),
    });
  }
  return result;
}

export async function listTripInvites(tripId: string): Promise<TripInviteItem[]> {
  const { data, error } = await supabase()
    .from("trip_invite")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throwDb(error, "listTripInvites");
  }

  return ((data ?? []) as TripInviteRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    createdAt: new Date(row.created_at),
  }));
}

export async function addTripMember(tripId: string, userId: string) {
  const { error } = await supabase().from("trip_member").insert({
    id: newId(),
    trip_id: tripId,
    user_id: userId,
    role: "editor",
  });

  if (error) throwDbCollaborator(error, "addTripMember");
}

export async function insertTripInvite(
  tripId: string,
  email: string,
  invitedByUserId: string,
) {
  const { error } = await supabase().from("trip_invite").insert({
    id: newId(),
    trip_id: tripId,
    email: normalizeEmail(email),
    invited_by_user_id: invitedByUserId,
  });

  if (error) throwDbCollaborator(error, "insertTripInvite");
}

export async function deleteTripInvite(inviteId: string, tripId: string) {
  const { error } = await supabase()
    .from("trip_invite")
    .delete()
    .eq("id", inviteId)
    .eq("trip_id", tripId);

  if (error) throwDbCollaborator(error, "deleteTripInvite");
}

export async function deleteTripMember(memberId: string, tripId: string) {
  const { error } = await supabase()
    .from("trip_member")
    .delete()
    .eq("id", memberId)
    .eq("trip_id", tripId);

  if (error) throwDbCollaborator(error, "deleteTripMember");
}

export async function getTripMemberByUserId(tripId: string, userId: string) {
  const { data, error } = await supabase()
    .from("trip_member")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throwDb(error, "getTripMemberByUserId");
  }
  return data as { id: string } | null;
}

export async function getTripInviteByEmail(tripId: string, email: string) {
  const { data, error } = await supabase()
    .from("trip_invite")
    .select("id")
    .eq("trip_id", tripId)
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throwDb(error, "getTripInviteByEmail");
  }
  return data as { id: string } | null;
}

export async function claimTripInvitesForUser(userId: string, email: string) {
  const normalized = normalizeEmail(email);
  const { data: invites, error } = await supabase()
    .from("trip_invite")
    .select("*")
    .eq("email", normalized);

  if (error) {
    if (isMissingTableError(error)) return 0;
    throwDb(error, "claimTripInvitesForUser");
  }
  if (!invites?.length) return 0;

  let claimed = 0;
  for (const invite of invites as TripInviteRow[]) {
    const existing = await getTripMemberByUserId(invite.trip_id, userId);
    if (!existing) {
      await addTripMember(invite.trip_id, userId);
      claimed += 1;
    }
    await supabase().from("trip_invite").delete().eq("id", invite.id);
  }
  return claimed;
}
