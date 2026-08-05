import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

const SPOTS = [
  {
    title: "Lake of the Ozarks",
    region: "Missouri",
    blurb: "Drive-friendly lake house weekends with room for a big crew.",
  },
  {
    title: "Door County",
    region: "Wisconsin",
    blurb: "Cherry orchards, shoreline towns, and easy multi-gen pacing.",
  },
  {
    title: "Asheville foothills",
    region: "North Carolina",
    blurb: "Mountain air, porches, and food that keeps everyone happy.",
  },
  {
    title: "Outer Banks",
    region: "North Carolina",
    blurb: "Beach houses, bikes, and sunrise walks for mixed ages.",
  },
];

export default async function InspirationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/inspiration");

  return (
    <div className="shell content-page">
      <header className="content-page-head">
        <h1 className="content-page-title">Inspiration</h1>
        <p className="content-page-lede">
          US reunion vibes to spark your Destinations chat — tap into WandrAI when
          you’re ready to shortlist.
        </p>
      </header>
      <ul className="inspire-grid">
        {SPOTS.map((spot) => (
          <li key={spot.title} className="inspire-card">
            <p className="inspire-region">{spot.region}</p>
            <h2 className="inspire-title">{spot.title}</h2>
            <p className="muted">{spot.blurb}</p>
          </li>
        ))}
      </ul>
      <p className="content-page-cta">
        <Link className="btn btn-berry" href="/plan">
          Plan with WandrAI →
        </Link>
      </p>
    </div>
  );
}
