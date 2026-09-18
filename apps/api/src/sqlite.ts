import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Atom, Capture, ID, Question, Session, Snapshot, Store, Turn } from "@tacit/core";

/**
 * SQLite-backed store using Node's built-in `node:sqlite` (no native deps).
 * Records are stored as JSON documents with a few indexed columns.
 */
export class SqliteStore implements Store {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS captures (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, capture_id TEXT NOT NULL, started_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, capture_id TEXT NOT NULL, at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS atoms (id TEXT PRIMARY KEY, capture_id TEXT NOT NULL, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, capture_id TEXT NOT NULL, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS embeddings (atom_id TEXT PRIMARY KEY, vec TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_sessions_capture ON sessions(capture_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, at);
      CREATE INDEX IF NOT EXISTS idx_turns_capture ON turns(capture_id, at);
      CREATE INDEX IF NOT EXISTS idx_atoms_capture ON atoms(capture_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_questions_capture ON questions(capture_id, created_at);
    `);
  }

  private rows<T>(sql: string, ...params: (string | number)[]): T[] {
    return (this.db.prepare(sql).all(...params) as { json: string }[]).map((r) => JSON.parse(r.json) as T);
  }
  private row<T>(sql: string, ...params: (string | number)[]): T | null {
    const r = this.db.prepare(sql).get(...params) as { json: string } | undefined;
    return r ? (JSON.parse(r.json) as T) : null;
  }

  async listCaptures() {
    return this.rows<Capture>("SELECT json FROM captures ORDER BY updated_at DESC");
  }
  async getCapture(id: ID) {
    return this.row<Capture>("SELECT json FROM captures WHERE id = ?", id);
  }
  async putCapture(c: Capture) {
    this.db.prepare("INSERT INTO captures (id, updated_at, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, json = excluded.json").run(c.id, c.updatedAt, JSON.stringify(c));
  }
  async deleteCapture(id: ID) {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM embeddings WHERE atom_id IN (SELECT id FROM atoms WHERE capture_id = ?)").run(id);
      for (const t of ["atoms", "turns", "sessions", "questions"]) this.db.prepare(`DELETE FROM ${t} WHERE capture_id = ?`).run(id);
      this.db.prepare("DELETE FROM captures WHERE id = ?").run(id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  async listSessions(captureId: ID) {
    return this.rows<Session>("SELECT json FROM sessions WHERE capture_id = ? ORDER BY started_at DESC", captureId);
  }
  async getSession(id: ID) {
    return this.row<Session>("SELECT json FROM sessions WHERE id = ?", id);
  }
  async putSession(s: Session) {
    this.db.prepare("INSERT INTO sessions (id, capture_id, started_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(s.id, s.captureId, s.startedAt, JSON.stringify(s));
  }

  async listTurns(sessionId: ID) {
    return this.rows<Turn>("SELECT json FROM turns WHERE session_id = ? ORDER BY at ASC, rowid ASC", sessionId);
  }
  async listTurnsForCapture(captureId: ID) {
    return this.rows<Turn>("SELECT json FROM turns WHERE capture_id = ? ORDER BY at ASC, rowid ASC", captureId);
  }
  async getTurn(id: ID) {
    return this.row<Turn>("SELECT json FROM turns WHERE id = ?", id);
  }
  async putTurn(t: Turn) {
    this.db.prepare("INSERT INTO turns (id, session_id, capture_id, at, json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(t.id, t.sessionId, t.captureId, t.at, JSON.stringify(t));
  }

  async listAtoms(captureId: ID) {
    return this.rows<Atom>("SELECT json FROM atoms WHERE capture_id = ? ORDER BY created_at DESC, rowid DESC", captureId);
  }
  async getAtom(id: ID) {
    return this.row<Atom>("SELECT json FROM atoms WHERE id = ?", id);
  }
  async putAtom(a: Atom) {
    this.db.prepare("INSERT INTO atoms (id, capture_id, created_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(a.id, a.captureId, a.createdAt, JSON.stringify(a));
  }
  async deleteAtom(id: ID) {
    this.db.prepare("DELETE FROM atoms WHERE id = ?").run(id);
    this.db.prepare("DELETE FROM embeddings WHERE atom_id = ?").run(id);
  }

  async listQuestions(captureId: ID) {
    return this.rows<Question>("SELECT json FROM questions WHERE capture_id = ? ORDER BY created_at ASC, rowid ASC", captureId);
  }
  async getQuestion(id: ID) {
    return this.row<Question>("SELECT json FROM questions WHERE id = ?", id);
  }
  async putQuestion(q: Question) {
    this.db.prepare("INSERT INTO questions (id, capture_id, created_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(q.id, q.captureId, q.createdAt, JSON.stringify(q));
  }

  async getEmbedding(atomId: ID) {
    const r = this.db.prepare("SELECT vec FROM embeddings WHERE atom_id = ?").get(atomId) as { vec: string } | undefined;
    if (!r) return null;
    const v = JSON.parse(r.vec) as number[];
    return v.length ? v : null;
  }
  async putEmbedding(atomId: ID, vec: number[]) {
    if (!vec.length) {
      this.db.prepare("DELETE FROM embeddings WHERE atom_id = ?").run(atomId);
      return;
    }
    this.db.prepare("INSERT INTO embeddings (atom_id, vec) VALUES (?, ?) ON CONFLICT(atom_id) DO UPDATE SET vec = excluded.vec").run(atomId, JSON.stringify(vec));
  }

  async snapshot(): Promise<Snapshot> {
    const embeddings: Record<string, number[]> = {};
    for (const r of this.db.prepare("SELECT atom_id, vec FROM embeddings").all() as { atom_id: string; vec: string }[]) embeddings[r.atom_id] = JSON.parse(r.vec);
    return {
      captures: this.rows<Capture>("SELECT json FROM captures"),
      sessions: this.rows<Session>("SELECT json FROM sessions"),
      turns: this.rows<Turn>("SELECT json FROM turns"),
      atoms: this.rows<Atom>("SELECT json FROM atoms"),
      questions: this.rows<Question>("SELECT json FROM questions"),
      embeddings,
    };
  }
  async restore(snap: Snapshot) {
    this.db.exec("BEGIN");
    try {
      for (const c of snap.captures) await this.putCapture(c);
      for (const s of snap.sessions) await this.putSession(s);
      for (const t of snap.turns) await this.putTurn(t);
      for (const a of snap.atoms) await this.putAtom(a);
      for (const q of snap.questions) await this.putQuestion(q);
      for (const [k, v] of Object.entries(snap.embeddings ?? {})) await this.putEmbedding(k, v);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}
