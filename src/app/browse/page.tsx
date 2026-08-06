import { auth } from "@/auth";
import { BrowseExperience } from "@/components/BrowseExperience";

export default async function BrowsePage() {
  const session = await auth();
  return (
    <div className="shell browse-shell">
      <BrowseExperience signedIn={Boolean(session?.user?.id)} />
    </div>
  );
}
