import { BrowserVoice } from "./browserVoice.js";
import { BlobPlayer } from "./player.js";

/** Natural server speech with browser fallback; stale downloads never play after stop(). */
export class SpokenAudio {
  private generation = 0;
  private player = new BlobPlayer();
  private fallback: BrowserVoice | null = null;
  private destroyed = false;

  constructor(private onFallback?: () => void, private language = "en-US") {}

  async speak(text: string, fetchAudio?: () => Promise<Blob>): Promise<void> {
    if (this.destroyed || !text.trim()) return;
    this.stop();
    const generation = this.generation;
    if (fetchAudio) {
      try {
        const blob = await fetchAudio();
        if (generation !== this.generation || this.destroyed) return;
        await this.player.play(blob);
        return;
      } catch (error) {
        if (generation !== this.generation || this.destroyed) return;
        if (!BrowserVoice.synthesisSupported()) throw error;
        this.onFallback?.();
      }
    }
    if (generation !== this.generation || this.destroyed) return;
    this.fallback ??= new BrowserVoice({ onPartial() {}, onFinal() {}, onState() {}, onLevel() {}, onError() {} }, this.language);
    await this.fallback.speak(text);
  }

  stop() {
    this.generation++;
    this.player.stop();
    this.fallback?.stopSpeaking();
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    this.fallback?.destroy();
    this.fallback = null;
  }
}
