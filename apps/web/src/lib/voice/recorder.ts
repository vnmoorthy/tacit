/** Optional, explicitly permitted microphone recording for voice cloning. */
export class ReferenceRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stopping: Promise<Blob | null> | null = null;
  mimeType = "audio/webm";

  static supported(): boolean { return typeof MediaRecorder !== "undefined"; }

  start(stream: MediaStream) {
    if (!ReferenceRecorder.supported() || this.rec || this.stopping) return;
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    this.mimeType = candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
    const recorder = new MediaRecorder(stream, this.mimeType ? { mimeType: this.mimeType, audioBitsPerSecond: 64000 } : undefined);
    this.rec = recorder;
    this.chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
    recorder.start(1000);
    this.startedAt = Date.now();
  }

  get seconds(): number { return this.rec ? (Date.now() - this.startedAt) / 1000 : 0; }

  /** A failed recorder must never prevent the interview from ending. */
  stop(): Promise<Blob | null> {
    if (this.stopping) return this.stopping;
    const recorder = this.rec;
    if (!recorder) return Promise.resolve(null);
    const mimeType = this.mimeType;
    this.stopping = new Promise<Blob | null>((resolve) => {
      let settled = false;
      const done = (usable: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        recorder.onstop = recorder.onerror = recorder.ondataavailable = null;
        const blob = usable ? new Blob(this.chunks, { type: mimeType || "audio/webm" }) : null;
        this.chunks = [];
        this.rec = null;
        resolve(blob && blob.size > 20_000 ? blob : null);
      };
      const timeout = setTimeout(() => done(false), 2000);
      recorder.onstop = () => done(true);
      recorder.onerror = () => done(false);
      try { if (recorder.state === "inactive") done(true); else recorder.stop(); }
      catch { done(false); }
    }).finally(() => { this.stopping = null; });
    return this.stopping;
  }
}
