import { fetchLinkPreview } from "@/lib/linkPreview";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url")?.trim();
  if (!url) {
    return Response.json({ error: "Missing url parameter." }, { status: 400 });
  }

  try {
    const preview = await fetchLinkPreview(url);
    return Response.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load preview.";
    return Response.json({ error: message }, { status: 400 });
  }
}
