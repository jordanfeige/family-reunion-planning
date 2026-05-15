"use client";

export function ChatComposer({
  id,
  placeholder,
  value,
  busy,
  onChange,
  onSubmit,
}: {
  id: string;
  placeholder: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
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
            style={{ minHeight: "72px" }}
            placeholder={placeholder}
            value={value}
            disabled={busy}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSubmit();
              }
            }}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block-sm" disabled={busy}>
          {busy ? "Thinking…" : "Send"}
        </button>
      </div>
    </form>
  );
}
