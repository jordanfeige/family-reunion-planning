import { APP_NAME } from "@/lib/brand";

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "WandrAI <onboarding@resend.dev>";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Magic links and transactional email require Resend in production. */
export function assertResendConfiguredForProduction(): void {
  if (isProduction() && !process.env.RESEND_API_KEY?.trim()) {
    throw new Error(
      "Sign-in email is not configured on the server. Add RESEND_API_KEY in your hosting environment (e.g. Vercel → Settings → Environment Variables).",
    );
  }
}

export function getAuthBaseUrl(): string {
  const url =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!url) {
    if (isProduction()) {
      throw new Error(
        "AUTH_URL is not set. Add your production site URL (e.g. https://your-app.vercel.app) to environment variables.",
      );
    }
    return "http://localhost:3000";
  }

  return url.replace(/\/$/, "");
}

export function parseResendError(status: number, body: string): string {
  let message = body;
  try {
    const json = JSON.parse(body) as { message?: string };
    if (json.message) message = json.message;
  } catch {
    // keep raw body
  }

  const lower = message.toLowerCase();
  if (status === 403 || lower.includes("domain") || lower.includes("verify")) {
    return `Resend rejected the sender address. Verify your domain in Resend and set EMAIL_FROM to an address on that domain (not onboarding@resend.dev). Details: ${message}`;
  }
  if (lower.includes("only send") || lower.includes("testing")) {
    return `Resend test mode only allows sending to your Resend account email. Verify a domain in Resend, or test with the email you used to sign up for Resend. Details: ${message}`;
  }
  if (status === 401 || lower.includes("api key")) {
    return `Resend API key is invalid. Check RESEND_API_KEY in your hosting environment. Details: ${message}`;
  }

  return `Resend could not send the ${APP_NAME} email (${status}): ${message}`;
}
