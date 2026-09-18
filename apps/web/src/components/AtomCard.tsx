import { AlertTriangle, BookOpen, CheckCircle2, GitBranch, ListOrdered, Pencil, Quote, Scale, ShieldAlert, Trash2, User, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { Atom, AtomType } from "@tacit/core";
import { Badge, cx, type Tone } from "./ui.js";
import { Markdown } from "./Markdown.js";

export const ATOM_META: Record<AtomType, { label: string; tone: Tone; icon: ReactNode; blurb: string }> = {
  procedure: { label: "Procedure", tone: "info", icon: <ListOrdered className="h-3 w-3" />, blurb: "Ordered steps" },
  rule: { label: "Rule", tone: "ink", icon: <Scale className="h-3 w-3" />, blurb: "Always / never / if-then" },
  gotcha: { label: "Gotcha", tone: "amber", icon: <AlertTriangle className="h-3 w-3" />, blurb: "Trap or quirk" },
  contact: { label: "Contact", tone: "sage", icon: <User className="h-3 w-3" />, blurb: "Who to call" },
  tool: { label: "Tool", tone: "plum", icon: <Wrench className="h-3 w-3" />, blurb: "System, report, script" },
  decision: { label: "Decision", tone: "teal", icon: <GitBranch className="h-3 w-3" />, blurb: "Judgement call" },
  glossary: { label: "Glossary", tone: "neutral", icon: <BookOpen className="h-3 w-3" />, blurb: "Term or acronym" },
  risk: { label: "Risk", tone: "danger", icon: <ShieldAlert className="h-3 w-3" />, blurb: "What can go wrong" },
  story: { label: "Story", tone: "rose", icon: <Quote className="h-3 w-3" />, blurb: "Anecdote worth keeping" },
};

export function AtomTypeBadge({ type }: { type: AtomType }) {
  const m = ATOM_META[type];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {m.label}
    </Badge>
  );
}

export function AtomCard({
  atom,
  domainName,
  onVerify,
  onDelete,
  onEdit,
  highlight,
  compact,
  citation,
}: {
  atom: Atom;
  domainName?: string;
  onVerify?: (a: Atom, verified: boolean) => void;
  onDelete?: (a: Atom) => void;
  onEdit?: (a: Atom) => void;
  highlight?: boolean;
  compact?: boolean;
  citation?: number;
}) {
  return (
    <article
      className={cx(
        "group relative rounded-xl border bg-paper-2/80 transition-all",
        highlight ? "border-accent shadow-lift ring-1 ring-accent/50" : "border-line shadow-soft hover:border-line-2",
        compact ? "p-3.5" : "p-4",
      )}
    >
      <div className="flex items-start gap-3">
        {citation !== undefined && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent font-mono text-[11px] font-semibold text-[#0e1013]">{citation}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <AtomTypeBadge type={atom.type} />
            {atom.verified && (
              <Badge tone="sage" icon={<CheckCircle2 className="h-3 w-3" />}>
                Verified
              </Badge>
            )}
            {domainName && <span className="text-[11.5px] text-muted truncate">· {domainName}</span>}
            <span className="ml-auto font-mono text-[10.5px] text-muted/80">{Math.round(atom.confidence * 100)}%</span>
          </div>
          <h4 className={cx("font-display mt-2 leading-snug", compact ? "text-[15px]" : "text-[17px]")}>{atom.title}</h4>
          {!compact && (
            <div className="mt-1.5 text-[13.5px] text-ink-2">
              <Markdown>{atom.content}</Markdown>
            </div>
          )}
          {compact && <p className="mt-1 text-[12.5px] text-ink-2 line-clamp-2">{atom.content.replace(/\n+/g, " ")}</p>}
          {!compact && atom.sourceQuote && (
            <p className="mt-2.5 border-l-2 border-accent pl-3 text-[13.5px] italic text-ink-2/90">“{atom.sourceQuote}”</p>
          )}
          {!compact && atom.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {atom.tags.map((t) => (
                <span key={t} className="rounded-md bg-paper-3 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {(onVerify || onDelete || onEdit) && (
        <div className="absolute right-3 top-3 hidden items-center gap-1 rounded-full border border-line-2 bg-paper-3 px-1 py-0.5 shadow-soft group-hover:flex">
          {onVerify && (
            <button
              title={atom.verified ? "Unverify" : "Mark verified by expert"}
              onClick={() => onVerify(atom, !atom.verified)}
              className={cx("rounded-full p-1.5 hover:bg-sage-2", atom.verified ? "text-sage" : "text-muted")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onEdit && (
            <button title="Edit" onClick={() => onEdit(atom)} className="rounded-full p-1.5 text-muted hover:bg-paper-2 hover:text-ink">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button title="Delete" onClick={() => onDelete(atom)} className="rounded-full p-1.5 text-muted hover:bg-danger-2 hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
