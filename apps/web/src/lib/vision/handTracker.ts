/**
 * Camera hand tracking with MediaPipe Hand Landmarker (WASM, on-device).
 * Emits per-frame hand states with simple, robust gestures: point, pinch, open palm, fist.
 * Coordinates are normalised [0,1] and mirrored so they match what the user sees.
 */
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

// Vite fingerprints and serves the matching installed runtime from our own origin.
import wasmLoader from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinary from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import noSimdLoader from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import noSimdBinary from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";

const MODEL_URL = `${import.meta.env.BASE_URL}vision/hand_landmarker.task`;

export interface Pt {
  x: number;
  y: number;
}

export interface HandState {
  handedness: "Left" | "Right";
  trackingId?: number;
  landmarks: NormalizedLandmark[];
  /** Index fingertip, mirrored. */
  pointer: Pt;
  /** Midpoint between thumb and index tips, mirrored. */
  pinchPoint: Pt;
  /** Palm centre, mirrored. */
  palm: Pt;
  /** 0 (touching) … 1 (far apart), relative to hand size. */
  pinchDistance: number;
  pinch: boolean;
  pointing: boolean;
  open: boolean;
  fist: boolean;
  /** Hand size proxy (wrist → middle MCP), normalised units. */
  size: number;
}

export interface HandFrame {
  hands: HandState[];
  t: number;
  fps: number;
}

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

function dist(a: NormalizedLandmark, b: NormalizedLandmark, aspect = 1): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

export function analyseHand(landmarks: NormalizedLandmark[], handedness: "Left" | "Right", aspect = 1): HandState {
  const wrist = landmarks[0];
  const size = Math.max(0.02, dist(wrist, landmarks[9], aspect));
  const extended = TIPS.map((tip, i) => dist(landmarks[tip], wrist, aspect) > dist(landmarks[PIPS[i]], wrist, aspect) * 1.12);
  const count = extended.filter(Boolean).length;
  const pinchDistance = Math.min(1, dist(landmarks[4], landmarks[8], aspect) / (size * 1.6));
  // A closed fist also puts thumb and index close together; keep it a safe hold gesture.
  const pinch = count > 0 && pinchDistance < 0.28;
  const pointing = !pinch && extended[0] && !extended[1] && !extended[2] && !extended[3];
  const open = !pinch && count >= 4;
  const fist = !pinch && count === 0;
  const m = (p: NormalizedLandmark): Pt => ({ x: 1 - p.x, y: p.y });
  const palmPts = [0, 5, 9, 13, 17].map((i) => landmarks[i]);
  const palm = m({ x: palmPts.reduce((a, p) => a + p.x, 0) / 5, y: palmPts.reduce((a, p) => a + p.y, 0) / 5, z: 0 } as NormalizedLandmark);
  return {
    handedness,
    landmarks,
    pointer: m(landmarks[8]),
    pinchPoint: m({ x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2, z: 0 } as NormalizedLandmark),
    palm,
    pinchDistance,
    pinch,
    pointing,
    open,
    fist,
    size,
  };
}

/** Stabilize by physical hand, even when MediaPipe changes result ordering. */
export class HandStabilizer {
  private previous: HandState[] = [];
  private nextId = 1;
  private lastT = 0;

  reset() { this.previous = []; this.lastT = 0; }

  update(hands: HandState[], t: number): HandState[] {
    if (t - this.lastT > 1500) this.previous = [];
    const gain = Math.max(0.22, Math.min(0.8, 1 - Math.exp(-(t - this.lastT || 33) / 45)));
    this.lastT = t;
    const remaining = [...this.previous];
    const mix = (a: Pt, b: Pt): Pt => ({ x: a.x + (b.x - a.x) * gain, y: a.y + (b.y - a.y) * gain });
    const result = hands.map((h) => {
      remaining.sort((a, b) => Math.hypot(a.palm.x - h.palm.x, a.palm.y - h.palm.y) + (a.handedness === h.handedness ? 0 : 0.12) - Math.hypot(b.palm.x - h.palm.x, b.palm.y - h.palm.y) - (b.handedness === h.handedness ? 0 : 0.12));
      const candidate = remaining[0];
      const prev = candidate && Math.hypot(candidate.palm.x - h.palm.x, candidate.palm.y - h.palm.y) < 0.3 ? remaining.shift() : undefined;
      // Separate engage/release thresholds prevent a held pinch chattering near its boundary.
      const pinch = !h.fist && h.pinchDistance < (prev?.pinch ? 0.36 : 0.24);
      return {
        ...h,
        trackingId: prev?.trackingId ?? this.nextId++,
        pointer: prev ? mix(prev.pointer, h.pointer) : h.pointer,
        pinchPoint: prev ? mix(prev.pinchPoint, h.pinchPoint) : h.pinchPoint,
        palm: prev ? mix(prev.palm, h.palm) : h.palm,
        pinch,
        pointing: !pinch && h.pointing,
        open: !pinch && h.open,
        fist: !pinch && h.fist,
      };
    }).sort((a, b) => a.trackingId - b.trackingId);
    this.previous = result;
    return result;
  }
}

export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was denied. Allow camera access in your browser, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No available camera was found. Connect a camera, then try again.";
  if (name === "NotReadableError") return "The camera is busy. Close other apps using it, then try again.";
  return error instanceof Error ? error.message : "Hand tracking could not start. Please try again.";
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private generation = 0;
  private lastVideoTime = -1;
  private lastInference = -Infinity;
  private frames = 0;
  private fpsAt = 0;
  private fps = 0;
  private stabilizer = new HandStabilizer();
  running = false;

  constructor(
    private video: HTMLVideoElement,
    private onFrame: (f: HandFrame) => void,
    private onError?: (message: string) => void,
  ) {}

  static supported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof WebAssembly !== "undefined";
  }

  async start(onStatus?: (s: string) => void): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    const active = () => generation === this.generation;
    try {
      onStatus?.("Starting camera… allow access");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 }, facingMode: "user" }, audio: false });
      if (!active()) { stream.getTracks().forEach((track) => track.stop()); return false; }
      this.stream = stream;
      this.video.srcObject = stream;
      this.video.muted = true;
      this.video.playsInline = true;
      for (const track of stream.getVideoTracks()) {
        track.onended = () => {
          if (!active()) return;
          this.stop();
          this.onError?.("The camera disconnected. Reconnect it and choose Use my hands.");
        };
      }
      await this.video.play();
      if (!active()) return false;
      onStatus?.("Loading hand tracking…");
      const simd = await FilesetResolver.isSimdSupported();
      if (!active()) return false;
      const vision = { wasmLoaderPath: simd ? wasmLoader : noSimdLoader, wasmBinaryPath: simd ? wasmBinary : noSimdBinary };
      const options = { runningMode: "VIDEO" as const, numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6 };
      let model: HandLandmarker;
      try {
        model = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" } });
      } catch (error) {
        if (!active()) return false;
        onStatus?.("Loading compatible hand tracking…");
        model = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" } });
      }
      if (!active()) { model.close(); return false; }
      this.landmarker = model;
      this.running = true;
      this.fpsAt = performance.now();
      onStatus?.("Tracking");
      const loop = () => {
        if (!active() || !this.running || !this.landmarker) return;
        const now = performance.now();
        // Inference is synchronous. Process fresh camera frames at most 20 times/s,
        // leaving headroom for the 3D renderer and speech on lower-powered laptops.
        if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime && now - this.lastInference >= 50) {
          this.lastVideoTime = this.video.currentTime;
          this.lastInference = now;
          try {
            const res = this.landmarker.detectForVideo(this.video, now);
            const aspect = (this.video.videoWidth || 640) / (this.video.videoHeight || 480);
            const hands = (res.landmarks ?? []).filter((lm) => lm.length === 21).map((lm, i) => analyseHand(lm, (res.handedness?.[i]?.[0]?.categoryName as "Left" | "Right") ?? "Right", aspect));
            this.frames++;
            if (now - this.fpsAt >= 1000) {
              this.fps = Math.round(this.frames * 1000 / (now - this.fpsAt));
              this.frames = 0;
              this.fpsAt = now;
            }
            this.onFrame({ hands: this.stabilizer.update(hands, now), t: now, fps: this.fps });
          } catch (error) {
            this.stop();
            this.onError?.(`Hand tracking stopped. ${cameraError(error)}`);
            return;
          }
        } else if (now - this.lastInference > 700 && this.lastInference !== -Infinity) {
          // A frozen/paused camera must not leave a node grabbed indefinitely.
          this.lastInference = now;
          this.stabilizer.reset();
          this.onFrame({ hands: [], t: now, fps: 0 });
        }
        this.raf = requestAnimationFrame(loop);
      };
      loop();
      return this.running;
    } catch (error) {
      if (!active()) return false;
      this.stop();
      throw new Error(cameraError(error));
    }
  }

  stop() {
    this.generation++;
    this.running = false;
    cancelAnimationFrame(this.raf);
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    if (this.video.srcObject === stream) { this.video.pause(); this.video.srcObject = null; }
    this.landmarker?.close();
    this.landmarker = null;
    this.stabilizer.reset();
    this.lastVideoTime = -1;
    this.lastInference = -Infinity;
    this.frames = 0;
    this.fps = 0;
  }
}

/** Draw landmarks on a canvas overlay (mirrored to match the preview). */
export function drawHands(ctx: CanvasRenderingContext2D, hands: HandState[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const CONN: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
  ];
  for (const hd of hands) {
    const color = hd.pinch ? "#e8b36b" : hd.pointing ? "#f6e3c3" : hd.open ? "#7ec38f" : "#a8a29a";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const [a, b] of CONN) {
      const p = hd.landmarks[a];
      const q = hd.landmarks[b];
      ctx.beginPath();
      ctx.moveTo((1 - p.x) * w, p.y * h);
      ctx.lineTo((1 - q.x) * w, q.y * h);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    for (const p of hd.landmarks) {
      ctx.beginPath();
      ctx.arc((1 - p.x) * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
