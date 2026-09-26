import React from "react";

function parseInline(text: string): React.ReactNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      nodes.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[3]}
        </strong>
      );
    } else if (match[4]) {
      nodes.push(
        <code
          key={match.index}
          className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground"
        >
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      nodes.push(
        <em key={match.index} className="italic">
          {match[5]}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function MarkdownText({ content }: { content: string }): React.JSX.Element {
  if (!content) return <span />;

  const blocks = content.trim().split(new RegExp("\n\n+"));

  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, idx) => {
        const lines = block.split(new RegExp("\n"));

        if (lines.every((l) => l.startsWith("> ") || l === ">")) {
          return (
            <blockquote
              key={idx}
              className="my-2 border-l-4 border-accent/50 pl-3 py-1 text-sm text-muted italic bg-surface/50 rounded-r-lg"
            >
              {lines.map((l, li) => (
                <p key={li}>{parseInline(l.replace(/^>\s?/, ""))}</p>
              ))}
            </blockquote>
          );
        }

        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={idx} className="list-disc space-y-1 pl-5 text-sm sm:text-base">
              {lines.map((l, li) => (
                <li key={li}>{parseInline(l.replace(/^\s*[-*]\s+/, ""))}</li >
              ))}
            </ul>
          );
        }

        if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
          return (
            <ol key={idx} className="list-decimal space-y-1 pl-5 text-sm sm:text-base">
              {lines.map((l, li) => (
                <li key={li}>{parseInline(l.replace(/^\s*\d+\.\s+/, ""))}</li >
              ))}
            </ol>
          );
        }

        if (block.startsWith("### ")) {
          return (
            <h4 key={idx} className="pt-1 font-semibold text-base text-foreground">
              {parseInline(block.replace(/^###\s+/, ""))}
            </h4>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h3 key={idx} className="pt-2 font-bold text-lg text-foreground">
              {parseInline(block.replace(/^##\s+/, ""))}
            </h3>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {parseInline(line)}
                {li < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
