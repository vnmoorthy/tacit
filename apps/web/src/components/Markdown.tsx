import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders markdown; turns [n] citation markers into chips. */
export function Markdown({ children, onCite, className }: { children: string; onCite?: (n: number) => void; className?: string }) {
  const text = onCite ? children.replace(/\[(\d{1,2})\]/g, (_, n) => `[[${n}]](#cite-${n})`) : children;
  return (
    <div className={`prose-tacit ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: c }) => {
            const m = href?.match(/^#cite-(\d+)$/);
            if (m && onCite) {
              return (
                <button type="button" className="cite" onClick={() => onCite(Number(m[1]))}>
                  {String(c).replace(/[[\]]/g, "")}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {c}
              </a>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
