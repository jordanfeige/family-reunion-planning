"use client";

import { useState } from "react";

export function ShareSendRail({
  defaultEmails = [],
  onSend,
}: {
  defaultEmails?: string[];
  onSend?: (payload: { emails: string[]; message: string }) => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>(defaultEmails);
  const [message, setMessage] = useState(
    "We locked the weekend plan—take a look and RSVP when you can.",
  );

  function addEmail(raw: string) {
    const next = raw
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (next.length === 0) return;
    setEmails((prev) => Array.from(new Set([...prev, ...next])));
    setEmailInput("");
  }

  return (
    <div className="share-send-rail">
      <h3 className="share-send-rail-title">Send it</h3>
      <div className="share-send-rail-chips">
        {emails.map((email) => (
          <span key={email} className="share-send-rail-chip">
            {email}
            <button
              type="button"
              className="share-send-rail-chip-remove"
              aria-label={`Remove ${email}`}
              onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="field" style={{ marginBottom: "0.65rem" }}>
        <label htmlFor="share-send-email" className="sr-only">
          Add email
        </label>
        <input
          id="share-send-email"
          type="email"
          placeholder="Add email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addEmail(emailInput);
            }
          }}
          onBlur={() => {
            if (emailInput.trim()) addEmail(emailInput);
          }}
        />
      </div>
      <div className="field" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="share-send-message">Message</label>
        <textarea
          id="share-send-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="share-send-rail-actions">
        <button
          type="button"
          className="btn btn-berry btn-block-sm"
          onClick={() => onSend?.({ emails, message })}
        >
          Send invites
        </button>
        <button type="button" className="btn btn-secondary btn-block-sm">
          Export PDF
        </button>
      </div>
    </div>
  );
}
