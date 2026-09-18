import { describe, expect, it } from "vitest";
import { framePoints } from "../framing.js";

const camera = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, back: { x: 0, y: 0, z: 1 }, width: 1440, height: 900, fov: 50 };
describe("constellation framing", () => {
  it("centers on actual off-origin knowledge instead of framing the origin", () => {
    const result = framePoints([{ x: 300, y: 100, z: 0 }, { x: 400, y: 200, z: 0 }], camera)!;
    expect(result.target).toEqual({ x: 350, y: 150, z: 0 });
    expect(result.position.z).toBeLessThan(200);
  });
  it("keeps cited nodes in the area to the left of the answer panel", () => {
    const points = [{ x: -100, y: -50, z: 0 }, { x: 100, y: 50, z: 0 }];
    const result = framePoints(points, { ...camera, panelWidth: 392 })!;
    const tan = Math.tan(camera.fov * Math.PI / 360);
    const pixels = points.map((p) => camera.width / 2 + (p.x - result.position.x) / (result.position.z - p.z) / tan * camera.height / 2);
    expect(Math.min(...pixels)).toBeGreaterThan(40);
    expect(Math.max(...pixels)).toBeLessThan(camera.width - 392);
    expect((Math.min(...pixels) + Math.max(...pixels)) / 2).toBeCloseTo((camera.width - 392) / 2);
  });
});
