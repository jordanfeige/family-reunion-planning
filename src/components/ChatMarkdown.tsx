import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${match.index}-a`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length > 0 ? nodes : [text];
}

function parseBlocks(source: string): ReactNode[] {
  const blocks = source.split(/\n{2,}/);
  const nodes: ReactNode[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]?.trim();
    if (!block) continue;

    const lines = block.split("\n");
    const first = lines[0] ?? "";

    if (/^###\s+/.test(first)) {
      nodes.push(
        <h4 key={`h4-${i}`} className="chat-md-h4">
          {renderInline(first.replace(/^###\s+/, ""))}
        </h4>,
      );
      const rest = lines.slice(1).join("\n").trim();
      if (rest) nodes.push(...parseBlocks(rest));
      continue;
    }

    if (/^##\s+/.test(first)) {
      nodes.push(
        <h3 key={`h3-${i}`} className="chat-md-h3">
          {renderInline(first.replace(/^##\s+/, ""))}
        </h3>,
      );
      const rest = lines.slice(1).join("\n").trim();
      if (rest) nodes.push(...parseBlocks(rest));
      continue;
    }

    if (lines.every((line) => /^[-*]\s+/.test(line.trim()))) {
      nodes.push(
        <ul key={`ul-${i}`} className="chat-md-list">
          {lines.map((line, j) => (
            <li key={`li-${i}-${j}`}>{renderInline(line.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>,
      );
      continue;
    }

    nodes.push(
      <p key={`p-${i}`} className="chat-md-p">
        {lines.map((line, j) => (
          <span key={`ln-${i}-${j}`}>
            {j > 0 ? <br /> : null}
            {renderInline(line)}
          </span>
        ))}
      </p>,
    );
  }

  return nodes;
}

export function ChatMarkdown({ text }: { text: string }) {
  if (!text.trim()) return null;
  return <div className="chat-markdown">{parseBlocks(text)}</div>;
}
