import type { HandState, Pt } from "./handTracker.js";

export type GestureMode = "none" | "point" | "pinch" | "orbit" | "zoom" | "hold";
export interface GestureMotionFrame {
  mode: GestureMode;
  pointer?: Pt;
  rotate?: Pt;
  zoom?: number;
  pinchStarted: boolean;
  pinchReleased: boolean;
  /** Losing the primary hand or entering a two-hand gesture cancels a drag. */
  cancelled: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Relative motion is measured only within one gesture by the same hand. */
export class GestureMotion {
  private mode: GestureMode = "none";
  private primary: number | string | undefined;
  private anchor: Pt | null = null;
  private separation: number | null = null;

  reset() { this.mode = "none"; this.primary = undefined; this.anchor = null; this.separation = null; }

  update(hands: HandState[]): GestureMotionFrame {
    const hand = hands[0];
    const primary = hand?.trackingId ?? hand?.handedness;
    const mode: GestureMode = hands.length === 2 && hands.every((h) => h.open || h.pointing) ? "zoom"
      : !hand ? "none" : hand.pinch ? "pinch" : hand.pointing ? "point" : hand.open ? "orbit" : hand.fist ? "hold" : "none";
    const sameHand = this.primary === primary;
    const continuous = sameHand && this.mode === mode;
    const result: GestureMotionFrame = {
      mode,
      pinchStarted: mode === "pinch" && !continuous,
      pinchReleased: this.mode === "pinch" && mode !== "pinch" && sameHand && mode !== "zoom" && !!hand,
      cancelled: !sameHand || !hand || mode === "zoom",
    };
    if (!continuous) { this.anchor = null; this.separation = null; }
    if (mode === "zoom") {
      const d = Math.hypot(hands[0].palm.x - hands[1].palm.x, hands[0].palm.y - hands[1].palm.y);
      // Coincident/occluded hands are not a useful zoom input.
      if (d < 0.08) this.separation = null;
      else if (this.separation === null) this.separation = d;
      else if (Math.abs(this.separation / d - 1) > 0.003) {
        result.zoom = clamp(this.separation / d, 0.94, 1.06);
        this.separation = d;
      }
    } else if (hand) {
      if (mode === "point" || mode === "pinch") result.pointer = mode === "pinch" ? hand.pinchPoint : hand.pointer;
      if (mode === "pinch" || mode === "orbit") {
        const point = mode === "pinch" ? hand.pinchPoint : hand.palm;
        if (this.anchor) {
          const dx = point.x - this.anchor.x;
          const dy = point.y - this.anchor.y;
          if (Math.hypot(dx, dy) > 0.002) {
            result.rotate = { x: clamp(-dx * 3.4, -0.12, 0.12), y: clamp(dy * 2.6, -0.1, 0.1) };
            this.anchor = point;
          }
        } else this.anchor = point;
      }
    }
    this.mode = mode;
    this.primary = primary;
    return result;
  }
}

/** Map mirrored landmark coordinates to the same contained camera viewport. */
export function cameraViewport(width: number, height: number, sourceWidth: number, sourceHeight: number) {
  const scale = Math.min(width / (sourceWidth || 640), height / (sourceHeight || 480));
  const w = (sourceWidth || 640) * scale;
  const h = (sourceHeight || 480) * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
