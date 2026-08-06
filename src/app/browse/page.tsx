import { auth } from "@/auth";
import { BrowseExperience } from "@/components/BrowseExperience";
import { ReturningFactsUpgrade } from "@/components/ReturningFactsUpgrade";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ stay?: string }>;
}) {
  const session = await auth();
  const { stay } = await searchParams;
  return (
    <div className="shell browse-shell">
      {stay === "1" ? null : <ReturningFactsUpgrade />}
      <BrowseExperience signedIn={Boolean(session?.user?.id)} />
    </div>
  );
}
