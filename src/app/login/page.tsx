import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { continueWithGoogleAction } from "@/app/actions/login";
import { BrandMark } from "@/components/BrandMark";
import { APP_TAGLINE } from "@/lib/brand";
import {
  getPlanDraftBySecret,
  readPlanDraftCookieSecret,
} from "@/lib/supabase/planDrafts";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; intent?: string }>;
}) {
  const session = await auth();
  const { callbackUrl: rawCallback, error, intent } = await searchParams;
  const isSignup = intent === "signup";

  const secret = await readPlanDraftCookieSecret();
  const draft = secret ? await getPlanDraftBySecret(secret) : null;
  const draftResumeUrl =
    draft?.payload.step === "save" && draft.payload.name?.trim()
      ? "/api/plan/claim"
      : draft
        ? "/plan"
        : null;

  const callbackUrl =
    (rawCallback?.trim() && rawCallback.trim().startsWith("/")
      ? rawCallback.trim()
      : null) ||
    draftResumeUrl ||
    "/dashboard";

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const title = isSignup ? "Create your account" : "Sign in";
  const blurb = isSignup
    ? "Continue with Google to save trips and share survey links with family."
    : "Continue with Google to open your trip hubs.";

  return (
    <div className="shell" style={{ maxWidth: "480px", padding: "2rem 1.25rem" }}>
      <div className="card auth-card">
        <BrandMark showTagline tagline={APP_TAGLINE} />
        <h1 style={{ marginTop: "1.25rem" }}>{title}</h1>
        <p className="muted" style={{ margin: "0.5rem 0 0", lineHeight: 1.5 }}>
          {blurb}
        </p>
        {draft && !rawCallback ? (
          <p className="success-banner" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
            You have an unsaved plan — we&apos;ll bring you back after Google.
          </p>
        ) : null}
        {error ? (
          <p className="error-banner" style={{ marginTop: "0.75rem" }}>
            {error}
          </p>
        ) : null}

        <form action={continueWithGoogleAction} className="stack" style={{ marginTop: "1.5rem" }}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button type="submit" className="btn btn-primary btn-google">
            Continue with Google
          </button>
        </form>

        <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link
                href={`/login?intent=signup&callbackUrl=${encodeURIComponent(callbackUrl)}`}
              >
                Create an account
              </Link>
            </>
          )}
        </p>
        <p style={{ marginTop: "1rem" }}>
          <Link href="/" className="muted">
            ← Back home
          </Link>
        </p>
      </div>
    </div>
  );
}
