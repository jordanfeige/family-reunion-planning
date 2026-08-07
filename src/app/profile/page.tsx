import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/auth";
import { SoftImage } from "@/components/SoftImage";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile");

  const name = session.user.name?.trim() || "Planner";
  const email = session.user.email ?? "";

  return (
    <div className="shell content-page">
      <header className="content-page-head profile-head">
        {session.user.image ? (
          <SoftImage
            src={session.user.image}
            letter={name}
            className="profile-avatar soft-image--avatar"
            width={72}
            height={72}
          />
        ) : (
          <span className="profile-avatar profile-avatar--fallback" aria-hidden>
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="content-page-title">{name}</h1>
          {email ? <p className="muted content-page-lede">{email}</p> : null}
        </div>
      </header>

      <div className="profile-actions">
        <Link className="btn btn-secondary" href="/dashboard">
          Your trips
        </Link>
        <a className="btn btn-berry" href="/api/plan/start">
          Plan a trip
        </a>
        <form action={signOutAction}>
          <button type="submit" className="btn btn-secondary">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
