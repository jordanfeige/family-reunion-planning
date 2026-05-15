const ERROR_HINTS: Record<string, string> = {
  Configuration:
    "Server sign-in configuration failed. Check AUTH_SECRET, AUTH_URL (your production URL), RESEND_API_KEY, and EMAIL_FROM on a verified Resend domain.",
  Verification:
    "That sign-in link is invalid or expired. Request a new magic link.",
  AccessDenied: "Sign-in was not allowed for this account.",
  EmailSignInError:
    "We could not start email sign-in. Check RESEND_API_KEY, EMAIL_FROM, and AUTH_URL in production.",
};

export function messageForAuthErrorCode(code: string | null | undefined): string {
  if (!code) {
    return "Something went wrong while signing you in. Please try again.";
  }
  return ERROR_HINTS[code] ?? ERROR_HINTS.Configuration;
}
