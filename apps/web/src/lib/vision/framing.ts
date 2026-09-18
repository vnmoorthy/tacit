type Point3 = { x: number; y: number; z: number };
const dot = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Fit actual projected points, reserving room for the answer beside the graph. */
export function framePoints(points: Point3[], options: {
  right: Point3; up: Point3; back: Point3; width: number; height: number; fov: number;
  panelWidth?: number; minDistance?: number;
}): { position: Point3; target: Point3 } | null {
  if (!points.length) return null;
  const { right, up, back, width, height, fov, minDistance = 90 } = options;
  const panel = Math.min(options.panelWidth ?? 0, width * 0.45);
  const center = { x: 0, y: 0, z: 0 };
  for (const axis of ["x", "y", "z"] as const) center[axis] = (Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2;
  const tan = Math.tan(fov * Math.PI / 360);
  // The top/bottom gutter leaves room for labels, the question HUD, and the legend.
  const vertical = tan * 0.72;
  const horizontal = tan * Math.max(0.3, (width - panel - 100) / height);
  const projections = points.map((p) => {
    const v = { x: p.x - center.x, y: p.y - center.y, z: p.z - center.z };
    return { x: dot(v, right), y: dot(v, up), z: dot(v, back) };
  });
  let distance = minDistance;
  for (const p of projections) distance = Math.max(distance, p.z + Math.max((Math.abs(p.x) + 12) / horizontal, (Math.abs(p.y) + 12) / vertical));
  const shift = panel / height * distance * tan;
  const target = { x: center.x + right.x * shift, y: center.y + right.y * shift, z: center.z + right.z * shift };
  return { target, position: { x: target.x + back.x * distance, y: target.y + back.y * distance, z: target.z + back.z * distance } };
}
