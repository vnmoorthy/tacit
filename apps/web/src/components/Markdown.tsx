import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo, useRef } from "react";
import type { Components } from "react-markdown";

/** Renders markdown; turns [n] citation markers into chips. */
export function Markdown({ children, onCite, className }: { children: string; onCite?: (n: number) => void; className?: string }) {
  const text = onCite ? children.replace(/\[(\d{1,2})\]/g, (_, n) => `[[${n}]](#cite-${n})`) : children;
  const onCiteRef = useRef(onCite);
  onCiteRef.current = onCite;
  // Stable renderer identity keeps the focused citation mounted on selection.
  const components = useMemo<Components>(() => ({
    a: ({ href, children: c }) => {
      const m = href?.match(/^#cite-(\d+)$/);
      if (m && onCiteRef.current) {
        return <button type="button" className="cite" aria-label={`View source ${m[1]}`} onClick={() => onCiteRef.current?.(Number(m[1]))}>{String(c).replace(/[[\]]/g, "")}</button>;
      }
      return <a href={href} target="_blank" rel="noreferrer">{c}</a>;
    },
  }), []);
  return (
    <div className={`prose-tacit ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
