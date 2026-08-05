import Link from "next/link";

import { auth } from "@/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="landing">
      <section className="landing-hero" aria-label={`${APP_NAME} home`}>
        <div className="landing-hero-glow" aria-hidden />
        <div className="landing-hero-inner">
          <h1 className="landing-brand">{APP_NAME}</h1>
          <p className="landing-tagline">{APP_TAGLINE}</p>
          <p className="landing-support">
            Plan reunions and family weekends without the spreadsheet chaos.
          </p>
          <div className="landing-cta-group">
            {session?.user ? (
              <Link className="btn btn-berry landing-cta" href="/dashboard">
                Go to your dashboard
              </Link>
            ) : (
              <Link className="btn btn-berry landing-cta" href="/login">
                Start with a magic link
              </Link>
            )}
            <a className="landing-secondary" href="#how">
              How magic link works
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="landing-how">
        <div className="shell landing-how-inner">
          <h2 className="landing-how-title">How it works</h2>
          <ol className="landing-steps">
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                1
              </span>
              <div>
                <h3>Survey</h3>
                <p>Send a friendly link. Family picks weekends and places.</p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                2
              </span>
              <div>
                <h3>Vote</h3>
                <p>Lock the trip, then thumbs-up stays and activities together.</p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                3
              </span>
              <div>
                <h3>Plan</h3>
                <p>Publish the itinerary and collect final RSVPs on one link.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
