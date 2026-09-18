import type { Domain } from "@tacit/core";
import { cx } from "./ui.js";

/**
 * Radial coverage map: one arc per domain (thickness by priority), filled by coverage.
 * Doubles as a legend/selector when `onSelect` is provided.
 */
export function CoverageMap({
  domains,
  coverage,
  size = 260,
  selected,
  onSelect,
  showList = true,
}: {
  domains: Domain[];
  coverage: number;
  size?: number;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  showList?: boolean;
}) {
  const n = Math.max(1, domains.length);
  const cx0 = size / 2;
  const cy0 = size / 2;
  const R = size / 2 - 8;
  const gap = 0.045;
  const arcs = domains.map((d, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 + gap / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - gap / 2;
    const w = d.priority === 1 ? 26 : d.priority === 2 ? 20 : 14;
    const rOuter = R;
    const rInner = R - w;
    return { d, a0, a1, rOuter, rInner, i };
  });

  const arcPath = (a0: number, a1: number, r0: number, r1: number) => {
    const p = (a: number, r: number) => [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)];
    const [x0, y0] = p(a0, r1);
    const [x1, y1] = p(a1, r1);
    const [x2, y2] = p(a1, r0);
    const [x3, y3] = p(a0, r0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
  };

  return (
    <div className={cx("flex gap-6", showList ? "flex-col md:flex-row md:items-start" : "")}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 mx-auto">
        <defs>
          <radialGradient id="cm-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e8b36b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e8b36b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx0} cy={cy0} r={R - 40} fill="url(#cm-glow)" />
        {arcs.map(({ d, a0, a1, rOuter, rInner, i }) => {
          const filled = a0 + (a1 - a0) * Math.max(0.02, d.coverage);
          const isSel = selected === d.id;
          const dim = selected && !isSel;
          return (
            <g
              key={d.id}
              className={cx(onSelect && "cursor-pointer")}
              onClick={() => onSelect?.(isSel ? null : d.id)}
              style={{ opacity: dim ? 0.35 : 1, transition: "opacity .2s" }}
            >
              <path d={arcPath(a0, a1, rOuter, rInner)} fill="#232830" />
              <path d={arcPath(a0, filled, rOuter, rInner)} fill={d.priority === 1 ? "#e8a33d" : d.priority === 2 ? "#b98232" : "#7a5a2a"} style={{ transition: "d .6s" }}>
                <title>{`${d.name}: ${Math.round(d.coverage * 100)}%`}</title>
              </path>
              {isSel && <path d={arcPath(a0, a1, rOuter + 4, rOuter + 1)} fill="#e8eaee" />}
              <text
                x={cx0 + (rInner - 12) * Math.cos((a0 + a1) / 2)}
                y={cy0 + (rInner - 12) * Math.sin((a0 + a1) / 2)}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fill="#7d8694"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
        <text x={cx0} y={cy0 - 6} textAnchor="middle" fontFamily="Inter Tight, Inter, sans-serif" fontWeight="600" fontSize={size * 0.16} fill="#e8eaee">
          {Math.round(coverage * 100)}%
        </text>
        <text x={cx0} y={cy0 + 18} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill="#7d8694" letterSpacing="1.5">
          COVERED
        </text>
      </svg>
      {showList && (
        <ol className="flex-1 space-y-1.5 min-w-0">
          {domains.map((d, i) => {
            const isSel = selected === d.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(isSel ? null : d.id)}
                  className={cx(
                    "w-full rounded-xl px-3 py-2 text-left transition",
                    onSelect && "hover:bg-paper-2",
                    isSel && "bg-paper-2 ring-1 ring-line-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10.5px] text-muted w-4">{i + 1}</span>
                    <span className="text-[13.5px] font-medium truncate flex-1">{d.name}</span>
                    <span className={cx("text-[10.5px] font-mono px-1.5 rounded", d.priority === 1 ? "bg-accent-3 text-accent" : "bg-paper-3 text-muted")}>P{d.priority}</span>
                    <span className="font-mono text-[12px] text-ink-2 w-10 text-right">{Math.round(d.coverage * 100)}%</span>
                  </div>
                  <div className="mt-1.5 ml-6 h-1 rounded-full bg-paper-3 overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.round(d.coverage * 100)}%` }} />
                  </div>
                  <div className="ml-6 mt-1 text-[11.5px] text-muted">
                    {d.atomCount} atoms · {d.askedCount}/{d.targetQuestions.length} questions asked
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
