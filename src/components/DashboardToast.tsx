"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DashboardToast({ message }: { message: string | null }) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const url = new URL(window.location.href);
    if (url.searchParams.has("deleted")) {
      url.searchParams.delete("deleted");
      const next = `${url.pathname}${url.search}${url.hash}`;
      router.replace(next, { scroll: false });
    }
    const hide = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(hide);
  }, [message, router]);

  if (!visible || !message) return null;

  return (
    <div className="dashboard-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
