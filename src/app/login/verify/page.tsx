import { redirect } from "next/navigation";

/** Magic-link verify screen — sign-in is Google-only now. */
export default function VerifyRequestPage() {
  redirect("/login");
}
