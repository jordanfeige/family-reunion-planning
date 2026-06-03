"use client";

import { useState, useTransition } from "react";

import { clearChatThreadAction } from "@/app/actions/trips";
import type { ChatThreadMode } from "@/lib/supabase/chatHistory";

export function ChatClearButton({
  slug,
  mode,
  focusDay,
  onCleared,
  disabled,
}: {
  slug: string;
  mode: ChatThreadMode;
  focusDay?: string | null;
  onCleared: () => void;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="chat-clear-wrap">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={disabled || pending}
        onClick={() => {
          if (
            !window.confirm(
              "Clear this chat? The conversation will be removed from the server.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              await clearChatThreadAction(slug, mode, focusDay ?? null);
              onCleared();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not clear chat.");
            }
          });
        }}
      >
        {pending ? "Clearing…" : "Clear chat"}
      </button>
      {error ? (
        <span className="muted" style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
