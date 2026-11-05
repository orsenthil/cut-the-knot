#!/usr/bin/env node
"use strict";

/*
 * Read a cut-the-knot.org page as plain text, for porting.
 *
 *   node porting/page.mjs <url | Applet>      # an Applet name uses its manifest ctkUrl
 *   node porting/page.mjs <url> --links       # also list the page's links
 *
 * Prints which applets the page embeds (its <applet code=...>/archive), so
 * you can tell at once whether the manifest's ctkUrl really is the applet's
 * page: the sitemap match is by name, and it has picked a reader's letter
 * before (exchange/hanoi.shtml instead of recurrence/hanoi.shtml). Then the
 * page text from its title on, without the site's navigation menus.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("usage: node porting/page.mjs <url | Applet> [--links]");
  process.exit(2);
}
if (!/^https?:/.test(target)) {
  const m = JSON.parse(readFileSync(join(REPO, "porting/manifest.json"), "utf8"));
  const a = m.applets.find((x) => x.name === target);
  if (!a || !a.ctkUrl) {
    console.error(`no ctkUrl for ${target} in the manifest`);
    process.exit(1);
  }
  console.log(`# ${target} -> ${a.ctkUrl}`);
  target = a.ctkUrl;
}

const res = await fetch(target, { redirect: "follow" });
const htmlText = await res.text();
if (!res.ok) console.log(`# HTTP ${res.status}`);

const applets = [...htmlText.matchAll(/<applet\b[^>]*>/gi)].map((m) => {
  const code = (m[0].match(/code\s*=\s*"?([^"\s>]+)/i) || [])[1];
  const archive = (m[0].match(/archive\s*=\s*"?([^"\s>]+)/i) || [])[1];
  return `${code || "?"}${archive ? ` (archive ${archive})` : ""}`;
});
console.log(`# applets on page: ${applets.length ? applets.join("; ") : "none - probably not the applet's own page"}`);

const decode = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");

if (args.includes("--links")) {
  const links = [...htmlText.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => `${decode(m[2].replace(/<[^>]+>/g, "")).trim()} -> ${new URL(m[1], target).href}`)
    .filter((l) => !/^\s*->/.test(l));
  console.log("# links\n" + [...new Set(links)].join("\n"));
}

let text = htmlText
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr|blockquote)>/gi, "\n")
  .replace(/<[^>]+>/g, " ");
text = decode(text).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

// Every page opens with the same navigation menu, ending with these items; start after it.
const head = text.slice(0, 4000);
const menuEnd = Math.max(head.lastIndexOf("Elementary geometry"), head.lastIndexOf("CTK Insights blog"));
if (menuEnd > 0) text = text.slice(text.indexOf("\n", menuEnd) + 1);
// Drop the "|Contact| |Front page| ..." link rows, mark each copyright line as a
// section break, and stop at the last one (what follows is the related-pages list).
text = text
  .split("\n")
  .filter((l) => !/^\s*(\|[^|]+\|\s*)+$/.test(l) && !/^\s*(-->\s*)+$/.test(l) && !/^\s*\d{6,}\s*$/.test(l))
  // the "your browser will not run Java" boilerplate every applet page carries
  .filter((l) => !/Sun's Java VM|not set to run Java|What if applet does not run|Buy this applet|^\s*Misc\s*$/.test(l))
  .map((l) => (/^\s*Copyright\s+(©\s*)?1996/.test(l) ? "----" : l))
  .join("\n");
// The page ends with a list of related pages: after "Related material" if it
// has that heading, otherwise after the last copyright line.
const related = text.search(/\n\s*Related material/);
const end = related > 0 ? related : text.lastIndexOf("\n----");
console.log((end > 0 ? text.slice(0, end) : text).trim());
