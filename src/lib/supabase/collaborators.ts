import { createSupabaseAdmin } from "@/lib/supabase/server";
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
};

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

  if (error) throwDb(error, "getTripForOrganizer.member");
  if (member) return { trip, role: "editor" };

  return null;
}

export async function listTripsForUser(userId: string): Promise<TripListItem[]> {
  const { data: owned, error: ownedError } = await supabase()
    .from("trip")
    .select("id, name, slug, tagline, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (ownedError) throwDb(ownedError, "listTripsForUser.owned");

  const ownedIds = new Set((owned ?? []).map((t) => t.id));
  const items: TripListItem[] = ((owned ?? []) as TripRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    createdAt: new Date(row.created_at),
    access: "owner" as const,
  }));

  const { data: memberships, error: memberError } = await supabase()
    .from("trip_member")
    .select("trip_id")
    .eq("user_id", userId);

  if (memberError) throwDb(memberError, "listTripsForUser.members");

  const sharedTripIds = (memberships ?? [])
    .map((m) => m.trip_id as string)
    .filter((id) => !ownedIds.has(id));

  if (sharedTripIds.length === 0) return items;

  const { data: shared, error: sharedError } = await supabase()
    .from("trip")
    .select("id, name, slug, tagline, created_at")
    .in("id", sharedTripIds)
    .order("created_at", { ascending: false });

  if (sharedError) throwDb(sharedError, "listTripsForUser.shared");

  for (const row of (shared ?? []) as TripRow[]) {
    items.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      createdAt: new Date(row.created_at),
      access: "collaborator",
    });
  }

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
    .select("id, email, name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throwDb(error, "getUserById");
  return data as UserRow | null;
}

export async function listTripMembers(tripId: string): Promise<TripMemberWithUser[]> {
  const { data: members, error } = await supabase()
    .from("trip_member")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) throwDb(error, "listTripMembers");

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

  if (error) throwDb(error, "listTripInvites");

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

  if (error) throwDb(error, "addTripMember");
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

  if (error) throwDb(error, "insertTripInvite");
}

export async function deleteTripInvite(inviteId: string, tripId: string) {
  const { error } = await supabase()
    .from("trip_invite")
    .delete()
    .eq("id", inviteId)
    .eq("trip_id", tripId);

  if (error) throwDb(error, "deleteTripInvite");
}

export async function deleteTripMember(memberId: string, tripId: string) {
  const { error } = await supabase()
    .from("trip_member")
    .delete()
    .eq("id", memberId)
    .eq("trip_id", tripId);

  if (error) throwDb(error, "deleteTripMember");
}

export async function getTripMemberByUserId(tripId: string, userId: string) {
  const { data, error } = await supabase()
    .from("trip_member")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwDb(error, "getTripMemberByUserId");
  return data as { id: string } | null;
}

export async function getTripInviteByEmail(tripId: string, email: string) {
  const { data, error } = await supabase()
    .from("trip_invite")
    .select("id")
    .eq("trip_id", tripId)
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) throwDb(error, "getTripInviteByEmail");
  return data as { id: string } | null;
}

export async function claimTripInvitesForUser(userId: string, email: string) {
  const normalized = normalizeEmail(email);
  const { data: invites, error } = await supabase()
    .from("trip_invite")
    .select("*")
    .eq("email", normalized);

  if (error) throwDb(error, "claimTripInvitesForUser");
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
