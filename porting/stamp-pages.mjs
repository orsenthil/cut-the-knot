#!/usr/bin/env node
"use strict";

/*
 * Writes the standard parts of every game page from its meta.json.
 *
 *   node porting/stamp-pages.mjs            stamp every page that has a meta.json
 *   node porting/stamp-pages.mjs <slug>...  stamp these pages
 *   node porting/stamp-pages.mjs --check    exit 1 if any page is not as stamped
 *
 * A game page has parts that are the same on every page and parts that are
 * the game. The same-everywhere parts are written here, so nobody (and no
 * model) writes them by hand, and so a change to them is one edit and one
 * run instead of a thousand edits:
 *
 *   <head>   everything between <!-- stamp:head --> and <!-- /stamp:head -->:
 *            charset, viewport, title, description, colour scheme, canonical
 *            address, app manifest, icons, the shared stylesheet and script
 *   <body>   data-game (the slug) and data-kind ("game" or "demo")
 *   <main>   wraps the page's content: the one landmark a screen reader
 *            can jump to
 *   tags     the concept links under the <h1>, between <!-- stamp:tags -->
 *            and <!-- /stamp:tags -->
 *
 * Everything else in the file is left exactly as it is. The tool is
 * idempotent, and it accepts a page that has none of the markers yet: the
 * lines it would write are recognised and replaced. So a new page needs
 * only <head><style>...</style></head>, a <body>, an <h1> and the game.
 *
 * The site's address and name are in porting/site.json; moving the site to
 * another domain is a change there and a run of this script.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(readFileSync(join(REPO, "porting", "site.json"), "utf8"));

function readConcepts() {
  const window = {};
  new Function("window", readFileSync(join(REPO, "assets", "concepts.js"), "utf8"))(window);
  return window.COOLMATHS_CONCEPTS;
}
const concepts = readConcepts();

const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------ the pieces */

export function headBlock(slug, meta) {
  const url = `${site.url}${slug}/`;
  const title = escapeHtml(meta.title);
  const blurb = escapeHtml(meta.blurb);
  return [
    "<!-- stamp:head (written by porting/stamp-pages.mjs from meta.json; do not edit) -->",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${title} &mdash; ${site.name}</title>`,
    `<meta name="description" content="${blurb}">`,
    '<meta name="color-scheme" content="light dark">',
    `<meta name="theme-color" content="${site.themeColorLight}" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="${site.themeColorDark}" media="(prefers-color-scheme: dark)">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${site.name}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${blurb}">`,
    `<meta property="og:url" content="${url}">`,
    '<link rel="manifest" href="../manifest.webmanifest">',
    '<link rel="icon" href="../assets/icons/icon-48.png" type="image/png">',
    '<link rel="apple-touch-icon" href="../assets/icons/icon-180.png">',
    '<link rel="stylesheet" href="../assets/site.css">',
    '<script src="../assets/site.js"></script>',
    "<!-- /stamp:head -->",
  ].join("\n");
}

export function tagsBlock(meta) {
  const links = meta.tags
    .map((tag) => `<a class="tag" href="../index.html#${tag}">${escapeHtml(concepts[tag]?.label ?? tag)}</a>`)
    .join("");
  return `<!-- stamp:tags --><div class="tags game-tags" aria-label="Concepts">${links}</div><!-- /stamp:tags -->`;
}

/* --------------------------------------------------------------- stamping */

/** Lines in <head> that the stamp replaces when a page has no markers yet. */
const HEAD_LINES = [
  /^[ \t]*<meta charset=[^>]*>[ \t]*\n/im,
  /^[ \t]*<meta name="viewport"[^>]*>[ \t]*\n/im,
  /^[ \t]*<title>[\s\S]*?<\/title>[ \t]*\n/im,
  /^[ \t]*<meta name="description"[^>]*>[ \t]*\n/im,
  /^[ \t]*<link rel="stylesheet" href="\.\.\/assets\/site\.css">[ \t]*\n/im,
  /^[ \t]*<script src="\.\.\/assets\/games\.js"><\/script>[ \t]*\n/im,
  /^[ \t]*<script src="\.\.\/assets\/site\.js"><\/script>[ \t]*\n/im,
];

export function stamp(html, slug, meta) {
  const problems = [];
  let out = html;

  // <head>
  const headOpen = /<head>\s*\n?/i.exec(out);
  if (!headOpen) return { html, problems: ["no <head>"] };
  const marked = /<!-- stamp:head[\s\S]*?<!-- \/stamp:head -->\n?/;
  if (marked.test(out)) {
    out = out.replace(marked, `${headBlock(slug, meta)}\n`);
  } else {
    const headEnd = out.indexOf("</head>");
    let head = out.slice(0, headEnd);
    for (const line of HEAD_LINES) head = head.replace(line, "");
    out = head.replace(/<head>\s*\n?/i, `<head>\n${headBlock(slug, meta)}\n`) + out.slice(headEnd);
  }

  // <body ...>: set data-game and data-kind, keep anything else it carries.
  const body = /<body\b([^>]*)>/i.exec(out);
  if (!body) return { html, problems: ["no <body>"] };
  const extra = body[1]
    .replace(/\sdata-game="[^"]*"/, "")
    .replace(/\sdata-kind="[^"]*"/, "")
    .trim();
  const kind = meta.kind === "demo" ? "demo" : "game";
  out = out.replace(body[0], `<body data-game="${slug}" data-kind="${kind}"${extra ? ` ${extra}` : ""}>`);

  // <main>: from just after <body> to just before the scripts that end it.
  if (!/<main\b/i.test(out)) {
    const bodyTag = /<body\b[^>]*>\n?/i.exec(out);
    const start = bodyTag.index + bodyTag[0].length;
    const trailing = /(?:[ \t]*<script\b[^>]*>(?:[\s\S]*?)<\/script>\s*)*<\/body>/i.exec(out.slice(start));
    const end = start + trailing.index;
    out = `${out.slice(0, start)}<main id="main">\n${out.slice(start, end).replace(/\s*$/, "\n")}</main>\n\n${out.slice(end)}`;
  }

  // The concept links, straight after the <h1>.
  const h1 = /<h1\b[^>]*>[\s\S]*?<\/h1>/i.exec(out);
  if (!h1) problems.push("no <h1>");
  else {
    const tagMarked = /\n?[ \t]*<!-- stamp:tags -->[\s\S]*?<!-- \/stamp:tags -->/;
    out = out.replace(tagMarked, "");
    const at = out.indexOf(h1[0]) + h1[0].length;
    const indent = /(^|\n)([ \t]*)<h1\b/.exec(out)?.[2] ?? "";
    out = `${out.slice(0, at)}\n${indent}${tagsBlock(meta)}${out.slice(at)}`;
  }

  return { html: out, problems };
}

/* -------------------------------------------------------------------- run */

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const named = args.filter((a) => !a.startsWith("--"));
  const slugs = named.length
    ? named
    : readdirSync(REPO, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(REPO, d.name, "meta.json")))
        .map((d) => d.name);

  let stale = 0;
  let written = 0;
  let failed = 0;
  for (const slug of slugs) {
    const file = join(REPO, slug, "index.html");
    if (!existsSync(file) || !existsSync(join(REPO, slug, "meta.json"))) {
      console.error(`${slug}: needs both index.html and meta.json`);
      failed++;
      continue;
    }
    const meta = JSON.parse(readFileSync(join(REPO, slug, "meta.json"), "utf8"));
    const before = readFileSync(file, "utf8");
    const { html, problems } = stamp(before, slug, meta);
    if (problems.length) {
      console.error(`${slug}/index.html: ${problems.join("; ")}`);
      failed++;
      continue;
    }
    if (html === before) continue;
    if (check) {
      console.error(`${slug}/index.html is not as stamped. Run: node porting/stamp-pages.mjs ${slug}`);
      stale++;
    } else {
      writeFileSync(file, html);
      written++;
    }
  }

  if (failed || stale) process.exit(1);
  console.log(check ? `pages as stamped (${slugs.length})` : `stamped ${written} of ${slugs.length} pages`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
