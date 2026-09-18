import { Brain, FileText, LayoutGrid, MessageSquareText, Mic, Orbit, Plus, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useMatch } from "react-router-dom";
import type { Capture } from "@tacit/core";
import { useApi, useApp } from "../lib/store.js";
import { Avatar, cx } from "./ui.js";

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition",
          isActive ? "bg-paper-3 text-ink border border-line-2" : "border border-transparent text-ink-2 hover:bg-paper-2 hover:text-ink",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

/** Compact engine status: what Tacit is thinking and speaking with. */
export function EngineBadge({ compact = false }: { compact?: boolean }) {
  const health = useApp((s) => s.health);
  if (!health) return null;
  const demo = health.engine.brain === "demo-brain";
  const brain = demo ? "Demo brain" : `${health.engine.brain === "nebius" ? "Nebius" : health.engine.brain} · ${health.engine.model?.split("/").pop()?.replace(/-Instruct.*$/, "") ?? ""}`;
  const voice = health.higgs ? "Higgs Realtime" : "Browser voice";
  return (
    <div className={cx("rounded-lg border border-line bg-paper-2 text-[12px] leading-5", compact ? "px-2.5 py-1.5" : "px-3 py-2.5")}>
      <div className="flex items-center gap-2">
        <span className={cx("h-2 w-2 rounded-full", demo ? "bg-muted" : "bg-sage")} style={{ boxShadow: demo ? "none" : "0 0 0 3px rgba(79,125,92,.18)" }} />
        <span className="truncate font-medium text-ink">{brain}</span>
      </div>
      {!compact && (
        <div className="mt-0.5 flex items-center gap-2 text-muted">
          <Mic className="h-3 w-3" /> {voice}
          <span className="ml-auto rounded-md bg-paper-3 px-1.5 font-mono text-[10.5px] uppercase tracking-wider">{health.mode === "server" ? "server" : "standalone"}</span>
        </div>
      )}
    </div>
  );
}

const CAPTURE_TABS = (id: string) => [
  { to: `/c/${id}`, icon: <Sparkles className="h-4 w-4" />, label: "Overview", end: true },
  { to: `/c/${id}/interview`, icon: <Mic className="h-4 w-4" />, label: "Interview" },
  { to: `/c/${id}/knowledge`, icon: <Brain className="h-4 w-4" />, label: "Knowledge" },
  { to: `/c/${id}/ask`, icon: <MessageSquareText className="h-4 w-4" />, label: "Ask" },
  { to: `/c/${id}/graph`, icon: <Orbit className="h-4 w-4" />, label: "Constellation" },
  { to: `/c/${id}/handover`, icon: <FileText className="h-4 w-4" />, label: "Handover" },
];

export function Layout() {
  const match = useMatch("/c/:id/*");
  const captureId = match?.params.id;
  const api = useApi();
  const [capture, setCapture] = useState<Capture | null>(null);

  useEffect(() => {
    if (!captureId) {
      setCapture(null);
      return;
    }
    let alive = true;
    api.getCapture(captureId).then((c) => alive && setCapture(c)).catch(() => alive && setCapture(null));
    return () => {
      alive = false;
    };
  }, [api, captureId]);

  const tabs = captureId ? CAPTURE_TABS(captureId) : [];

  return (
    <div className="flex min-h-screen">
      {/* ── desktop sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col border-r border-line bg-paper px-4 py-5 md:flex">
        <Link to="/app" className="flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-line-2 bg-paper-2">
            <svg viewBox="0 0 64 64" className="h-5 w-5">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#E8B36B" strokeWidth="4" />
              <circle cx="32" cy="32" r="9" fill="none" stroke="#E8B36B" strokeWidth="4" opacity=".7" />
              <circle cx="32" cy="32" r="3" fill="#E8B36B" />
            </svg>
          </span>
          <span className="font-display text-[22px] leading-none">Tacit</span>
        </Link>

        <nav className="mt-7 space-y-1">
          <NavItem to="/app" icon={<LayoutGrid className="h-4 w-4" />} label="Captures" end />
          <NavItem to="/new" icon={<Plus className="h-4 w-4" />} label="New capture" />
        </nav>

        {captureId && (
          <div className="mt-7">
            <div className="flex items-center gap-2.5 px-2">
              {capture && <Avatar name={capture.expert.name} size={28} />}
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-ink">{capture?.expert.name ?? "Capture"}</div>
                <div className="truncate text-[11.5px] text-muted">{capture?.expert.role ?? ""}</div>
              </div>
            </div>
            <nav className="mt-3 space-y-1">
              {tabs.map((t) => (
                <NavItem key={t.to} {...t} />
              ))}
            </nav>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <EngineBadge />
          <NavItem to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label="Settings" />
          <Link to="/" className="block px-3 text-[12px] text-muted hover:text-ink">← Website</Link>
        </div>
      </aside>

      {/* ── main ── */}
      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        {/* mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
          <Link to="/app" className="flex items-center gap-2 font-display text-[20px]">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-line-2 bg-paper-2">
              <svg viewBox="0 0 64 64" className="h-4 w-4">
                <circle cx="32" cy="32" r="17" fill="none" stroke="#E8B36B" strokeWidth="4" />
                <circle cx="32" cy="32" r="3" fill="#E8B36B" />
              </svg>
            </span>
            Tacit
          </Link>
          <div className="flex items-center gap-1">
            <EngineBadge compact />
            <Link to="/settings" className="rounded-full p-2 text-ink-2 hover:bg-paper-2" aria-label="Settings">
              <SettingsIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1180px] px-5 py-7 md:px-8 md:py-9">
          <Outlet />
        </div>
      </main>

      {/* ── mobile bottom tabs ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper/95 backdrop-blur md:hidden">
        {(captureId
          ? tabs.filter((t) => t.label !== "Handover")
          : [
              { to: "/app", icon: <LayoutGrid className="h-4 w-4" />, label: "Captures", end: true },
              { to: "/new", icon: <Plus className="h-4 w-4" />, label: "New" },
              { to: "/settings", icon: <SettingsIcon className="h-4 w-4" />, label: "Settings" },
            ]
        ).map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cx("flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", isActive ? "text-accent" : "text-muted")}
          >
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
