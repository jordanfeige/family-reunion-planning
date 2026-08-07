import { auth } from "@/auth";
import { PlanDraftBootstrap } from "@/components/PlanDraftBootstrap";
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
  searchParams: Promise<{ error?: string; seed?: string }>;
}) {
  const session = await auth();
  const { error, seed } = await searchParams;

  const secret = await readPlanDraftCookieSecret();
  let draft = null;
  if (secret) {
    try {
      draft = await getPlanDraftBySecret(secret);
    } catch {
      draft = null;
    }
  }

  // Cookie must be set in a Route Handler, not a Server Component.
  // Do not redirect() to /api/plan/start from RSC — soft navigation 500s.
  if (!draft) {
    return <PlanDraftBootstrap error={error} />;
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
        seedMessage={seed?.trim() || null}
      />
    </div>
  );
}
