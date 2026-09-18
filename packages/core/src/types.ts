/**
 * Tacit core domain types.
 * These are shared by the server (SQLite store), the browser (standalone mode)
 * and the tests. Keep them JSON-serialisable.
 */

export type ID = string;

export interface Expert {
  name: string;
  role: string;
  team?: string;
  tenureYears?: number;
  /** ISO date (YYYY-MM-DD) of the expert's last day, if known. */
  departureDate?: string;
}

export interface Successor {
  name: string;
  role?: string;
}

export type CaptureStatus = "planning" | "active" | "complete";

export interface Domain {
  id: ID;
  name: string;
  description: string;
  /** 1 = critical, 2 = important, 3 = nice to have */
  priority: 1 | 2 | 3;
  targetQuestions: string[];
  /** Number of target questions that have been asked so far. */
  askedCount: number;
  atomCount: number;
  /** 0..1 */
  coverage: number;
}

export interface CaptureStats {
  atoms: number;
  verifiedAtoms: number;
  sessions: number;
  turns: number;
  minutes: number;
  /** Weighted coverage 0..1 across domains. */
  coverage: number;
  openQuestions: number;
}

export interface Capture {
  id: ID;
  createdAt: string;
  updatedAt: string;
  title: string;
  expert: Expert;
  successor?: Successor;
  /** Free-text context: responsibilities, systems, known pain points. */
  context: string;
  status: CaptureStatus;
  domains: Domain[];
  stats: CaptureStats;
  /** True for bundled sample data. */
  sample?: boolean;
  /** Boson Higgs Audio voice id (voice_<sha>) cloned from the expert, used by the twin. */
  voiceId?: string;
}

export type AtomType =
  | "procedure"
  | "rule"
  | "gotcha"
  | "contact"
  | "tool"
  | "decision"
  | "glossary"
  | "risk"
  | "story";

export const ATOM_TYPES: AtomType[] = [
  "procedure",
  "rule",
  "gotcha",
  "contact",
  "tool",
  "decision",
  "glossary",
  "risk",
  "story",
];

export interface Atom {
  id: ID;
  captureId: ID;
  sessionId?: ID;
  turnId?: ID;
  domainId?: ID;
  type: AtomType;
  title: string;
  /** Markdown */
  content: string;
  tags: string[];
  /** 0..1 */
  confidence: number;
  verified: boolean;
  /** The expert's words this atom was distilled from. */
  sourceQuote?: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionMode = "voice-higgs" | "voice-browser" | "text";

export interface Session {
  id: ID;
  captureId: ID;
  mode: SessionMode;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  turnCount: number;
  atomCount: number;
}

export type TurnRole = "interviewer" | "expert";

export interface Turn {
  id: ID;
  sessionId: ID;
  captureId: ID;
  role: TurnRole;
  text: string;
  at: string;
  domainId?: ID;
  /** For interviewer turns: what kind of move this was. */
  kind?: "opening" | "new" | "followup" | "successor" | "closing";
  questionId?: ID;
  extractedAtomIds?: ID[];
}

export type QuestionSource = "plan" | "successor" | "gap" | "followup";
export type QuestionStatus = "open" | "asked" | "answered";

export interface Question {
  id: ID;
  captureId: ID;
  text: string;
  source: QuestionSource;
  status: QuestionStatus;
  askedBy?: string;
  domainId?: ID;
  createdAt: string;
  answeredAt?: string;
  answerAtomIds?: ID[];
}

export interface Citation {
  n: number;
  atomId: ID;
  title: string;
  type: AtomType;
  quote?: string;
  sessionId?: ID;
  turnId?: ID;
  score: number;
}

export type Confidence = "high" | "medium" | "low" | "none";

export interface AskResult {
  question: string;
  answer: string;
  confidence: Confidence;
  citations: Citation[];
  /** Set when the twin could not answer and queued the question for the expert. */
  queuedQuestion?: Question;
  /** Which brain produced the answer. */
  engine: string;
}

export interface TurnResult {
  expertTurn: Turn;
  atoms: Atom[];
  interviewerTurn: Turn | null;
  capture: Capture;
}

export interface CreateCaptureInput {
  title?: string;
  expert: Expert;
  successor?: Successor;
  context: string;
}

export interface EngineInfo {
  brain: string;
  model?: string;
  embeddings?: string;
  voice: { higgs: boolean; browser: boolean };
}

export interface Snapshot {
  captures: Capture[];
  sessions: Session[];
  turns: Turn[];
  atoms: Atom[];
  questions: Question[];
  embeddings: Record<ID, number[]>;
}
