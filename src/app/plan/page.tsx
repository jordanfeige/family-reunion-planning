import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PlanExperience } from "@/components/PlanExperience";
import { hasAnthropicApiKey } from "@/lib/ai";
import {
  getPlanDraftBySecret,
  readPlanDraftCookieSecret,
} from "@/lib/supabase/planDrafts";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const { error } = await searchParams;

  const secret = await readPlanDraftCookieSecret();
  const draft = secret ? await getPlanDraftBySecret(secret) : null;

  // Signed-in users with no draft plan via dashboard create.
  if (session?.user?.id && !draft) {
    redirect("/dashboard");
  }

  // Cookie must be set in a Route Handler, not a Server Component.
  if (!draft) {
    const qs = error ? `?error=${encodeURIComponent(error)}` : "";
    redirect(`/api/plan/start${qs}`);
  }

  return (
    <div className="shell plan-shell">
      <PlanExperience
        initialPayload={draft.payload}
        initialMessageCount={draft.messageCount}
        aiEnabled={hasAnthropicApiKey()}
        errorCode={error}
      />
    </div>
  );
}
