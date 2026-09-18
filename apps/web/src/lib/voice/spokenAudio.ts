import { BrowserVoice } from "./browserVoice.js";
import { BlobPlayer } from "./player.js";

/** Natural server speech with browser fallback; stale downloads never play after stop(). */
export class SpokenAudio {
  private generation = 0;
  private player = new BlobPlayer();
  private fallback: BrowserVoice | null = null;
  private destroyed = false;
  private cancelDownload: (() => void) | null = null;

  constructor(private onFallback?: () => void, private language = "en-US", private onState?: (state: "thinking" | "speaking" | "idle") => void) {}

  async speak(text: string, fetchAudio?: () => Promise<Blob>): Promise<void> {
    if (this.destroyed || !text.trim()) return;
    this.stop();
    const generation = this.generation;
    this.onState?.("thinking");
    if (fetchAudio) {
      try {
        const cancelled = new Promise<null>((resolve) => { this.cancelDownload = () => resolve(null); });
        const blob = await Promise.race([fetchAudio(), cancelled]);
        if (generation !== this.generation || this.destroyed || !blob) return;
        this.cancelDownload = null;
        this.onState?.("speaking");
        await this.player.play(blob);
        if (generation === this.generation) this.onState?.("idle");
        return;
      } catch (error) {
        if (generation !== this.generation || this.destroyed) return;
        this.cancelDownload = null;
        if (!BrowserVoice.synthesisSupported()) { this.onState?.("idle"); throw error; }
        this.onFallback?.();
      }
    }
    if (generation !== this.generation || this.destroyed) return;
    this.fallback ??= new BrowserVoice({ onPartial() {}, onFinal() {}, onState() {}, onLevel() {}, onError() {} }, this.language);
    this.onState?.("speaking");
    try { await this.fallback.speak(text); }
    finally { if (generation === this.generation) this.onState?.("idle"); }
  }

  stop() {
    this.generation++;
    this.cancelDownload?.();
    this.cancelDownload = null;
    this.player.stop();
    this.fallback?.stopSpeaking();
    this.onState?.("idle");
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    this.fallback?.destroy();
    this.fallback = null;
  }
}
