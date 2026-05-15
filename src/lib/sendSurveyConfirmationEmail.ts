import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  buildSurveySummaryHtml,
  buildSurveySummaryText,
  type SurveySummaryInput,
} from "@/lib/surveySummary";

const emailFrom = process.env.EMAIL_FROM ?? "WandrAI <onboarding@resend.dev>";

export async function sendSurveyConfirmationEmail(
  to: string,
  input: SurveySummaryInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `\n━━━ ${APP_NAME} · survey copy (no RESEND_API_KEY) ━━━\nTo: ${to}\n${buildSurveySummaryText(input)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    );
    return { ok: true };
  }

  const subject = `Your responses for ${input.tripName}`;
  const html = buildSurveySummaryHtml(input);
  const text = buildSurveySummaryText(input);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend survey email failed:", res.status, body);
    return { ok: false, reason: "Could not send email right now." };
  }

  return { ok: true };
}
