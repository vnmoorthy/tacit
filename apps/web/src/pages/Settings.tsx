import { Database, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input, Modal, PageHeader, Select } from "../components/ui.js";
import { getPreferredMode, setPreferredMode } from "../lib/api.js";
import { DEFAULT_SETTINGS, clearLocalData, loadSettings, saveSettings, type LocalSettings } from "../lib/local.js";
import { useApp } from "../lib/store.js";

export function Settings() {
  const { health, api, toast, init } = useApp();
  const [s, setS] = useState<LocalSettings>(loadSettings());
  const [mode, setMode] = useState(getPreferredMode());
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    try {
      saveSettings(s);
      setPreferredMode(mode);
      await init();
      const error = useApp.getState().error;
      if (error) toast(error, "error");
      else toast("Settings saved and engine restarted", "success");
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true);
    setResetError(null);
    try {
      clearLocalData();
      await init();
      setConfirmReset(false);
      toast("Local captures deleted");
    } catch (e) {
      setResetError((e as Error).message);
    } finally { setBusy(false); }
  };

  const loadSamples = async () => {
    if (!api) return;
    setBusy(true);
    try {
      const l = await api.loadSamples();
      toast(`Loaded ${l.length} sample captures`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Settings" title="Engine & voice" lede="Tacit picks the best available brain and voice automatically. Everything here is optional." />

      <Card>
        <CardHeader title="Current engine" subtitle="What Tacit is thinking and speaking with right now." />
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
        <CardHeader title="Standalone model" subtitle="Optional. Settings are saved in this browser. Requests and the API key go directly to your chosen provider." />
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
          <div className="border-t border-line pt-4">
            <p className="text-[13px] font-medium text-ink">Boson AI · Higgs voice</p>
            <p className="mt-1 text-[12.5px] text-muted">Enables Higgs Realtime interviews, Higgs Audio speech and voice cloning directly from this browser. The key is stored only in this browser and sent only to api.boson.ai.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field label="Boson API key">
                <Input type="password" value={s.bosonKey} onChange={(e) => setS({ ...s, bosonKey: e.target.value })} placeholder="bai-…" autoComplete="off" />
              </Field>
              <Field label="Interviewer voice">
                <Select value={s.bosonVoice} onChange={(e) => setS({ ...s, bosonVoice: e.target.value })}>
                  {["nora", "chloe", "eleanor", "oliver", "marcus", "jake"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
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
            <Button variant="danger" onClick={() => { setResetError(null); setConfirmReset(true); }} icon={<Trash2 className="h-4 w-4" />}>
              Delete local captures
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5 text-[13px] text-ink-2 leading-relaxed">
        <h2 className="font-medium text-ink">Phone interviews</h2>
        <p className="mt-1">{health?.phone ? "Phone interviews are configured. Open a capture and choose “Call the expert”." : "Available when LiveKit and Twilio are configured on the server. Open a capture and choose “Call the expert” once setup is complete."}</p>
      </Card>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Delete local captures?" error={resetError} footer={<><Button data-autofocus onClick={() => setConfirmReset(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={reset}>Delete local captures</Button></>}>
        <p className="text-sm text-ink-2">This deletes captures, interviews and saved knowledge in this browser. Model settings and API keys remain. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
