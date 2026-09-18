import type {
  AskResult,
  GraphData,
  Atom,
  Capture,
  CaptureBundle,
  CreateCaptureInput,
  EngineInfo,
  Question,
  Session,
  SessionDetail,
  SessionMode,
  Turn,
  TurnResult,
} from "@tacit/core";

export type ApiMode = "server" | "local";

export interface Health {
  ok: boolean;
  version: string;
  engine: EngineInfo;
  provider: string;
  notes: string[];
  higgs: boolean;
  phone?: boolean;
  mode: ApiMode;
}

export interface HiggsSessionInfo {
  clientSecret: string;
  expiresAt: number;
  sessionId?: string;
  wsUrl: string;
  model: string;
  voice: string;
  instructions: string;
  transcriptionModel: string;
}

export interface AtomFilter {
  q?: string;
  type?: string;
  domainId?: string;
  verified?: boolean;
}

export interface ApiClient {
  readonly mode: ApiMode;
  health(): Promise<Health>;
  listCaptures(): Promise<Capture[]>;
  createCapture(input: CreateCaptureInput): Promise<Capture>;
  getCapture(id: string): Promise<Capture>;
  updateCapture(id: string, patch: Partial<Pick<Capture, "title" | "expert" | "successor" | "context" | "status" | "voiceId">>): Promise<Capture>;
  deleteCapture(id: string): Promise<void>;
  exportCapture(id: string): Promise<CaptureBundle>;
  handover(id: string): Promise<string>;
  graph(id: string): Promise<GraphData>;
  instructions(id: string): Promise<string>;
  listSessions(id: string): Promise<Session[]>;
  startSession(id: string, mode: SessionMode): Promise<{ session: Session; interviewerTurn: Turn; capture: Capture }>;
  getSession(sid: string): Promise<SessionDetail>;
  expertTurn(sid: string, text: string, generateNext?: boolean): Promise<TurnResult>;
  interviewerTurn(sid: string, text: string, meta?: { kind?: Turn["kind"]; domainId?: string }): Promise<Turn>;
  endSession(sid: string): Promise<Session>;
  listAtoms(id: string, filter?: AtomFilter): Promise<Atom[]>;
  updateAtom(aid: string, patch: Partial<Pick<Atom, "title" | "content" | "type" | "tags" | "verified" | "domainId">>): Promise<Atom>;
  deleteAtom(aid: string): Promise<void>;
  ask(id: string, question: string, askedBy?: string): Promise<AskResult>;
  listQuestions(id: string): Promise<Question[]>;
  addQuestion(id: string, text: string, askedBy?: string, domainId?: string): Promise<Question>;
  updateQuestion(qid: string, patch: Partial<Pick<Question, "text" | "status" | "domainId">>): Promise<Question>;
  loadSamples(key?: string): Promise<Capture[]>;
  higgsSession(captureId: string): Promise<HiggsSessionInfo>;
  /** Higgs Audio TTS; resolves to a playable Blob. Uses the capture's cloned voice when present. */
  speak(text: string, captureId?: string): Promise<Blob>;
  cloneVoice(captureId: string, audio: Blob, transcript: string): Promise<{ voiceId: string; capture: Capture }>;
  /** Phone interview: Tacit calls the expert (Twilio SIP → LiveKit → Higgs Realtime agent). */
  callExpert(captureId: string, phone: string): Promise<{ session: Session; roomName: string; opening: string }>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/* ───────────────────────────── HTTP client ───────────────────────────── */

export class HttpApiClient implements ApiClient {
  readonly mode: ApiMode = "server";
  constructor(private base = "/api") {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new ApiError(msg, res.status);
    }
    return (await res.json()) as T;
  }
  private post<T>(path: string, body: unknown): Promise<T> {
    return this.req<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  }
  private patch<T>(path: string, body: unknown): Promise<T> {
    return this.req<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
  }

  async health() {
    const h = await this.req<Omit<Health, "mode">>("/health");
    return { ...h, mode: "server" as const };
  }
  listCaptures() {
    return this.req<Capture[]>("/captures");
  }
  createCapture(input: CreateCaptureInput) {
    return this.post<Capture>("/captures", input);
  }
  getCapture(id: string) {
    return this.req<Capture>(`/captures/${id}`);
  }
  updateCapture(id: string, patch: Parameters<ApiClient["updateCapture"]>[1]) {
    return this.patch<Capture>(`/captures/${id}`, patch);
  }
  async deleteCapture(id: string) {
    await this.req(`/captures/${id}`, { method: "DELETE" });
  }
  exportCapture(id: string) {
    return this.req<CaptureBundle>(`/captures/${id}/export`);
  }
  async handover(id: string) {
    return (await this.req<{ markdown: string }>(`/captures/${id}/handover`)).markdown;
  }
  graph(id: string) {
    return this.req<GraphData>(`/captures/${id}/graph`);
  }
  async instructions(id: string) {
    return (await this.req<{ instructions: string }>(`/captures/${id}/instructions`)).instructions;
  }
  listSessions(id: string) {
    return this.req<Session[]>(`/captures/${id}/sessions`);
  }
  startSession(id: string, mode: SessionMode) {
    return this.post<{ session: Session; interviewerTurn: Turn; capture: Capture }>(`/captures/${id}/sessions`, { mode });
  }
  getSession(sid: string) {
    return this.req<SessionDetail>(`/sessions/${sid}`);
  }
  expertTurn(sid: string, text: string, generateNext = true) {
    return this.post<TurnResult>(`/sessions/${sid}/turns`, { text, generateNext });
  }
  interviewerTurn(sid: string, text: string, meta = {}) {
    return this.post<Turn>(`/sessions/${sid}/interviewer`, { text, ...meta });
  }
  endSession(sid: string) {
    return this.post<Session>(`/sessions/${sid}/end`, {});
  }
  listAtoms(id: string, filter: AtomFilter = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== "") p.set(k, String(v));
    const qs = p.toString();
    return this.req<Atom[]>(`/captures/${id}/atoms${qs ? `?${qs}` : ""}`);
  }
  updateAtom(aid: string, patch: Parameters<ApiClient["updateAtom"]>[1]) {
    return this.patch<Atom>(`/atoms/${aid}`, patch);
  }
  async deleteAtom(aid: string) {
    await this.req(`/atoms/${aid}`, { method: "DELETE" });
  }
  ask(id: string, question: string, askedBy?: string) {
    return this.post<AskResult>(`/captures/${id}/ask`, { question, askedBy });
  }
  listQuestions(id: string) {
    return this.req<Question[]>(`/captures/${id}/questions`);
  }
  addQuestion(id: string, text: string, askedBy?: string, domainId?: string) {
    return this.post<Question>(`/captures/${id}/questions`, { text, askedBy, domainId, source: "successor" });
  }
  updateQuestion(qid: string, patch: Parameters<ApiClient["updateQuestion"]>[1]) {
    return this.patch<Question>(`/questions/${qid}`, patch);
  }
  loadSamples(key?: string) {
    return this.post<Capture[]>("/samples/load", key ? { key } : {});
  }
  higgsSession(captureId: string) {
    return this.post<HiggsSessionInfo>("/voice/higgs/session", { captureId });
  }
  async speak(text: string, captureId?: string) {
    const res = await fetch(`${this.base}/voice/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, captureId }) });
    if (!res.ok) throw new ApiError((await res.json().catch(() => ({})))?.error ?? `TTS failed (${res.status})`, res.status);
    return res.blob();
  }
  callExpert(captureId: string, phone: string) {
    return this.post<{ session: Session; roomName: string; opening: string }>("/phone/call", { captureId, phone });
  }
  async cloneVoice(captureId: string, audio: Blob, transcript: string) {
    const form = new FormData();
    form.append("audio", audio, "reference.webm");
    form.append("transcript", transcript);
    const res = await fetch(`${this.base}/captures/${captureId}/voice/clone`, { method: "POST", body: form });
    if (!res.ok) throw new ApiError((await res.json().catch(() => ({})))?.error ?? `Clone failed (${res.status})`, res.status);
    return res.json();
  }
}

/* ───────────────────────────── resolution ───────────────────────────── */

const MODE_KEY = "tacit.mode";

export function getPreferredMode(): ApiMode | "auto" {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "server" || v === "local" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function setPreferredMode(mode: ApiMode | "auto") {
  try {
    if (mode === "auto") localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Probe the server; fall back to the in-browser engine (standalone mode). */
export async function resolveApi(): Promise<{ api: ApiClient; health: Health }> {
  const pref = getPreferredMode();
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || (import.meta.env.BASE_URL.replace(/\/$/, "") !== "" ? "" : "");
  if (pref !== "local") {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${base}/api/health`, { signal: ctrl.signal });
      clearTimeout(t);
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.includes("application/json")) {
        const api = new HttpApiClient(`${base}/api`);
        return { api, health: await api.health() };
      }
    } catch {
      /* fall through */
    }
    if (pref === "server") throw new Error("Server mode requested but the Tacit API is unreachable.");
  }
  const { createLocalClient } = await import("./local.js");
  const api = createLocalClient();
  return { api, health: await api.health() };
}
