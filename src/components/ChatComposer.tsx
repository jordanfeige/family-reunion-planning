"use client";

import { useState } from "react";

import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { focusBlockingField } from "@/lib/formFocus";

export function ChatComposer({
  id,
  placeholder,
  value,
  busy,
  onChange,
  onSubmit,
  compact = false,
  blockedReason = null,
}: {
  id: string;
  placeholder: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  compact?: boolean;
  /** Hard block (no AI key, quota) — button disabled with adjacent explanation. */
  blockedReason?: string | null;
}) {
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const hardBlocked = Boolean(blockedReason);
  const sendDisabled = busy || hardBlocked;

  function handleSubmit() {
    if (sendDisabled) return;
    if (!value.trim()) {
      setEmptyHint("Type a message to continue.");
      focusBlockingField(`#${id}`);
      return;
    }
    setEmptyHint(null);
    void onSubmit();
  }

  return (
    <form
      className={`chat-composer${compact ? " chat-composer--compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="refine-row">
        <div className="field chat-composer-field">
          <label htmlFor={id} className="sr-only">
            Message
          </label>
          <textarea
            id={id}
            className="itinerary-block-notes chat-composer-input"
            style={compact ? { minHeight: "3rem" } : { minHeight: "72px" }}
            rows={compact ? 1 : undefined}
            placeholder={placeholder}
            value={value}
            disabled={busy || hardBlocked}
            onChange={(e) => {
              setEmptyHint(null);
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <button
          type="submit"
          className={`btn btn-primary${compact ? "" : " btn-block-sm"}`}
          disabled={sendDisabled}
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
      <CtaRequirementHint>{blockedReason ?? emptyHint}</CtaRequirementHint>
    </form>
  );
}
