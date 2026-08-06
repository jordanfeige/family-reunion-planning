const ERROR_HINTS: Record<string, string> = {
  Configuration:
    "Sign-in hit a server error after Google returned. Usually this is a database schema mismatch (missing columns), not missing Google keys. Check recent Vercel logs for AdapterError, and confirm AUTH_SECRET / AUTH_URL / AUTH_GOOGLE_* are set.",
  AccessDenied: "Sign-in was not allowed for this account.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Use Continue with Google with the same Google account.",
  OAuthSignin: "Could not start Google sign-in. Check AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.",
  OAuthCallback: "Google sign-in failed on return. Try again, or check AUTH_URL matches this site.",
  Callback: "Sign-in callback failed. Check AUTH_URL and Google OAuth redirect URIs.",
  AdapterError:
    "Sign-in could not read your account from the database. A required Postgres column may be missing — apply pending migrations (see supabase/migrations).",
};

export function messageForAuthErrorCode(code: string | null | undefined): string {
  if (!code) {
    return "Something went wrong while signing you in. Please try again.";
  }
  return ERROR_HINTS[code] ?? ERROR_HINTS.Configuration;
}
