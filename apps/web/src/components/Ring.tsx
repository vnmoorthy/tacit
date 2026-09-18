/** Small radial progress ring used on capture cards. */
export function Ring({ value, size = 46, stroke = 5, tone = "accent" }: { value: number; size?: number; stroke?: number; tone?: "accent" | "sage" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = tone === "sage" ? "#6fbf8a" : "#e8a33d";
  return (
    <svg role="img" aria-label={`Coverage: ${Math.round(v * 100)}%`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232830" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray .8s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono, monospace" fontSize={size * 0.24} fill="#e8eaee">
        {Math.round(v * 100)}
      </text>
    </svg>
  );
}
