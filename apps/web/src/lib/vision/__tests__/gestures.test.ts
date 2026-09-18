import { describe, expect, it } from "vitest";
import { analyseHand } from "../handTracker.js";

type L = { x: number; y: number; z: number };
const pt = (x: number, y: number): L => ({ x, y, z: 0 });

/** Synthetic right hand: wrist at bottom, fingers pointing up. */
function hand(opts: { index?: "up" | "curled"; others?: "up" | "curled"; thumbToIndex?: boolean }): L[] {
  const wrist = pt(0.5, 0.9);
  const mcps = [pt(0.44, 0.7), pt(0.48, 0.68), pt(0.52, 0.68), pt(0.56, 0.7)]; // index, middle, ring, pinky
  const finger = (mcp: L, up: boolean) => (up ? [mcp, pt(mcp.x, mcp.y - 0.08), pt(mcp.x, mcp.y - 0.14), pt(mcp.x, mcp.y - 0.2)] : [mcp, pt(mcp.x, mcp.y - 0.05), pt(mcp.x, mcp.y - 0.02), pt(mcp.x, mcp.y + 0.03)]);
  const index = finger(mcps[0], opts.index !== "curled");
  const middle = finger(mcps[1], opts.others === "up");
  const ring = finger(mcps[2], opts.others === "up");
  const pinky = finger(mcps[3], opts.others === "up");
  const indexTip = index[3];
  const thumbTip = opts.thumbToIndex ? pt(indexTip.x + 0.005, indexTip.y + 0.005) : pt(0.3, 0.7);
  const thumb = [pt(0.42, 0.85), pt(0.36, 0.8), pt(0.32, 0.75), thumbTip];
  return [wrist, ...thumb, ...index, ...middle, ...ring, ...pinky];
}

describe("gesture analysis", () => {
  it("detects pointing (index up, others curled)", () => {
    const h = analyseHand(hand({ index: "up", others: "curled" }) as any, "Right");
    expect(h.pointing).toBe(true);
    expect(h.open).toBe(false);
    expect(h.pinch).toBe(false);
  });
  it("detects an open palm", () => {
    const h = analyseHand(hand({ index: "up", others: "up" }) as any, "Right");
    expect(h.open).toBe(true);
    expect(h.pointing).toBe(false);
  });
  it("detects a fist", () => {
    const h = analyseHand(hand({ index: "curled", others: "curled" }) as any, "Right");
    expect(h.fist).toBe(true);
  });
  it("detects a pinch and mirrors coordinates", () => {
    const h = analyseHand(hand({ index: "up", others: "up", thumbToIndex: true }) as any, "Right");
    expect(h.pinch).toBe(true);
    expect(h.open).toBe(false);
    expect(h.pointer.x).toBeCloseTo(1 - 0.44, 2);
  });
});
