import Link from "next/link";

import { messageForAuthErrorCode } from "@/lib/loginErrors";

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  const message = messageForAuthErrorCode(errorCode);

  return (
    <div className="shell" style={{ maxWidth: "520px", padding: "2rem 1.25rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Sign-in hiccup</h1>
        {errorCode ? (
          <p className="error-banner" style={{ marginBottom: "0.75rem" }}>
            Code: {errorCode}
          </p>
        ) : null}
        <p className="muted">{message}</p>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
          Production checklist: <code>RESEND_API_KEY</code>,{" "}
          <code>EMAIL_FROM</code> on a verified Resend domain,{" "}
          <code>AUTH_URL</code> matching your live site, and <code>AUTH_SECRET</code>{" "}
          set in Vercel. Check Resend → Logs for delivery details.
        </p>
        <Link className="btn btn-primary" href="/login" style={{ marginTop: "1rem" }}>
          Try again
        </Link>
      </div>
    </div>
  );
}

