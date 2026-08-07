import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listTripsForUser } from "@/lib/supabase/queries";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/library");

  const trips = await listTripsForUser(session.user.id);

  return (
    <div className="shell content-page">
      <header className="content-page-head">
        <h1 className="content-page-title">Library</h1>
        <p className="content-page-lede">
          Saved trips and drafts — jump back into the trail anytime.
        </p>
      </header>
      {trips.length === 0 ? (
        <p className="muted">
          No trips yet.{" "}
          <a href="/api/plan/start">Start planning</a> to fill this shelf.
        </p>
      ) : (
        <ul className="library-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link className="library-row" href={`/t/${trip.slug}`}>
                <span>
                  <strong>{trip.name}</strong>
                  {trip.tagline ? (
                    <span className="muted library-tagline">{trip.tagline}</span>
                  ) : null}
                </span>
                <span className="library-open">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
