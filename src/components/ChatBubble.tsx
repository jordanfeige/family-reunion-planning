"use client";

import type { UIMessage } from "ai";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import { textFromMessage } from "@/lib/chatMessage";

export function ChatBubble({
  message,
  streaming,
}: {
  message: UIMessage;
  streaming?: boolean;
}) {
  const text = textFromMessage(message);
  if (!text && !streaming) return null;
  if (text.startsWith("⟦advance:")) return null;

  const isDivider =
    message.id.startsWith("divider-") ||
    /^—— .+ ——$/.test(text.trim());

  if (isDivider) {
    return (
      <div className="chat-step-divider" role="separator">
        <span>{text.replace(/^——\s*|\s*——$/g, "").trim() || text}</span>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={`chat-row chat-row--${message.role}`}>
      {!isUser ? (
        <span className="chat-avatar" aria-hidden>
          W
        </span>
      ) : null}
      <div className={`chat-bubble chat-bubble--${message.role}`}>
        {isUser ? (
          <p className="chat-bubble-text">{text}</p>
        ) : (
          <>
            {text ? <ChatMarkdown text={text} /> : null}
            {streaming ? (
              <p className="chat-bubble-thinking" aria-live="polite">
                <span className="chat-typing-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                Thinking…
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
