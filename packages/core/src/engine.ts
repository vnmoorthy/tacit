import type { Brain, NextQuestion } from "./brain.js";
import { recomputeCapture, suggestNext } from "./coverage.js";
import { buildGraph, type GraphData } from "./graph.js";
import { compileHandover } from "./handover.js";
import { newId, nowIso } from "./ids.js";
import type { Embedder } from "./llm.js";
import { INTERVIEWER_PERSONA, captureBrief, coverageBrief } from "./prompts.js";
import { ensureEmbeddings, retrieve } from "./retrieval.js";
import type { Store } from "./store.js";
import { wordCount } from "./text.js";
import type {
  AskResult,
  Atom,
  Capture,
  Citation,
  CreateCaptureInput,
  Domain,
  EngineInfo,
  ID,
  Question,
  QuestionSource,
  Session,
  SessionMode,
  Turn,
  TurnResult,
} from "./types.js";

export interface EngineOptions {
  store: Store;
  brain: Brain;
  embedder?: Embedder | null;
  voice?: { higgs: boolean; browser: boolean };
}

export interface SessionDetail {
  session: Session;
  turns: Turn[];
  atoms: Atom[];
  capture: Capture;
}

export interface CaptureBundle {
  capture: Capture;
  sessions: Session[];
  turns: Turn[];
  atoms: Atom[];
  questions: Question[];
}

export interface AtomFilter {
  q?: string;
  type?: string;
  domainId?: string;
  verified?: boolean;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/**
 * The Tacit engine: orchestrates captures, interview sessions, extraction,
 * retrieval and the successor twin. Runs on the server and in the browser.
 */
export class Engine {
  readonly store: Store;
  readonly brain: Brain;
  readonly embedder: Embedder | null;
  private voice: { higgs: boolean; browser: boolean };

  constructor(o: EngineOptions) {
    this.store = o.store;
    this.brain = o.brain;
    this.embedder = o.embedder ?? null;
    this.voice = o.voice ?? { higgs: false, browser: true };
  }

  info(): EngineInfo {
    return {
      brain: this.brain.name,
      model: this.brain.model,
      embeddings: this.embedder ? `${this.embedder.name}/${this.embedder.model}` : undefined,
      voice: this.voice,
    };
  }

  /* ────────────────────────── captures ────────────────────────── */

  listCaptures(): Promise<Capture[]> {
    return this.store.listCaptures();
  }

  async getCapture(id: ID): Promise<Capture> {
    const c = await this.store.getCapture(id);
    if (!c) throw new NotFoundError("capture");
    return c;
  }

  async createCapture(input: CreateCaptureInput): Promise<Capture> {
    const plan = await this.brain.plan({ expert: input.expert, context: input.context });
    const now = nowIso();
    const domains: Domain[] = plan.domains.map((d) => ({
      id: newId("dom"),
      name: d.name,
      description: d.description,
      priority: d.priority,
      targetQuestions: d.questions,
      askedCount: 0,
      atomCount: 0,
      coverage: 0,
    }));
    const capture: Capture = {
      id: newId("cap"),
      createdAt: now,
      updatedAt: now,
      title: input.title?.trim() || `${input.expert.name} — ${input.expert.role}`,
      expert: input.expert,
      successor: input.successor,
      context: input.context,
      status: "planning",
      domains,
      stats: { atoms: 0, verifiedAtoms: 0, sessions: 0, turns: 0, minutes: 0, coverage: 0, openQuestions: 0 },
    };
    await this.store.putCapture(recomputeCapture(capture, [], [], [], []));
    return this.getCapture(capture.id);
  }

  async updateCapture(id: ID, patch: Partial<Pick<Capture, "title" | "expert" | "successor" | "context" | "status" | "voiceId">>): Promise<Capture> {
    const c = await this.getCapture(id);
    const next = { ...c, ...patch, updatedAt: nowIso() };
    await this.store.putCapture(next);
    return this.refresh(id);
  }

  async deleteCapture(id: ID): Promise<void> {
    await this.getCapture(id);
    await this.store.deleteCapture(id);
  }

  /** Recompute stats/coverage from raw records and persist. */
  async refresh(captureId: ID): Promise<Capture> {
    const c = await this.getCapture(captureId);
    const [atoms, sessions, turns, questions] = await Promise.all([
      this.store.listAtoms(captureId),
      this.store.listSessions(captureId),
      this.store.listTurnsForCapture(captureId),
      this.store.listQuestions(captureId),
    ]);
    const next = { ...recomputeCapture(c, atoms, sessions, turns, questions), updatedAt: nowIso() };
    await this.store.putCapture(next);
    return next;
  }

  async exportCapture(captureId: ID): Promise<CaptureBundle> {
    const capture = await this.getCapture(captureId);
    const [sessions, turns, atoms, questions] = await Promise.all([
      this.store.listSessions(captureId),
      this.store.listTurnsForCapture(captureId),
      this.store.listAtoms(captureId),
      this.store.listQuestions(captureId),
    ]);
    return { capture, sessions, turns, atoms, questions };
  }

  /** Import a bundle (used for bundled samples and JSON import). Overwrites records with the same ids. */
  async importBundle(b: CaptureBundle): Promise<Capture> {
    await this.store.putCapture(b.capture);
    for (const s of b.sessions) await this.store.putSession(s);
    for (const t of b.turns) await this.store.putTurn(t);
    for (const a of b.atoms) await this.store.putAtom(a);
    for (const q of b.questions) await this.store.putQuestion(q);
    await ensureEmbeddings(this.store, this.embedder, b.atoms);
    return this.refresh(b.capture.id);
  }

  /* ────────────────────────── sessions ────────────────────────── */

  listSessions(captureId: ID): Promise<Session[]> {
    return this.store.listSessions(captureId);
  }

  async getSession(sessionId: ID): Promise<SessionDetail> {
    const session = await this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("session");
    const [turns, allAtoms, capture] = await Promise.all([
      this.store.listTurns(sessionId),
      this.store.listAtoms(session.captureId),
      this.getCapture(session.captureId),
    ]);
    return { session, turns, atoms: allAtoms.filter((a) => a.sessionId === sessionId), capture };
  }

  async startSession(captureId: ID, mode: SessionMode): Promise<{ session: Session; interviewerTurn: Turn; capture: Capture }> {
    let capture = await this.getCapture(captureId);
    const session: Session = {
      id: newId("ses"),
      captureId,
      mode,
      startedAt: nowIso(),
      turnCount: 0,
      atomCount: 0,
    };
    await this.store.putSession(session);
    const interviewerTurn = await this.generateInterviewerTurn(session, capture, [], [], true);
    capture = await this.refresh(captureId);
    return { session: (await this.store.getSession(session.id))!, interviewerTurn, capture };
  }

  /** Record what the interviewer said (used by the Higgs speech-to-speech path where the model speaks on its own). */
  async interviewerTurn(sessionId: ID, text: string, meta: { kind?: Turn["kind"]; domainId?: ID } = {}): Promise<Turn> {
    const session = await this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("session");
    const turns = await this.store.listTurns(sessionId);
    const last = [...turns].reverse().find((t) => t.role === "interviewer");
    const turn: Turn = {
      id: newId("turn"),
      sessionId,
      captureId: session.captureId,
      role: "interviewer",
      text: text.trim(),
      at: nowIso(),
      kind: meta.kind ?? "new",
      domainId: meta.domainId ?? last?.domainId,
    };
    await this.store.putTurn(turn);
    session.turnCount = turns.length + 1;
    await this.store.putSession(session);
    return turn;
  }

  async expertTurn(sessionId: ID, text: string, opts: { generateNext?: boolean } = {}): Promise<TurnResult> {
    const generateNext = opts.generateNext ?? true;
    const session = await this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("session");
    if (session.endedAt) throw new Error("session has ended");
    let capture = await this.getCapture(session.captureId);
    const turns = await this.store.listTurns(sessionId);
    const lastInterviewer = [...turns].reverse().find((t) => t.role === "interviewer");

    const expertTurn: Turn = {
      id: newId("turn"),
      sessionId,
      captureId: capture.id,
      role: "expert",
      text: text.trim(),
      at: nowIso(),
      domainId: lastInterviewer?.domainId,
      extractedAtomIds: [],
    };
    await this.store.putTurn(expertTurn);

    // 1. Extract knowledge atoms and (in parallel) decide the next question. The planner
    //    sees the transcript including this answer, so it doesn't need to wait for atoms.
    const substantive = wordCount(expertTurn.text) >= 6;
    const extractP = substantive
      ? this.brain.extract({
          capture,
          question: lastInterviewer?.text ?? "Tell me about your work.",
          answer: expertTurn.text,
          domainHint: lastInterviewer?.domainId,
        })
      : Promise.resolve([]);
    const nextP = generateNext ? this.planNext(capture, [...turns, expertTurn], [], false) : Promise.resolve(null);
    const [extracted, planned] = await Promise.all([extractP, nextP]);

    let atoms: Atom[] = [];
    if (extracted.length) {
      const now = nowIso();
      atoms = extracted.map((e) => ({
        id: newId("atom"),
        captureId: capture.id,
        sessionId,
        turnId: expertTurn.id,
        domainId: e.domainId,
        type: e.type,
        title: e.title,
        content: e.content,
        tags: e.tags,
        confidence: e.confidence,
        verified: false,
        sourceQuote: e.sourceQuote,
        createdAt: now,
        updatedAt: now,
      }));
      for (const a of atoms) await this.store.putAtom(a);
      expertTurn.extractedAtomIds = atoms.map((a) => a.id);
      await this.store.putTurn(expertTurn);
      void ensureEmbeddings(this.store, this.embedder, atoms);
    }

    // 2. If this answered a queued successor question, close it.
    if (lastInterviewer?.questionId) {
      const q = await this.store.getQuestion(lastInterviewer.questionId);
      if (q && atoms.length) {
        q.status = "answered";
        q.answeredAt = nowIso();
        q.answerAtomIds = atoms.map((a) => a.id);
        await this.store.putQuestion(q);
      }
    }

    session.turnCount = turns.length + 1;
    session.atomCount = (await this.store.listAtoms(capture.id)).filter((a) => a.sessionId === sessionId).length;
    await this.store.putSession(session);
    capture = await this.refresh(capture.id);

    // 3. Persist the interviewer's next move.
    let interviewerTurn: Turn | null = null;
    if (planned) {
      interviewerTurn = await this.commitInterviewerTurn(session, capture, [...turns, expertTurn], planned);
      capture = await this.refresh(capture.id);
    }
    return { expertTurn, atoms, interviewerTurn, capture };
  }

  private async planNext(capture: Capture, turns: Turn[], lastAtoms: Atom[], isOpening: boolean): Promise<NextQuestion> {
    const questions = await this.store.listQuestions(capture.id);
    const successorQuestions = questions.filter((q) => q.status === "open" && (q.source === "successor" || q.source === "gap"));
    const suggested = suggestNext(capture);
    return this.brain.nextQuestion({ capture, recentTurns: turns.slice(-10), lastAtoms, successorQuestions, suggested, isOpening });
  }

  private async commitInterviewerTurn(session: Session, capture: Capture, turns: Turn[], nq: NextQuestion): Promise<Turn> {
    const turn: Turn = {
      id: newId("turn"),
      sessionId: session.id,
      captureId: capture.id,
      role: "interviewer",
      text: nq.say,
      at: nowIso(),
      kind: nq.kind,
      domainId: nq.domainId,
      questionId: nq.questionId,
    };
    await this.store.putTurn(turn);

    if ((nq.kind === "new" || nq.kind === "opening") && nq.domainId) {
      const d = capture.domains.find((x) => x.id === nq.domainId);
      if (d && d.askedCount < d.targetQuestions.length) {
        d.askedCount += 1;
        await this.store.putCapture(capture);
      }
    }
    if (nq.kind === "successor" && nq.questionId) {
      const q = await this.store.getQuestion(nq.questionId);
      if (q) {
        q.status = "asked";
        await this.store.putQuestion(q);
      }
    }
    session.turnCount = turns.length + 1;
    await this.store.putSession(session);
    return turn;
  }

  private async generateInterviewerTurn(session: Session, capture: Capture, turns: Turn[], lastAtoms: Atom[], isOpening: boolean): Promise<Turn> {
    const nq = await this.planNext(capture, turns, lastAtoms, isOpening);
    return this.commitInterviewerTurn(session, capture, turns, nq);
  }

  async endSession(sessionId: ID): Promise<Session> {
    const session = await this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("session");
    if (session.endedAt) return session;
    const capture = await this.getCapture(session.captureId);
    const turns = await this.store.listTurns(sessionId);
    const atoms = (await this.store.listAtoms(capture.id)).filter((a) => a.sessionId === sessionId);
    session.endedAt = nowIso();
    session.turnCount = turns.length;
    session.atomCount = atoms.length;
    // Re-open any successor question that was asked but not answered.
    for (const t of turns) {
      if (t.role === "interviewer" && t.questionId) {
        const q = await this.store.getQuestion(t.questionId);
        if (q && q.status === "asked") {
          q.status = "open";
          await this.store.putQuestion(q);
        }
      }
    }
    if (turns.some((t) => t.role === "expert")) {
      session.summary = await this.brain.summarize({ capture, turns, atoms });
    }
    await this.store.putSession(session);
    await this.refresh(capture.id);
    return session;
  }

  /** System instructions for a speech-to-speech model that runs the interview itself (Higgs Realtime). */
  async interviewerInstructions(captureId: ID): Promise<string> {
    const capture = await this.getCapture(captureId);
    const questions = await this.store.listQuestions(captureId);
    const successorQuestions = questions.filter((q) => q.status === "open" && (q.source === "successor" || q.source === "gap"));
    const suggested = suggestNext(capture);
    return [
      INTERVIEWER_PERSONA,
      "",
      captureBrief(capture),
      "",
      "Coverage map (ask unasked questions from low-coverage, high-priority domains; follow up on anything surprising):",
      coverageBrief(capture.domains),
      successorQuestions.length
        ? `\nThe successor already asked these and got no answer — ask them early, in the expert's language:\n${successorQuestions.map((q) => `- ${q.text}`).join("\n")}`
        : "",
      suggested ? `\nOpen by greeting ${capture.expert.name.split(" ")[0]} in one sentence, then ask: "${suggested.question}"` : "",
      "\nAsk exactly one question per turn. Keep every turn under 45 words.",
    ]
      .filter((l) => l !== "")
      .join("\n");
  }

  /* ─────────────────────────── atoms ─────────────────────────── */

  async listAtoms(captureId: ID, filter: AtomFilter = {}): Promise<Atom[]> {
    let atoms = await this.store.listAtoms(captureId);
    if (filter.type) atoms = atoms.filter((a) => a.type === filter.type);
    if (filter.domainId) atoms = atoms.filter((a) => a.domainId === filter.domainId);
    if (filter.verified !== undefined) atoms = atoms.filter((a) => a.verified === filter.verified);
    if (filter.q?.trim()) {
      const hits = await retrieve(this.store, this.embedder, captureId, filter.q, 50);
      const order = new Map(hits.map((h, i) => [h.atom.id, i]));
      atoms = atoms.filter((a) => order.has(a.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
    return atoms;
  }

  async updateAtom(id: ID, patch: Partial<Pick<Atom, "title" | "content" | "type" | "tags" | "verified" | "domainId">>): Promise<Atom> {
    const a = await this.store.getAtom(id);
    if (!a) throw new NotFoundError("atom");
    const next: Atom = { ...a, ...patch, updatedAt: nowIso() };
    await this.store.putAtom(next);
    if (patch.title !== undefined || patch.content !== undefined) {
      // content changed → refresh vector
      await this.store.putEmbedding(id, []);
      await ensureEmbeddings(this.store, this.embedder, [next]).catch(() => 0);
    }
    await this.refresh(a.captureId);
    return next;
  }

  async deleteAtom(id: ID): Promise<void> {
    const a = await this.store.getAtom(id);
    if (!a) throw new NotFoundError("atom");
    await this.store.deleteAtom(id);
    await this.refresh(a.captureId);
  }

  /* ──────────────────────── the successor twin ──────────────────────── */

  async ask(captureId: ID, question: string, askedBy?: string): Promise<AskResult> {
    const capture = await this.getCapture(captureId);
    const q = question.trim();
    if (!q) throw new Error("question is empty");
    const hits = await retrieve(this.store, this.embedder, captureId, q, 6);
    const result = await this.brain.answer({ capture, question: q, hits, askedBy });

    const usedIdx = result.used.length ? result.used : hits.map((_, i) => i + 1);
    const citations: Citation[] = usedIdx
      .filter((n) => n >= 1 && n <= hits.length)
      .map((n) => {
        const h = hits[n - 1];
        return {
          n,
          atomId: h.atom.id,
          title: h.atom.title,
          type: h.atom.type,
          quote: h.atom.sourceQuote,
          sessionId: h.atom.sessionId,
          turnId: h.atom.turnId,
          score: Number(h.strength.toFixed(3)),
        };
      });

    let queuedQuestion: Question | undefined;
    if (result.confidence === "none" || result.confidence === "low") {
      const existing = (await this.store.listQuestions(captureId)).find(
        (x) => x.status !== "answered" && x.text.trim().toLowerCase() === q.toLowerCase(),
      );
      queuedQuestion = existing ?? (await this.addQuestion(captureId, q, "successor", askedBy ?? capture.successor?.name));
    }
    return {
      question: q,
      answer: result.answer,
      confidence: result.confidence,
      citations,
      queuedQuestion,
      engine: this.brain.model ? `${this.brain.name}/${this.brain.model}` : this.brain.name,
    };
  }

  /* ───────────────────────── questions ───────────────────────── */

  listQuestions(captureId: ID): Promise<Question[]> {
    return this.store.listQuestions(captureId);
  }

  async addQuestion(captureId: ID, text: string, source: QuestionSource, askedBy?: string, domainId?: ID): Promise<Question> {
    await this.getCapture(captureId);
    const q: Question = {
      id: newId("q"),
      captureId,
      text: text.trim(),
      source,
      status: "open",
      askedBy,
      domainId,
      createdAt: nowIso(),
    };
    await this.store.putQuestion(q);
    await this.refresh(captureId);
    return q;
  }

  async updateQuestion(id: ID, patch: Partial<Pick<Question, "text" | "status" | "domainId">>): Promise<Question> {
    const q = await this.store.getQuestion(id);
    if (!q) throw new NotFoundError("question");
    const next = { ...q, ...patch };
    if (patch.status === "answered" && !next.answeredAt) next.answeredAt = nowIso();
    await this.store.putQuestion(next);
    await this.refresh(q.captureId);
    return next;
  }

  /* ───────────────────────── documents ───────────────────────── */

  async graph(captureId: ID): Promise<GraphData> {
    const capture = await this.getCapture(captureId);
    const atoms = await this.store.listAtoms(captureId);
    return buildGraph(capture, atoms);
  }

  async handover(captureId: ID): Promise<string> {
    const b = await this.exportCapture(captureId);
    return compileHandover(b.capture, b.atoms, b.sessions, b.questions);
  }
}
