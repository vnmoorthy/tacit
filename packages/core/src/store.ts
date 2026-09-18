import type { Atom, Capture, ID, Question, Session, Snapshot, Turn } from "./types.js";

/**
 * Storage abstraction. The server implements it on SQLite; the browser's
 * standalone mode uses MemoryStore persisted to localStorage; tests use
 * MemoryStore directly.
 */
export interface Store {
  listCaptures(): Promise<Capture[]>;
  getCapture(id: ID): Promise<Capture | null>;
  putCapture(c: Capture): Promise<void>;
  deleteCapture(id: ID): Promise<void>;

  listSessions(captureId: ID): Promise<Session[]>;
  getSession(id: ID): Promise<Session | null>;
  putSession(s: Session): Promise<void>;

  listTurns(sessionId: ID): Promise<Turn[]>;
  listTurnsForCapture(captureId: ID): Promise<Turn[]>;
  getTurn(id: ID): Promise<Turn | null>;
  putTurn(t: Turn): Promise<void>;

  listAtoms(captureId: ID): Promise<Atom[]>;
  getAtom(id: ID): Promise<Atom | null>;
  putAtom(a: Atom): Promise<void>;
  deleteAtom(id: ID): Promise<void>;

  listQuestions(captureId: ID): Promise<Question[]>;
  getQuestion(id: ID): Promise<Question | null>;
  putQuestion(q: Question): Promise<void>;

  getEmbedding(atomId: ID): Promise<number[] | null>;
  putEmbedding(atomId: ID, vec: number[]): Promise<void>;

  /** Whole-database export/import (used for standalone persistence + JSON export). */
  snapshot(): Promise<Snapshot>;
  restore(snap: Snapshot): Promise<void>;
}

export class MemoryStore implements Store {
  captures = new Map<ID, Capture>();
  sessions = new Map<ID, Session>();
  turns = new Map<ID, Turn>();
  atoms = new Map<ID, Atom>();
  questions = new Map<ID, Question>();
  embeddings = new Map<ID, number[]>();
  /** Called after every mutation — used by the browser to persist. */
  onChange?: () => void;

  private touched() {
    this.onChange?.();
  }

  async listCaptures() {
    return [...this.captures.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getCapture(id: ID) {
    return this.captures.get(id) ?? null;
  }
  async putCapture(c: Capture) {
    this.captures.set(c.id, structuredClone(c));
    this.touched();
  }
  async deleteCapture(id: ID) {
    this.captures.delete(id);
    for (const [k, s] of this.sessions) if (s.captureId === id) this.sessions.delete(k);
    for (const [k, t] of this.turns) if (t.captureId === id) this.turns.delete(k);
    for (const [k, a] of this.atoms) {
      if (a.captureId === id) {
        this.atoms.delete(k);
        this.embeddings.delete(k);
      }
    }
    for (const [k, q] of this.questions) if (q.captureId === id) this.questions.delete(k);
    this.touched();
  }

  async listSessions(captureId: ID) {
    return [...this.sessions.values()]
      .filter((s) => s.captureId === captureId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async getSession(id: ID) {
    return this.sessions.get(id) ?? null;
  }
  async putSession(s: Session) {
    this.sessions.set(s.id, structuredClone(s));
    this.touched();
  }

  async listTurns(sessionId: ID) {
    return [...this.turns.values()]
      .filter((t) => t.sessionId === sessionId)
      .sort((a, b) => a.at.localeCompare(b.at));
  }
  async listTurnsForCapture(captureId: ID) {
    return [...this.turns.values()]
      .filter((t) => t.captureId === captureId)
      .sort((a, b) => a.at.localeCompare(b.at));
  }
  async getTurn(id: ID) {
    return this.turns.get(id) ?? null;
  }
  async putTurn(t: Turn) {
    this.turns.set(t.id, structuredClone(t));
    this.touched();
  }

  async listAtoms(captureId: ID) {
    return [...this.atoms.values()]
      .filter((a) => a.captureId === captureId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getAtom(id: ID) {
    return this.atoms.get(id) ?? null;
  }
  async putAtom(a: Atom) {
    this.atoms.set(a.id, structuredClone(a));
    this.touched();
  }
  async deleteAtom(id: ID) {
    this.atoms.delete(id);
    this.embeddings.delete(id);
    this.touched();
  }

  async listQuestions(captureId: ID) {
    return [...this.questions.values()]
      .filter((q) => q.captureId === captureId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async getQuestion(id: ID) {
    return this.questions.get(id) ?? null;
  }
  async putQuestion(q: Question) {
    this.questions.set(q.id, structuredClone(q));
    this.touched();
  }

  async getEmbedding(atomId: ID) {
    return this.embeddings.get(atomId) ?? null;
  }
  async putEmbedding(atomId: ID, vec: number[]) {
    this.embeddings.set(atomId, vec);
    this.touched();
  }

  async snapshot(): Promise<Snapshot> {
    return {
      captures: [...this.captures.values()],
      sessions: [...this.sessions.values()],
      turns: [...this.turns.values()],
      atoms: [...this.atoms.values()],
      questions: [...this.questions.values()],
      embeddings: Object.fromEntries(this.embeddings),
    };
  }
  async restore(snap: Snapshot) {
    this.captures = new Map(snap.captures.map((c) => [c.id, c]));
    this.sessions = new Map(snap.sessions.map((s) => [s.id, s]));
    this.turns = new Map(snap.turns.map((t) => [t.id, t]));
    this.atoms = new Map(snap.atoms.map((a) => [a.id, a]));
    this.questions = new Map(snap.questions.map((q) => [q.id, q]));
    this.embeddings = new Map(Object.entries(snap.embeddings ?? {}));
    this.touched();
  }
}
