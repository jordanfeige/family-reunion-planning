import { redirect } from "next/navigation";

/** Claim runs in /api/plan/claim so the draft cookie can be cleared. */
export default function PlanClaimPage() {
  redirect("/api/plan/claim");
}
