import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { claimPlanDraftForUser } from "@/app/actions/planDraft";

export const runtime = "nodejs";

/** Claim cookie draft after Google — cookie writes belong in a Route Handler. */
export async function GET(request: Request) {
  const session = await auth();
  const origin = new URL(request.url).origin;

  if (!session?.user?.id) {
    const login = new URL("/login", origin);
    login.searchParams.set("intent", "signup");
    login.searchParams.set("callbackUrl", "/api/plan/claim");
    return NextResponse.redirect(login);
  }

  const result = await claimPlanDraftForUser();

  if ("slug" in result) {
    const send = new URL(request.url).searchParams.get("send");
    const dest = new URL(`/t/${result.slug}`, origin);
    dest.searchParams.set("stop", "survey");
    if (send === "1") dest.searchParams.set("send", "1");
    return NextResponse.redirect(dest);
  }

  if (result.error === "no_draft") {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  if (result.error === "expired") {
    return NextResponse.redirect(new URL("/plan?error=expired", origin));
  }

  if (result.error === "needs_name") {
    return NextResponse.redirect(new URL("/plan?error=needs_name", origin));
  }

  return NextResponse.redirect(new URL("/plan?error=claim_failed", origin));
}
