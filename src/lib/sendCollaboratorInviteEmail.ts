import { APP_NAME } from "@/lib/brand";

const emailFrom = process.env.EMAIL_FROM ?? "WandrAI <onboarding@resend.dev>";

export async function sendCollaboratorInviteEmail(
  to: string,
  input: { tripName: string; inviterName: string | null; loginUrl: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const inviter = input.inviterName?.trim() || "A trip organizer";
  const subject = `You're invited to plan ${input.tripName}`;
  const text = `${inviter} invited you to co-plan "${input.tripName}" on ${APP_NAME}.

Sign in with this email to open the trip hub:
${input.loginUrl}

If you don't have an account yet, use the magic link on that page—same email address.`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px"><div style="max-width:480px;margin:0 auto"><h1 style="color:#1c3d5a">Trip planning invite</h1><p>${inviter} invited you to co-plan <strong>${escapeHtml(input.tripName)}</strong>.</p><p><a href="${escapeHtml(input.loginUrl)}" style="color:#d45a3a">Open trip hub →</a></p><p style="color:#3d4f63;font-size:14px">Sign in with <strong>${escapeHtml(to)}</strong>. ${APP_NAME} uses a magic link—no password.</p></div></body></html>`;

  if (!apiKey) {
    console.log(
      `\n━━━ ${APP_NAME} · collaborator invite (no RESEND_API_KEY) ━━━\nTo: ${to}\n${text}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    );
    return { ok: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: emailFrom, to: [to], subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend collaborator invite failed:", res.status, body);
    return { ok: false, reason: "Could not send invite email right now." };
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
