/**
 * Boson AI Higgs Realtime engine — speech-to-speech over WebSocket using the
 * OpenAI Realtime event protocol. The browser connects directly with an
 * ephemeral client secret minted by the Tacit server.
 */
import type { HiggsSessionInfo } from "../api.js";
import type { VoiceEvents, VoiceState } from "./types.js";

export interface HiggsEvents extends VoiceEvents {
  onUserTranscript(text: string): void;
  onAssistantTranscript(text: string): void;
  onAssistantPartial(text: string): void;
}

const RATE = 24000;

const WORKLET = `
class TacitCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("tacit-capture", TacitCapture);
`;

function downsample(input: Float32Array, from: number, to: number): Int16Array {
  if (from === to) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
    return out;
  }
  const ratio = from / to;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let c = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      c++;
    }
    const v = c ? sum / c : 0;
    out[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  return out;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}

function unb64(s: string): Int16Array {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(buf);
}

export class HiggsVoice {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private playhead = 0;
  private sources: AudioBufferSourceNode[] = [];
  private state: VoiceState = "off";
  private assistantBuf = "";
  private speakingTimer = 0;
  private muted = false;

  constructor(private ev: HiggsEvents) {}

  private setState(s: VoiceState) {
    if (this.state === s) return;
    this.state = s;
    this.ev.onState(s);
  }

  async connect(info: HiggsSessionInfo) {
    this.ctx = new AudioContext({ sampleRate: RATE });
    await this.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "tacit-capture");
    src.connect(this.node);
    const inRate = this.ctx.sampleRate;

    const ws = new WebSocket(info.wsUrl, ["realtime", `bai-client-secret.${info.clientSecret}`]);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Could not connect to Higgs Realtime"));
    });
    console.debug("[higgs] connected; input sample rate", inRate, "→", RATE);

    this.send({
      type: "session.update",
      session: {
        model: info.model,
        instructions: info.instructions,
        audio: {
          input: {
            format: { type: "audio/pcm", rate: RATE },
            turn_detection: { type: "semantic_vad" },
            transcription: { model: info.transcriptionModel },
          },
          output: { format: { type: "audio/pcm", rate: RATE }, voice: info.voice },
        },
      },
    });

    ws.onmessage = (m) => this.handle(JSON.parse(m.data as string));
    ws.onclose = () => this.setState("off");
    ws.onerror = () => this.ev.onError("Higgs Realtime connection error");

    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const f = e.data;
      let peak = 0;
      for (let i = 0; i < f.length; i += 8) peak = Math.max(peak, Math.abs(f[i]));
      if (this.state === "listening" || this.state === "idle") this.ev.onLevel(Math.min(1, peak * 3));
      if (this.muted || ws.readyState !== WebSocket.OPEN) return;
      const pcm = downsample(f, inRate, RATE);
      this.send({ type: "input_audio_buffer.append", audio: b64(new Uint8Array(pcm.buffer)) });
      if (++this.chunksSent % 200 === 0) console.debug("[higgs] mic chunks sent:", this.chunksSent, "peak", peak.toFixed(3));
    };

    this.setState("listening");
    // Ask the model to open the conversation.
    this.send({ type: "response.create" });
  }

  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  /** Refresh the interviewer's agenda mid-session. */
  updateInstructions(instructions: string) {
    this.send({ type: "session.update", session: { instructions } });
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  private chunksSent = 0;
  private lastUser = { text: "", at: 0 };

  /** Higgs may emit a short transcript and then a cumulative one that repeats it; forward only the new words. */
  private emitUserTranscript(raw: string) {
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    const now = Date.now();
    const prev = this.lastUser;
    let text = raw.trim();
    if (prev.text && now - prev.at < 30000) {
      const a = norm(prev.text);
      const b = norm(text);
      if (a === b || a.startsWith(b)) return; // re-emit of something we already have
      if (b.startsWith(a)) text = text.slice(prev.text.length).replace(/^[\s,.;:!?-]+/, "").trim(); // cumulative → delta
    }
    this.lastUser = { text: raw.trim(), at: now };
    if (text.split(/\s+/).length >= 2) this.ev.onUserTranscript(text);
  }

  private handle(e: any) {
    if (!/delta/.test(e.type)) console.debug("[higgs]", e.type, e.type === "error" ? JSON.stringify(e).slice(0, 300) : "");
    switch (e.type) {
      case "input_audio_buffer.speech_started":
        this.stopPlayback();
        this.setState("listening");
        break;
      case "input_audio_buffer.speech_stopped":
      case "input_audio_buffer.committed":
        this.setState("thinking");
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const t = String(e.transcript ?? "").trim();
        if (t) this.emitUserTranscript(t);
        break;
      }
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (typeof e.delta === "string") this.play(unb64(e.delta));
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.assistantBuf += String(e.delta ?? "");
        this.ev.onAssistantPartial(this.assistantBuf);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const t = String(e.transcript ?? this.assistantBuf).trim();
        this.assistantBuf = "";
        if (t) this.ev.onAssistantTranscript(t);
        break;
      }
      case "response.done":
        this.assistantBuf = "";
        break;
      case "error":
        this.ev.onError(e.message ?? e.error?.message ?? "Higgs error");
        break;
      default:
        break;
    }
  }

  private play(pcm: Int16Array) {
    if (!this.ctx || !pcm.length) return;
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 0x8000;
    const buf = this.ctx.createBuffer(1, f.length, RATE);
    buf.copyToChannel(f, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    if (this.playhead < now) this.playhead = now + 0.02;
    src.start(this.playhead);
    this.playhead += buf.duration;
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
    };
    this.setState("speaking");
    window.clearTimeout(this.speakingTimer);
    this.speakingTimer = window.setTimeout(() => this.setState("listening"), Math.max(50, (this.playhead - this.ctx.currentTime) * 1000 + 80));
  }

  private stopPlayback() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.sources = [];
    this.playhead = 0;
    window.clearTimeout(this.speakingTimer);
  }

  disconnect() {
    this.stopPlayback();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws?.close();
    void this.ctx?.close().catch(() => undefined);
    this.ws = null;
    this.ctx = null;
    this.setState("off");
  }
}
