/**
 * Browser voice engine: Web Speech API recognition for the expert,
 * speechSynthesis for the interviewer. No keys, works in Chrome/Edge/Safari.
 */
import { MicLevel } from "./mic.js";
import type { VoiceEvents, VoiceState } from "./types.js";

type SR = typeof window extends { SpeechRecognition: infer T } ? T : any;

function getRecognitionCtor(): (new () => any) | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface BrowserVoiceEvents extends VoiceEvents {
  onPartial(text: string): void;
  onFinal(text: string): void;
}

export class BrowserVoice {
  static supported(): boolean {
    return Boolean(getRecognitionCtor()) && "speechSynthesis" in window;
  }
  static recognitionSupported(): boolean {
    return Boolean(getRecognitionCtor());
  }

  private rec: any = null;
  private mic = new MicLevel();
  private wantListening = false;
  private state: VoiceState = "off";
  private buffer = "";
  private silenceTimer = 0;
  private destroyed = false;
  private voice: SpeechSynthesisVoice | null = null;
  private synthUnlocked = false;

  private lang = "en-US";

  constructor(private ev: BrowserVoiceEvents, lang?: string) {
    if (lang) this.lang = lang;
  }

  private setState(s: VoiceState) {
    this.state = s;
    this.ev.onState(s);
  }

  /** The microphone stream (available after init). */
  get stream(): MediaStream | null {
    return this.mic.stream;
  }

  async init() {
    await this.mic.start((l) => this.ev.onLevel(this.state === "listening" ? l : 0));
    this.pickVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", () => this.pickVoice());
    this.setState("idle");
  }

  private pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    if (!voices.length) return;
    const base = this.lang.split("-")[0].toLowerCase();
    if (base !== "en") {
      const exact = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === this.lang.toLowerCase());
      const family = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
      const pool = exact.length ? exact : family;
      this.voice = pool.find((v) => /Google|Natural|Premium|Enhanced/i.test(v.name)) ?? pool[0] ?? voices[0];
      return;
    }
    const prefs = [/Google US English/i, /Samantha/i, /Karen/i, /Daniel/i, /Moira/i, /Microsoft (Aria|Jenny|Guy)/i, /en-US/i, /en-GB/i, /en/i];
    for (const re of prefs) {
      const v = voices.find((v) => re.test(v.name) || re.test(v.lang));
      if (v) {
        this.voice = v;
        return;
      }
    }
    this.voice = voices[0];
  }

  /** Begin (or resume) listening for the expert. Recognition auto-restarts until stopListening(). */
  listen() {
    if (this.destroyed) return;
    this.wantListening = true;
    this.startRecognition();
  }

  private startRecognition() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !this.wantListening) return;
    if (this.rec) {
      try {
        this.rec.abort();
      } catch {
        /* ignore */
      }
    }
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.buffer = "";
    rec.onstart = () => this.setState("listening");
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.buffer += (this.buffer ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      this.ev.onPartial((this.buffer + " " + interim).trim());
      // The expert paused for ~1.6s after a final chunk → treat as end of turn.
      window.clearTimeout(this.silenceTimer);
      if (this.buffer) {
        this.silenceTimer = window.setTimeout(() => this.commit(), 1600);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.wantListening = false;
        this.ev.onError("Microphone permission was denied. Allow the mic and try again, or switch to typing.");
        this.setState("off");
        return;
      }
      if (e.error === "network") {
        this.ev.onError("Speech recognition needs a network connection in this browser. You can type your answers instead.");
      }
    };
    rec.onend = () => {
      if (this.buffer) this.commit();
      // Chrome ends recognition after silence; keep listening.
      if (this.wantListening && !this.destroyed) setTimeout(() => this.wantListening && this.startRecognition(), 250);
    };
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  private commit() {
    window.clearTimeout(this.silenceTimer);
    const text = this.buffer.trim();
    this.buffer = "";
    if (!text) return;
    this.stopListening();
    this.ev.onPartial("");
    this.ev.onFinal(text);
  }

  stopListening() {
    this.wantListening = false;
    window.clearTimeout(this.silenceTimer);
    if (this.rec) {
      const r = this.rec;
      this.rec = null;
      r.onend = null;
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    }
    if (this.state === "listening") this.setState("idle");
  }

  thinking() {
    this.stopListening();
    this.setState("thinking");
  }

  /** Speak a line; resolves when done (or immediately if synthesis is unavailable). */
  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) return resolve();
      this.stopListening();
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = 1.02;
      u.pitch = 1.0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearInterval(watchdog);
        if (this.state === "speaking") this.setState("idle");
        resolve();
      };
      u.onstart = () => this.setState("speaking");
      u.onend = finish;
      u.onerror = finish;
      // Some browsers never fire onend for cancelled/long utterances — watchdog.
      const est = 2000 + text.split(/\s+/).length * 420;
      const started = Date.now();
      const watchdog = window.setInterval(() => {
        if (!synth.speaking || Date.now() - started > est + 4000) finish();
      }, 400);
      this.synthUnlocked = true;
      synth.speak(u);
    });
  }

  stopSpeaking() {
    window.speechSynthesis?.cancel();
    if (this.state === "speaking") this.setState("idle");
  }

  destroy() {
    this.destroyed = true;
    this.stopListening();
    this.stopSpeaking();
    this.mic.stop();
    this.setState("off");
  }
}
