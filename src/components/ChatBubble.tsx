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
  const isUser = message.role === "user";

  return (
    <div className={`chat-bubble chat-bubble--${message.role}`}>
      <div className="chat-bubble-label">{isUser ? "You" : "WandrAI"}</div>
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
  );
}
