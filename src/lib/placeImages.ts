/** Scenic stills for destination shortlist cards (US-focused prompts). */

export function placeStillUrl(title: string, summary?: string): string {
  const place = [title, summary].filter(Boolean).join(", ");
  const prompt = [
    "Photorealistic travel photography,",
    place,
    "United States,",
    "scenic landscape, natural light, no text, no watermark, wide shot",
  ].join(" ");
  const params = new URLSearchParams({
    width: "640",
    height: "400",
    nologo: "true",
    enhance: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

/** Prefer a short region line under the place name (mock layout). */
export function placeRegionLine(summary?: string): string | undefined {
  if (!summary) return undefined;
  const first = summary.split(/[.—|]/)[0]?.trim();
  if (!first || first.length > 48) return summary.slice(0, 48);
  return first;
}
