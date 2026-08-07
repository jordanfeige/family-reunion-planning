import { NextResponse } from "next/server";

import { ensurePlanDraft } from "@/lib/supabase/planDrafts";

export const runtime = "nodejs";

/** Create anonymous plan draft + set cookie (cookie writes are not allowed in RSC). */
export async function GET(request: Request) {
  await ensurePlanDraft();

  const url = new URL(request.url);
  const dest = new URL("/plan", url.origin);
  const error = url.searchParams.get("error");
  if (error) dest.searchParams.set("error", error);
  const seed = url.searchParams.get("seed");
  if (seed) dest.searchParams.set("seed", seed);

  return NextResponse.redirect(dest);
}
