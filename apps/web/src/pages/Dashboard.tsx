import { ArrowRight, Clock, Database, Mic, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Capture } from "@tacit/core";
import { OrbArt } from "../components/OrbArt.js";
import { Ring } from "../components/Ring.js";
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle, Stat, cx } from "../components/ui.js";
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
      <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-line-2 hover:shadow-lift">
        <div className="flex items-start gap-3">
          <Avatar name={c.expert.name} size={44} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display truncate text-[20px] leading-tight">{c.expert.name}</h3>
            <p className="truncate text-[13.5px] text-muted">{c.expert.role}</p>
            <div className="mt-2">
              <Badge tone={risk.tone} icon={<Clock className="h-3 w-3" />}>
                {risk.label}
              </Badge>
            </div>
          </div>
          <Ring value={c.stats.coverage} tone={c.stats.coverage > 0.66 ? "sage" : "accent"} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div>
            <div className="font-display text-[20px] leading-none">{c.stats.atoms}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">atoms</div>
          </div>
          <div>
            <div className="font-display text-[20px] leading-none">{c.stats.sessions}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">sessions</div>
          </div>
          <div>
            <div className={cx("font-display text-[20px] leading-none", c.stats.openQuestions ? "text-accent" : "")}>{c.stats.openQuestions}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">open</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>Updated {fmtRelative(c.updatedAt)}</span>
          <span className="inline-flex items-center gap-1 font-medium text-ink opacity-0 transition group-hover:opacity-100">
            Open <ArrowRight className="h-3.5 w-3.5" />
          </span>
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
  const hasSamples = list.some((c) => c.sample);

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-2xl border border-line-2 bg-paper-2 px-7 py-9 text-ink md:px-12 md:py-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full" style={{ background: "radial-gradient(circle, rgba(232,163,61,.12), transparent 62%)" }} />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(232,163,61,.06), transparent 62%)" }} />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-2">Institutional memory</p>
            <h1 className="font-display mt-3 text-[38px] leading-[1.03] md:text-[52px]">
              Every expert who leaves takes a library with them. <span className="italic text-accent-2">Tacit interviews them first.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">A voice AI that interviews departing experts and turns what's in their head into a living, cited knowledge base their successor can talk to.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" icon={<Plus className="h-4 w-4" />} onClick={() => nav("/new")}>
                New capture
              </Button>
              {!hasSamples && (
                <Button size="lg" onClick={loadSamples} loading={loadingSamples} icon={<Database className="h-4 w-4" />}>
                  Load sample captures
                </Button>
              )}
              {hasSamples && list[0] && (
                <Button size="lg" onClick={() => nav(`/c/${list.find((c) => c.sample)!.id}/interview`)} icon={<Mic className="h-4 w-4" />}>
                  Try a live interview
                </Button>
              )}
            </div>
          </div>
          <div className="hidden md:block">
            <OrbArt size={320} />
          </div>
        </div>
      </section>

      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Experts at risk" value={atRisk} hint="leaving within 90 days" tone={atRisk ? "danger" : "neutral"} />
          <Stat label="Knowledge atoms" value={atoms} hint="procedures, rules, gotchas, contacts…" />
          <Stat label="Average coverage" value={pct(avgCov)} hint="weighted by domain priority" tone={avgCov > 0.66 ? "sage" : "accent"} />
          <Stat label="Open questions" value={openQ} hint="queued for the next interview" tone={openQ ? "accent" : "neutral"} />
        </div>
      )}

      <section>
        <SectionTitle
          action={
            <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => nav("/new")}>
              New capture
            </Button>
          }
        >
          Captures
        </SectionTitle>
        {captures === null ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-paper-2" />
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
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { n: "01", icon: <Mic className="h-4 w-4" />, t: "Interview", b: "A voice agent interviews the expert one question at a time, following threads and probing for failure modes." },
          { n: "02", icon: <Sparkles className="h-4 w-4" />, t: "Distil", b: "Answers become typed knowledge atoms with source quotes. The coverage map fills in live." },
          { n: "03", icon: <ArrowRight className="h-4 w-4" />, t: "Hand over", b: "The successor asks the twin. Unanswered questions go straight back into the next interview." },
        ].map((s) => (
          <Card key={s.t} className="p-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-muted">{s.n}</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-3 text-accent">{s.icon}</span>
              <span className="font-display text-[19px]">{s.t}</span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{s.b}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
