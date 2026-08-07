"use client";

import { useEffect, useRef, useState } from "react";

import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { focusBlockingField } from "@/lib/formFocus";
import { useHoldToTalk } from "@/lib/useHoldToTalk";

/**
 * §2c / §3 Mobile composer — send never visually disabled; empty focuses textarea.
 * Mic hidden entirely when Web Speech is unavailable.
 */
export function ChatComposer({
  id,
  placeholder,
  value,
  busy,
  onChange,
  onSubmit,
  compact = false,
  blockedReason = null,
  quotaLabel = null,
  onFocusMessagesScroll,
}: {
  id: string;
  placeholder: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  compact?: boolean;
  /** Hard block (no AI key, quota) — explained inline; send still focuses when empty. */
  blockedReason?: string | null;
  /** Optional faint quota text in the composer footer (e.g. ≤5 messages left). */
  quotaLabel?: string | null;
  /** Scroll the messages pane — never the window. */
  onFocusMessagesScroll?: () => void;
}) {
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [interim, setInterim] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hardBlocked = Boolean(blockedReason);

  const voice = useHoldToTalk({
    value,
    onChange: (next, isInterim) => {
      onChange(next);
      setInterim(Boolean(isInterim));
      setEmptyHint(null);
    },
  });

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function onViewport() {
      const form = formRef.current;
      if (!form || !vv) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      form.style.setProperty("--composer-keyboard-inset", `${inset}px`);
      onFocusMessagesScroll?.();
    }

    vv.addEventListener("resize", onViewport);
    vv.addEventListener("scroll", onViewport);
    return () => {
      vv.removeEventListener("resize", onViewport);
      vv.removeEventListener("scroll", onViewport);
    };
  }, [onFocusMessagesScroll]);

  function handleSubmit() {
    if (busy) return;
    if (!value.trim()) {
      setEmptyHint(null);
      textareaRef.current?.focus();
      return;
    }
    if (hardBlocked) {
      setEmptyHint(blockedReason);
      focusBlockingField(`#${id}`);
      return;
    }
    setEmptyHint(null);
    void onSubmit();
  }

  return (
    <form
      ref={formRef}
      className={`chat-composer wa-composer-bar${compact ? " chat-composer--compact" : ""} chat-composer--mobile-spec`}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="wa-composer-row">
        <label htmlFor={id} className="sr-only">
          Message
        </label>
        <textarea
          ref={textareaRef}
          id={id}
          className="wa-composer-input"
          rows={1}
          placeholder={placeholder}
          value={value}
          style={interim ? { color: "var(--muted)" } : undefined}
          onChange={(e) => {
            setEmptyHint(null);
            setInterim(false);
            onChange(e.target.value);
          }}
          onFocus={() => {
            onFocusMessagesScroll?.();
            requestAnimationFrame(() => onFocusMessagesScroll?.());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        {voice.supported ? (
          <button
            type="button"
            className={`wa-composer-mic${voice.listening ? " is-listening" : ""}`}
            aria-label="Hold to speak"
            aria-pressed={voice.listening}
            onPointerDown={(e) => {
              e.preventDefault();
              voice.start();
            }}
            onPointerUp={() => voice.stop()}
            onPointerLeave={() => {
              if (voice.listening) voice.stop();
            }}
            onClick={() => voice.toggle()}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
                voice.toggle();
              }
            }}
          >
            {voice.listening ? (
              <span className="wa-voice-bars" aria-hidden>
                <span className="wa-voice-bar" />
                <span className="wa-voice-bar" />
                <span className="wa-voice-bar" />
              </span>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        ) : null}
        <button
          type="submit"
          className="wa-composer-send"
          aria-label={busy ? "Sending" : "Send"}
        >
          {busy ? "…" : "↑"}
        </button>
      </div>
      <div className="chat-composer-footer">
        <CtaRequirementHint>
          {blockedReason ?? emptyHint ?? voice.errorMessage}
        </CtaRequirementHint>
        {quotaLabel ? (
          <p className="chat-composer-quota" aria-live="polite">
            {quotaLabel}
          </p>
        ) : null}
      </div>
    </form>
  );
}
