import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { Engine, HeuristicBrain, MemoryStore } from "@tacit/core";
import { buildRoutes } from "../routes.js";

function app() {
  const engine = new Engine({ store: new MemoryStore(), brain: new HeuristicBrain() });
  const a = new Hono();
  a.route("/api", buildRoutes(engine, { version: "test", notes: [], provider: "demo" }));
  return a;
}

describe("API", () => {
  it("serves health and a full capture flow", async () => {
    const a = app();
    const health = await a.request("/api/health");
    expect(health.status).toBe(200);
    expect((await health.json()).engine.brain).toBe("demo-brain");

    const created = await a.request("/api/captures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expert: { name: "Dev Patel", role: "SRE" }, context: "Runs Kubernetes on AWS." }),
    });
    expect(created.status).toBe(201);
    const capture = await created.json();

    const started = await a.request(`/api/captures/${capture.id}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "text" }) });
    const { session } = await started.json();
    const turn = await a.request(`/api/sessions/${session.id}/turns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "First check the PgBouncer dashboard in Grafana, then scale pgbouncer to four replicas. Never restart Postgres for this, it makes it worse." }),
    });
    const result = await turn.json();
    expect(result.atoms.length).toBeGreaterThan(0);
    expect(result.interviewerTurn.text.length).toBeGreaterThan(10);

    const ask = await a.request(`/api/captures/${capture.id}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "What do I do about PgBouncer connection pages?" }) });
    expect((await ask.json()).citations.length).toBeGreaterThan(0);

    const bad = await a.request("/api/captures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expert: { name: "" }, context: "" }) });
    expect(bad.status).toBe(400);
    const missing = await a.request("/api/captures/nope");
    expect(missing.status).toBe(404);
    const higgs = await a.request("/api/voice/higgs/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ captureId: capture.id }) });
    expect(higgs.status).toBe(409);
  });

  it("loads bundled samples", async () => {
    const a = app();
    const res = await a.request("/api/samples/load", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    expect(res.status).toBe(201);
    const list = await res.json();
    expect(list.length).toBe(3);
    const md = await (await a.request(`/api/captures/${list[0].id}/handover`)).json();
    expect(md.markdown).toMatch(/# Handover/);
  });
});
