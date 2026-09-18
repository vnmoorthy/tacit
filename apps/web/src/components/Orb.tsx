import { cx } from "./ui.js";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "off";

/** The voice orb: breathes when idle, swells with mic level, spins while thinking, pulses while speaking. */
export function Orb({ state, level = 0, size = 220 }: { state: OrbState; level?: number; size?: number }) {
  const l = Math.max(0, Math.min(1, level));
  const scale = state === "listening" ? 1 + l * 0.45 : state === "speaking" ? 1.08 : 1;
  const ring = state === "listening" ? "#e8a33d" : state === "speaking" ? "#f0b95c" : state === "thinking" ? "#6ea8fe" : "#c2a473";
  return (
    <div aria-hidden="true" className="relative grid place-items-center" style={{ width: size, height: size }}>
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
        className={cx("relative overflow-hidden rounded-full transition-transform duration-100", state === "idle" && "animate-[orb-breathe_4.5s_ease-in-out_infinite]")}
        style={{
          width: size * 0.42,
          height: size * 0.42,
          transform: `scale(${scale})`,
          background:
            state === "off"
              ? "radial-gradient(circle at 30% 24%, #b7b3a9, #55514a 62%, #1b1b1a)"
              : "radial-gradient(ellipse at 65% 78%, #e8a33d66, transparent 51%), radial-gradient(circle at 30% 23%, #fff1cd 0%, #e9bb72 20%, #a15a20 55%, #412411 82%, #110e0a 100%)",
          boxShadow: state === "off" ? "inset 0 0 1px #ffffff66" : `0 14px 40px -16px ${ring}aa, inset 0 0 1px #fff6dbaa, inset -4px -8px 14px #180d0b66`,
        }}
      >
        <span className="absolute left-[14%] top-[10%] h-[32%] w-[56%] -rotate-[25deg] rounded-full" style={{ background: "linear-gradient(165deg, #fff9eaa6, #fff2d322 50%, transparent 80%)" }} />
        <span className="absolute inset-[5%] rounded-full border border-[#ffdda522]" />
        <span className="absolute bottom-[9%] left-[18%] h-[35%] w-[67%] rounded-[50%] border-b-2 border-[#f4b15c66] blur-[1px]" />
      </div>
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
