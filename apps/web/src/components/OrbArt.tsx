/** Decorative orb with orbit rings and floating atom chips (light-safe, pure SVG/CSS). */
export function OrbArt({ size = 300, chips = true }: { size?: number; chips?: boolean }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 400 400" width={size} height={size} className="absolute inset-0">
        <defs>
          <radialGradient id="orbA" cx="40%" cy="35%" r="65%">
            <stop offset="0" stopColor="#f6e3c3" />
            <stop offset=".35" stopColor="#e8b36b" />
            <stop offset=".75" stopColor="#b8541e" />
            <stop offset="1" stopColor="#6e2e0c" />
          </radialGradient>
          <filter id="orbBlur">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>
        <circle cx="200" cy="200" r="150" fill="#e8b36b" opacity=".22" filter="url(#orbBlur)" />
        <g fill="none" stroke="#e8b36b" strokeLinecap="round">
          <circle cx="200" cy="200" r="178" strokeWidth="2" opacity=".3" strokeDasharray="12 10" style={{ transformOrigin: "200px 200px", animation: "orb-spin 60s linear infinite" }} />
          <path d="M200 40 A160 160 0 0 1 360 200" strokeWidth="10" opacity=".95" />
          <path d="M360 200 A160 160 0 0 1 200 360" strokeWidth="10" opacity=".45" />
          <path d="M200 360 A160 160 0 0 1 40 200" strokeWidth="10" opacity=".22" />
          <path d="M40 200 A160 160 0 0 1 200 40" strokeWidth="10" opacity=".6" />
        </g>
        <circle cx="200" cy="200" r="86" fill="url(#orbA)" style={{ animation: "orb-breathe 4s ease-in-out infinite", transformOrigin: "200px 200px" }} />
      </svg>
      {chips && (
        <>
          <Chip className="left-[-8%] top-[14%]" tone="gotcha" label="GOTCHA" text="ADP “filed” ≠ “deposited”" delay={0} />
          <Chip className="right-[-10%] top-[38%]" tone="rule" label="RULE" text="Real cut-off is 3:30, not 5" delay={0.8} />
          <Chip className="left-[2%] bottom-[10%]" tone="contact" label="CONTACT" text="Dan Okafor · Treasury" delay={1.6} />
        </>
      )}
    </div>
  );
}

function Chip({ className, tone, label, text, delay }: { className: string; tone: "gotcha" | "rule" | "contact"; label: string; text: string; delay: number }) {
  const tones = {
    gotcha: "bg-accent-3 text-[#8a4a12]",
    rule: "bg-ink text-accent-2",
    contact: "bg-sage-2 text-sage",
  }[tone];
  return (
    <div className={`absolute flex items-center gap-2 rounded-xl border border-white/60 bg-white/85 px-3 py-2 text-[12.5px] shadow-lift backdrop-blur ${className}`} style={{ animation: `orb-breathe 5s ease-in-out ${delay}s infinite` }}>
      <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${tones}`}>{label}</span>
      <span className="text-ink">{text}</span>
    </div>
  );
}
