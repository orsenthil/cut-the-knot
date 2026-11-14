#!/usr/bin/env node
"use strict";

/*
 * Turns the site into data the server can serve.
 *
 *   node scripts/build-index.mjs
 *
 * Writes (all gitignored, rebuilt in CI before every deploy):
 *
 *   src/generated/content.json    the catalogue, each game's rules, its "Look
 *                                 for the math" sections, its wiki terms, its
 *                                 cut-the-knot link and its source
 *   src/generated/manifest.json   the porting manifest, trimmed
 *   src/generated/cores/*.js      each DOM-free core, wrapped as an ES module
 *   src/generated/cores.js        a map from slug to the loaded core
 *   src/generated/recommend.js    assets/recommend.js, wrapped the same way
 *   src/generated/games.ts        a map from slug to its src/games/<slug>.ts
 *
 * Why the cores are rewritten rather than evaluated: copying each core's
 * source verbatim with an `export` appended makes it an ordinary module that
 * any bundler and any host can load (some, like Cloudflare Workers, forbid
 * eval and new Function altogether). The core in the game folder stays the
 * single source of truth - this script never edits one, it only re-exports it.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP = join(HERE, "..");
const REPO = join(MCP, "..");
const GEN = join(MCP, "src", "generated");

/* ------------------------------------------------------------- html helpers */

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  times: "×",
  minus: "−",
  deg: "°",
  frac12: "½",
  le: "≤",
  ge: "≥",
  ne: "≠",
  rarr: "→",
  larr: "←",
  harr: "↔",
  sum: "∑",
  radic: "√",
  infin: "∞",
  pi: "π",
  alpha: "α",
  beta: "β",
  theta: "θ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
};

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[name] ?? m;
  });
}

/** HTML fragment to readable plain text. */
function text(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The content of the first element with the given id, by brace counting on tags. */
function extractById(html, id, tagName) {
  const open = new RegExp(`<${tagName}[^>]*\\bid="${id}"[^>]*>`, "i");
  const m = open.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const openTag = new RegExp(`<${tagName}\\b`, "gi");
  const closeTag = new RegExp(`</${tagName}>`, "gi");
  let depth = 1;
  let pos = start;
  while (depth > 0) {
    openTag.lastIndex = pos;
    closeTag.lastIndex = pos;
    const o = openTag.exec(html);
    const c = closeTag.exec(html);
    if (!c) return html.slice(start);
    if (o && o.index < c.index) {
      depth++;
      pos = o.index + o[0].length;
    } else {
      depth--;
      pos = c.index + c[0].length;
      if (depth === 0) return html.slice(start, c.index);
    }
  }
  return null;
}

/* ---------------------------------------------------------------- the site */

/** A site script that sets one global on `window`, evaluated for that global. */
function readWindowGlobal(file, name) {
  const src = readFileSync(join(REPO, "assets", file), "utf8");
  const window = {};
  new Function("window", src)(window);
  return window[name];
}

const readCatalogue = () => readWindowGlobal("games.js", "COOLMATHS");

/** "Game: ..." / "How to play: ..." out of #rules. */
function parseRules(html) {
  const block = extractById(html, "rules", "div");
  if (!block) return null;
  const parts = block.split(/<br\s*\/?>/i);
  const out = { lead: null, leadLabel: null, howToPlay: null, text: text(block) };
  for (const part of parts) {
    const label = /<strong>([^<]*)<\/strong>/.exec(part)?.[1]?.trim();
    const body = text(part.replace(/<strong>[^<]*<\/strong>/, ""));
    if (!label) continue;
    if (/^How to play:?$/i.test(label)) out.howToPlay = body;
    else if (!out.lead) {
      out.leadLabel = label.replace(/:$/, "");
      out.lead = body;
    }
  }
  return out;
}

/** The "Look for the math" section: intro, then one entry per <h3>. */
function parseMath(html) {
  const block = extractById(html, "math", "details");
  if (!block) return null;
  const body = block.replace(/<summary>[\s\S]*?<\/summary>/i, "");
  const pieces = body.split(/<h3[^>]*>/i);
  const intro = text(pieces[0]);
  const sections = [];
  for (const piece of pieces.slice(1)) {
    const end = piece.indexOf("</h3>");
    if (end < 0) continue;
    sections.push({
      heading: text(piece.slice(0, end)),
      body: text(piece.slice(end + 5)),
    });
  }
  const tip = /<p class="tip">([\s\S]*?)<\/p>/i.exec(body);
  return { intro, sections, tip: tip ? text(tip[1]) : null };
}

/** Every <a class="wiki-term" data-wiki="Page"> on the page. */
function parseWikiTerms(html) {
  const out = new Map();
  for (const m of html.matchAll(/<a[^>]*\bdata-wiki="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const page = m[1];
    if (!out.has(page)) {
      out.set(page, {
        page,
        label: text(m[2]),
        url: `https://en.wikipedia.org/wiki/${page}`,
      });
    }
  }
  return [...out.values()];
}

function parseCtkUrl(html) {
  return /href="(https?:\/\/(?:www\.)?cut-the-knot\.org\/[^"]*)"/i.exec(html)?.[1] ?? null;
}

/* ------------------------------------------------------------------- build */

rmSync(GEN, { recursive: true, force: true });
mkdirSync(join(GEN, "cores"), { recursive: true });

const catalogue = readCatalogue();
const manifest = JSON.parse(readFileSync(join(REPO, "porting", "manifest.json"), "utf8"));

/** Cores worth exporting, and the global each one defines. */
const CORE_GLOBALS = {
  "hourglass/hourglass-core.js": ["HourglassCore"],
  "coins/coin-game.js": ["Coin", "CoinGame"],
  "four-knights/knights-core.js": ["KnightsCore"],
  "eye-opener/eye-opener-core.js": ["EyeOpener"],
  "mind-reader/mind-reader-core.js": ["MindReader"],
  "torque/torque-core.js": ["TorqueCore"],
  "four-by-four/fbf-core.js": ["FourByFourCore"],
};

const games = [];
for (const entry of catalogue.games) {
  const slug = entry.slug;
  const pagePath = join(REPO, slug, "index.html");
  if (!existsSync(pagePath)) throw new Error(`games.js lists ${slug} but ${slug}/index.html is missing`);
  const html = readFileSync(pagePath, "utf8");

  const scripts = readdirSync(join(REPO, slug))
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => ({
      name: f,
      path: `${slug}/${f}`,
      isCore: /-core\.js$|-game\.js$/.test(f),
      source: readFileSync(join(REPO, slug, f), "utf8"),
    }));

  const manifestEntry = manifest.applets.find((a) => a.slug === slug) ?? null;

  games.push({
    slug,
    title: entry.title,
    blurb: entry.blurb,
    tags: entry.tags ?? [],
    level: entry.level ?? 2,
    kind: entry.kind ?? "game",
    url: `https://orsenthil.github.io/cut-the-knot/${slug}/`,
    ctkUrl: parseCtkUrl(html) ?? manifestEntry?.ctkUrl ?? null,
    applet: manifestEntry?.archive ?? null,
    rules: parseRules(html),
    math: parseMath(html),
    wikiTerms: parseWikiTerms(html),
    scripts,
  });
}

/* ------------------------------------------------- the cores, as ES modules */

const coreModules = [];
for (const [rel, globals] of Object.entries(CORE_GLOBALS)) {
  const slug = rel.split("/")[0];
  const raw = readFileSync(join(REPO, rel), "utf8");
  // Some cores end with a CommonJS tail so they can be required in Node:
  //   if (typeof module !== "undefined" && module.exports) module.exports = X;
  // Adding `export` makes the file an ES module, where `module` does not exist.
  // The guard means it is harmless at runtime, but esbuild warns about it on
  // every build, so it is dropped rather than left to make noise.
  const src = raw.replace(
    /^\s*if \(typeof module !== "undefined" && module\.exports\) module\.exports = \w+;\s*$/m,
    "// (CommonJS export dropped: this copy is an ES module.)",
  );
  const file = `${slug}.js`;
  writeFileSync(
    join(GEN, "cores", file),
    `// Generated by mcp/scripts/build-index.mjs from ${rel}. Do not edit.\n` +
      `// The source below is copied verbatim apart from the export.\n\n` +
      `${src}\n\nexport { ${globals.join(", ")} };\n`,
  );
  coreModules.push({ slug, file, globals });
}

writeFileSync(
  join(GEN, "cores.js"),
  `// Generated by mcp/scripts/build-index.mjs. Do not edit.\n` +
    coreModules.map((c) => `import * as ${c.slug.replace(/-/g, "_")} from "./cores/${c.file}";`).join("\n") +
    `\n\nexport const cores = {\n` +
    coreModules.map((c) => `  ${JSON.stringify(c.slug)}: ${c.slug.replace(/-/g, "_")},`).join("\n") +
    `\n};\n`,
);

/* ------------------------------------------- the recommender, as a module */

writeFileSync(
  join(GEN, "recommend.js"),
  `// Generated by mcp/scripts/build-index.mjs from assets/recommend.js. Do not edit.\n\n` +
    `${readFileSync(join(REPO, "assets", "recommend.js"), "utf8")}\n\nexport { Recommend };\n`,
);

/* ---------------------------------------------- the per-game action modules */

// src/games/<slug>.ts holds one game's run_game_logic actions. The registry is
// generated so that adding a game adds a file and edits none. Order follows
// CORE_GLOBALS, since a game needs a core before it can have actions.
const actionSlugs = Object.keys(CORE_GLOBALS)
  .map((rel) => rel.split("/")[0])
  .filter((slug) => existsSync(join(MCP, "src", "games", `${slug}.ts`)));
const orphans = readdirSync(join(MCP, "src", "games"))
  .filter((f) => f.endsWith(".ts") && !f.startsWith("_") && f !== "registry.ts")
  .map((f) => f.slice(0, -3))
  .filter((slug) => !actionSlugs.includes(slug));
if (orphans.length) {
  throw new Error(`src/games/ has ${orphans.join(", ")} but CORE_GLOBALS lists no core for them`);
}

writeFileSync(
  join(GEN, "games.ts"),
  `// Generated by mcp/scripts/build-index.mjs from src/games/*.ts. Do not edit.\n` +
    `import type { GameModule } from "../games/_shared.js";\n` +
    actionSlugs.map((slug) => `import * as ${slug.replace(/-/g, "_")} from "../games/${slug}.js";`).join("\n") +
    `\n\nexport const gameModules: Record<string, GameModule> = {\n` +
    actionSlugs.map((slug) => `  ${JSON.stringify(slug)}: ${slug.replace(/-/g, "_")},`).join("\n") +
    `\n};\n`,
);

/* ------------------------------------------------------------------ output */

const content = {
  site: "https://orsenthil.github.io/cut-the-knot/",
  repo: "https://github.com/orsenthil/cut-the-knot",
  tags: catalogue.tags,
  concepts: readWindowGlobal("concepts.js", "COOLMATHS_CONCEPTS"),
  games,
};

writeFileSync(join(GEN, "content.json"), JSON.stringify(content));

// The manifest is served whole, minus the prose fields the server never reads.
writeFileSync(
  join(GEN, "manifest.json"),
  JSON.stringify({
    counts: manifest.counts,
    kinds: manifest.kinds,
    statuses: manifest.statuses,
    applets: manifest.applets,
  }),
);

const size = (p) => (readFileSync(p).length / 1024).toFixed(0) + "kB";
console.log(`content.json  ${size(join(GEN, "content.json"))}  (${games.length} games)`);
console.log(`manifest.json ${size(join(GEN, "manifest.json"))}  (${manifest.applets.length} applets)`);
console.log(`cores         ${coreModules.length} modules: ${coreModules.map((c) => c.slug).join(", ")}`);

for (const g of games) {
  const missing = [];
  if (!g.rules) missing.push("rules");
  if (!g.math && g.slug !== "maths-quiz") missing.push("math");
  if (missing.length) console.warn(`  warning: ${g.slug} has no ${missing.join(", ")}`);
}
