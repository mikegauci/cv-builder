import type { ReactNode } from "react";

interface Props {
  text: string;
  className?: string;
}

function parseInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < line.length) {
    if (line.startsWith("**", index)) {
      const end = line.indexOf("**", index + 2);
      if (end !== -1) {
        const value = line.slice(index + 2, end);
        nodes.push(<strong key={`b-${key++}`}>{value}</strong>);
        index = end + 2;
        continue;
      }
    }

    if (line.startsWith("__", index)) {
      const end = line.indexOf("__", index + 2);
      if (end !== -1) {
        const value = line.slice(index + 2, end);
        nodes.push(
          <u key={`u-${key++}`}>
            {value}
          </u>
        );
        index = end + 2;
        continue;
      }
    }

    if (line.startsWith("*", index)) {
      const end = line.indexOf("*", index + 1);
      if (end !== -1) {
        const value = line.slice(index + 1, end);
        nodes.push(<em key={`i-${key++}`}>{value}</em>);
        index = end + 1;
        continue;
      }
    }

    let next = line.length;
    const nextBold = line.indexOf("**", index);
    const nextUnderline = line.indexOf("__", index);
    const nextItalic = line.indexOf("*", index);

    if (nextBold !== -1) next = Math.min(next, nextBold);
    if (nextUnderline !== -1) next = Math.min(next, nextUnderline);
    if (nextItalic !== -1) next = Math.min(next, nextItalic);

    const plainText = line.slice(index, next);
    if (plainText) {
      nodes.push(<span key={`t-${key++}`}>{plainText}</span>);
    }
    index = next;
  }

  return nodes;
}

export default function FormattedText({ text, className }: Props) {
  const lines = text.split(/\r?\n/);

  return (
    <div className={className}>
      {lines.map((line, idx) => {
        const isBullet = line.startsWith("- ");
        const content = isBullet ? line.slice(2) : line;

        return (
          <div key={`line-${idx}`} className={isBullet ? "flex gap-1.5" : undefined}>
            {isBullet && <span className="shrink-0">•</span>}
            <span>{parseInline(content)}</span>
            {idx < lines.length - 1 && !isBullet && <br />}
          </div>
        );
      })}
    </div>
  );
}
