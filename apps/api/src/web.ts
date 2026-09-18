import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

/** Serve the built client from its absolute directory, including sibling workspaces. */
export function serveWeb(app: Hono, directory: string): boolean {
  const root = resolve(directory);
  const index = resolve(root, "index.html");
  if (!existsSync(index)) return false;
  const html = readFileSync(index, "utf8");
  app.use("/*", serveStatic({ root }));
  app.get("*", (c) => {
    // A missing script/model must return a real 404, not HTML that fails to parse.
    if (c.req.path === "/api" || c.req.path.startsWith("/api/")) return c.json({ error: "not found" }, 404);
    if (extname(c.req.path)) return c.notFound();
    return c.html(html);
  });
  return true;
}
