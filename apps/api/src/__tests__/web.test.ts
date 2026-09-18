import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveWeb } from "../web.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function builtApp() {
  // Outside process.cwd(), as the web workspace is when the API starts.
  const root = mkdtempSync(join(tmpdir(), "tacit-web-test-"));
  directories.push(root);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), '<!doctype html><div id="root">Tacit</div>');
  writeFileSync(join(root, "assets", "client.js"), 'console.log("Tacit");');
  writeFileSync(join(root, "assets", "client.css"), "body{color:white}");
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ ok: true }));
  expect(serveWeb(app, root)).toBe(true);
  return app;
}

describe("production web serving", () => {
  it("serves actual JavaScript and CSS from an absolute sibling directory", async () => {
    const app = builtApp();
    const js = await app.request("/assets/client.js");
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toMatch(/javascript/);
    expect(await js.text()).toBe('console.log("Tacit");');
    const css = await app.request("/assets/client.css");
    expect(css.headers.get("content-type")).toMatch(/text\/css/);
    expect(await css.text()).toBe("body{color:white}");
  });

  it("serves the SPA for navigation while keeping API and missing assets distinct", async () => {
    const app = builtApp();
    expect(await (await app.request("/c/cap_maria/interview")).text()).toContain('id="root"');
    expect(await (await app.request("/api/health")).json()).toEqual({ ok: true });
    for (const path of ["/assets/missing.js", "/vision/missing.wasm", "/api/missing"]) {
      const response = await app.request(path);
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('id="root"');
    }
  });

  it("leaves API-only mode available when the web build is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "tacit-empty-web-test-"));
    directories.push(root);
    expect(serveWeb(new Hono(), root)).toBe(false);
  });
});
