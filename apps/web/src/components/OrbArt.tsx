import { useId } from "react";

/** A lit amber glass core and brushed-metal orbits, rendered locally at any size. */
export function OrbArt({ size = 300, chips = true }: { size?: number; chips?: boolean }) {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <div aria-hidden="true" className="relative mx-auto max-w-full" style={{ width: size, aspectRatio: "1" }}>
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" fill="none">
        <defs>
          <radialGradient id={`${id}-body`} cx="32%" cy="25%" r="80%">
            <stop stopColor="#ffedc6" /><stop offset=".17" stopColor="#edc17a" />
            <stop offset=".46" stopColor="#ac611f" /><stop offset=".77" stopColor="#472311" /><stop offset="1" stopColor="#110f0c" />
          </radialGradient>
          <radialGradient id={`${id}-core`} cx="63%" cy="70%" r="54%">
            <stop stopColor="#ffc05b" stopOpacity=".74" /><stop offset=".42" stopColor="#d57d20" stopOpacity=".2" /><stop offset="1" stopColor="#e49a39" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-sheen`} cx="30%" cy="20%" r="66%">
            <stop stopColor="#fff9e6" stopOpacity=".84" /><stop offset=".22" stopColor="#ffefc5" stopOpacity=".16" /><stop offset="1" stopColor="#ffe7b2" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-metal`} x1="70" y1="100" x2="315" y2="310" gradientUnits="userSpaceOnUse">
            <stop stopColor="#422e1c" /><stop offset=".22" stopColor="#e6bc7b" /><stop offset=".35" stopColor="#fff0c9" /><stop offset=".55" stopColor="#755236" /><stop offset=".82" stopColor="#b37c38" /><stop offset="1" stopColor="#34261c" />
          </linearGradient>
          <filter id={`${id}-blur`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="15" /></filter>
          <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
          <clipPath id={`${id}-clip`}><circle cx="200" cy="188" r="92" /></clipPath>
        </defs>
        <ellipse cx="204" cy="335" rx="99" ry="15" fill="#000" opacity=".8" filter={ref("blur")} />
        <ellipse cx="210" cy="328" rx="48" ry="5" fill="#d9973d" opacity=".15" filter={ref("soft")} />
        <circle cx="200" cy="189" r="132" fill="#c28635" opacity=".1" filter={ref("blur")} />
        <g stroke={ref("metal")}>
          <ellipse cx="200" cy="190" rx="167" ry="83" transform="rotate(-30 200 190)" strokeWidth="2.3" opacity=".52" />
          <ellipse cx="200" cy="190" rx="164" ry="111" transform="rotate(48 200 190)" strokeWidth="1.2" opacity=".4" />
          <circle cx="200" cy="190" r="162" strokeWidth=".6" opacity=".3" strokeDasharray="2 9" />
        </g>
        <g style={{ animation: "orb-breathe 7s ease-in-out infinite", transformOrigin: "200px 188px" }}>
          <circle cx="200" cy="188" r="93" fill="#2d2116" stroke={ref("metal")} strokeWidth="1" />
          <circle cx="200" cy="188" r="92" fill={ref("body")} />
          <circle cx="200" cy="188" r="92" fill={ref("core")} />
          <g clipPath={ref("clip")}>
            <ellipse cx="197" cy="161" rx="88" ry="89" stroke="#f9da9c" opacity=".16" strokeWidth=".65" />
            <ellipse cx="201" cy="153" rx="84" ry="64" stroke="#ffdc91" opacity=".12" strokeWidth=".7" />
            <path d="M127 220 C148 276 237 285 273 214" stroke="#f8b956" strokeWidth="3" opacity=".65" filter={ref("soft")} />
            <ellipse cx="179" cy="138" rx="56" ry="41" transform="rotate(-27 179 138)" fill={ref("sheen")} />
            <path d="M135 145 C146 121 171 111 194 112" stroke="#fff3d6" strokeWidth="2" strokeLinecap="round" opacity=".67" />
          </g>
        </g>
        <path d="M55.4 273 A167 83 -30 0 0 344.6 107" stroke={ref("metal")} strokeWidth="2.8" />
        <path d="M90.3 68.1 A164 111 48 0 0 309.7 311.9" stroke={ref("metal")} strokeWidth="1.6" opacity=".85" />
        <circle cx="58" cy="224" r="3.3" fill="#ffe0a6" /><circle cx="58" cy="224" r="8" fill="#efb65b" opacity=".24" filter={ref("soft")} />
        <circle cx="321" cy="237" r="2.1" fill="#e2b66d" />
      </svg>
      {chips && <>
        <Chip className="left-[-8%] top-[14%]" tone="gotcha" label="GOTCHA" text="ADP “filed” ≠ “deposited”" delay={0} />
        <Chip className="right-[-7%] top-[43%]" tone="rule" label="RULE" text="ACH cut-off: 3:30 pm" delay={0.8} />
        <Chip className="left-[2%] bottom-[8%]" tone="contact" label="CONTACT" text="Dan Okafor · Treasury" delay={1.6} />
      </>}
    </div>
  );
}

function Chip({ className, tone, label, text, delay }: { className: string; tone: "gotcha" | "rule" | "contact"; label: string; text: string; delay: number }) {
  const tones = { gotcha: "bg-accent-3 text-accent", rule: "bg-paper-3 text-accent-2", contact: "bg-sage-2 text-sage" }[tone];
  return (
    <div className={`absolute flex items-center gap-2 rounded-lg border border-line-2 bg-paper-2/95 px-3 py-2.5 text-[12.5px] shadow-lift backdrop-blur-md ${className}`} style={{ animation: `orb-breathe 8s ease-in-out ${delay}s infinite` }}>
      <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${tones}`}>{label}</span><span className="text-ink">{text}</span>
    </div>
  );
}
