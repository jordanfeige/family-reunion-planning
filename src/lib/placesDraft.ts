import { z } from "zod";

export const placesDraftItemSchema = z.object({
  title: z.string().min(1).describe('Place name as "Place, ST" (e.g. "Lake Okoboji, IA")'),
  summary: z
    .string()
    .optional()
    .describe("Short why — region vibe, drive/flight fit, season note"),
  state: z.string().length(2).optional().describe("Two-letter US state code"),
  driveMinutesFromOrigin: z
    .number()
    .int()
    .optional()
    .describe("Drive time in minutes from originMetro (not per-household)"),
  originMetro: z
    .string()
    .optional()
    .describe('Metro the drive time is from (e.g. "Sioux Falls, SD")'),
  nearestAirportCode: z
    .string()
    .length(3)
    .optional()
    .describe("Nearest commercial airport IATA code"),
  avgHighF: z
    .number()
    .int()
    .optional()
    .describe("Typical high temperature in °F for the reunion season"),
  crowdLevel: z
    .enum(["quiet", "moderate", "busy"])
    .optional()
    .describe("Typical crowd level for the season"),
  typicalLodgingUsd: z
    .number()
    .int()
    .optional()
    .describe("Typical lodging USD per household for the weekend — estimate only"),
  selected: z.boolean().optional(),
});

export const placesDraftSchema = z.object({
  places: z
    .array(placesDraftItemSchema)
    .min(1)
    .max(8)
    .describe(
      "Destination options for the family survey. Fill US meta fields when known: state, driveMinutesFromOrigin, originMetro, nearestAirportCode, avgHighF, crowdLevel, typicalLodgingUsd.",
    ),
});

export type PlacesDraftItem = {
  title: string;
  summary?: string;
  state?: string;
  driveMinutesFromOrigin?: number;
  originMetro?: string;
  nearestAirportCode?: string;
  avgHighF?: number;
  crowdLevel?: "quiet" | "moderate" | "busy";
  typicalLodgingUsd?: number;
  selected?: boolean;
};

export type PlacesDraft = {
  places: PlacesDraftItem[];
};

export function normalizePlacesDraft(input: z.infer<typeof placesDraftSchema>): PlacesDraft {
  const seen = new Set<string>();
  const places: PlacesDraftItem[] = [];
  for (const p of input.places) {
    const title = p.title.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      title,
      summary: p.summary?.trim() || undefined,
      state: p.state,
      driveMinutesFromOrigin: p.driveMinutesFromOrigin,
      originMetro: p.originMetro?.trim() || undefined,
      nearestAirportCode: p.nearestAirportCode,
      avgHighF: p.avgHighF,
      crowdLevel: p.crowdLevel,
      typicalLodgingUsd: p.typicalLodgingUsd,
      selected: true,
    });
    if (places.length >= 8) break;
  }
  return { places };
}
