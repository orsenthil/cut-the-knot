#!/usr/bin/env node
"use strict";

/*
 * Checks a game page against the page rules in CLAUDE.md section 3, plus the
 * registration rules in section 5.
 *
 *   node porting/lint-page.mjs <slug>...
 *   node porting/lint-page.mjs --all
 *
 * This is a structural check, not a parser: the pages are hand-written and
 * regular, so regexes over the source are enough and keep the repo
 * dependency-free.
 *
 * The bar is "what the 13 hand-made ports already do". Where they legitimately
 * differ, the rule is relaxed rather than the page changed - a gate stricter
 * than the reference ports would reject the very pages it is modelled on. The
 * two real exceptions are listed in EXEMPT with a reason each.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

/**
 * Pages that cannot meet a rule for a real reason, with the checks they skip.
 * Keep this list tiny and justified; it is not a place to park a sloppy port.
 */
const EXEMPT = {
  "maths-quiz": {
    checks: ["math", "byline", "hovercard"],
    why: "the arithmetic quiz, not a ported applet: it has no single puzzle to explain and no cut-the-knot page",
  },
  euler2d: {
    checks: ["byline"],
    why: "ported from xscreensaver/hacks/euler2d.c, so there is no cut-the-knot page to cite",
  },
};

function readCatalogue() {
  const src = readFileSync(join(REPO, "assets", "games.js"), "utf8");
  const window = {};
  new Function("window", src)(window);
  return window.COOLMATHS;
}

/** Index of the first match, or -1. */
const at = (html, re) => {
  const m = re.exec(html);
  return m ? m.index : -1;
};

function lintSlug(slug, catalogue) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const dir = join(REPO, slug);
  const pagePath = join(dir, "index.html");

  if (!existsSync(pagePath)) return [`${slug}/index.html does not exist`];
  const html = readFileSync(pagePath, "utf8");
  const skip = new Set(EXEMPT[slug]?.checks ?? []);

  /* ---------------------------------------------------------- 1. title + head */

  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  if (!/(?:&mdash;|—)\s*coolmaths\s*$/.test(title)) {
    fail(`<title> must end with "&mdash; coolmaths", got ${JSON.stringify(title)}`);
  }

  const cssAt = at(html, /<link[^>]+href="\.\.\/assets\/site\.css"/);
  const gamesAt = at(html, /<script[^>]+src="\.\.\/assets\/games\.js"/);
  const siteAt = at(html, /<script[^>]+src="\.\.\/assets\/site\.js"/);
  if (cssAt < 0) fail("missing <link> to ../assets/site.css");
  if (gamesAt < 0) fail("missing <script src=../assets/games.js>");
  if (siteAt < 0) fail("missing <script src=../assets/site.js>");
  if (gamesAt >= 0 && siteAt >= 0 && gamesAt > siteAt) {
    fail("games.js must come before site.js, so the catalogue exists when site.js runs");
  }
  const headEnd = at(html, /<\/head>/);
  if (headEnd >= 0 && siteAt > headEnd) {
    fail("site.js must be in <head>, so the saved theme applies before paint");
  }

  /* ------------------------------------------------------------- 2. body/h1 */

  const bodyGame = /<body[^>]*\bdata-game="([^"]*)"/.exec(html)?.[1];
  if (bodyGame !== slug) {
    fail(`<body data-game> is ${JSON.stringify(bodyGame ?? null)}, expected ${JSON.stringify(slug)}`);
  }
  const h1At = at(html, /<h1[\s>]/);
  if (h1At < 0) fail("no <h1>");

  /* -------------------------------------------------------------- 3. byline */

  const rulesAt = at(html, /<div[^>]+id="rules"/);
  if (rulesAt < 0) fail('no <div id="rules">');

  if (!skip.has("byline")) {
    const byline = h1At >= 0 && rulesAt > h1At ? html.slice(h1At, rulesAt) : "";
    if (!/cut-the-knot\.org/.test(byline)) {
      fail("byline between <h1> and #rules must link to the original cut-the-knot.org page");
    }
    if (!/data-wiki="Alexander_Bogomolny"/.test(byline)) {
      fail('byline must credit Alexander Bogomolny with a wiki-term link (data-wiki="Alexander_Bogomolny")');
    }
  }

  /* --------------------------------------------------------------- 4. rules */

  if (rulesAt >= 0) {
    const block = html.slice(rulesAt).split("</div>")[0];
    const labels = [...block.matchAll(/<strong>([^<]*)<\/strong>/g)].map((m) => m[1].trim());
    const lead = labels[0] ?? "";
    // euler2d is a simulation, so "What it shows:" stands in for "Game:".
    if (!/^(Game|What it shows):$/.test(lead)) {
      fail(`#rules must open with "<strong>Game:</strong>" (or "What it shows:"), got ${JSON.stringify(lead)}`);
    }
    if (!labels.includes("How to play:")) {
      fail('#rules must have a "<strong>How to play:</strong>" line');
    }
    const brs = (block.match(/<br\s*\/?>/g) ?? []).length;
    if (brs !== 1) {
      fail(`#rules must be exactly two lines, i.e. a single <br>; found ${brs}`);
    }
  }

  /* --------------------------------------------------------------- 5. stage */

  const stageAt = at(html, /<[a-z]+[^>]*\bclass="[^"]*\bstage\b/);
  if (stageAt < 0) fail('no play area marked class="stage"');

  /* ---------------------------------------------------------------- 6. math */

  const mathAt = at(html, /<details[^>]*\bid="math"/);
  if (!skip.has("math")) {
    if (mathAt < 0) {
      fail('no <details id="math">');
    } else {
      const open = /<details[^>]*\bid="math"[^>]*\bopen\b/.test(html);
      if (open) fail('<details id="math"> must be closed by default (no "open" attribute)');
      const body = html.slice(mathAt).split("</details>")[0];
      const h3 = (body.match(/<h3[\s>]/g) ?? []).length;
      if (h3 < 2 || h3 > 5) {
        fail(`"Look for the math" must have 2-5 <h3> sections, found ${h3}`);
      }
      if (!/<summary>/.test(body)) fail('<details id="math"> needs a <summary>');
    }
  }

  /* --------------------------------------------------------------- 7. order */

  const order = [
    ["<h1>", h1At],
    ['#rules', rulesAt],
    [".stage", stageAt],
  ];
  if (mathAt >= 0) order.push(["#math", mathAt]);
  for (let i = 1; i < order.length; i++) {
    const [prevName, prev] = order[i - 1];
    const [name, pos] = order[i];
    if (prev >= 0 && pos >= 0 && pos < prev) {
      fail(`${name} appears before ${prevName}; CLAUDE.md fixes the section order`);
    }
  }

  /* ----------------------------------------------------------- 8. hovercard */

  if (!skip.has("hovercard") && !/src="\.\.\/assets\/wiki-hovercard\.js"/.test(html)) {
    fail("missing <script src=../assets/wiki-hovercard.js>");
  }

  /* ------------------------------------------------------ 9. games.js entry */

  const entry = catalogue.games.find((g) => g.slug === slug);
  if (!entry) {
    fail(`no entry for "${slug}" in assets/games.js`);
  } else {
    if (!entry.title) fail("games.js entry has no title");
    if (!entry.blurb) fail("games.js entry has no blurb");
    const tags = entry.tags ?? [];
    if (tags.length === 0) fail("games.js entry has no tags");
    if (tags.length > 3) fail(`games.js entry has ${tags.length} tags; at most 3 are allowed`);
    for (const t of tags) {
      if (!(t in catalogue.tags)) fail(`unknown tag "${t}"; add it to COOLMATHS.tags or reuse one`);
    }
  }

  /* --------------------------------------------------------- 10. thumb.svg */

  const thumb = join(dir, "thumb.svg");
  if (!existsSync(thumb)) {
    fail("no thumb.svg");
  } else {
    const svg = readFileSync(thumb, "utf8");
    const viewBox = /viewBox="([^"]*)"/.exec(svg)?.[1]?.trim();
    if (viewBox !== "0 0 320 200") {
      fail(`thumb.svg viewBox is ${JSON.stringify(viewBox ?? null)}, expected "0 0 320 200"`);
    }
  }

  return problems;
}

/* --------------------------------------------------------------------- main */

const catalogue = readCatalogue();
const args = process.argv.slice(2);
const slugs = args.includes("--all") ? catalogue.games.map((g) => g.slug) : args;

if (!slugs.length) {
  console.error("usage: node porting/lint-page.mjs <slug>... | --all");
  process.exit(2);
}

let failed = 0;
for (const slug of slugs) {
  const problems = lintSlug(slug, catalogue);
  const note = EXEMPT[slug] ? `  (skips ${EXEMPT[slug].checks.join(", ")}: ${EXEMPT[slug].why})` : "";
  if (problems.length) {
    failed++;
    console.error(`FAIL ${slug}${note}`);
    for (const p of problems) console.error(`       - ${p}`);
  } else {
    console.log(`ok   ${slug}${note}`);
  }
}

// The site-wide rule: a slug in the catalogue with no folder would 404 from the
// home grid.
for (const g of catalogue.games) {
  if (!existsSync(join(REPO, g.slug, "index.html"))) {
    console.error(`FAIL site: games.js lists "${g.slug}" but ${g.slug}/index.html does not exist`);
    failed++;
  }
}
// And a game folder missing from the catalogue is unreachable from the grid.
const folders = readdirSync(REPO, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(REPO, d.name, "index.html")))
  .map((d) => d.name)
  // Site pages that are not games (profile/ is the player's record) are not in the catalogue.
  .filter((n) => !["assets", "porting", "mcp", "xscreensaver", "node_modules", "profile"].includes(n));
for (const f of folders) {
  if (!catalogue.games.some((g) => g.slug === f)) {
    console.error(`FAIL site: ${f}/index.html exists but "${f}" is not in assets/games.js`);
    failed++;
  }
}

process.exit(failed ? 1 : 0);
