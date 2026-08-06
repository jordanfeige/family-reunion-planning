import { anthropic } from "@ai-sdk/anthropic";

export const PLANNER_MODEL_ID = "claude-sonnet-4-5";
export const EXTRACTOR_MODEL_ID = "claude-haiku-4-5";

export function plannerModel() {
  return anthropic(PLANNER_MODEL_ID);
}

/** Cheap model for structured draft extraction only (no prose). */
export function extractorModel() {
  return anthropic(EXTRACTOR_MODEL_ID);
}

export function hasAnthropicApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
