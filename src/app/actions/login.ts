"use server";

import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { takeLastMagicLinkSendError } from "@/lib/auth/resendEmailProvider";
import { assertResendConfiguredForProduction } from "@/lib/emailConfig";
import { messageForAuthErrorCode } from "@/lib/loginErrors";

const EMAIL_PROVIDER_ID = "email";

function loginErrorRedirect(callbackUrl: string, message: string): never {
  const params = new URLSearchParams({
    error: message,
    callbackUrl,
  });
  redirect(`/login?${params.toString()}`);
}

function authResultUrlHasError(resultUrl: string): boolean {
  try {
    const url = new URL(resultUrl, "http://local");
    return url.searchParams.has("error");
  } catch {
    return resultUrl.includes("error=");
  }
}

function messageFromAuthResultUrl(resultUrl: string): string {
  try {
    const url = new URL(resultUrl, "http://local");
    const code = url.searchParams.get("error");
    const sendError = takeLastMagicLinkSendError();
    if (sendError) return sendError;
    return messageForAuthErrorCode(code);
  } catch {
    return takeLastMagicLinkSendError() ?? messageForAuthErrorCode("Configuration");
  }
}

export async function loginWithMagicLinkAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Please enter your email.");
  }

  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    assertResendConfiguredForProduction();
  } catch (err) {
    loginErrorRedirect(
      callbackUrl,
      err instanceof Error ? err.message : "Email is not configured.",
    );
  }

  let resultUrl: string;
  try {
    resultUrl = await signIn(EMAIL_PROVIDER_ID, {
      email,
      redirectTo: callbackUrl,
      redirect: false,
    });
  } catch (err) {
    const sendError = takeLastMagicLinkSendError();
    if (sendError) {
      loginErrorRedirect(callbackUrl, sendError);
    }
    if (err instanceof Error) {
      loginErrorRedirect(callbackUrl, err.message);
    }
    loginErrorRedirect(callbackUrl, "Could not send a sign-in email. Please try again.");
  }

  if (authResultUrlHasError(resultUrl)) {
    loginErrorRedirect(callbackUrl, messageFromAuthResultUrl(resultUrl));
  }

  redirect(resultUrl);
}
