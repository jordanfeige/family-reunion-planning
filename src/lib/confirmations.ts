import { partyAdults, partyKids, type PartyCountRow } from "@/lib/partyCount";

export type TripConfirmationRow = PartyCountRow & {
  id: string;
  respondentName: string;
  respondentEmail: string | null;
  status: "confirmed" | "declined";
  weekendFriday: string;
  locationId: string;
  submittedAt: Date | null;
};

export type ConfirmationTotals = {
  confirmedHouseholds: number;
  declinedHouseholds: number;
  pendingEstimate: number;
  totalAdults: number;
  totalKids: number;
  totalPeople: number;
  responses: TripConfirmationRow[];
};

export function filterConfirmationsForPlan(
  rows: TripConfirmationRow[],
  weekendFriday: string,
  locationId: string,
): TripConfirmationRow[] {
  return rows.filter(
    (r) => r.weekendFriday === weekendFriday && r.locationId === locationId,
  );
}

export function aggregateConfirmations(
  rows: TripConfirmationRow[],
): ConfirmationTotals {
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const declined = rows.filter((r) => r.status === "declined");

  const totalAdults = confirmed.reduce((s, r) => s + partyAdults(r), 0);
  const totalKids = confirmed.reduce((s, r) => s + partyKids(r), 0);

  return {
    confirmedHouseholds: confirmed.length,
    declinedHouseholds: declined.length,
    pendingEstimate: 0,
    totalAdults,
    totalKids,
    totalPeople: totalAdults + totalKids,
    responses: rows,
  };
}
