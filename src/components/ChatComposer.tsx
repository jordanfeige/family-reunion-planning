"use client";

export function ChatComposer({
  id,
  placeholder,
  value,
  busy,
  onChange,
  onSubmit,
  compact = false,
}: {
  id: string;
  placeholder: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  compact?: boolean;
}) {
  return (
    <form
      className={`chat-composer${compact ? " chat-composer--compact" : ""}`}
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
            style={compact ? { minHeight: "2.75rem" } : { minHeight: "72px" }}
            rows={compact ? 1 : undefined}
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
        <button
          type="submit"
          className={`btn btn-primary${compact ? "" : " btn-block-sm"}`}
          disabled={busy}
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
