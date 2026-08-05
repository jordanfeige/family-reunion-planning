import Link from "next/link";

import { auth } from "@/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  getPlanDraftBySecret,
  readPlanDraftCookieSecret,
} from "@/lib/supabase/planDrafts";

export default async function HomePage() {
  const session = await auth();
  const secret = await readPlanDraftCookieSecret();
  const draft = secret ? await getPlanDraftBySecret(secret) : null;
  const hasDraft = Boolean(draft);

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
              <>
                <Link className="btn btn-berry landing-cta" href="/dashboard">
                  Go to your dashboard
                </Link>
                {hasDraft ? (
                  <Link className="landing-secondary" href="/plan">
                    Resume your draft plan
                  </Link>
                ) : (
                  <Link className="landing-secondary" href="/dashboard">
                    Plan a new trip
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link className="btn btn-berry landing-cta" href="/plan">
                  {hasDraft ? "Resume your plan" : "Plan a trip"}
                </Link>
                <div className="landing-auth-links">
                  <Link className="landing-secondary" href="/login">
                    Sign in
                  </Link>
                  <span className="landing-auth-sep" aria-hidden>
                    ·
                  </span>
                  <Link className="landing-secondary" href="/login?intent=signup">
                    Sign up
                  </Link>
                </div>
              </>
            )}
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
                <h3>Plan</h3>
                <p>Chat with WandrAI — no account needed to start.</p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                2
              </span>
              <div>
                <h3>Save</h3>
                <p>Continue with Google when you want the family survey link.</p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                3
              </span>
              <div>
                <h3>Share</h3>
                <p>Send the survey, vote, and publish the weekend plan.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
