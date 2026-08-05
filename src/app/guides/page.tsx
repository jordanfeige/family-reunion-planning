import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

const GUIDES = [
  {
    title: "How the family survey works",
    body: "Share one link. Households pick weekends and destinations. You lock the plan on Decision.",
  },
  {
    title: "Picking a US drive-radius",
    body: "Ask WandrAI for “within a day’s drive of Chicago” or similar — it shortlists survey options, not bookings.",
  },
  {
    title: "From shortlist to weekend plan",
    body: "Publish destinations → collect replies → soft-lock place & weekend → generate Fri–Sun with AI.",
  },
];

export default async function GuidesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/guides");

  return (
    <div className="shell content-page">
      <header className="content-page-head">
        <h1 className="content-page-title">Guides</h1>
        <p className="content-page-lede">
          Short playbooks for US reunions on WandrAI — practical, not fluffy.
        </p>
      </header>
      <ol className="guides-list">
        {GUIDES.map((g) => (
          <li key={g.title} className="guides-card">
            <h2 className="guides-title">{g.title}</h2>
            <p className="muted">{g.body}</p>
          </li>
        ))}
      </ol>
      <p className="content-page-cta">
        <Link className="btn btn-berry" href="/dashboard">
          Back to trips
        </Link>
      </p>
    </div>
  );
}
