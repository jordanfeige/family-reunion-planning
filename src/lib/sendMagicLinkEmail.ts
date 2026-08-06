import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  getEmailFrom,
  isProduction,
  parseResendError,
} from "@/lib/emailConfig";

export type SendMagicLinkResult =
  | { ok: true }
  | { ok: false; reason: string; detail?: string };

export async function sendMagicLinkEmail(
  to: string,
  url: string,
): Promise<SendMagicLinkResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const subject = `Sign in to ${APP_NAME}`;
  const text = `Sign in to ${APP_NAME}\n\n${APP_TAGLINE}\n\nClick to sign in (expires soon):\n${url}\n\nIf you did not request this, you can ignore this email.`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f7f6f3;padding:24px"><div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid rgba(22,32,43,0.10)"><h1 style="color:#16202b;font-size:20px;margin:0 0 8px">Sign in to ${escapeHtml(APP_NAME)}</h1><p style="color:#6f7a86;margin:0 0 20px;font-size:14px">${escapeHtml(APP_TAGLINE)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#8c1f43;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p><p style="color:#6f7a86;font-size:12px;margin:24px 0 0">Or paste this link: ${escapeHtml(url)}</p><p style="color:#6f7a86;font-size:12px">This link expires soon. If you did not request it, ignore this email.</p></div></body></html>`;

  if (!apiKey) {
    if (isProduction()) {
      return {
        ok: false,
        reason:
          "RESEND_API_KEY is not set on the server. Add it in your hosting provider's environment variables.",
      };
    }
    console.log(
      `\n━━━ ${APP_NAME} · magic link (no RESEND_API_KEY) ━━━\nTo: ${to}\n${url}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    );
    return { ok: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend magic link failed:", res.status, body);
    return {
      ok: false,
      reason: parseResendError(res.status, body),
      detail: body,
    };
  }

  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
