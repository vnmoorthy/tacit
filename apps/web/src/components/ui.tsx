import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";
import { useApp } from "../lib/store.js";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ────────────────────────────── Button ────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode; loading?: boolean }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";
  const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
  const variants: Record<Variant, string> = {
    primary: "bg-ink text-paper hover:bg-ink-2 shadow-soft",
    accent: "bg-accent text-white hover:brightness-110 shadow-soft",
    secondary: "bg-white/70 border border-line-2 text-ink hover:bg-white hover:border-ink/30",
    ghost: "text-ink-2 border border-transparent hover:border-line-2 hover:bg-white/70 hover:text-ink",
    danger: "bg-danger-2 text-danger border border-danger/20 hover:bg-danger hover:text-white",
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block rounded-full border-2 border-current border-t-transparent animate-spin", className ?? "h-4 w-4")} />;
}

/* ────────────────────────────── Badge ────────────────────────────── */

export type Tone = "neutral" | "accent" | "sage" | "danger" | "info" | "amber" | "plum" | "teal" | "rose" | "ink";

const TONES: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2 border-line",
  accent: "bg-accent-3 text-accent border-accent/20",
  amber: "bg-accent-3 text-[#8a4a12] border-accent-2/60",
  sage: "bg-sage-2 text-sage border-sage/20",
  danger: "bg-danger-2 text-danger border-danger/20",
  info: "bg-info-2 text-info border-info/20",
  plum: "bg-plum-2 text-plum border-plum/20",
  teal: "bg-teal-2 text-teal border-teal/20",
  rose: "bg-rose-2 text-rose border-rose/20",
  ink: "bg-ink text-accent-2 border-ink",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/* ────────────────────────────── Card ────────────────────────────── */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white/60 shadow-soft backdrop-blur-[2px]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h3 className="font-display text-[20px] leading-tight">{title}</h3>
        {subtitle && <p className="mt-1 text-[13.5px] leading-snug text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Consistent page header: eyebrow, display title, optional lede and actions. */
export function PageHeader({ eyebrow, title, lede, actions, className }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cx("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>}
        <h1 className="font-display mt-1.5 text-[32px] leading-[1.08] md:text-[38px]">{title}</h1>
        {lede && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div>}
    </header>
  );
}

/* ────────────────────────────── Stat ────────────────────────────── */

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "neutral" | "accent" | "danger" | "sage" }) {
  const color = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : tone === "sage" ? "text-sage" : "text-ink";
  return (
    <Card className="px-5 py-4">
      <div className="text-[12px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div className={cx("font-display mt-2 text-[30px] leading-none md:text-[34px]", color)}>{value}</div>
      {hint && <div className="mt-2 text-[12.5px] leading-snug text-muted">{hint}</div>}
    </Card>
  );
}

/* ────────────────────────────── Empty state ────────────────────────────── */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 p-10 text-center">
      {icon && <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-paper-2 text-ink-2">{icon}</div>}
      <h3 className="font-display text-xl">{title}</h3>
      {body && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ────────────────────────────── Form ────────────────────────────── */

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted mt-1.5">{hint}</span>}
    </label>
  );
}

const inputBase = "w-full rounded-xl border border-line-2 bg-white/80 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:border-ink/40 focus:ring-2 focus:ring-accent/20 transition";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputBase, className)} {...props} />;
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputBase, "min-h-[120px] leading-relaxed", className)} {...props} />;
}
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink-2">
      <span className={cx("relative inline-block h-5 w-9 rounded-full transition", checked ? "bg-sage" : "bg-line-2")}>
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

/* ────────────────────────────── Modal ────────────────────────────── */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div className={cx("relative w-full rounded-2xl bg-paper shadow-lift border border-line rise-in", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="font-display text-xl">{title}</h3>
          <button className="rounded-full p-1.5 text-muted hover:bg-paper-2 hover:text-ink" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ────────────────────────────── Toaster ────────────────────────────── */

export function Toaster() {
  const { toasts, dismiss } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "pointer-events-auto rise-in flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift max-w-sm",
            t.kind === "error" ? "bg-danger-2 border-danger/30 text-danger" : t.kind === "success" ? "bg-sage-2 border-sage/30 text-sage" : "bg-ink text-paper border-ink",
          )}
        >
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────── Misc ────────────────────────────── */

export function ProgressBar({ value, tone = "accent", className }: { value: number; tone?: "accent" | "sage" | "ink"; className?: string }) {
  const color = tone === "sage" ? "bg-sage" : tone === "ink" ? "bg-ink" : "bg-accent";
  return (
    <div className={cx("h-1.5 w-full rounded-full bg-paper-3 overflow-hidden", className)}>
      <div className={cx("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div className="grid place-items-center rounded-full bg-ink text-accent-2 font-display shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {ini}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[12px] uppercase tracking-[0.14em] text-muted font-semibold">{children}</h2>
      {action}
    </div>
  );
}
