/**
 * Standalone mode: the whole Tacit engine runs in the browser.
 * Data persists to localStorage; the brain is the offline heuristic brain
 * unless the user configures an OpenAI-compatible or Anthropic key in Settings.
 */
import {
  AnthropicLLM,
  Engine,
  HeuristicBrain,
  LLMBrain,
  MemoryStore,
  OpenAICompatibleEmbedder,
  OpenAICompatibleLLM,
  SAMPLES,
  buildSample,
  type Atom,
  type Brain,
  type Capture,
  type CreateCaptureInput,
  type Embedder,
  type Question,
  type Session,
  type SessionMode,
  type Snapshot,
  type Turn,
} from "@tacit/core";
import type { ApiClient, ApiMode, AtomFilter, Health, HiggsSessionInfo } from "./api.js";

const DB_KEY = "tacit.db.v1";
const SETTINGS_KEY = "tacit.settings.v1";

export interface LocalSettings {
  provider: "none" | "openai-compatible" | "anthropic";
  baseUrl: string;
  apiKey: string;
  model: string;
  embedModel: string;
}

export const DEFAULT_SETTINGS: LocalSettings = {
  provider: "none",
  baseUrl: "https://api.tokenfactory.nebius.com/v1",
  apiKey: "",
  model: "Qwen/Qwen3-30B-A3B-Instruct-2507",
  embedModel: "",
};

export function loadSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LocalSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: LocalSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function clearLocalData() {
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    /* ignore */
  }
}

function buildBrain(s: LocalSettings): { brain: Brain; embedder: Embedder | null; provider: string } {
  const heuristic = new HeuristicBrain();
  if (s.provider === "openai-compatible" && s.apiKey && s.baseUrl && s.model) {
    const llm = new OpenAICompatibleLLM({ name: /nebius/i.test(s.baseUrl) ? "nebius" : "openai-compatible", baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model });
    const embedder = s.embedModel ? new OpenAICompatibleEmbedder({ name: llm.name, baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.embedModel }) : null;
    return { brain: new LLMBrain(llm, { fallback: heuristic, onError: (st, e) => console.warn(`[tacit] ${st} failed:`, e) }), embedder, provider: llm.name };
  }
  if (s.provider === "anthropic" && s.apiKey) {
    const llm = new AnthropicLLM({ apiKey: s.apiKey, model: s.model || "claude-sonnet-4-5" });
    return { brain: new LLMBrain(llm, { fallback: heuristic, onError: (st, e) => console.warn(`[tacit] ${st} failed:`, e) }), embedder: null, provider: "anthropic" };
  }
  return { brain: heuristic, embedder: null, provider: "demo" };
}

export function createLocalClient(): ApiClient {
  const settings = loadSettings();
  const { brain, embedder, provider } = buildBrain(settings);
  const store = new MemoryStore();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot;
      store.restore(snap);
    }
  } catch {
    /* corrupt data — start fresh */
  }
  let timer: number | null = null;
  store.onChange = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(await store.snapshot()));
      } catch (e) {
        console.warn("[tacit] could not persist local data", e);
      }
    }, 250);
  };
  const engine = new Engine({ store, brain, embedder, voice: { higgs: false, browser: true } });
  const mode: ApiMode = "local";

  return {
    mode,
    async health(): Promise<Health> {
      return {
        ok: true,
        version: "0.1.0-standalone",
        engine: engine.info(),
        provider,
        notes: provider === "demo" ? ["Standalone mode: running the offline demo brain in your browser. Add an API key in Settings for a real model."] : ["Standalone mode: model calls go straight from your browser to the provider."],
        higgs: false,
        mode,
      };
    },
    listCaptures: () => engine.listCaptures(),
    createCapture: (input: CreateCaptureInput) => engine.createCapture(input),
    getCapture: (id: string) => engine.getCapture(id),
    updateCapture: (id: string, patch: Partial<Pick<Capture, "title" | "expert" | "successor" | "context" | "status" | "voiceId">>) => engine.updateCapture(id, patch),
    deleteCapture: (id: string) => engine.deleteCapture(id),
    exportCapture: (id: string) => engine.exportCapture(id),
    handover: (id: string) => engine.handover(id),
    instructions: (id: string) => engine.interviewerInstructions(id),
    listSessions: (id: string) => engine.listSessions(id),
    startSession: (id: string, m: SessionMode) => engine.startSession(id, m),
    getSession: (sid: string) => engine.getSession(sid),
    expertTurn: (sid: string, text: string, generateNext = true) => engine.expertTurn(sid, text, { generateNext }),
    interviewerTurn: (sid: string, text: string, meta: { kind?: Turn["kind"]; domainId?: string } = {}) => engine.interviewerTurn(sid, text, meta),
    endSession: (sid: string) => engine.endSession(sid),
    listAtoms: (id: string, filter: AtomFilter = {}) => engine.listAtoms(id, filter),
    updateAtom: (aid: string, patch: Partial<Pick<Atom, "title" | "content" | "type" | "tags" | "verified" | "domainId">>) => engine.updateAtom(aid, patch),
    deleteAtom: (aid: string) => engine.deleteAtom(aid),
    ask: (id: string, q: string, askedBy?: string) => engine.ask(id, q, askedBy),
    listQuestions: (id: string) => engine.listQuestions(id),
    addQuestion: (id: string, text: string, askedBy?: string, domainId?: string) => engine.addQuestion(id, text, "successor", askedBy, domainId),
    updateQuestion: (qid: string, patch: Partial<Pick<Question, "text" | "status" | "domainId">>) => engine.updateQuestion(qid, patch),
    async loadSamples(key?: string) {
      const specs = key ? SAMPLES.filter((s) => s.key === key) : SAMPLES;
      const out: Capture[] = [];
      for (const s of specs) out.push(await engine.importBundle(buildSample(s)));
      return out;
    },
    async higgsSession(): Promise<HiggsSessionInfo> {
      throw new Error("Higgs Realtime needs the Tacit server with BOSON_API_KEY configured.");
    },
    async speak(): Promise<Blob> {
      throw new Error("Higgs Audio needs the Tacit server with BOSON_API_KEY configured.");
    },
    async cloneVoice(): Promise<{ voiceId: string; capture: Capture }> {
      throw new Error("Voice cloning needs the Tacit server with BOSON_API_KEY configured.");
    },
    async callExpert(): Promise<{ session: Session; roomName: string; opening: string }> {
      throw new Error("Phone interviews need the Tacit server with LiveKit + Twilio configured.");
    },
  };
}
