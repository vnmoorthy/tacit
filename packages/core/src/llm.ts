/**
 * Provider-agnostic LLM client. Isomorphic (fetch-based) so it runs on the
 * server and in the browser's standalone mode.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for a JSON object if it supports it. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface LLM {
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}

export interface Embedder {
  readonly name: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Extra headers, e.g. for OpenRouter-style gateways. */
  headers?: Record<string, string>;
  /** Some providers reject response_format; disable JSON mode for them. */
  supportsJsonMode?: boolean;
  fetchImpl?: typeof fetch;
}

/** Works with OpenAI, Nebius Token Factory, Ollama (/v1), Groq, Together, Insforge & Butterbase gateways… */
export class OpenAICompatibleLLM implements LLM {
  readonly name: string;
  readonly model: string;
  private cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = cfg;
    this.name = cfg.name;
    this.model = cfg.model;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const f = this.cfg.fetchImpl ?? fetch;
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 900,
      stream: false,
    };
    if (opts.json && this.cfg.supportsJsonMode !== false) {
      body.response_format = { type: "json_object" };
    }
    const res = await f(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}),
        ...(this.cfg.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${this.name} chat failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error(`${this.name} returned no content`);
    return stripReasoning(content);
  }
}

export class OpenAICompatibleEmbedder implements Embedder {
  readonly name: string;
  readonly model: string;
  constructor(
    private cfg: { name: string; baseUrl: string; apiKey?: string; model: string; fetchImpl?: typeof fetch },
  ) {
    this.name = cfg.name;
    this.model = cfg.model;
  }
  async embed(texts: string[]): Promise<number[][]> {
    const f = this.cfg.fetchImpl ?? fetch;
    const res = await f(`${this.cfg.baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: this.cfg.model, input: texts }),
    });
    if (!res.ok) throw new Error(`${this.name} embeddings failed (${res.status})`);
    const data = (await res.json()) as any;
    return (data.data as any[]).sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
  }
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class AnthropicLLM implements LLM {
  readonly name = "anthropic";
  readonly model: string;
  constructor(private cfg: AnthropicConfig) {
    this.model = cfg.model;
  }
  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const f = this.cfg.fetchImpl ?? fetch;
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    const res = await f(`${(this.cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: opts.maxTokens ?? 900,
        temperature: opts.temperature ?? 0.4,
        ...(system ? { system } : {}),
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`anthropic chat failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    const text = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    return text;
  }
}

/** Remove <think>…</think> blocks emitted by reasoning models (Qwen3, DeepSeek-R1…). */
export function stripReasoning(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Extract the first JSON object/array from a model reply, tolerating fences and prose. */
export function extractJson<T = unknown>(raw: string): T {
  let s = stripReasoning(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }
  const start = Math.min(...["{", "["].map((c) => s.indexOf(c)).filter((i) => i >= 0));
  if (!Number.isFinite(start)) throw new Error("No JSON found in model reply");
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1)) as T;
    }
  }
  throw new Error("Unbalanced JSON in model reply");
}

/** Ask for JSON, retrying once with a stricter reminder if parsing fails. */
export async function chatJson<T>(llm: LLM, messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> {
  const first = await llm.chat(messages, { ...opts, json: true });
  try {
    return extractJson<T>(first);
  } catch {
    const retry = await llm.chat(
      [
        ...messages,
        { role: "assistant", content: first },
        { role: "user", content: "That was not valid JSON. Reply with ONLY the JSON object, no prose, no code fences." },
      ],
      { ...opts, json: true, temperature: 0 },
    );
    return extractJson<T>(retry);
  }
}
