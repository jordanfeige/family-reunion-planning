"use server";

import { signIn } from "@/auth";

export async function loginWithMagicLinkAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Please enter your email.");
  }
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  const provider = process.env.RESEND_API_KEY ? "resend" : "nodemailer";
  await signIn(provider, { email, redirectTo: callbackUrl });
}
