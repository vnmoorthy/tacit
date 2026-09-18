import type { LLM } from "./llm.js";
import { chatJson } from "./llm.js";
import { answerPrompt, extractPrompt, nextQuestionPrompt, planPrompt, summaryPrompt } from "./prompts.js";
import type { RetrievedAtom } from "./retrieval.js";
import { KNOWN_TOOLS, pickTemplate } from "./templates.js";
import { splitSentences, tokenize, truncate, wordCount } from "./text.js";
import type { Atom, AtomType, Capture, Confidence, Domain, Expert, Question, Turn } from "./types.js";
import { ATOM_TYPES } from "./types.js";

/* ───────────────────────────── contracts ───────────────────────────── */

export interface PlanResult {
  domains: { name: string; description: string; priority: 1 | 2 | 3; questions: string[] }[];
}

export interface NextQuestionContext {
  capture: Capture;
  recentTurns: Turn[];
  lastAtoms: Atom[];
  successorQuestions: Question[];
  suggested: { domain: Domain; question: string } | null;
  isOpening: boolean;
  /** Recently captured atoms, so the interviewer can refer back to them. */
  memory?: Atom[];
}

export interface NextQuestion {
  say: string;
  kind: "opening" | "followup" | "new" | "successor" | "closing";
  domainId?: string;
  questionId?: string;
}

export interface ExtractedAtom {
  type: AtomType;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  domainId?: string;
  sourceQuote?: string;
}

export interface ExtractContext {
  capture: Capture;
  question: string;
  answer: string;
  domainHint?: string;
}

export interface AnswerContext {
  capture: Capture;
  question: string;
  hits: RetrievedAtom[];
  askedBy?: string;
}

export interface AnswerResult {
  answer: string;
  confidence: Confidence;
  used: number[];
}

export interface SummaryContext {
  capture: Capture;
  turns: Turn[];
  atoms: Atom[];
}

/** The "brain" behind the interviewer, the extractor and the twin. */
export interface Brain {
  readonly name: string;
  readonly model?: string;
  plan(input: { expert: Expert; context: string }): Promise<PlanResult>;
  nextQuestion(ctx: NextQuestionContext): Promise<NextQuestion>;
  extract(ctx: ExtractContext): Promise<ExtractedAtom[]>;
  answer(ctx: AnswerContext): Promise<AnswerResult>;
  summarize(ctx: SummaryContext): Promise<string>;
}

/* ───────────────────────── shared helpers ───────────────────────── */

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

const FILLER = /\b(um+|uh+|you know|i mean|sort of|kind of|like,)\b[, ]*/gi;
const LEADING = /^(?:(?:so|and|but|well|then|also|basically|honestly|okay|ok|right|yeah|yes|no|oh|look)[,\s]+)+/i;

export function cleanSentence(s: string): string {
  return s
    .replace(FILLER, "")
    .replace(/\s+/g, " ")
    .replace(LEADING, "")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function imperative(s: string): string {
  let t = cleanSentence(s);
  t = t.replace(
    /^(?:i|we|you|they|she|he|one|people)\s+(?:usually|always|normally|typically|often|just|generally|would|will|have to|need to|should|must|can|tend to|try to|also|still|do|do not|don't)?\s*/i,
    "",
  );
  t = t.replace(/^(?:the (?:trick|key|secret|rule|thing) (?:is|was)(?: to)?|the way (?:i|we) do it is)\s*/i, "");
  t = t.replace(/[.!?]+$/, "");
  return t.replace(/^./, (c) => c.toUpperCase());
}

export function findTools(s: string): string[] {
  const out: string[] = [];
  for (const t of KNOWN_TOOLS) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(s)) out.push(t);
  }
  return [...new Set(out)];
}

const CAP_STOP = new Set(["I", "I'm", "I'll", "I've", "The", "A", "An", "If", "When", "Then", "And", "But", "So", "It", "It's", "That", "This", "There", "Never", "Always", "First", "Second", "Finally", "Don't", "Do", "We", "You", "They", "He", "She", "My", "Our", "In", "On", "At", "For", "To", "Of", "By", "Every", "Anything", "Everything", "Nobody", "Sure", "Yes", "No", "Okay", "Well", "Usually", "Sometimes", "Normally", "Federal", "State", "Two", "Three", "One", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);

export function properNouns(s: string): string[] {
  const out: string[] = [];
  const re = /\b([A-Z][a-zA-Z'’]+(?:\s+[A-Z][a-zA-Z'’]+){0,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const phrase = m[1];
    const words = phrase.split(/\s+/).filter((w) => !CAP_STOP.has(w));
    if (!words.length) continue;
    if (m.index === 0 && words.length === 1 && CAP_STOP.has(phrase.split(" ")[0])) continue;
    out.push(words.join(" "));
  }
  return [...new Set(out)];
}

/* ─────────────────────────── HeuristicBrain ─────────────────────────── */

const CUES = {
  contact: /\b(call|ask|email|ping|reach out to|talk to|contact|escalate to|loop in|check with|go to|send (?:it )?to|our (?:named )?(?:rep|contact|admin)|the (?:person|guy|woman|man) who)\b/i,
  procedure: /\b(first|then|next|after that|step|finally|before (?:you|we|i|the)|once (?:you|we|i|it|the)|start by|lastly|followed by|secondly|after the|end to end)\b/i,
  rule: /\b(always|never|must|should|shouldn't|don't|do not|only|unless|whenever|make sure|rule of thumb|as long as|no matter|has to|have to|needs? to be|the real|not the|not \d)\b/i,
  gotcha: /\b(gotcha|trick|catch|watch out|careful|bug|weird|quirk|fails?|breaks?|silently|surprise|mistake|trap|nobody tells you|counterintuitive|doesn'?t (?:actually|really|mean)|looks like|but actually|can'?t (?:prioriti[sz]e|handle|do)|wrong period|isn'?t (?:actually|really))\b/i,
  risk: /\b(risk|audit|fines?|penalt(?:y|ies)|compliance|deadline|regulator|late|lose|lost|exposure|liabilit\w*|breach|outage|blocked|in my name|only i|former employee|personal calendar|before i leave)\b/i,
  decision: /\b(we decided|i decided|the reason|chose|instead of|trade-?offs?|depends on|judg(?:e)?ment call|weigh|costs? about|worth it|beats)\b/i,
  story: /\b(one time|once,|back in|remember when|years ago|there was a time|i'?ll never forget|last year|in 20\d\d|every mistake)\b/i,
  hedge: /\b(usually|sometimes|normally|most of the time|typically|generally|depends|almost always|nine times out of ten|ninety percent)\b/i,
};

const ACTION = /\b(run|check|pull|send|open|export|review|submit|file|update|call|log|approve|reconcile|verify|compare|process|enter|scale|restart|sync|merge|apply|rotate|book|calculate|generate|regenerate|fix|watch|keep|map|clear)\b/i;
const TEAM = /\b(team|desk|vendor|bank|support|helpdesk|it|hr|finance|treasury|legal|ops|accounting|security|carrier|agency|account team|client service)\b/i;

function glossaryTerm(s: string): string | null {
  const m1 = s.match(/\bwe call (?:it|that|this|them) (?:the |a )?["“]?([A-Za-z][\w\- ]{1,30}?)["”]?(?:[,.]|$)/i);
  if (m1) return m1[1].trim();
  const m2 = s.match(/\b([A-Z]{2,6})\b\s*(?:\(|is|means|stands for|—|–)/);
  if (m2 && !["I", "OK"].includes(m2[1])) return m2[1];
  const m3 = s.match(/\b([A-Z][\w-]+(?: [A-Z][\w-]+)?)\s*\(([A-Z]{2,6})\)/);
  if (m3) return `${m3[2]} — ${m3[1]}`;
  return null;
}

function classify(s: string): AtomType | null {
  const n = wordCount(s);
  if (n < 6) return null;
  if (CUES.story.test(s) && n >= 15) return "story";
  if (/^\s*(\d+[.)]|-|\*)\s/.test(s) || CUES.procedure.test(s)) return "procedure";
  if (CUES.contact.test(s) && (properNouns(s).length || TEAM.test(s))) return "contact";
  if (CUES.gotcha.test(s)) return "gotcha";
  if (glossaryTerm(s)) return "glossary";
  if (CUES.rule.test(s)) return "rule";
  if (CUES.risk.test(s)) return "risk";
  if (CUES.decision.test(s)) return "decision";
  if (findTools(s).length) return "tool";
  if (ACTION.test(s)) return "procedure";
  return null;
}

function contactName(s: string): string | null {
  const m = s.match(
    /(?:call|ask|email|ping|reach out to|talk to|contact|escalate to|loop in|check with|go to|send (?:it )?to|rep is|admin is|contact is)\s+((?:[A-Z][\w'’-]+)(?:\s+[A-Z][\w'’-]+)?(?:\s+(?:in|from|at|on)\s+[A-Z]?[\w-]+)?)/,
  );
  if (m) return m[1].replace(/[.,;]$/, "");
  const pn = properNouns(s).filter((p) => !findTools(s).includes(p));
  return pn[0] ?? null;
}

function salientTerm(text: string): string {
  const tools = findTools(text);
  if (tools.length) return tools[0];
  const pn = properNouns(text).filter((p) => p.split(" ").length <= 3);
  if (pn.length) return pn[0];
  const the = [...text.matchAll(/\bthe ([a-z][a-z-]+(?: [a-z][a-z-]+){0,2})\b/g)]
    .map((m) => m[1])
    .filter((p) => !/^(same|way|time|thing|things|one|ones|other|first|last|next|day|days|rest|point|end|case)$/.test(p));
  if (the.length) {
    the.sort((a, b) => b.length - a.length);
    return `the ${the[0]}`;
  }
  return "that";
}

function scoreDomain(tokens: Set<string>, d: Domain): number {
  const dt = new Set(tokenize(`${d.name} ${d.description} ${d.targetQuestions.join(" ")}`));
  let score = 0;
  for (const t of dt) if (tokens.has(t)) score++;
  return score;
}

function assignDomain(text: string, capture: Capture, hint?: string): string | undefined {
  const tokens = new Set(tokenize(text));
  const hintDomain = capture.domains.find((d) => d.id === hint);
  let best: Domain | null = null;
  let bestScore = 0;
  for (const d of capture.domains) {
    const sc = scoreDomain(tokens, d);
    if (sc > bestScore) {
      best = d;
      bestScore = sc;
    }
  }
  if (hintDomain && (bestScore < 3 || best?.id === hintDomain.id)) return hintDomain.id;
  if (best && bestScore >= 2) return best.id;
  return hint ?? capture.domains[0]?.id;
}

function makeTags(s: string, type: AtomType): string[] {
  const tags = [...findTools(s), ...properNouns(s).slice(0, 3)];
  const nums = s.match(/\$\d[\d,]*|\d+(?:\.\d+)?\s?%|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi) ?? [];
  tags.push(...nums);
  return [...new Set(tags.map((t) => t.trim()))].filter(Boolean).slice(0, 5).concat(type === "procedure" ? [] : []);
}

export class HeuristicBrain implements Brain {
  readonly name = "demo-brain";

  async plan(input: { expert: Expert; context: string }): Promise<PlanResult> {
    const t = pickTemplate(input.expert.role, input.context);
    const tools = findTools(input.context);
    const domains = t.domains.slice(0, 8).map((d) => ({
      name: d.name,
      description: d.description,
      priority: d.priority,
      questions: [...d.questions],
    }));
    if (tools.length) {
      const sys = domains.find((d) => /system|tool/i.test(d.name));
      if (sys) sys.description = `${sys.description} Known systems: ${tools.slice(0, 6).join(", ")}.`;
    }
    return { domains };
  }

  async nextQuestion(ctx: NextQuestionContext): Promise<NextQuestion> {
    const { capture, recentTurns, successorQuestions, suggested } = ctx;
    const first = firstName(capture.expert.name);
    const successorName = capture.successor?.name ?? "your successor";
    const lowest = [...capture.domains].sort((a, b) => a.coverage - b.coverage)[0];

    if (successorQuestions.length) {
      const q = successorQuestions[0];
      const who = q.askedBy ?? successorName;
      const lead = ctx.isOpening ? `Hi ${first}, good to have you back. ` : "Thanks. ";
      return {
        say: `${lead}Before we go on, ${who} asked something I couldn't answer from what we have so far: ${lowerFirst(q.text.replace(/[?]+$/, ""))}? How would you handle that?`,
        kind: "successor",
        questionId: q.id,
        domainId: q.domainId ?? suggested?.domain.id ?? lowest?.id,
      };
    }

    if (ctx.isOpening) {
      const q = suggested?.question ?? "What do you do that nobody else knows how to do?";
      return {
        say: `Hi ${first}, I'm Tacit. I'll ask about how you really do your job so ${successorName} can pick it up without you. Let's start here: ${lowerFirst(q)}`,
        kind: "opening",
        domainId: suggested?.domain.id ?? lowest?.id,
      };
    }

    const lastExpert = [...recentTurns].reverse().find((t) => t.role === "expert");
    const lastInterviewer = [...recentTurns].reverse().find((t) => t.role === "interviewer");
    let followupsInRow = 0;
    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const t = recentTurns[i];
      if (t.role !== "interviewer") continue;
      if (t.kind === "followup") followupsInRow++;
      else break;
    }
    const text = lastExpert?.text ?? "";
    const wantsFollowup = text && wordCount(text) >= 12 && followupsInRow < 2 && (CUES.hedge.test(text) || ctx.lastAtoms.length > 0);

    if (wantsFollowup) {
      const hedge = text.match(CUES.hedge)?.[0];
      const term = salientTerm(text);
      const variants = [
        hedge ? `You said "${hedge}". When isn't that the case, and what do you do instead?` : null,
        `You mentioned ${term}. What goes wrong with ${term} most often, and how do you know when it has?`,
        `Can you give me the exact steps for ${term}, as if I had to do it tomorrow?`,
        `Who else is involved when ${term} comes up, and who actually gets it unstuck?`,
        `Is there a cut-off, deadline or timing rule around ${term} that people tend to miss?`,
      ].filter(Boolean) as string[];
      const idx = (recentTurns.length + followupsInRow) % variants.length;
      return { say: variants[idx], kind: "followup", domainId: lastInterviewer?.domainId ?? suggested?.domain.id };
    }

    if (suggested) {
      const moving = lastInterviewer && lastInterviewer.domainId !== suggested.domain.id;
      // React to what was actually said: name a captured detail, admit a thin answer, or say nothing.
      const thin = !text || wordCount(text) < 8 || /\b(i don'?t know|not sure|nothing much|no idea|can'?t think)\b/i.test(text);
      const first = ctx.lastAtoms[0];
      const reaction = first
        ? `${first.type === "contact" ? "Good to know who to call" : first.type === "gotcha" ? "That's the kind of trap that never makes the manual" : first.type === "rule" ? "That's a rule worth writing down" : `Noted — ${first.title.toLowerCase()}`}. `
        : thin && text
          ? "Fair enough, that one's hard to pin down. "
          : "";
      const lead = moving ? `${reaction}Let's turn to ${suggested.domain.name.toLowerCase()}. ` : reaction;
      return { say: lead + suggested.question, kind: "new", domainId: suggested.domain.id };
    }

    const closers = [
      "Is there anything you're worried nobody will know once you've left?",
      `What would you put on a sticky note for ${successorName}?`,
      "Which relationships should your successor rebuild first, and how?",
      "What is the one thing that, if it slipped, would embarrass the company?",
    ];
    return { say: closers[recentTurns.length % closers.length], kind: "closing", domainId: lowest?.id };
  }

  async extract(ctx: ExtractContext): Promise<ExtractedAtom[]> {
    const { capture, answer, domainHint } = ctx;
    const sentences = splitSentences(answer).filter((s) => wordCount(s) >= 6);
    const atoms: ExtractedAtom[] = [];
    let proc: string[] = [];
    const flush = () => {
      if (!proc.length) return;
      const quote = truncate(proc.join(" "), 240);
      const content = proc.length > 1 ? proc.map((p, i) => `${i + 1}. ${cleanSentence(p)}`).join("\n") : cleanSentence(proc[0]);
      atoms.push({
        type: "procedure",
        title: truncate(imperative(proc[0]), 64),
        content,
        tags: makeTags(proc.join(" "), "procedure"),
        confidence: Math.min(0.85, 0.6 + 0.08 * proc.length),
        domainId: assignDomain(proc.join(" "), capture, domainHint),
        sourceQuote: quote,
      });
      proc = [];
    };
    for (const s of sentences) {
      const type = classify(s);
      if (type === "procedure") {
        proc.push(s);
        continue;
      }
      flush();
      if (!type) continue;
      let title: string;
      switch (type) {
        case "contact": {
          const who = contactName(s);
          title = who ? `Contact: ${who}` : truncate(imperative(s), 64);
          break;
        }
        case "tool": {
          const t = findTools(s)[0];
          title = t ? `Tool: ${t}` : truncate(imperative(s), 64);
          break;
        }
        case "glossary": {
          title = glossaryTerm(s) ?? truncate(imperative(s), 64);
          break;
        }
        default:
          title = truncate(imperative(s), 64);
      }
      const cueHits = Object.values(CUES).filter((re) => re.test(s)).length;
      atoms.push({
        type,
        title,
        content: cleanSentence(s),
        tags: makeTags(s, type),
        confidence: Math.min(0.85, 0.5 + 0.1 * cueHits),
        domainId: assignDomain(s, capture, domainHint),
        sourceQuote: truncate(s, 200),
      });
    }
    flush();
    const seen = new Set<string>();
    return atoms
      .filter((a) => {
        const k = a.title.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 6);
  }

  async answer(ctx: AnswerContext): Promise<AnswerResult> {
    const { capture, hits } = ctx;
    const first = firstName(capture.expert.name);
    if (!hits.length) {
      return {
        answer: `I don't have anything from ${first} on that yet. I've queued it for the next interview so ${first} can answer it directly.`,
        confidence: "none",
        used: [],
      };
    }
    const strength = hits[0].strength;
    const confidence: Confidence = strength >= 0.62 ? "high" : strength >= 0.3 ? "medium" : strength > 0.08 ? "low" : "none";
    const top = hits.slice(0, 3);
    const parts = top.map((h, i) => `**${h.atom.title}** [${i + 1}]\n${h.atom.content}`);
    let answer = `Here's what ${first} has said about this:\n\n${parts.join("\n\n")}`;
    if (confidence === "low" || confidence === "none") {
      answer += `\n\nI'm not confident this fully answers your question, so I've queued it for ${first}'s next session.`;
    }
    return { answer, confidence, used: top.map((_, i) => i + 1) };
  }

  async summarize(ctx: SummaryContext): Promise<string> {
    const { capture, turns, atoms } = ctx;
    const names = [...new Set(turns.filter((t) => t.role === "interviewer" && t.domainId).map((t) => capture.domains.find((d) => d.id === t.domainId)?.name).filter(Boolean))];
    const top = atoms.slice(0, 3).map((a) => a.title.toLowerCase());
    const remaining = capture.domains.reduce((acc, d) => acc + Math.max(0, d.targetQuestions.length - d.askedCount), 0);
    return `Covered ${names.length} domain${names.length === 1 ? "" : "s"}${names.length ? ` (${names.join(", ")})` : ""}. Captured ${atoms.length} knowledge atom${atoms.length === 1 ? "" : "s"}${top.length ? `, including ${top.join("; ")}` : ""}. ${remaining} planned question${remaining === 1 ? "" : "s"} remain.`;
  }
}

function lowerFirst(s: string): string {
  return s.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());
}

/* ───────────────────────────── LLMBrain ───────────────────────────── */

export interface LLMBrainOptions {
  fallback?: Brain;
  onError?: (stage: string, err: unknown) => void;
}

/** Uses a real model; falls back to the heuristic brain if a call fails so the product never stalls. */
export class LLMBrain implements Brain {
  readonly name: string;
  readonly model: string;
  private fallback: Brain;
  private onError: (stage: string, err: unknown) => void;

  constructor(private llm: LLM, opts: LLMBrainOptions = {}) {
    this.name = llm.name;
    this.model = llm.model;
    this.fallback = opts.fallback ?? new HeuristicBrain();
    this.onError = opts.onError ?? (() => {});
  }

  async plan(input: { expert: Expert; context: string }): Promise<PlanResult> {
    try {
      const r = await chatJson<PlanResult>(this.llm, planPrompt(input), { maxTokens: 1400, temperature: 0.5 });
      const domains = (r.domains ?? [])
        .filter((d) => d && typeof d.name === "string" && Array.isArray(d.questions) && d.questions.length)
        .slice(0, 8)
        .map((d) => ({
          name: String(d.name).slice(0, 80),
          description: String(d.description ?? "").slice(0, 200),
          priority: ([1, 2, 3] as const).includes(Number(d.priority) as 1 | 2 | 3) ? (Number(d.priority) as 1 | 2 | 3) : 2,
          questions: d.questions.map(String).slice(0, 5),
        }));
      if (domains.length < 3) throw new Error("model returned too few domains");
      return { domains };
    } catch (err) {
      this.onError("plan", err);
      return this.fallback.plan(input);
    }
  }

  async nextQuestion(ctx: NextQuestionContext): Promise<NextQuestion> {
    try {
      const r = await chatJson<{ say: string; kind: string; domainId?: string; questionId?: string | null }>(
        this.llm,
        nextQuestionPrompt({
          capture: ctx.capture,
          recentTurns: ctx.recentTurns,
          lastAtoms: ctx.lastAtoms,
          successorQuestions: ctx.successorQuestions,
          suggestedDomain: ctx.suggested?.domain ?? null,
          suggestedQuestion: ctx.suggested?.question ?? null,
          isOpening: ctx.isOpening,
          memory: ctx.memory,
        }),
        { maxTokens: 320, temperature: 0.7 },
      );
      const say = String(r.say ?? "").trim();
      if (!say) throw new Error("empty question");
      let kind = (["followup", "new", "successor"].includes(r.kind) ? r.kind : "new") as NextQuestion["kind"];
      let questionId: string | undefined;
      if (kind === "successor") {
        const q = ctx.successorQuestions.find((q) => q.id === r.questionId) ?? ctx.successorQuestions[0];
        if (q) questionId = q.id;
        else kind = "new";
      }
      if (ctx.isOpening && kind !== "successor") kind = "opening";
      const domainId = ctx.capture.domains.some((d) => d.id === r.domainId) ? r.domainId : ctx.suggested?.domain.id;
      return { say: truncate(say, 400), kind, domainId, questionId };
    } catch (err) {
      this.onError("nextQuestion", err);
      return this.fallback.nextQuestion(ctx);
    }
  }

  async extract(ctx: ExtractContext): Promise<ExtractedAtom[]> {
    try {
      const r = await chatJson<{ atoms: Partial<ExtractedAtom>[] }>(this.llm, extractPrompt(ctx), { maxTokens: 1400, temperature: 0.2 });
      const out: ExtractedAtom[] = [];
      for (const a of r.atoms ?? []) {
        if (!a || typeof a.title !== "string" || typeof a.content !== "string") continue;
        const type = (ATOM_TYPES as string[]).includes(String(a.type)) ? (a.type as AtomType) : "rule";
        const conf = Number(a.confidence);
        out.push({
          type,
          title: truncate(a.title, 80),
          content: a.content.trim(),
          tags: Array.isArray(a.tags) ? a.tags.map(String).slice(0, 6) : [],
          confidence: Number.isFinite(conf) ? Math.max(0.2, Math.min(0.98, conf)) : 0.7,
          domainId: ctx.capture.domains.some((d) => d.id === a.domainId) ? (a.domainId as string) : ctx.domainHint,
          sourceQuote: typeof a.sourceQuote === "string" ? truncate(a.sourceQuote, 240) : undefined,
        });
      }
      return out.slice(0, 6);
    } catch (err) {
      this.onError("extract", err);
      return this.fallback.extract(ctx);
    }
  }

  async answer(ctx: AnswerContext): Promise<AnswerResult> {
    if (!ctx.hits.length) return this.fallback.answer(ctx);
    try {
      const r = await chatJson<AnswerResult>(
        this.llm,
        answerPrompt({ capture: ctx.capture, question: ctx.question, atoms: ctx.hits.map((h) => h.atom), askedBy: ctx.askedBy }),
        { maxTokens: 700, temperature: 0.2 },
      );
      const answer = String(r.answer ?? "").trim();
      if (!answer) throw new Error("empty answer");
      const confidence = (["high", "medium", "low", "none"].includes(r.confidence) ? r.confidence : "medium") as Confidence;
      const used = Array.isArray(r.used) ? r.used.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= ctx.hits.length) : [];
      return { answer, confidence, used };
    } catch (err) {
      this.onError("answer", err);
      return this.fallback.answer(ctx);
    }
  }

  async summarize(ctx: SummaryContext): Promise<string> {
    try {
      const s = await this.llm.chat(summaryPrompt(ctx), { maxTokens: 300, temperature: 0.3 });
      return s.trim() || (await this.fallback.summarize(ctx));
    } catch (err) {
      this.onError("summarize", err);
      return this.fallback.summarize(ctx);
    }
  }
}
