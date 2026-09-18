/**
 * Camera hand tracking with MediaPipe Hand Landmarker (WASM, on-device).
 * Emits per-frame hand states with simple, robust gestures: point, pinch, open palm, fist.
 * Coordinates are normalised [0,1] and mirrored so they match what the user sees.
 */
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface Pt {
  x: number;
  y: number;
}

export interface HandState {
  handedness: "Left" | "Right";
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

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function analyseHand(landmarks: NormalizedLandmark[], handedness: "Left" | "Right"): HandState {
  const wrist = landmarks[0];
  const size = Math.max(0.02, dist(wrist, landmarks[9]));
  const extended = TIPS.map((tip, i) => dist(landmarks[tip], wrist) > dist(landmarks[PIPS[i]], wrist) * 1.12);
  const count = extended.filter(Boolean).length;
  const pinchDistance = Math.min(1, dist(landmarks[4], landmarks[8]) / (size * 1.6));
  const pinch = pinchDistance < 0.28;
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

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastT = -1;
  private frames = 0;
  private fpsAt = 0;
  private fps = 0;
  running = false;

  constructor(
    private video: HTMLVideoElement,
    private onFrame: (f: HandFrame) => void,
  ) {}

  static supported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof WebAssembly !== "undefined";
  }

  async start(onStatus?: (s: string) => void) {
    onStatus?.("Loading hand model…");
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" }, runningMode: "VIDEO", numHands: 2 });
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" }, runningMode: "VIDEO", numHands: 2 });
    }
    onStatus?.("Starting camera…");
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    this.running = true;
    onStatus?.("Tracking");
    const loop = () => {
      if (!this.running || !this.landmarker) return;
      const now = performance.now();
      if (this.video.readyState >= 2 && now !== this.lastT) {
        this.lastT = now;
        const res = this.landmarker.detectForVideo(this.video, now);
        const hands: HandState[] = (res.landmarks ?? []).map((lm, i) => analyseHand(lm, (res.handedness?.[i]?.[0]?.categoryName as "Left" | "Right") ?? "Right"));
        this.frames++;
        if (now - this.fpsAt > 1000) {
          this.fps = this.frames;
          this.frames = 0;
          this.fpsAt = now;
        }
        this.onFrame({ hands, t: now, fps: this.fps });
      }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.landmarker?.close();
    this.landmarker = null;
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
