/** Records the expert's microphone during a session so the twin can borrow their voice (Higgs Audio cloning). */
export class ReferenceRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  mimeType = "audio/webm";

  static supported(): boolean {
    return typeof MediaRecorder !== "undefined";
  }

  start(stream: MediaStream) {
    if (!ReferenceRecorder.supported()) return;
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    this.mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    this.rec = new MediaRecorder(stream, this.mimeType ? { mimeType: this.mimeType, audioBitsPerSecond: 64000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(1000);
    this.startedAt = Date.now();
  }

  get seconds(): number {
    return this.rec ? (Date.now() - this.startedAt) / 1000 : 0;
  }

  /** Stop and return the recording (or null if too short / unsupported). */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = this.rec;
      if (!rec) return resolve(null);
      this.rec = null;
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
        resolve(blob.size > 20_000 ? blob : null);
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }
}
