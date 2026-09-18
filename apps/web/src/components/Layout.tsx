import { Bot, Brain, FileText, LayoutGrid, MessageSquareText, Mic, Plus, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useMatch } from "react-router-dom";
import type { Capture } from "@tacit/core";
import { useApi, useApp } from "../lib/store.js";
import { Badge, cx } from "./ui.js";

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition",
          isActive ? "bg-ink text-paper shadow-soft" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function EngineBadge() {
  const health = useApp((s) => s.health);
  if (!health) return null;
  const brain = health.engine.brain === "demo-brain" ? "Demo brain" : `${health.engine.brain}${health.engine.model ? ` · ${health.engine.model.split("/").pop()}` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={health.engine.brain === "demo-brain" ? "neutral" : "sage"} icon={<Brain className="h-3 w-3" />}>
        {brain}
      </Badge>
      <Badge tone={health.higgs ? "accent" : "neutral"} icon={<Mic className="h-3 w-3" />}>
        {health.higgs ? "Higgs Realtime" : "Browser voice"}
      </Badge>
      <Badge tone="neutral">{health.mode === "server" ? "Server" : "Standalone"}</Badge>
    </div>
  );
}

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

  return (
    <div className="flex h-full min-h-screen">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-paper-2/60 px-4 py-5 md:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink">
            <svg viewBox="0 0 64 64" className="h-5 w-5">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#E8B36B" strokeWidth="4" />
              <circle cx="32" cy="32" r="9" fill="none" stroke="#E8B36B" strokeWidth="4" opacity=".7" />
              <circle cx="32" cy="32" r="3" fill="#E8B36B" />
            </svg>
          </span>
          <span className="font-display text-[22px] leading-none">Tacit</span>
        </Link>

        <nav className="mt-7 space-y-1">
          <NavItem to="/" icon={<LayoutGrid className="h-4 w-4" />} label="Captures" end />
          <NavItem to="/new" icon={<Plus className="h-4 w-4" />} label="New capture" />
        </nav>

        {captureId && (
          <div className="mt-6">
            <div className="px-3 text-[11px] uppercase tracking-[0.14em] text-muted font-semibold truncate">{capture?.expert.name ?? "Capture"}</div>
            <nav className="mt-2 space-y-1">
              <NavItem to={`/c/${captureId}`} icon={<Sparkles className="h-4 w-4" />} label="Overview" end />
              <NavItem to={`/c/${captureId}/interview`} icon={<Mic className="h-4 w-4" />} label="Interview" />
              <NavItem to={`/c/${captureId}/knowledge`} icon={<Brain className="h-4 w-4" />} label="Knowledge" />
              <NavItem to={`/c/${captureId}/ask`} icon={<MessageSquareText className="h-4 w-4" />} label="Ask the twin" />
              <NavItem to={`/c/${captureId}/handover`} icon={<FileText className="h-4 w-4" />} label="Handover doc" />
            </nav>
          </div>
        )}

        <div className="mt-auto space-y-3">
          <EngineBadge />
          <NavItem to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label="Settings" />
          <p className="px-3 text-[11px] text-muted leading-relaxed">
            <Bot className="inline h-3 w-3 mr-1 -mt-0.5" />
            Open source · MIT
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="md:hidden flex items-center justify-between border-b border-line px-4 py-3">
          <Link to="/" className="font-display text-xl">
            Tacit
          </Link>
          <div className="flex gap-2 text-[13px]">
            {captureId && <Link to={`/c/${captureId}`}>Overview</Link>}
            <Link to="/settings">Settings</Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1180px] px-5 py-7 md:px-8 md:py-9">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
