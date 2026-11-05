#!/usr/bin/env node
"use strict";

/*
 * Loads a game page in headless Chromium and fails on anything a player would
 * notice: a console error, a request that did not load, or sideways scrolling
 * on a phone.
 *
 *   node porting/smoke-test.mjs <slug>...
 *   node porting/smoke-test.mjs --all
 *   node porting/smoke-test.mjs --all --keep   # keep the screenshots
 *
 * Each page is loaded four times: 375px and 1200px wide, each in light and dark.
 * Screenshots go to /tmp/coolmaths-smoke/<slug>/ so a session can look at what
 * it just built.
 *
 * Playwright drives Chromium rather than `chrome --headless --screenshot`
 * because it can set a real 375px viewport. A headless Chrome window has a
 * minimum width of about 500px, which is why CLAUDE.md otherwise reaches for a
 * 375px <iframe>; with a real viewport the overflow check actually measures the
 * phone layout.
 *
 * The server and the browser come from lib/browser.mjs.
 */

import { mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, serveRepo, launch } from "./lib/browser.mjs";
const OUT = "/tmp/coolmaths-smoke";

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1200, height: 900 },
];
const THEMES = ["light", "dark"];

/**
 * Console noise that is not the page's fault. Keep this empty unless there is a
 * real reason: the point of the check is that a port ships with a clean console.
 */
function isIgnorableError(text) {
  // Wikipedia hover cards are fetched lazily from the network; a sandbox with no
  // outbound access must not turn that into a port failure.
  return /en\.wikipedia\.org/.test(text);
}

async function checkPage(browser, slug, base, keep) {
  const problems = [];
  const dir = join(OUT, slug);
  await mkdir(dir, { recursive: true });

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        colorScheme: theme,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !isIgnorableError(m.text())) errors.push(`console: ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("requestfailed", (r) => {
        const url = r.url();
        if (!isIgnorableError(url)) errors.push(`requestfailed: ${url} ${r.failure()?.errorText ?? ""}`);
      });

      const label = `${vp.name}-${theme}`;
      try {
        const resp = await page.goto(`${base}/${slug}/`, { waitUntil: "load", timeout: 30000 });
        if (!resp || !resp.ok()) problems.push(`${label}: HTTP ${resp ? resp.status() : "no response"}`);
        // Let a requestAnimationFrame loop or an entry animation settle.
        await page.waitForTimeout(900);

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          bodyText: (document.body.innerText || "").trim().length,
          theme: document.documentElement.dataset.theme ?? null,
          bg: getComputedStyle(document.body).backgroundColor,
        }));

        await page.screenshot({ path: join(dir, `${label}.png`), fullPage: true });

        if (metrics.scrollWidth > metrics.innerWidth) {
          problems.push(
            `${label}: horizontal overflow, scrollWidth ${metrics.scrollWidth} > viewport ${metrics.innerWidth}`,
          );
        }
        if (metrics.bodyText < 50) {
          problems.push(`${label}: page rendered almost no text (${metrics.bodyText} chars) - did it fail to run?`);
        }
        if (!metrics.bg || metrics.bg === "rgba(0, 0, 0, 0)") {
          problems.push(`${label}: <body> has no background colour set`);
        }
        for (const e of errors) problems.push(`${label}: ${e}`);
      } catch (err) {
        problems.push(`${label}: ${err.message.split("\n")[0]}`);
      } finally {
        await ctx.close();
      }
    }
  }

  if (!problems.length && !keep) await rm(dir, { recursive: true, force: true });
  return problems;
}

/** The home grid must load and show a card for every catalogue entry. */
async function checkHome(browser, base, expected) {
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !isIgnorableError(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${base}/`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(500);
    const cards = await page.evaluate(
      () => document.querySelectorAll('a[href$="/"], .card, article').length,
    );
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    );
    // The grid links to "<slug>/index.html"; compare the first path segment so
    // a later switch to a bare "<slug>/" does not break the check.
    const firstSegment = (href) => href.replace(/^\.\//, "").replace(/^\//, "").split(/[/?#]/)[0];
    for (const slug of expected) {
      if (!links.some((h) => h && firstSegment(h) === slug)) {
        problems.push(`home grid has no link to ${slug}/`);
      }
    }
    if (!cards) problems.push("home grid rendered no cards");
    for (const e of errors) problems.push(`home console: ${e}`);
  } catch (err) {
    problems.push(`home: ${err.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
  return problems;
}

/* --------------------------------------------------------------------- main */

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const src = readFileSync(join(REPO, "assets", "games.js"), "utf8");
const w = {};
new Function("window", src)(w);
const allSlugs = w.COOLMATHS.games.map((g) => g.slug);
const slugs = args.includes("--all") ? allSlugs : args.filter((a) => !a.startsWith("--"));

if (!slugs.length) {
  console.error("usage: node porting/smoke-test.mjs <slug>... | --all");
  process.exit(2);
}

const { server, port } = await serveRepo();
const base = `http://127.0.0.1:${port}`;
const browser = await launch();
let failed = 0;

try {
  for (const slug of slugs) {
    const problems = await checkPage(browser, slug, base, keep);
    if (problems.length) {
      failed++;
      console.error(`FAIL ${slug}   screenshots: ${join(OUT, slug)}`);
      for (const p of problems) console.error(`       - ${p}`);
    } else {
      console.log(`ok   ${slug}`);
    }
  }
  const homeProblems = await checkHome(browser, base, allSlugs);
  if (homeProblems.length) {
    failed++;
    console.error("FAIL home grid");
    for (const p of homeProblems) console.error(`       - ${p}`);
  } else {
    console.log("ok   home grid");
  }
} finally {
  await browser.close();
  server.close();
}

process.exit(failed ? 1 : 0);
