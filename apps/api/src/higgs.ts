/** Boson AI Higgs Realtime: mint short-lived client secrets for browser sessions. */

export interface HiggsSession {
  clientSecret: string;
  expiresAt: number;
  sessionId?: string;
  wsUrl: string;
  model: string;
  voice: string;
  instructions: string;
  transcriptionModel: string;
}

export async function createHiggsSession(opts: { apiKey: string; instructions: string; voice: string; baseUrl?: string }): Promise<HiggsSession> {
  const base = (opts.baseUrl ?? "https://api.boson.ai").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/realtime/client_secrets`, {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ expires_after: { seconds: 1800 } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Boson client_secrets failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { value: string; expires_at: number; session?: { id?: string } };
  return {
    clientSecret: data.value,
    expiresAt: data.expires_at,
    sessionId: data.session?.id,
    wsUrl: base.replace(/^http/, "ws") + "/v1/realtime?model=higgs-realtime",
    model: "higgs-realtime",
    voice: opts.voice,
    instructions: opts.instructions,
    transcriptionModel: "higgs-stt-3.1",
  };
}

/** Higgs Audio text-to-speech. Returns audio bytes (mp3 by default). */
export async function higgsSpeech(opts: { apiKey: string; text: string; voice?: string; format?: "mp3" | "wav" | "pcm" | "opus"; baseUrl?: string }): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const base = (opts.baseUrl ?? "https://api.boson.ai").replace(/\/$/, "");
  const format = opts.format ?? "mp3";
  const res = await fetch(`${base}/v1/audio/speech`, {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "higgs-tts-3", input: opts.text, voice: opts.voice || "default", response_format: format }),
  });
  if (!res.ok) throw new Error(`Higgs TTS failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const ct = format === "mp3" ? "audio/mpeg" : format === "wav" ? "audio/wav" : format === "opus" ? "audio/ogg" : "application/octet-stream";
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? ct };
}

/** Clone a voice from a reference clip (≥3s, ≤10MB) and its transcript. Deterministic per key+audio. */
export async function higgsCloneVoice(opts: { apiKey: string; audio: Blob; filename: string; transcript: string; description?: string; baseUrl?: string }): Promise<{ voiceId: string }> {
  const base = (opts.baseUrl ?? "https://api.boson.ai").replace(/\/$/, "");
  const form = new FormData();
  form.append("ref_audio", opts.audio, opts.filename);
  form.append("ref_text", opts.transcript);
  if (opts.description) form.append("description", opts.description);
  const res = await fetch(`${base}/v1/audio/voices`, { method: "POST", headers: { authorization: `Bearer ${opts.apiKey}` }, body: form });
  if (!res.ok) throw new Error(`Higgs voice clone failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = (await res.json()) as { voice_id?: string; voice?: string };
  return { voiceId: (data.voice_id ?? data.voice) as string };
}
