import Link from "next/link";

import { loginWithMagicLinkAction } from "@/app/actions/login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="shell" style={{ maxWidth: "480px", padding: "2rem 1.25rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Magic link</h1>
        <p className="muted">
          Velkommen tilbake. We will email you a one-time link—no passwords to
          forget on the trail.
        </p>
        <form action={loginWithMagicLinkAction} className="stack" style={{ marginTop: "1rem" }}>
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Email me a link
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.85rem" }}>
          Local dev without Resend? Check your terminal—the magic link is printed
          there.
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
