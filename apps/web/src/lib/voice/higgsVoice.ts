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
  onDisconnect?(message: string): void;
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
  private generation = 0;
  private cancelConnect: (() => void) | null = null;
  private responseActive = false;
  private interruptedResponses = new Set<string>();
  private responseId = "";
  private userItems = new Map<string, string>();
  private assistantItems = new Set<string>();

  constructor(private ev: HiggsEvents) {}

  private setState(state: VoiceState) {
    if (this.state === state) return;
    this.state = state;
    this.ev.onState(state);
  }

  async connect(info: HiggsSessionInfo) {
    this.disconnect();
    const generation = this.generation;
    const current = () => generation === this.generation;
    const check = () => { if (!current()) throw new DOMException("Voice setup cancelled", "AbortError"); };
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires HTTPS or localhost.");
      const ctx = new AudioContext({ sampleRate: RATE });
      this.ctx = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      check();
      const workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      try { await ctx.audioWorklet.addModule(workletUrl); }
      finally { URL.revokeObjectURL(workletUrl); }
      check();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); check(); }
      this.stream = stream;
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "tacit-capture");
      this.node = node;
      src.connect(node);
      // Keep the worklet in the render graph without playing microphone audio.
      const silent = ctx.createGain();
      silent.gain.value = 0;
      node.connect(silent).connect(ctx.destination);
      const ws = new WebSocket(info.wsUrl, ["realtime", `bai-client-secret.${info.clientSecret}`]);
      this.ws = ws;
      await new Promise<void>((resolve, reject) => {
        let ready = false;
        const fail = (message: string) => {
          if (!current()) return;
          if (!ready) { clearTimeout(timeout); this.cancelConnect = null; reject(new Error(message)); }
          else {
            this.disconnect();
            this.ev.onDisconnect?.(message);
            this.ev.onError(message);
          }
        };
        const timeout = setTimeout(() => fail("Voice connection timed out. Continue by typing or retry voice."), 15000);
        this.cancelConnect = () => { clearTimeout(timeout); reject(new DOMException("Voice setup cancelled", "AbortError")); };
        ws.onopen = () => {
          if (!current()) return;
          this.send({
            type: "session.update",
            session: {
              model: info.model,
              instructions: info.instructions,
              audio: {
                input: { format: { type: "audio/pcm", rate: RATE }, turn_detection: { type: "semantic_vad" }, transcription: { model: info.transcriptionModel } },
                output: { format: { type: "audio/pcm", rate: RATE }, voice: info.voice },
              },
            },
          });
        };
        ws.onmessage = (message) => {
          if (!current()) return;
          try {
            const event = JSON.parse(message.data as string);
            if (!ready && event.type === "error") return fail(event.error?.message ?? event.message ?? "Voice setup failed.");
            if (!ready && event.type === "session.updated") {
              ready = true;
              clearTimeout(timeout);
              this.cancelConnect = null;
              resolve();
            }
            this.handle(event);
          } catch { fail("The voice service sent an unreadable response. Continue by typing."); }
        };
        ws.onclose = () => fail("Voice disconnected. Your transcript is saved; continue by typing or retry voice.");
        ws.onerror = () => fail("Could not connect to voice. Continue by typing or retry voice.");
      });
      check();
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!current() || this.muted || ws.readyState !== WebSocket.OPEN) return;
        const samples = event.data;
        let peak = 0;
        for (let i = 0; i < samples.length; i += 8) peak = Math.max(peak, Math.abs(samples[i]));
        if (this.state === "listening" || this.state === "idle") this.ev.onLevel(Math.min(1, peak * 3));
        const pcm = downsample(samples, ctx.sampleRate, RATE);
        this.send({ type: "input_audio_buffer.append", audio: b64(new Uint8Array(pcm.buffer)) });
      };
      this.setState(this.muted ? "idle" : "listening");
      this.send({ type: "response.create" });
    } catch (error) {
      if (current()) this.disconnect();
      throw error;
    }
  }

  private send(event: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event));
  }

  updateInstructions(instructions: string) {
    this.send({ type: "session.update", session: { instructions } });
  }

  /** Text and audio turns share the same provider conversation. */
  sendText(text: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) throw new Error("Voice is disconnected. Switch to typing and send again.");
    this.interrupt();
    this.send({ type: "input_audio_buffer.clear" });
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    this.send({ type: "response.create" });
    this.setState("thinking");
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    if (muted) { this.send({ type: "input_audio_buffer.clear" }); this.ev.onLevel(0); }
    if (this.state === "listening" || this.state === "idle") this.setState(muted ? "idle" : "listening");
  }

  private emitUserTranscript(event: any) {
    const raw = String(event.transcript ?? "").trim();
    if (!raw) return;
    const key = String(event.item_id ?? event.event_id ?? "");
    const previous = key ? this.userItems.get(key) : undefined;
    if (previous === raw) return;
    // A provider can update a transcript for the same item. Preserve short answers
    // and repeated words in distinct turns; never deduplicate across speakers' turns.
    const text = previous && raw.startsWith(previous) ? raw.slice(previous.length).trim() : raw;
    if (key) this.userItems.set(key, raw);
    if (this.userItems.size > 100) this.userItems.delete(this.userItems.keys().next().value!);
    if (text) this.ev.onUserTranscript(text);
  }

  private handle(event: any) {
    if (event.response_id && this.interruptedResponses.has(event.response_id)) return;
    switch (event.type) {
      case "response.created":
        this.responseActive = true;
        this.responseId = event.response?.id ?? "";
        this.assistantBuf = "";
        this.setState("thinking");
        break;
      case "input_audio_buffer.speech_started":
        this.interrupt();
        this.setState(this.muted ? "idle" : "listening");
        break;
      case "input_audio_buffer.speech_stopped":
      case "input_audio_buffer.committed":
        if (!this.muted) this.setState("thinking");
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.emitUserTranscript(event);
        break;
      case "conversation.item.input_audio_transcription.failed":
        this.ev.onError("That answer could not be transcribed. Please repeat it or type below.");
        this.setState(this.muted ? "idle" : "listening");
        break;
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (typeof event.delta === "string") this.play(unb64(event.delta));
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.assistantBuf += String(event.delta ?? "");
        this.ev.onAssistantPartial(this.assistantBuf);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = String(event.transcript ?? this.assistantBuf).trim();
        const key = `${event.item_id ?? event.response_id ?? this.responseId}:${event.content_index ?? 0}`;
        this.assistantBuf = "";
        this.ev.onAssistantPartial("");
        if (text && !this.assistantItems.has(key)) {
          this.assistantItems.add(key);
          this.ev.onAssistantTranscript(text);
        }
        break;
      }
      case "response.done":
        this.responseActive = false;
        this.assistantBuf = "";
        this.ev.onAssistantPartial("");
        if (event.response?.status === "failed") this.ev.onError("Voice could not generate a reply. Try again or continue by typing.");
        if (!this.sources.length) this.setState(this.muted ? "idle" : "listening");
        break;
      case "error":
        this.ev.onError(event.message ?? event.error?.message ?? "Voice service error. Try again or continue by typing.");
        if (!this.sources.length) this.setState(this.muted ? "idle" : "listening");
        break;
    }
  }

  private play(pcm: Int16Array) {
    if (!this.ctx || !pcm.length) return;
    const samples = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 0x8000;
    const buffer = this.ctx.createBuffer(1, samples.length, RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    if (this.playhead < this.ctx.currentTime) this.playhead = this.ctx.currentTime + 0.02;
    source.start(this.playhead);
    this.playhead += buffer.duration;
    this.sources.push(source);
    source.onended = () => { source.disconnect(); this.sources = this.sources.filter((other) => other !== source); };
    this.setState("speaking");
    window.clearTimeout(this.speakingTimer);
    this.speakingTimer = window.setTimeout(() => this.setState(this.muted ? "idle" : "listening"), Math.max(50, (this.playhead - this.ctx.currentTime) * 1000 + 80));
  }

  interrupt() {
    if (this.responseActive) {
      if (this.responseId) this.interruptedResponses.add(this.responseId);
      this.send({ type: "response.cancel" });
      this.responseActive = false;
    }
    this.stopPlayback();
    this.assistantBuf = "";
    this.ev.onAssistantPartial("");
  }

  private stopPlayback() {
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); source.disconnect(); } catch { /* already stopped */ }
    }
    this.sources = [];
    this.playhead = 0;
    window.clearTimeout(this.speakingTimer);
  }

  disconnect() {
    this.generation++;
    this.cancelConnect?.();
    this.cancelConnect = null;
    this.stopPlayback();
    if (this.node) this.node.port.onmessage = null;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      this.ws.close();
    }
    void this.ctx?.close().catch(() => undefined);
    this.ws = null;
    this.ctx = null;
    this.node = null;
    this.stream = null;
    this.responseActive = false;
    this.assistantBuf = "";
    this.responseId = "";
    this.userItems.clear();
    this.assistantItems.clear();
    this.interruptedResponses.clear();
    this.ev.onLevel(0);
    this.ev.onAssistantPartial("");
    this.setState("off");
  }
}
