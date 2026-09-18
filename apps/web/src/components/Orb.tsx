import { cx } from "./ui.js";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "off";

/** The voice orb: breathes when idle, swells with mic level, spins while thinking, pulses while speaking. */
export function Orb({ state, level = 0, size = 220 }: { state: OrbState; level?: number; size?: number }) {
  const l = Math.max(0, Math.min(1, level));
  const scale = state === "listening" ? 1 + l * 0.45 : state === "speaking" ? 1.08 : 1;
  const ring = state === "listening" ? "#b8541e" : state === "speaking" ? "#e8b36b" : state === "thinking" ? "#345d8a" : "#cfc5b4";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* outer halo */}
      <div
        className="absolute rounded-full transition-transform duration-100"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: `radial-gradient(circle, ${ring}33 0%, ${ring}11 45%, transparent 70%)`,
          transform: `scale(${1 + l * 0.9})`,
          opacity: state === "off" ? 0.3 : 1,
        }}
      />
      {/* rotating arc while thinking */}
      {state === "thinking" && (
        <svg className="absolute" width={size * 0.7} height={size * 0.7} viewBox="0 0 100 100" style={{ animation: "orb-spin 1.6s linear infinite" }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#345d8a" strokeWidth="2.5" strokeDasharray="60 230" strokeLinecap="round" />
        </svg>
      )}
      {/* core */}
      <div
        className={cx("relative rounded-full transition-transform duration-100", state === "idle" && "animate-[orb-breathe_3.2s_ease-in-out_infinite]")}
        style={{
          width: size * 0.42,
          height: size * 0.42,
          transform: `scale(${scale})`,
          background:
            state === "off"
              ? "radial-gradient(circle at 35% 30%, #d9d0c1, #8a8377)"
              : "radial-gradient(circle at 35% 30%, #f6e3c3 0%, #e8b36b 35%, #b8541e 75%, #6e2e0c 100%)",
          boxShadow: state === "off" ? "none" : `0 10px 40px -8px ${ring}aa, inset 0 -8px 20px rgba(0,0,0,.25)`,
        }}
      />
      {/* speaking bars */}
      {state === "speaking" && (
        <div className="absolute flex items-end gap-1" style={{ bottom: size * 0.16 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-ink"
              style={{ height: 6 + ((i * 7) % 12), animation: `orb-breathe ${0.5 + i * 0.13}s ease-in-out infinite` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
