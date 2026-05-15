/** Survey or confirmation row with adult/kid (or legacy attendee) counts. */
export type PartyCountRow = {
  adultCount?: number | null;
  kidCount?: number | null;
  attendeeCount?: number | null;
};

export function partyAdults(row: PartyCountRow): number {
  if (row.adultCount != null && row.adultCount >= 0) return row.adultCount;
  return Math.max(1, row.attendeeCount ?? 1);
}

export function partyKids(row: PartyCountRow): number {
  return Math.max(0, row.kidCount ?? 0);
}

export function partyTotal(row: PartyCountRow): number {
  if (row.adultCount != null || row.kidCount != null) {
    return partyAdults(row) + partyKids(row);
  }
  return row.attendeeCount ?? 1;
}
