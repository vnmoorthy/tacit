/** Small radial progress ring used on capture cards. */
export function Ring({ value, size = 46, stroke = 5, tone = "accent" }: { value: number; size?: number; stroke?: number; tone?: "accent" | "sage" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = tone === "sage" ? "#4f7d5c" : "#b8541e";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6ddcd" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray .8s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono, monospace" fontSize={size * 0.24} fill="#1c1a17">
        {Math.round(v * 100)}
      </text>
    </svg>
  );
}
