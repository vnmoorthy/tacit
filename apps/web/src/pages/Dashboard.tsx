import { ArrowRight, Clock, Database, Mic, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Capture } from "@tacit/core";
import { Avatar, Badge, Button, Card, EmptyState, ProgressBar, Stat, cx } from "../components/ui.js";
import { daysUntil, fmtRelative, pct, plural } from "../lib/format.js";
import { useApi, useApp } from "../lib/store.js";

function riskTone(days: number | null): { tone: "danger" | "amber" | "neutral"; label: string } {
  if (days === null) return { tone: "neutral", label: "No date set" };
  if (days < 0) return { tone: "neutral", label: "Departed" };
  if (days <= 30) return { tone: "danger", label: `${days} days left` };
  if (days <= 90) return { tone: "amber", label: `${days} days left` };
  return { tone: "neutral", label: `${days} days left` };
}

export function CaptureCard({ c }: { c: Capture }) {
  const days = daysUntil(c.expert.departureDate);
  const risk = riskTone(days);
  return (
    <Link to={`/c/${c.id}`} className="group block">
      <Card className="h-full p-5 transition hover:shadow-lift hover:border-line-2">
        <div className="flex items-start gap-3">
          <Avatar name={c.expert.name} size={44} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[19px] leading-tight truncate">{c.expert.name}</h3>
            <p className="text-[13px] text-muted truncate">{c.expert.role}</p>
          </div>
          <Badge tone={risk.tone} icon={<Clock className="h-3 w-3" />}>
            {risk.label}
          </Badge>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] text-muted mb-1.5">
            <span>Coverage</span>
            <span className="font-mono text-ink">{pct(c.stats.coverage)}</span>
          </div>
          <ProgressBar value={c.stats.coverage} tone={c.stats.coverage > 0.66 ? "sage" : "accent"} />
        </div>
        <div className="mt-4 flex items-center gap-4 text-[12.5px] text-muted">
          <span>{plural(c.stats.atoms, "atom")}</span>
          <span>{plural(c.stats.sessions, "session")}</span>
          {c.stats.openQuestions > 0 && <span className="text-accent">{plural(c.stats.openQuestions, "open question")}</span>}
          <span className="ml-auto">{fmtRelative(c.updatedAt)}</span>
        </div>
        <div className={cx("mt-4 flex items-center gap-1 text-[13px] font-medium text-ink-2 opacity-0 transition group-hover:opacity-100")}>
          Open capture <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const api = useApi();
  const toast = useApp((s) => s.toast);
  const nav = useNavigate();
  const [captures, setCaptures] = useState<Capture[] | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const refresh = () => api.listCaptures().then(setCaptures);
  useEffect(() => {
    void refresh();
  }, [api]);

  const loadSamples = async () => {
    setLoadingSamples(true);
    try {
      const loaded = await api.loadSamples();
      toast(`Loaded ${loaded.length} sample captures`, "success");
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoadingSamples(false);
    }
  };

  const list = captures ?? [];
  const atRisk = list.filter((c) => {
    const d = daysUntil(c.expert.departureDate);
    return d !== null && d >= 0 && d <= 90;
  }).length;
  const atoms = list.reduce((a, c) => a + c.stats.atoms, 0);
  const openQ = list.reduce((a, c) => a + c.stats.openQuestions, 0);
  const avgCov = list.length ? list.reduce((a, c) => a + c.stats.coverage, 0) / list.length : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-muted font-semibold">Institutional memory</p>
          <h1 className="font-display text-[40px] leading-[1.05] mt-2 max-w-xl">
            Every expert who leaves takes a library with them. <span className="text-accent">Tacit interviews them first.</span>
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          {list.length > 0 && !list.some((c) => c.sample) && (
            <Button onClick={loadSamples} loading={loadingSamples} icon={<Database className="h-4 w-4" />}>
              Load samples
            </Button>
          )}
          <Button variant="primary" size="lg" icon={<Plus className="h-4 w-4" />} onClick={() => nav("/new")}>
            New capture
          </Button>
        </div>
      </header>

      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Experts at risk" value={atRisk} hint="leaving within 90 days" tone={atRisk ? "danger" : "neutral"} />
          <Stat label="Knowledge atoms" value={atoms} hint="procedures, rules, gotchas, contacts…" />
          <Stat label="Average coverage" value={pct(avgCov)} hint="weighted by domain priority" tone={avgCov > 0.66 ? "sage" : "accent"} />
          <Stat label="Open questions" value={openQ} hint="queued for the next interview" tone={openQ ? "accent" : "neutral"} />
        </div>
      )}

      {captures === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-paper-2 animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No captures yet"
          body="Create a capture for an expert who is leaving, or load two sample captures (a payroll lead and an SRE) to see Tacit with real knowledge already in it."
          action={
            <>
              <Button onClick={loadSamples} loading={loadingSamples} icon={<Database className="h-4 w-4" />}>
                Load sample captures
              </Button>
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => nav("/new")}>
                New capture
              </Button>
            </>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <CaptureCard key={c.id} c={c} />
          ))}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <Mic className="h-4 w-4" />, t: "1 · Interview", b: "A voice agent interviews the expert one question at a time, following threads and probing for failure modes." },
          { icon: <Sparkles className="h-4 w-4" />, t: "2 · Distil", b: "Answers become typed knowledge atoms with source quotes. The coverage map fills in live." },
          { icon: <ArrowRight className="h-4 w-4" />, t: "3 · Hand over", b: "The successor asks the twin. Unanswered questions go straight back into the next interview." },
        ].map((s) => (
          <Card key={s.t} className="p-5">
            <div className="flex items-center gap-2 text-accent">
              {s.icon}
              <span className="text-[12px] uppercase tracking-[0.14em] font-semibold">{s.t}</span>
            </div>
            <p className="mt-2 text-[13.5px] text-ink-2 leading-relaxed">{s.b}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
