import type { EmailConfig } from "@auth/core/providers/email";

import { getEmailFrom } from "@/lib/emailConfig";
import { sendMagicLinkEmail } from "@/lib/sendMagicLinkEmail";

/** Last send failure message (same request) for login action error display. */
let lastSendFailureMessage: string | null = null;

export function takeLastMagicLinkSendError(): string | null {
  const message = lastSendFailureMessage;
  lastSendFailureMessage = null;
  return message;
}

/** Magic-link provider — delivery via Resend API only (no SMTP). */
export function resendEmailProvider(): EmailConfig {
  return {
    id: "email",
    type: "email",
    name: "Email",
    from: getEmailFrom(),
    maxAge: 24 * 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      lastSendFailureMessage = null;
      const result = await sendMagicLinkEmail(identifier, url);
      if (!result.ok) {
        lastSendFailureMessage = result.reason;
        console.error(
          "Magic link email failed:",
          result.reason,
          result.detail ?? "",
        );
        throw new Error(result.reason);
      }
    },
  };
}
