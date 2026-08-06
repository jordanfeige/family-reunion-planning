import { generateObject } from "ai";

import { extractorModel } from "@/lib/ai";
import {
  mergePlanTripDraft,
  normalizePlanTripDraft,
  planTripDraftSchema,
  type PlanTripDraft,
} from "@/lib/planTripDraft";

const EXTRACTOR_SYSTEM = `You extract structured trip-planning facts into JSON. Output ONLY fields clearly supported by the new message (and prior draft when reinforcing). Do not invent. Do not write prose. Leave unknown fields omitted. Use US units: miles, USD, Fahrenheit, MM/DD/YYYY. originMetro like "Sioux Falls, SD". dateWindow as a short US date range string. vibe and mustHaves are short phrase arrays. shortlist titles as "Place, ST". Append any question texts the user already answered into answeredQuestions. Append rejected destination names into rejectedIdeas.`;

/**
 * Cheap second call: prior draft + new message → updated PlanTripDraft.
 * Never emits conversational prose.
 */
export async function extractPlanTripDraft(opts: {
  prior: PlanTripDraft;
  message: string;
  role: "user" | "assistant";
}): Promise<PlanTripDraft> {
  const text = opts.message.trim();
  if (!text) return normalizePlanTripDraft(opts.prior);

  const { object } = await generateObject({
    model: extractorModel(),
    schema: planTripDraftSchema,
    system: EXTRACTOR_SYSTEM,
    prompt: `Prior draft JSON:\n${JSON.stringify(opts.prior)}\n\nNew ${opts.role} message:\n${text}\n\nReturn the patch of fields to merge (omit unknowns).`,
  });

  return mergePlanTripDraft(opts.prior, object);
}
