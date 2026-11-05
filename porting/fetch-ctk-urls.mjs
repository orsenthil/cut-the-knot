#!/usr/bin/env node
"use strict";

/*
 * Regenerates porting/ctk-urls.json: a map from applet name to its page on
 * cut-the-knot.org.
 *
 * Why a checked-in map: the applet archives carry no link back to the page that
 * embedded them, and the page URLs follow no derivable convention (compare
 * /SimpleGames/RFWH.shtml, /proofs/chocolad.shtml and
 * /Curriculum/Arithmetic/FlipThem.shtml). The site's sitemap.xml does list every
 * page, and about 87% of applets sit on a page named after the applet, so the
 * name -> URL match is exact rather than guessed. The remaining applets get a
 * null ctkUrl in the manifest; a port fills it in by hand.
 *
 * This is the only part of the manifest pipeline that touches the network, which
 * is why it is a separate script: build-manifest.mjs stays offline and
 * deterministic, and this is re-run only when the site gains pages.
 *
 *   node porting/fetch-ctk-urls.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listAppletNames } from "./lib/archives.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const SITEMAP = "https://www.cut-the-knot.org/sitemap.xml";

const res = await fetch(SITEMAP);
if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
const xml = await res.text();

const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim()).filter(Boolean);
if (urls.length < 1000) throw new Error(`sitemap looks truncated: ${urls.length} urls`);

// page basename -> urls
const byName = new Map();
const byLower = new Map();
for (const u of urls) {
  const m = /\/([^/]+)\.s?html?$/.exec(u);
  if (!m) continue;
  const n = m[1];
  if (!byName.has(n)) byName.set(n, []);
  byName.get(n).push(u);
  const l = n.toLowerCase();
  if (!byLower.has(l)) byLower.set(l, []);
  byLower.get(l).push(u);
}

const names = listAppletNames(REPO);
const out = {};
for (const n of names) {
  const cands = byName.get(n) ?? byLower.get(n.toLowerCase()) ?? [];
  if (!cands.length) continue;
  // Prefer a page whose filename matches the applet's own capitalisation, then
  // the shortest URL, which is the canonical page rather than a variant.
  const exact = cands.filter((u) => new RegExp(`/${n}\\.s?html?$`).test(u));
  out[n] = (exact.length ? exact : cands).sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

const path = join(REPO, "porting", "ctk-urls.json");
writeFileSync(path, JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + "\n");
const pct = ((100 * Object.keys(out).length) / names.length).toFixed(1);
console.log(`${names.length} applets, ${Object.keys(out).length} urls resolved (${pct}%) -> porting/ctk-urls.json`);
