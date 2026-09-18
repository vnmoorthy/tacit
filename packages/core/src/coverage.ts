import type { Atom, Capture, Domain, Question, Session, Turn } from "./types.js";

export function domainCoverage(d: Domain): number {
  const targets = Math.max(1, d.targetQuestions.length);
  const asked = Math.min(d.askedCount, targets) / targets;
  const depth = Math.min(1, d.atomCount / 5);
  return Math.max(0, Math.min(1, 0.55 * asked + 0.45 * depth));
}

/** Recompute per-domain and capture-level statistics from the raw records. */
export function recomputeCapture(
  capture: Capture,
  atoms: Atom[],
  sessions: Session[],
  turns: Turn[],
  questions: Question[],
): Capture {
  const byDomain = new Map<string, number>();
  for (const a of atoms) if (a.domainId) byDomain.set(a.domainId, (byDomain.get(a.domainId) ?? 0) + 1);
  const domains = capture.domains.map((d) => {
    const nd = { ...d, atomCount: byDomain.get(d.id) ?? 0 };
    nd.coverage = domainCoverage(nd);
    return nd;
  });
  const weights = domains.map((d) => (d.priority === 1 ? 3 : d.priority === 2 ? 2 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const coverage = domains.reduce((acc, d, i) => acc + d.coverage * weights[i], 0) / wsum;
  const minutes = sessions.reduce((acc, s) => {
    const end = s.endedAt ? Date.parse(s.endedAt) : Date.now();
    return acc + Math.max(0, (end - Date.parse(s.startedAt)) / 60000);
  }, 0);
  const status: Capture["status"] = capture.status === "complete" ? "complete" : sessions.length ? "active" : "planning";
  return {
    ...capture,
    domains,
    status,
    stats: {
      atoms: atoms.length,
      verifiedAtoms: atoms.filter((a) => a.verified).length,
      sessions: sessions.length,
      turns: turns.length,
      minutes: Math.round(minutes),
      coverage,
      openQuestions: questions.filter((q) => q.status === "open" && q.source !== "plan").length,
    },
  };
}

/** Planner: which domain and target question should be asked next? */
export function suggestNext(capture: Capture): { domain: Domain; question: string } | null {
  const candidates = capture.domains.filter((d) => d.askedCount < d.targetQuestions.length);
  if (!candidates.length) return null;
  const score = (d: Domain) => d.coverage - (3 - d.priority) * 0.18;
  candidates.sort((a, b) => score(a) - score(b));
  const domain = candidates[0];
  return { domain, question: domain.targetQuestions[domain.askedCount] };
}

export function daysUntil(dateIso?: string): number | null {
  if (!dateIso) return null;
  const d = Date.parse(dateIso);
  if (!Number.isFinite(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}
