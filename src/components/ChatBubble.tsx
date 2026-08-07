"use client";

import type { UIMessage } from "ai";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import { Orb } from "@/components/Orb";
import { textFromMessage } from "@/lib/chatMessage";

export function ChatBubble({
  message,
  streaming,
  orbState = "idle",
}: {
  message: UIMessage;
  streaming?: boolean;
  orbState?: "idle" | "thinking" | "speaking";
}) {
  const text = textFromMessage(message);
  if (!text && !streaming) return null;
  if (text.startsWith("⟦advance:")) return null;

  const isDivider =
    message.id.startsWith("divider-") || /^—— .+ ——$/.test(text.trim());

  if (isDivider) {
    return (
      <div className="chat-step-divider" role="separator">
        <span>{text.replace(/^——\s*|\s*——$/g, "").trim() || text}</span>
      </div>
    );
  }

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="wa-bubble-user wa-msg-enter">
        <p style={{ margin: 0 }}>{text}</p>
      </div>
    );
  }

  return (
    <div className="wa-asst-row wa-msg-enter">
      <Orb state={streaming ? "speaking" : orbState} size="md" />
      <div className="wa-bubble-asst">
        {text ? <ChatMarkdown text={text} /> : null}
        {streaming ? <span className="wa-caret" aria-hidden /> : null}
      </div>
    </div>
  );
}
