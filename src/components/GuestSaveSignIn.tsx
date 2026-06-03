import { loginWithMagicLinkAction } from "@/app/actions/login";

export function GuestSaveSignIn({
  callbackUrl,
  defaultEmail,
}: {
  callbackUrl: string;
  defaultEmail?: string;
}) {
  return (
    <div
      className="card guest-save-signin"
      style={{
        padding: "0.85rem 1rem",
        marginBottom: "1rem",
        background: "rgba(42, 85, 128, 0.06)",
        border: "1px solid rgba(28, 61, 90, 0.12)",
      }}
    >
      <p style={{ margin: "0 0 0.65rem", fontSize: "0.9rem", color: "var(--color-fjord)" }}>
        <strong>Sign in to save your answers and edit later</strong>
      </p>
      <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
        We&apos;ll email you the same magic link planners use—then you can return to this page
        anytime to update your RSVP or votes.
      </p>
      <form action={loginWithMagicLinkAction} className="stack" style={{ gap: "0.65rem" }}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="guest_signin_email">Email</label>
          <input
            id="guest_signin_email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaultEmail ?? ""}
            placeholder="you@example.com"
          />
        </div>
        <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }}>
          Email me a sign-in link
        </button>
      </form>
    </div>
  );
}

export function GuestSignedInBanner({ email }: { email: string }) {
  return (
    <p
      className="pill guest-signed-in-banner"
      style={{ marginBottom: "1rem", fontSize: "0.82rem" }}
    >
      Signed in as {email} — your answers save to your account and you can edit them here anytime.
    </p>
  );
}
