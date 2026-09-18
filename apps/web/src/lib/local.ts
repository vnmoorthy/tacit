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
  /** Boson AI key for Higgs Realtime / Higgs Audio directly from the browser (stays in localStorage). */
  bosonKey: string;
  bosonVoice: string;
}

export const DEFAULT_SETTINGS: LocalSettings = {
  provider: "none",
  baseUrl: "https://api.tokenfactory.nebius.com/v1",
  apiKey: "",
  model: "Qwen/Qwen3-30B-A3B-Instruct-2507",
  embedModel: "",
  bosonKey: "",
  bosonVoice: "nora",
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
    throw new Error("This browser could not save your settings. Check available storage and browser permissions, then try again.");
  }
}

export function clearLocalData() {
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    throw new Error("This browser could not delete its saved captures. Check browser storage permissions, then try again.");
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
  // A successful mutation must be durable before the UI navigates or reloads.
  // Debouncing this write lost entire new captures when the page closed quickly.
  const save = async <T>(operation: Promise<T>): Promise<T> => {
    try {
      return await operation;
    } finally {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(await store.snapshot()));
      } catch {
        throw new Error("This browser could not save your changes. Keep this tab open and export your capture before clearing space or changing browser settings.");
      }
    }
  };
  const boson = settings.bosonKey.trim();
  const BOSON = "https://api.boson.ai";
  const engine = new Engine({ store, brain, embedder, voice: { higgs: Boolean(boson), browser: true } });
  const mode: ApiMode = "local";

  return {
    mode,
    async health(): Promise<Health> {
      return {
        ok: true,
        version: "0.1.0-standalone",
        engine: engine.info(),
        provider,
        notes: [
          provider === "demo" ? "Standalone mode: running the offline demo brain in your browser. Add a Nebius or OpenAI key in Settings for a real model." : "Standalone mode: model calls go straight from your browser to the provider.",
          boson ? "Higgs Realtime and Higgs Audio run straight from your browser with your Boson key." : "Add a Boson AI key in Settings for Higgs Realtime voice and voice cloning.",
        ],
        higgs: Boolean(boson),
        mode,
      };
    },
    listCaptures: () => engine.listCaptures(),
    createCapture: (input: CreateCaptureInput) => save(engine.createCapture(input)),
    getCapture: (id: string) => engine.getCapture(id),
    updateCapture: (id: string, patch: Partial<Pick<Capture, "title" | "expert" | "successor" | "context" | "status" | "voiceId">>) => save(engine.updateCapture(id, patch)),
    deleteCapture: (id: string) => save(engine.deleteCapture(id)),
    exportCapture: (id: string) => engine.exportCapture(id),
    handover: (id: string) => engine.handover(id),
    graph: (id: string) => engine.graph(id),
    instructions: (id: string) => engine.interviewerInstructions(id),
    listSessions: (id: string) => engine.listSessions(id),
    startSession: (id: string, m: SessionMode) => save(engine.startSession(id, m)),
    getSession: (sid: string) => engine.getSession(sid),
    expertTurn: (sid: string, text: string, generateNext = true) => save(engine.expertTurn(sid, text, { generateNext })),
    interviewerTurn: (sid: string, text: string, meta: { kind?: Turn["kind"]; domainId?: string } = {}) => save(engine.interviewerTurn(sid, text, meta)),
    endSession: (sid: string) => save(engine.endSession(sid)),
    listAtoms: (id: string, filter: AtomFilter = {}) => engine.listAtoms(id, filter),
    updateAtom: (aid: string, patch: Partial<Pick<Atom, "title" | "content" | "type" | "tags" | "verified" | "domainId">>) => save(engine.updateAtom(aid, patch)),
    deleteAtom: (aid: string) => save(engine.deleteAtom(aid)),
    ask: (id: string, q: string, askedBy?: string) => save(engine.ask(id, q, askedBy)),
    listQuestions: (id: string) => engine.listQuestions(id),
    addQuestion: (id: string, text: string, askedBy?: string, domainId?: string) => save(engine.addQuestion(id, text, "successor", askedBy, domainId)),
    updateQuestion: (qid: string, patch: Partial<Pick<Question, "text" | "status" | "domainId">>) => save(engine.updateQuestion(qid, patch)),
    async loadSamples(key?: string) {
      const specs = key ? SAMPLES.filter((s) => s.key === key) : SAMPLES;
      const out: Capture[] = [];
      for (const s of specs) out.push(await engine.importBundle(buildSample(s)));
      return save(Promise.resolve(out));
    },
    async higgsSession(captureId: string): Promise<HiggsSessionInfo> {
      if (!boson) throw new Error("Add a Boson AI key in Settings to use Higgs Realtime here, or run the Tacit server.");
      const capture = await engine.getCapture(captureId);
      const instructions = await engine.interviewerInstructions(captureId);
      const atoms = await engine.listAtoms(captureId);
      const vocab = [...new Set([capture.expert.name, capture.successor?.name, ...atoms.flatMap((a) => a.tags)].filter((x): x is string => Boolean(x) && /^[A-Z]/.test(x as string)))].slice(0, 24);
      const res = await fetch(`${BOSON}/v1/realtime/client_secrets`, {
        method: "POST",
        headers: { authorization: `Bearer ${boson}`, "content-type": "application/json" },
        body: JSON.stringify({ expires_after: { seconds: 1800 } }),
      });
      if (!res.ok) throw new Error(`Boson rejected the key (${res.status}). Check it in Settings.`);
      const data = (await res.json()) as { value: string; expires_at: number; session?: { id?: string } };
      return {
        clientSecret: data.value,
        expiresAt: data.expires_at,
        sessionId: data.session?.id,
        wsUrl: "wss://api.boson.ai/v1/realtime?model=higgs-realtime",
        model: "higgs-realtime",
        voice: settings.bosonVoice || "nora",
        instructions,
        transcriptionModel: "higgs-stt-3.1",
        language: (capture.expert.language ?? "en").split("-")[0].toLowerCase(),
        transcriptionPrompt: `${capture.expert.role} interview. Names and systems: ${vocab.join(", ")}.`,
      };
    },
    async speak(text: string, captureId?: string): Promise<Blob> {
      if (!boson) throw new Error("Add a Boson AI key in Settings for Higgs Audio, or run the Tacit server.");
      const voice = (captureId ? (await engine.getCapture(captureId)).voiceId : undefined) || settings.bosonVoice || "nora";
      const call = () =>
        fetch(`${BOSON}/v1/audio/speech`, {
          method: "POST",
          headers: { authorization: `Bearer ${boson}`, "content-type": "application/json" },
          body: JSON.stringify({ model: "higgs-tts-3", input: text, voice, response_format: "mp3" }),
        });
      let res = await call();
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await call();
      }
      if (!res.ok) throw new Error(`Higgs Audio failed (${res.status})`);
      return res.blob();
    },
    async cloneVoice(captureId: string, audio: Blob, transcript: string): Promise<{ voiceId: string; capture: Capture }> {
      if (!boson) throw new Error("Add a Boson AI key in Settings to clone voices, or run the Tacit server.");
      const form = new FormData();
      form.append("ref_audio", audio, "reference.webm");
      form.append("ref_text", transcript);
      form.append("description", `Tacit clone for ${captureId}`);
      const res = await fetch(`${BOSON}/v1/audio/voices`, { method: "POST", headers: { authorization: `Bearer ${boson}` }, body: form });
      if (!res.ok) throw new Error(`Voice clone failed (${res.status})`);
      const data = (await res.json()) as { voice_id?: string; voice?: string };
      const voiceId = data.voice_id ?? data.voice;
      if (!voiceId) throw new Error("Boson did not return a voice id");
      const capture = await engine.updateCapture(captureId, { voiceId });
      return { voiceId, capture };
    },
    async callExpert(): Promise<{ session: Session; roomName: string; opening: string }> {
      throw new Error("Phone interviews need the Tacit server with LiveKit + Twilio configured.");
    },
  };
}
