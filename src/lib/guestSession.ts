export type GuestSession = {
  userId: string;
  name: string;
  email: string;
};

export function guestSessionFromUser(user: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}): GuestSession | null {
  const userId = user.id?.trim();
  const email = user.email?.trim();
  if (!userId || !email) return null;
  const name = user.name?.trim() || email.split("@")[0] || "Guest";
  return { userId, name, email };
}
