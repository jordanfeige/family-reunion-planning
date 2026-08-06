/** Canonical lodging amenity vocabulary (R6 / R9). Unmapped provider strings are dropped. */

export const LODGING_AMENITY_VOCAB = [
  "single-level",
  "no-stairs",
  "elevator",
  "full-kitchen",
  "no-kitchen",
  "ac",
  "no-ac",
  "laundry",
  "waterfront",
  "private-beach",
  "dock",
  "pool",
  "fenced-yard",
  "pet-friendly",
  "two-night-minimum",
] as const;

export type LodgingAmenityCode = (typeof LODGING_AMENITY_VOCAB)[number];

const LABEL: Record<LodgingAmenityCode, string> = {
  "single-level": "Single-level layout",
  "no-stairs": "No stairs",
  elevator: "Elevator",
  "full-kitchen": "Full kitchen",
  "no-kitchen": "No shared kitchen",
  ac: "Air conditioning",
  "no-ac": "No AC",
  laundry: "Laundry on site",
  waterfront: "Water access",
  "private-beach": "Private beach",
  dock: "Dock",
  pool: "Pool",
  "fenced-yard": "Fenced yard",
  "pet-friendly": "Pet-friendly",
  "two-night-minimum": "Two-night minimum",
};

const CAUTION_CODES = new Set<LodgingAmenityCode>([
  "no-kitchen",
  "no-ac",
  "two-night-minimum",
]);

const ALIASES: { re: RegExp; code: LodgingAmenityCode }[] = [
  { re: /\bsingle[- ]?level|one[- ]?story|ranch\b/i, code: "single-level" },
  { re: /\bno[- ]?stairs|ground[- ]?floor|step[- ]?free\b/i, code: "no-stairs" },
  { re: /\belevator|lift\b/i, code: "elevator" },
  { re: /\bfull[- ]?kitchen|kitchenette|kitchen\b/i, code: "full-kitchen" },
  { re: /\bno[- ]?kitchen|without kitchen\b/i, code: "no-kitchen" },
  { re: /\bair[- ]?conditioning|\ba\.?c\.?\b|climate control\b/i, code: "ac" },
  { re: /\bno[- ]?a\.?c|without a\.?c|no air conditioning\b/i, code: "no-ac" },
  { re: /\blaundry|washer|dryer\b/i, code: "laundry" },
  { re: /\bwaterfront|lakefront|lake access|on the water\b/i, code: "waterfront" },
  { re: /\bprivate[- ]?beach\b/i, code: "private-beach" },
  { re: /\bdock|pier|boat slip\b/i, code: "dock" },
  { re: /\bpool|swimming pool\b/i, code: "pool" },
  { re: /\bfenced[- ]?yard|fenced[- ]?garden\b/i, code: "fenced-yard" },
  { re: /\bpet[- ]?friendly|dogs? allowed|pets allowed\b/i, code: "pet-friendly" },
  { re: /\b2[- ]?night|two[- ]?night|minimum stay|min\.?\s*nights?\b/i, code: "two-night-minimum" },
];

export function amenityLabel(code: LodgingAmenityCode): string {
  return LABEL[code];
}

export function normalizeAmenityStrings(raw: string[]): LodgingAmenityCode[] {
  const out = new Set<LodgingAmenityCode>();
  for (const s of raw) {
    const text = String(s ?? "").trim();
    if (!text) continue;
    for (const { re, code } of ALIASES) {
      if (re.test(text)) out.add(code);
    }
  }
  // Contradictions: no-kitchen wins over full-kitchen; no-ac over ac
  if (out.has("no-kitchen")) out.delete("full-kitchen");
  if (out.has("no-ac")) out.delete("ac");
  return [...out];
}

export type AmenityRow = { kind: "pro" | "con"; label: string; code?: LodgingAmenityCode };

/** Build UI amenity rows; always at least one caution ("Nothing flagged" if none). */
export function amenityRowsFromCodes(
  codes: LodgingAmenityCode[],
  extraCautions: string[] = [],
): AmenityRow[] {
  const rows: AmenityRow[] = [];
  for (const code of codes) {
    rows.push({
      kind: CAUTION_CODES.has(code) ? "con" : "pro",
      label: amenityLabel(code),
      code,
    });
  }
  for (const c of extraCautions) {
    const label = c.trim();
    if (!label) continue;
    rows.push({ kind: "con", label });
  }
  if (!rows.some((r) => r.kind === "con")) {
    rows.push({ kind: "con", label: "Nothing flagged" });
  }
  return rows;
}
