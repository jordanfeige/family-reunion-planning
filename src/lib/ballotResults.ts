import type { VenueOption } from "@/lib/venues";

export type BallotVoteRow = {
  optionId: string;
  vote: "up" | "down";
};

export type OptionVoteTally = {
  optionId: string;
  up: number;
  down: number;
  net: number;
};

export function tallyBallotVotes(votes: BallotVoteRow[]): Map<string, OptionVoteTally> {
  const map = new Map<string, OptionVoteTally>();

  for (const row of votes) {
    const current = map.get(row.optionId) ?? {
      optionId: row.optionId,
      up: 0,
      down: 0,
      net: 0,
    };
    if (row.vote === "up") current.up += 1;
    else current.down += 1;
    current.net = current.up - current.down;
    map.set(row.optionId, current);
  }

  return map;
}

export function sortOptionsByVotes(
  options: VenueOption[],
  tallies: Map<string, OptionVoteTally>,
): VenueOption[] {
  return [...options].sort((a, b) => {
    const netA = tallies.get(a.id)?.net ?? 0;
    const netB = tallies.get(b.id)?.net ?? 0;
    if (netB !== netA) return netB - netA;
    const upA = tallies.get(a.id)?.up ?? 0;
    const upB = tallies.get(b.id)?.up ?? 0;
    return upB - upA;
  });
}

export function countDistinctVoters(votes: { voterKey: string }[]): number {
  return new Set(votes.map((v) => v.voterKey)).size;
}
