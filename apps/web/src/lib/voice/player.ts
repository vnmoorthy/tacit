/** Plays one audio blob at a time, releasing resources even when interrupted. */
export class BlobPlayer {
  private finish: (() => void) | null = null;

  play(blob: Blob): Promise<void> {
    this.stop();
    if (!blob.size) return Promise.reject(new Error("The voice service returned empty audio."));
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      let settled = false;
      const done = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        audio.onended = audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        URL.revokeObjectURL(url);
        if (this.finish === cancel) this.finish = null;
        if (error) reject(error);
        else resolve();
      };
      const cancel = () => done();
      this.finish = cancel;
      const timeout = setTimeout(() => done(new Error("Audio playback timed out. Try replaying the answer.")), 180_000);
      audio.onended = () => done();
      audio.onerror = () => done(new Error("This browser could not decode the audio. Try replaying the answer."));
      audio.play().catch((error: Error) => done(new Error(error.name === "NotAllowedError" ? "Playback was blocked. Press Replay to enable sound." : error.message || "Audio playback failed.")));
    });
  }

  stop() { this.finish?.(); }
}
