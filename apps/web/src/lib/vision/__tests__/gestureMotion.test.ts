import { describe, expect, it } from "vitest";
import { HandStabilizer, type HandState } from "../handTracker.js";
import { cameraViewport, GestureMotion } from "../gestureMotion.js";

const hand = (id = 1, options: Partial<HandState> = {}): HandState => ({
  trackingId: id, handedness: id === 1 ? "Right" : "Left", landmarks: [],
  pointer: { x: 0.5, y: 0.3 }, pinchPoint: { x: 0.5, y: 0.3 }, palm: { x: 0.5, y: 0.6 },
  pinchDistance: 0.8, pinch: false, pointing: false, open: true, fist: false, size: 0.2, ...options,
});

describe("gesture motion", () => {
  it("never jumps between pinch and open-palm coordinate spaces", () => {
    const motion = new GestureMotion();
    motion.update([hand()]);
    expect(motion.update([hand(1, { palm: { x: 0.55, y: 0.6 } })]).rotate?.x).toBeLessThan(0);
    expect(motion.update([hand(1, { pinch: true, open: false })]).rotate).toBeUndefined();
    expect(motion.update([hand()]).rotate).toBeUndefined();
  });
  it("starts a pinch once and distinguishes release from tracking loss", () => {
    const motion = new GestureMotion();
    const pinch = hand(1, { pinch: true, open: false });
    expect(motion.update([pinch]).pinchStarted).toBe(true);
    expect(motion.update([pinch]).pinchStarted).toBe(false);
    expect(motion.update([hand()]).pinchReleased).toBe(true);
    motion.update([pinch]);
    expect(motion.update([])).toMatchObject({ cancelled: true, pinchReleased: false });
  });
  it("cancels a held node when another hand takes over", () => {
    const motion = new GestureMotion();
    motion.update([hand(1, { pinch: true, open: false })]);
    expect(motion.update([hand(2)])).toMatchObject({ cancelled: true, pinchReleased: false });
  });
  it("starts two-hand zoom without a jump, clamps occlusions, and resets on return", () => {
    const motion = new GestureMotion();
    const pair = (x: number) => [hand(1, { palm: { x: 0.2, y: 0.5 } }), hand(2, { palm: { x, y: 0.5 } })];
    motion.update([hand()]);
    expect(motion.update(pair(0.7))).toMatchObject({ mode: "zoom", cancelled: true });
    expect(motion.update(pair(0.8)).zoom).toBe(0.94);
    expect(motion.update(pair(0.2)).zoom).toBeUndefined();
    expect(motion.update(pair(0.8)).zoom).toBeUndefined();
    expect(motion.update([hand()]).rotate).toBeUndefined();
  });
  it("ignores tiny movement but accumulates deliberate slow motion", () => {
    const motion = new GestureMotion();
    motion.update([hand()]);
    expect(motion.update([hand(1, { palm: { x: 0.501, y: 0.6 } })]).rotate).toBeUndefined();
    expect(motion.update([hand(1, { palm: { x: 0.504, y: 0.6 } })]).rotate).toBeDefined();
  });
});

describe("hand stabilization and viewport alignment", () => {
  it("uses different pinch engage/release thresholds", () => {
    const smooth = new HandStabilizer();
    expect(smooth.update([hand(1, { pinchDistance: 0.23, pinch: true })], 100)[0].pinch).toBe(true);
    expect(smooth.update([hand(1, { pinchDistance: 0.31 })], 133)[0].pinch).toBe(true);
    expect(smooth.update([hand(1, { pinchDistance: 0.38 })], 166)[0].pinch).toBe(false);
    expect(smooth.update([hand(1, { pinchDistance: 0.3 })], 199)[0].pinch).toBe(false);
  });
  it("preserves physical hand identity when result ordering changes", () => {
    const smooth = new HandStabilizer();
    const right = hand(1, { palm: { x: 0.3, y: 0.6 } });
    const left = hand(2, { palm: { x: 0.7, y: 0.6 } });
    const first = smooth.update([right, left], 100);
    const second = smooth.update([left, right], 133);
    expect(second.map((h) => h.trackingId)).toEqual(first.map((h) => h.trackingId));
    expect(second[0].handedness).toBe("Right");
  });
  it("keeps identity stable on a slow software renderer", () => {
    const smooth = new HandStabilizer();
    const initial = smooth.update([hand()], 100)[0].trackingId;
    expect(smooth.update([hand()], 450)[0].trackingId).toBe(initial);
    expect(smooth.update([hand()], 800)[0].trackingId).toBe(initial);
  });
  it("does not interpolate a newly acquired hand from a lost hand's pointer", () => {
    const smooth = new HandStabilizer();
    smooth.update([hand()], 100);
    smooth.update([], 133);
    expect(smooth.update([hand(1, { pointer: { x: 0.9, y: 0.1 } })], 166)[0].pointer).toEqual({ x: 0.9, y: 0.1 });
  });
  it("matches a contained 4:3 camera inside a wide viewport", () => {
    expect(cameraViewport(1600, 900, 640, 480)).toEqual({ x: 200, y: 0, width: 1200, height: 900 });
    expect(cameraViewport(400, 800, 640, 480)).toEqual({ x: 0, y: 250, width: 400, height: 300 });
  });
});
