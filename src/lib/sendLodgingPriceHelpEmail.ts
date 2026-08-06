import { APP_NAME } from "@/lib/brand";

const emailFrom = process.env.EMAIL_FROM ?? "WandrAI <onboarding@resend.dev>";

export async function sendLodgingPriceHelpEmail(
  to: string,
  input: {
    tripName: string;
    placeName: string;
    organizerName: string;
    priceUrl: string;
    rentalNames: string[];
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const organizer = input.organizerName.trim() || "Your organizer";
  const list =
    input.rentalNames.length > 0
      ? input.rentalNames.map((n) => `• ${n}`).join("\n")
      : "• (open the link for the full list)";
  const subject = `Help price lodging for ${input.tripName}`;
  const text = `${organizer} asked for help pricing rentals in ${input.placeName} for "${input.tripName}" on ${APP_NAME}.

Paste a nightly rate for any of these — no account needed:
${list}

Open the list and enter rates:
${input.priceUrl}

Paste the rate and we'll split it among the households.`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px"><div style="max-width:480px;margin:0 auto"><h1 style="color:#16202b;font-size:22px">Help price these rentals</h1><p>${escapeHtml(organizer)} asked for help with lodging in <strong>${escapeHtml(input.placeName)}</strong> for <strong>${escapeHtml(input.tripName)}</strong>.</p><p>Paste a nightly rate — no account needed. We'll split it among the households.</p><ul style="padding-left:1.2rem;color:#3a4550">${input.rentalNames
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join("")}</ul><p><a href="${escapeHtml(input.priceUrl)}" style="color:#8c1f43">Open rentals and add rates →</a></p></div></body></html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `\n━━━ ${APP_NAME} · lodging price help (no RESEND_API_KEY) ━━━\nTo: ${to}\n${text}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
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
    console.error("Resend lodging price help failed:", res.status, body);
    return { ok: false, reason: "Could not send email right now." };
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
