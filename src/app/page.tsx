import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listTripsForUser } from "@/lib/supabase/queries";

/**
 * `/` entry (R11):
 * - ≥1 trip → composer (`/plan`)
 * - otherwise → browse (new-user default)
 *
 * People-graph facts live in localStorage, so Browse mounts a tiny client
 * upgrade that sends fact-returning users to `/plan`.
 */
export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id) {
    try {
      const trips = await listTripsForUser(session.user.id);
      if (trips.length > 0) redirect("/plan");
    } catch {
      /* fall through to browse */
    }
  }

  redirect("/browse");
}
