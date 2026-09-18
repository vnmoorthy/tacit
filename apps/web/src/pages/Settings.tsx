import { Database, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { EngineBadge } from "../components/Layout.js";
import { Button, Card, CardHeader, Field, Input, Select, Toggle } from "../components/ui.js";
import { getPreferredMode, setPreferredMode } from "../lib/api.js";
import { DEFAULT_SETTINGS, clearLocalData, loadSettings, saveSettings, type LocalSettings } from "../lib/local.js";
import { useApp } from "../lib/store.js";

export function Settings() {
  const { health, api, toast, init } = useApp();
  const [s, setS] = useState<LocalSettings>(loadSettings());
  const [mode, setMode] = useState(getPreferredMode());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    saveSettings(s);
    setPreferredMode(mode);
    setBusy(true);
    await init();
    setBusy(false);
    toast("Settings saved and engine restarted", "success");
  };

  const reset = async () => {
    clearLocalData();
    await init();
    toast("Local data cleared");
  };

  const loadSamples = async () => {
    if (!api) return;
    setBusy(true);
    try {
      const l = await api.loadSamples();
      toast(`Loaded ${l.length} sample captures`, "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-[12px] uppercase tracking-[0.16em] text-muted font-semibold">Settings</p>
        <h1 className="font-display text-[34px] leading-tight mt-1">Engine & voice</h1>
      </header>

      <Card>
        <CardHeader title="Current engine" subtitle="What Tacit is thinking and speaking with right now." action={<EngineBadge />} />
        <div className="px-5 pb-5 text-[13.5px] text-ink-2 space-y-1.5">
          <p>
            <span className="text-muted">Brain:</span> {health?.engine.brain}
            {health?.engine.model ? ` · ${health.engine.model}` : ""}
          </p>
          <p>
            <span className="text-muted">Embeddings:</span> {health?.engine.embeddings ?? "none (BM25 only)"}
          </p>
          <p>
            <span className="text-muted">Voice:</span> {health?.higgs ? "Boson Higgs Realtime (speech-to-speech) + browser fallback" : "Browser Web Speech (set BOSON_API_KEY on the server for Higgs Realtime)"}
          </p>
          {health?.notes.map((n) => (
            <p key={n} className="text-muted">
              {n}
            </p>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Where the engine runs" subtitle="Server mode uses the Tacit API and SQLite. Standalone runs entirely in this browser tab." />
        <div className="px-5 pb-5 space-y-4">
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="auto">Auto (server if reachable, else standalone)</option>
              <option value="server">Server only</option>
              <option value="local">Standalone (in-browser)</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Standalone model" subtitle="Optional. Used only in standalone mode; calls go straight from your browser to the provider. Keys stay in this browser." />
        <div className="px-5 pb-5 space-y-4">
          <Field label="Provider">
            <Select value={s.provider} onChange={(e) => setS({ ...s, provider: e.target.value as LocalSettings["provider"] })}>
              <option value="none">Offline demo brain (no key)</option>
              <option value="openai-compatible">OpenAI-compatible (Nebius, OpenAI, Groq, Ollama…)</option>
              <option value="anthropic">Anthropic</option>
            </Select>
          </Field>
          {s.provider === "openai-compatible" && (
            <>
              <Field label="Base URL">
                <Input value={s.baseUrl} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} placeholder={DEFAULT_SETTINGS.baseUrl} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Chat model">
                  <Input value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="Qwen/Qwen3-30B-A3B-Instruct-2507" />
                </Field>
                <Field label="Embedding model" hint="Optional; enables semantic search.">
                  <Input value={s.embedModel} onChange={(e) => setS({ ...s, embedModel: e.target.value })} placeholder="Qwen/Qwen3-Embedding-8B" />
                </Field>
              </div>
            </>
          )}
          {s.provider === "anthropic" && (
            <Field label="Model">
              <Input value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="claude-sonnet-4-5" />
            </Field>
          )}
          {s.provider !== "none" && (
            <Field label="API key">
              <Input type="password" value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value })} placeholder="sk-…" autoComplete="off" />
            </Field>
          )}
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={save} loading={busy} icon={<RefreshCw className="h-4 w-4" />}>
              Save & restart engine
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data" subtitle="Sample captures and local storage." />
        <div className="px-5 pb-5 flex flex-wrap gap-2">
          <Button onClick={loadSamples} loading={busy} icon={<Database className="h-4 w-4" />}>
            Load sample captures
          </Button>
          {health?.mode === "local" && (
            <Button variant="danger" onClick={reset} icon={<Trash2 className="h-4 w-4" />}>
              Clear standalone data
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5 text-[13px] text-ink-2 leading-relaxed">
        <Toggle checked={false} onChange={() => toast("Phone-call interviews are on the roadmap (Twilio + Higgs).")} label="Phone-call interviews (coming soon)" />
      </Card>
    </div>
  );
}
