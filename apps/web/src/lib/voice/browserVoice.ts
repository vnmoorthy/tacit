/** Browser speech input and an offline-compatible speech synthesis fallback. */
import { MicLevel } from "./mic.js";
import type { VoiceEvents, VoiceState } from "./types.js";

function getRecognitionCtor(): (new () => any) | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface BrowserVoiceEvents extends VoiceEvents {
  onPartial(text: string): void;
  onFinal(text: string): void;
}

export class BrowserVoice {
  static supported(): boolean { return Boolean(getRecognitionCtor()) && "speechSynthesis" in window; }
  static recognitionSupported(): boolean { return Boolean(getRecognitionCtor()); }
  static synthesisSupported(): boolean { return "speechSynthesis" in window; }

  private rec: any = null;
  private mic = new MicLevel();
  private wantListening = false;
  private state: VoiceState = "off";
  private buffer = "";
  private silenceTimer = 0;
  private restartTimer = 0;
  private destroyed = false;
  private voice: SpeechSynthesisVoice | null = null;
  private finishSpeech: (() => void) | null = null;
  private lang: string;
  private voicesChanged = () => this.pickVoice();

  constructor(private ev: BrowserVoiceEvents, lang = "en-US") {
    this.lang = lang;
    this.pickVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", this.voicesChanged);
  }

  private setState(state: VoiceState) {
    if (this.destroyed && state !== "off") return;
    this.state = state;
    this.ev.onState(state);
  }

  get stream(): MediaStream | null { return this.mic.stream; }

  async init() {
    if (this.destroyed) throw new DOMException("Voice setup cancelled", "AbortError");
    await this.mic.start((level) => this.ev.onLevel(this.state === "listening" ? level : 0));
    if (this.destroyed) { this.mic.stop(); return; }
    this.setState("idle");
  }

  private pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    const lang = this.lang.toLowerCase().replace("_", "-");
    const base = lang.split("-")[0];
    const family = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
    const exact = family.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang);
    const pool = exact.length ? exact : family;
    this.voice = pool.find((v) => /Natural|Premium|Enhanced|Google|Samantha/i.test(v.name)) ?? pool[0] ?? voices[0] ?? null;
  }

  listen() {
    if (this.destroyed || this.state === "speaking" || this.state === "thinking") return;
    this.wantListening = true;
    this.mic.setMuted(false);
    this.startRecognition();
  }

  private startRecognition() {
    const Ctor = getRecognitionCtor();
    if (this.destroyed || !Ctor || !this.wantListening || this.rec) return;
    const rec = new Ctor();
    this.rec = rec;
    const current = () => this.rec === rec && this.wantListening && !this.destroyed;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.buffer = "";
    rec.onstart = () => { if (current()) this.setState("listening"); };
    rec.onresult = (event: any) => {
      if (!current()) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) this.buffer += (this.buffer ? " " : "") + result[0].transcript.trim();
        else interim += result[0].transcript;
      }
      this.ev.onPartial((this.buffer + " " + interim).trim());
      window.clearTimeout(this.silenceTimer);
      if (this.buffer && !interim.trim()) this.silenceTimer = window.setTimeout(() => { if (current()) this.commit(); }, 1600);
    };
    rec.onerror = (event: any) => {
      if (!current() || event.error === "no-speech" || event.error === "aborted") return;
      this.stopListening();
      this.setState("idle");
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone permission was denied. Allow the mic and try again, or type your answer."
        : event.error === "network"
          ? "Speech recognition lost its connection. Type your answer or press the microphone to retry."
          : "Speech recognition stopped. Type your answer or press the microphone to retry.";
      this.ev.onError(message);
    };
    rec.onend = () => {
      if (!current()) return;
      this.rec = null;
      if (this.buffer) this.commit();
      if (this.wantListening) this.restartTimer = window.setTimeout(() => this.startRecognition(), 250);
    };
    try { rec.start(); }
    catch (error) {
      this.rec = null;
      this.wantListening = false;
      this.setState("idle");
      this.ev.onError((error as Error).message || "Could not start speech recognition. Try again or type your answer.");
    }
  }

  private commit() {
    const text = this.buffer.trim();
    this.stopListening();
    if (text && !this.destroyed) this.ev.onFinal(text);
  }

  stopListening() {
    this.wantListening = false;
    this.buffer = "";
    window.clearTimeout(this.silenceTimer);
    window.clearTimeout(this.restartTimer);
    this.mic.setMuted(true);
    if (this.rec) {
      const rec = this.rec;
      this.rec = null;
      rec.onend = rec.onresult = rec.onerror = rec.onstart = null;
      try { rec.abort(); } catch { /* already stopped */ }
    }
    this.ev.onPartial("");
    this.ev.onLevel(0);
    if (this.state === "listening") this.setState("idle");
  }

  thinking() { this.stopListening(); this.stopSpeaking(); this.setState("thinking"); }
  idle() { this.setState("idle"); }

  /** Does not require microphone permission. Cancellation always settles the promise. */
  speak(text: string): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const synth = window.speechSynthesis;
    if (!synth) return Promise.reject(new Error("Spoken playback is not supported in this browser."));
    this.stopListening();
    this.stopSpeaking();
    this.pickVoice();
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.lang;
      if (this.voice) utterance.voice = this.voice;
      utterance.rate = 1;
      let done = false;
      const finish = (error?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        utterance.onstart = utterance.onend = utterance.onerror = null;
        if (this.finishSpeech === cancel) this.finishSpeech = null;
        if (this.state === "speaking") this.setState("idle");
        if (error) reject(error); else resolve();
      };
      const cancel = () => finish();
      this.finishSpeech = cancel;
      const watchdog = setTimeout(() => {
        finish(new Error("Spoken playback timed out. Press Replay to try again."));
        synth.cancel();
      }, Math.max(15000, text.split(/\s+/).length * 700 + 5000));
      this.setState("speaking");
      utterance.onend = () => finish();
      utterance.onerror = (event) => finish(event.error === "canceled" || event.error === "interrupted" ? undefined : new Error(`Browser voice failed (${event.error}). Press Replay to try again.`));
      try { synth.resume(); synth.speak(utterance); }
      catch (error) { finish(error as Error); }
    });
  }

  stopSpeaking() {
    const finish = this.finishSpeech;
    if (finish) {
      finish();
      window.speechSynthesis?.cancel();
    }
  }

  destroy() {
    this.destroyed = true;
    this.stopListening();
    this.stopSpeaking();
    this.mic.stop();
    window.speechSynthesis?.removeEventListener?.("voiceschanged", this.voicesChanged);
    this.setState("off");
  }
}
