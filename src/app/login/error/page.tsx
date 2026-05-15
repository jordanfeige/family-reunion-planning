import Link from "next/link";

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="shell" style={{ maxWidth: "520px", padding: "2rem 1.25rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Sign-in hiccup</h1>
        {error ? (
          <p className="error-banner">Code: {error}</p>
        ) : (
          <p className="muted">Something went wrong while signing you in.</p>
        )}
        <p className="muted">
          Double-check your email provider, Resend domain settings, and{" "}
          <code>AUTH_URL</code> in production.
        </p>
        <Link className="btn btn-primary" href="/login" style={{ marginTop: "1rem" }}>
          Try again
        </Link>
      </div>
    </div>
  );
}
