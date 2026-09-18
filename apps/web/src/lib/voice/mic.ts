/** Shared microphone + level meter. Setup can safely be cancelled by navigation. */
export class MicLevel {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private generation = 0;
  private data: Uint8Array<ArrayBuffer> | null = null;
  stream: MediaStream | null = null;

  async start(onLevel: (l: number) => void): Promise<MediaStream> {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires HTTPS or localhost in a supported browser.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException("Microphone setup was cancelled", "AbortError");
    }
    this.stream = stream;
    try {
      this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      if (generation !== this.generation) throw new DOMException("Microphone setup was cancelled", "AbortError");
      const src = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      const tick = () => {
        if (generation !== this.generation || !this.analyser || !this.data) return;
        this.analyser.getByteTimeDomainData(this.data);
        let sum = 0;
        for (const sample of this.data) sum += ((sample - 128) / 128) ** 2;
        onLevel(Math.min(1, Math.sqrt(sum / this.data.length) * 4.5));
        this.raf = requestAnimationFrame(tick);
      };
      tick();
      return stream;
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }

  get context(): AudioContext | null { return this.ctx; }

  setMuted(muted: boolean) {
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }

  stop() {
    this.generation++;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.analyser = null;
    this.data = null;
  }
}
