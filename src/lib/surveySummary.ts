import { findLocationById, formatLocationLabel, type LocationOption } from "@/lib/locations";
import { formatSurveyNextStepsText, type SurveyNextStep } from "@/lib/surveyNextSteps";
import { formatWeekendLabel } from "@/lib/weekends";

export type SurveySummaryInput = {
  tripName: string;
  respondentName: string;
  adultCount: number;
  kidCount: number;
  notes: string | null;
  selectedSlots: string[];
  selectedLocations: string[];
  locationOptions: LocationOption[];
  nextSteps?: SurveyNextStep[];
  planUrl?: string | null;
};

export function buildSurveySummaryText(input: SurveySummaryInput): string {
  const lines: string[] = [
    `Trip: ${input.tripName}`,
    `Name: ${input.respondentName}`,
    `Party: ${input.adultCount} adult${input.adultCount === 1 ? "" : "s"}, ${input.kidCount} kid${input.kidCount === 1 ? "" : "s"}`,
  ];

  if (input.selectedLocations.length > 0) {
    lines.push(
      `Locations: ${input.selectedLocations
        .map((id) => findLocationById(input.locationOptions, id))
        .filter(Boolean)
        .map((l) => formatLocationLabel(l!))
        .join("; ")}`,
    );
  }

  if (input.selectedSlots.length > 0) {
    lines.push(
      `Weekends: ${input.selectedSlots.map((s) => formatWeekendLabel(s)).join("; ")}`,
    );
  }

  if (input.notes?.trim()) {
    lines.push(`Notes: ${input.notes.trim()}`);
  }

  if (input.nextSteps?.length) {
    lines.push("", "What happens next:", formatSurveyNextStepsText(input.nextSteps));
    if (input.planUrl) {
      lines.push("", `Trip plan: ${input.planUrl}`);
    }
  }

  return lines.join("\n");
}

export function buildSurveySummaryHtml(input: SurveySummaryInput): string {
  const locationLabels = input.selectedLocations
    .map((id) => findLocationById(input.locationOptions, id))
    .filter(Boolean)
    .map((l) => formatLocationLabel(l!));

  const weekendLabels = input.selectedSlots.map((s) => formatWeekendLabel(s));

  const rows: [string, string][] = [
    ["Trip", input.tripName],
    ["Name", input.respondentName],
    [
      "Party",
      `${input.adultCount} adult${input.adultCount === 1 ? "" : "s"}, ${input.kidCount} kid${input.kidCount === 1 ? "" : "s"}`,
    ],
  ];

  if (locationLabels.length > 0) {
    rows.push(["Locations", locationLabels.join("<br>")]);
  }
  if (weekendLabels.length > 0) {
    rows.push(["Weekends", weekendLabels.join("<br>")]);
  }
  if (input.notes?.trim()) {
    rows.push(["Notes", input.notes.trim().replace(/\n/g, "<br>")]);
  }

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#6f7a86;font-weight:600;vertical-align:top">${label}</td><td style="padding:8px 0;color:#16202b">${value}</td></tr>`,
    )
    .join("");

  const nextStepsHtml =
    input.nextSteps?.length ?
      `<h2 style="color:#16202b;font-size:16px;margin:24px 0 8px">What happens next</h2><ol style="margin:0;padding:0 0 0 1.1rem;color:#6f7a86;font-size:14px;line-height:1.5">${input.nextSteps
        .map(
          (s) =>
            `<li style="margin-bottom:10px"><strong style="color:#16202b">${escapeHtml(s.title)}</strong><br>${escapeHtml(s.description)}</li>`,
        )
        .join("")}</ol>${input.planUrl ? `<p style="margin:16px 0 0"><a href="${escapeHtml(input.planUrl)}" style="color:#8c1f43">View shared trip plan</a></p>` : ""}`
    : "";

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f7f6f3;padding:24px"><div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid rgba(22,32,43,0.10)"><h1 style="color:#16202b;font-size:20px;margin:0 0 8px">Your survey responses</h1><p style="color:#6f7a86;margin:0 0 20px;font-size:14px">Thanks for helping plan <strong>${escapeHtml(input.tripName)}</strong>. Here is what you submitted.</p><table style="width:100%;border-collapse:collapse;font-size:14px">${body}</table>${nextStepsHtml}<p style="color:#6f7a86;font-size:12px;margin:24px 0 0">Sent by WandrAI · More smiles. Less planning.</p></div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
