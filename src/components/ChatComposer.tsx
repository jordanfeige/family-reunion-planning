"use client";

import { useEffect, useRef, useState } from "react";

import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { focusBlockingField } from "@/lib/formFocus";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
  /** Hard block (no AI key, quota) — button disabled with adjacent explanation. */
  blockedReason?: string | null;
  /** Optional faint quota text in the composer footer (e.g. ≤5 messages left). */
  quotaLabel?: string | null;
  /** Scroll the messages pane — never the window. */
  onFocusMessagesScroll?: () => void;
}) {
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const hardBlocked = Boolean(blockedReason);
  const sendDisabled = busy || hardBlocked;

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
      // Keep composer pinned under the soft keyboard within the flex column.
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

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

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

  function toggleMic() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setEmptyHint("Voice input isn’t available in this browser.");
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript?.trim();
      if (spoken) {
        const next = value.trim() ? `${value.trim()} ${spoken}` : spoken;
        onChange(next);
        setEmptyHint(null);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <form
      ref={formRef}
      className={`chat-composer${compact ? " chat-composer--compact" : ""} chat-composer--mobile-spec`}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="refine-row chat-composer-row">
        <div className="field chat-composer-field">
          <label htmlFor={id} className="sr-only">
            Message
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            className="itinerary-block-notes chat-composer-input"
            rows={1}
            placeholder={placeholder}
            value={value}
            disabled={busy || hardBlocked}
            onChange={(e) => {
              setEmptyHint(null);
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
        </div>
        <button
          type="button"
          className={`chat-composer-mic${listening ? " is-listening" : ""}`}
          aria-label={listening ? "Stop listening" : "Dictate message"}
          aria-pressed={listening}
          disabled={busy || hardBlocked}
          onClick={toggleMic}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path
              d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          type="submit"
          className="chat-composer-send"
          aria-label={busy ? "Sending" : "Send"}
          disabled={sendDisabled}
        >
          {busy ? (
            <span className="chat-composer-send-busy" aria-hidden>
              …
            </span>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M12 19V5M5 12l7-7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <button
          type="submit"
          className="btn btn-primary chat-composer-send-labeled"
          disabled={sendDisabled}
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
      <div className="chat-composer-footer">
        <CtaRequirementHint>{blockedReason ?? emptyHint}</CtaRequirementHint>
        {quotaLabel ? (
          <p className="chat-composer-quota" aria-live="polite">
            {quotaLabel}
          </p>
        ) : null}
      </div>
    </form>
  );
}
