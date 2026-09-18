import { AnthropicLLM, HeuristicBrain, LLMBrain, OpenAICompatibleEmbedder, OpenAICompatibleLLM, type Brain, type Embedder, type LLM } from "@tacit/core";
import { env } from "./env.js";

export interface Providers {
  brain: Brain;
  embedder: Embedder | null;
  provider: string;
  notes: string[];
}

async function ollamaModels(url: string): Promise<string[] | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(`${url.replace(/\/$/, "")}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return null;
  }
}

/**
 * Resolve the LLM + embedding providers from the environment.
 * Order: explicit LLM_PROVIDER → Nebius → OpenAI → Anthropic → Ollama (if reachable) → demo brain.
 */
export async function resolveProviders(): Promise<Providers> {
  const notes: string[] = [];
  const explicit = env("LLM_PROVIDER").toLowerCase();
  const want = (p: string) => !explicit || explicit === p;

  let llm: LLM | null = null;
  let embedder: Embedder | null = null;
  let provider = "demo";

  if (!llm && want("nebius") && env("NEBIUS_API_KEY")) {
    llm = new OpenAICompatibleLLM({
      name: "nebius",
      baseUrl: env("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1"),
      apiKey: env("NEBIUS_API_KEY"),
      model: env("NEBIUS_MODEL", "Qwen/Qwen3-30B-A3B-Instruct-2507"),
    });
    embedder = new OpenAICompatibleEmbedder({
      name: "nebius",
      baseUrl: env("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1"),
      apiKey: env("NEBIUS_API_KEY"),
      model: env("NEBIUS_EMBED_MODEL", "Qwen/Qwen3-Embedding-8B"),
    });
    provider = "nebius";
  }
  if (!llm && want("openai") && env("OPENAI_API_KEY")) {
    const baseUrl = env("OPENAI_BASE_URL", "https://api.openai.com/v1");
    llm = new OpenAICompatibleLLM({ name: "openai", baseUrl, apiKey: env("OPENAI_API_KEY"), model: env("OPENAI_MODEL", "gpt-4o-mini") });
    embedder = new OpenAICompatibleEmbedder({ name: "openai", baseUrl, apiKey: env("OPENAI_API_KEY"), model: env("OPENAI_EMBED_MODEL", "text-embedding-3-small") });
    provider = "openai";
  }
  if (!llm && want("anthropic") && env("ANTHROPIC_API_KEY")) {
    llm = new AnthropicLLM({ apiKey: env("ANTHROPIC_API_KEY"), model: env("ANTHROPIC_MODEL", "claude-sonnet-4-5") });
    provider = "anthropic";
  }
  if (!llm && want("ollama")) {
    const url = env("OLLAMA_URL", "http://localhost:11434");
    const models = await ollamaModels(url);
    if (models && models.length) {
      const wanted = env("OLLAMA_MODEL", "llama3.1:8b");
      const chatModel =
        models.find((m) => m === wanted || m === `${wanted}:latest`) ??
        models.find((m) => /llama|qwen|gemma|mistral|phi|deepseek/i.test(m) && !/embed/i.test(m)) ??
        null;
      if (chatModel) {
        llm = new OpenAICompatibleLLM({ name: "ollama", baseUrl: `${url.replace(/\/$/, "")}/v1`, model: chatModel, supportsJsonMode: true });
        provider = "ollama";
        notes.push(`Ollama detected at ${url} (model ${chatModel}).`);
      }
      const embedWanted = env("OLLAMA_EMBED_MODEL", "nomic-embed-text");
      const embedModel = models.find((m) => m.startsWith(embedWanted)) ?? models.find((m) => /embed/i.test(m));
      if (embedModel && !embedder) {
        embedder = new OpenAICompatibleEmbedder({ name: "ollama", baseUrl: `${url.replace(/\/$/, "")}/v1`, model: embedModel });
      }
    } else if (explicit === "ollama") {
      notes.push(`LLM_PROVIDER=ollama but nothing answered at ${url}; using demo brain.`);
    }
  }

  const heuristic = new HeuristicBrain();
  const brain: Brain = llm
    ? new LLMBrain(llm, { fallback: heuristic, onError: (stage, err) => console.warn(`[tacit] ${provider} ${stage} failed, used demo brain:`, (err as Error).message) })
    : heuristic;
  if (!llm) notes.push("No LLM configured — running the offline demo brain. Set NEBIUS_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY or run Ollama.");
  return { brain, embedder, provider, notes };
}
