import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PlanExperience } from "@/components/PlanExperience";
import { hasAnthropicApiKey } from "@/lib/ai";
import {
  getPlanDraftBySecret,
  readPlanDraftCookieSecret,
} from "@/lib/supabase/planDrafts";
import { listTripsForUser } from "@/lib/supabase/queries";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const { error } = await searchParams;

  const secret = await readPlanDraftCookieSecret();
  const draft = secret ? await getPlanDraftBySecret(secret) : null;

  // Cookie must be set in a Route Handler, not a Server Component.
  if (!draft) {
    const qs = error ? `?error=${encodeURIComponent(error)}` : "";
    redirect(`/api/plan/start${qs}`);
  }

  let activeTrip: { name: string; href: string } | null = null;
  if (session?.user?.id) {
    try {
      const trips = await listTripsForUser(session.user.id);
      const first = trips[0];
      if (first) {
        activeTrip = { name: first.name, href: `/t/${first.slug}` };
      }
    } catch {
      activeTrip = null;
    }
  }

  return (
    <div className="shell plan-shell">
      <PlanExperience
        initialPayload={draft.payload}
        initialMessageCount={draft.messageCount}
        aiEnabled={hasAnthropicApiKey()}
        errorCode={error}
        signedIn={Boolean(session?.user?.id)}
        activeTrip={activeTrip}
      />
    </div>
  );
}
