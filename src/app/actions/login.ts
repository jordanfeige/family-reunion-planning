"use server";

import { signIn } from "@/auth";

/** Google OAuth — used for both Sign in and Sign up. */
export async function continueWithGoogleAction(formData: FormData) {
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard").trim() || "/dashboard";
  await signIn("google", { redirectTo: callbackUrl });
}
