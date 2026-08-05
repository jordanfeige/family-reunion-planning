const ERROR_HINTS: Record<string, string> = {
  Configuration:
    "Server sign-in configuration failed. Check AUTH_SECRET, AUTH_URL (your production URL), AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET.",
  AccessDenied: "Sign-in was not allowed for this account.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Use Continue with Google with the same Google account.",
  OAuthSignin: "Could not start Google sign-in. Check AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.",
  OAuthCallback: "Google sign-in failed on return. Try again, or check AUTH_URL matches this site.",
  Callback: "Sign-in callback failed. Check AUTH_URL and Google OAuth redirect URIs.",
};

export function messageForAuthErrorCode(code: string | null | undefined): string {
  if (!code) {
    return "Something went wrong while signing you in. Please try again.";
  }
  return ERROR_HINTS[code] ?? ERROR_HINTS.Configuration;
}
