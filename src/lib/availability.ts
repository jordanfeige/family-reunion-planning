import { formatLocationLabel, type LocationOption } from "@/lib/locations";
import { partyTotal, type PartyCountRow } from "@/lib/partyCount";
import {
  filterValidFridays,
  formatWeekendLabel,
} from "@/lib/weekends";

export type SurveyResponseRow = PartyCountRow & {
  respondentName: string;
  selectedSlots: string[] | null;
  selectedLocations?: string[] | null;
};

export type WeekendAvailability = {
  fridayIso: string;
  label: string;
  households: number;
  totalAttendees: number;
  respondents: { name: string; count: number }[];
};

export function aggregateWeekendAvailability(
  proposedSlots: string[],
  responses: SurveyResponseRow[],
): WeekendAvailability[] {
  const slots = filterValidFridays(proposedSlots);
  return slots.map((fridayIso) => {
    const matching = responses.filter((r) =>
      (r.selectedSlots ?? []).includes(fridayIso),
    );
    return {
      fridayIso,
      label: formatWeekendLabel(fridayIso),
      households: matching.length,
      totalAttendees: matching.reduce((sum, r) => sum + partyTotal(r), 0),
      respondents: matching.map((r) => ({
        name: r.respondentName,
        count: partyTotal(r),
      })),
    };
  });
}

export function getBestOverlapWeekends(
  availability: WeekendAvailability[],
): WeekendAvailability[] {
  if (availability.length === 0) return [];
  const withRsvp = availability.filter((a) => a.households > 0);
  if (withRsvp.length === 0) return [];
  const max = Math.max(...withRsvp.map((a) => a.totalAttendees));
  return withRsvp.filter((a) => a.totalAttendees === max);
}

export function formatAvailabilitySummary(
  proposedSlots: string[],
  responses: SurveyResponseRow[],
): string {
  const agg = aggregateWeekendAvailability(proposedSlots, responses);
  if (agg.length === 0) {
    return "No Fri–Sun weekends configured yet. Ask the organizer to add candidate weekends.";
  }

  const lines: string[] = [];
  if (responses.length === 0) {
    lines.push("No survey responses received yet.");
  }

  const withRsvp = agg.filter((a) => a.households > 0);
  const without = agg.filter((a) => a.households === 0);

  for (const a of withRsvp) {
    const names = a.respondents.map((r) => `${r.name} (${r.count})`).join(", ");
    lines.push(
      `${a.label}: ${a.households} household(s), ${a.totalAttendees} people — ${names}`,
    );
  }

  if (without.length > 0) {
    lines.push(`No RSVPs yet for: ${without.map((a) => a.label).join("; ")}`);
  }

  const best = getBestOverlapWeekends(agg);
  if (best.length > 0) {
    const bestLabels = best.map((b) => b.label).join("; ");
    const top = best[0]!;
    lines.push(
      `Strongest overlap: ${bestLabels} with ${top.totalAttendees} people from ${top.households} household(s).`,
    );
  }

  return lines.join("\n");
}

export function formatLocationPreferenceSummary(
  locations: LocationOption[],
  responses: SurveyResponseRow[],
): string {
  if (locations.length === 0) {
    return "No location options on the survey yet.";
  }

  const lines: string[] = [];
  for (const loc of locations) {
    const matching = responses.filter((r) =>
      (r.selectedLocations ?? []).includes(loc.id),
    );
    if (matching.length === 0) {
      lines.push(`${loc.title}: no votes yet`);
      continue;
    }
    const names = matching
      .map((r) => `${r.respondentName} (${partyTotal(r)})`)
      .join(", ");
    const total = matching.reduce((s, r) => s + partyTotal(r), 0);
    lines.push(
      `${formatLocationLabel(loc)}: ${matching.length} household(s), ${total} people — ${names}`,
    );
  }

  return lines.join("\n");
}

export type LocationAvailability = {
  locationId: string;
  title: string;
  households: number;
  totalAttendees: number;
};

export function aggregateLocationAvailability(
  locations: LocationOption[],
  responses: SurveyResponseRow[],
): LocationAvailability[] {
  return locations.map((loc) => {
    const matching = responses.filter((r) =>
      (r.selectedLocations ?? []).includes(loc.id),
    );
    return {
      locationId: loc.id,
      title: loc.title,
      households: matching.length,
      totalAttendees: matching.reduce((s, r) => s + partyTotal(r), 0),
    };
  });
}

export function headcountForWeekend(
  fridayIso: string,
  proposedSlots: string[],
  responses: SurveyResponseRow[],
): number {
  const agg = aggregateWeekendAvailability(proposedSlots, responses);
  const row = agg.find((a) => a.fridayIso === fridayIso);
  return row?.totalAttendees ?? 0;
}
