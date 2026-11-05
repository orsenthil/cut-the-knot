"use strict";

/*
 * What the browser checks share: a static server for the repo, so pages load
 * over http:// exactly as on GitHub Pages, and a headless Chromium.
 *
 * The browser is whatever is on this machine: Playwright's bundled Chromium,
 * /opt/pw-browsers/chromium, /usr/bin/google-chrome or /usr/bin/chromium. All
 * of them need --no-sandbox in a container. Playwright itself is found through
 * NODE_PATH (a global install); this repo has no node_modules of its own.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** Serves the repo, so pages load over http:// exactly as on GitHub Pages. */
export function serveRepo() {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      // The site has no favicon. Some Chromium builds ask for one on the first
      // page load and log the 404 as a console error, which is not the port's fault.
      if (path === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }
      if (path.endsWith("/")) path += "index.html";
      const file = join(REPO, normalize(path).replace(/^(\.\.[/\\])+/, ""));
      if (!file.startsWith(REPO)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

export async function launch() {
  let chromium;
  try {
    // createRequire, not import(): a globally installed playwright is found via
    // NODE_PATH, which CommonJS resolution honours and ESM resolution does not.
    // This repo has no node_modules of its own.
    ({ chromium } = createRequire(import.meta.url)("playwright"));
  } catch {
    console.error(
      "playwright is not installed. Install it, or run the gate with SKIP_SMOKE=1 and check the page by hand.",
    );
    process.exit(2);
  }
  const candidates = ["/opt/pw-browsers/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium"];
  const args = ["--no-sandbox", "--disable-dev-shm-usage"];
  try {
    return await chromium.launch({ args });
  } catch (err) {
    const executablePath = candidates.find((p) => existsSync(p));
    if (!executablePath) throw err;
    return await chromium.launch({ executablePath, args });
  }
}
