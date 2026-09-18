/** Plays audio blobs one at a time; used for Higgs Audio replies. */
export class BlobPlayer {
  private audio: HTMLAudioElement | null = null;
  play(blob: Blob): Promise<void> {
    this.stop();
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      this.audio = a;
      const done = () => {
        URL.revokeObjectURL(url);
        if (this.audio === a) this.audio = null;
        resolve();
      };
      a.onended = done;
      a.onerror = done;
      a.play().catch(done);
    });
  }
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}
