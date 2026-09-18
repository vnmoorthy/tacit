import { describe, expect, it } from "vitest";
import { MARIA, buildGraph, buildSample } from "../index.js";

describe("knowledge graph", () => {
  it("links atoms to domains, entities and related atoms", () => {
    const b = buildSample(MARIA);
    const g = buildGraph(b.capture, b.atoms);
    expect(g.nodes.filter((n) => n.kind === "domain")).toHaveLength(b.capture.domains.length);
    expect(g.nodes.filter((n) => n.kind === "atom")).toHaveLength(b.atoms.length);
    const entities = g.nodes.filter((n) => n.kind === "entity");
    expect(entities.some((e) => e.label === "Workday" && e.group === "tool")).toBe(true);
    expect(entities.some((e) => e.label === "Dan Okafor" && e.group === "person")).toBe(true);
    expect(g.links.some((l) => l.kind === "in")).toBe(true);
    expect(g.links.some((l) => l.kind === "mentions")).toBe(true);
    expect(g.links.some((l) => l.kind === "related")).toBe(true);
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.links.every((l) => ids.has(l.source) && ids.has(l.target))).toBe(true);
    expect(g.stats.links).toBe(g.links.length);
  });
});
