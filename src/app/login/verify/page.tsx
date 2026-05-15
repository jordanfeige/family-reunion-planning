import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="shell" style={{ maxWidth: "520px", padding: "2rem 1.25rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Check your inbox</h1>
        <p className="muted">
          We sent a WandrAI magic link. Tap it on this device to hop
          into your dashboard. If you do not see it, peek in promotions or spam.
        </p>
        {process.env.NODE_ENV !== "production" ? (
          <div className="success-banner" style={{ marginTop: "1rem" }}>
            Running locally? The link is also printed in your dev server terminal.
          </div>
        ) : null}
        <p style={{ marginTop: "1.25rem" }}>
          <Link href="/login">← Try a different email</Link>
        </p>
      </div>
    </div>
  );
}
