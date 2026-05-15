import { put } from "@vercel/blob";

import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("BLOB_READ_WRITE_TOKEN is not set", { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return new Response("Missing file", { status: 400 });
  }

  const blob = await put(file.name, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return Response.json({ url: blob.url });
}
