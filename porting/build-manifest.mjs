#!/usr/bin/env node
"use strict";

/*
 * Builds porting/manifest.json: the inventory that drives the porting campaign
 * (porting/PLAN.md) and that the MCP tutor serves as
 * coolmaths://manifest.
 *
 *   node porting/build-manifest.mjs           # rewrite the manifest
 *   node porting/build-manifest.mjs --check   # fail if it is out of date
 *
 * One entry per applet in classes.zip, plus an entry for each ported game whose
 * applet is not in the archive at all (hourglass, torque, four-knights and the
 * two non-applet pages), so that every slug in assets/games.js appears here.
 *
 * How kind is decided
 * -------------------
 * The original plan asked for a per-applet Claude pass. At ~1,280 applets that is neither
 * affordable nor reproducible, and `--check` needs the build to be a pure
 * function of what is checked in. So classification is deterministic and
 * auditable instead, from three sources, strongest first:
 *
 *   1. porting/overrides.json - hand-checked entries. Always wins.
 *   2. Class names inside the archive. Bogomolny's naming is consistent:
 *      a *Game / *Move / *Player class, or CTKWinker (the "you won" animation),
 *      means the applet has a win condition, i.e. it is a game.
 *   3. The section of the cut-the-knot.org page that embeds it, from
 *      porting/ctk-urls.json. /Games/ and /SimpleGames/ are games;
 *      /Curriculum/Geometry/ and /pythagoras/ are theorem diagrams; the other
 *      curriculum sections are interactive demonstrations.
 *
 * Anything with no signal falls back to "illustration", which is the right
 * prior: about two thirds of the archive is Curriculum/Geometry.
 *
 * The classifier is a starting order for the campaign, not a verdict. A port
 * that finds its applet misfiled corrects porting/overrides.json in the same
 * commit.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readInventory } from "./lib/archives.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const MANIFEST = join(HERE, "manifest.json");

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);

const ctkUrls = readJson(join(HERE, "ctk-urls.json"), {});
const overrides = readJson(join(HERE, "overrides.json"), {});

// JSON.parse keeps the last of two equal keys without a word, which once hid a
// stale "in-progress" claim behind a "ported" entry. Refuse duplicates outright.
{
  const keys = [...readFileSync(join(HERE, "overrides.json"), "utf8").matchAll(/^ {2}"([^"]+)"\s*:/gm)].map((m) => m[1]);
  const dupes = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
  if (dupes.length) {
    console.error(`porting/overrides.json has duplicate keys: ${dupes.join(", ")}. Merge them into one entry.`);
    process.exit(1);
  }
}

/* ---------------------------------------------------------------- games.js */

/**
 * The site catalogue. games.js is a browser script that assigns to `window`, so
 * it is evaluated with a stub window, the same trick CLAUDE.md uses for cores.
 */
function readGamesJs() {
  const src = readFileSync(join(REPO, "assets", "games.js"), "utf8");
  const window = {};
  new Function("window", src)(window);
  return window.COOLMATHS;
}

/**
 * Which applet each ported slug came from. Most are not guessable from the
 * name: the Eye Opener applet is called WProblem, and the hourglass, torque and
 * four-knights applets are not in classes.zip at all (null), though their pages
 * are.
 */
const SLUG_TO_APPLET = {
  "four-pegs": "FourPegs",
  rfwh: "RFWH",
  flipthem: "FlipThem",
  coins: "CoinsGame",
  chocolate: "chocolate",
  "mind-reader": "MindReaderNine",
  "eye-opener": "WProblem",
  "four-by-four": "FourByFour",
  "circle-solitaire": "CSolitaire",
  "calendar-magic": "Calendar",
  hanoing: "Hanoing",
  "clone-escape": "CloneEscape",
  "dawsons-chess": "DawsonChess",
  "bicolor-hanoi": "BiColorHanoi",
  "stones-in-cups": "BarryCipra",
  "eight-digits": "EightDigitPuzzle",
  "domino-faults": "DominoCovering",
  "full-house": "FullHouse",
  "pennies-in-boxes": "IntIter2",
  diagonals: "Diagonals",
  "flipping-pancakes": "Flipper",
  "frogs-toads-2d": "FrogsAndToads2D",
  "frogs-toads": "FrogsAndToads",
  grundy: "Grundy",
  "whats-next": "guess",
  hanoi: "hanoi",
  "hanoi-3c": "Hanoi3c",
  hex7: "Hex7",
  "hex-draw": "HexTheory",
  "hare-hounds": "Hounds",
  "gergonne": "GergonneMagic",
  "vanishing-digit": null,
  hourglass: null,
  torque: null,
  "four-knights": "Horse",
  "maths-quiz": null,
  euler2d: null,
  aliquot: "Aliquot",
  "dawsons-kayles": "DawsonKayles",
  "fraction-game": "FractionGame",
};

/** Pages for ported games whose applet is missing from classes.zip. */
const SLUG_FALLBACK_URL = {
  hourglass: "https://www.cut-the-knot.org/hg_solution.shtml",
  torque: "https://www.cut-the-knot.org/Games/Torque.shtml",
  "four-knights": "https://www.cut-the-knot.org/Curriculum/Games/FourKnights.shtml",
  "vanishing-digit": "https://www.cut-the-knot.org/Curriculum/Magic/VanishingDigit.shtml",
  "maths-quiz": "https://www.cut-the-knot.org/arithmetic/rapid/index.shtml",
  euler2d: null, // ported from xscreensaver, not from cut-the-knot
};

/* ----------------------------------------------------------- classification */

/** Shared libraries and chrome, not puzzles. */
const HELPER_PREFIX = /^(CTK|JCTK|Doub|banner|GeoS)/;
const HELPER_NAMES = new Set([
  "vecmath",
  "Comparable",
  "CompareInterface",
  "CompareValues",
  "BetterInteger",
  "BetterMover",
  "BetterMoveablePoly",
  "BetterRotatingPoly",
  "mouseTracker",
  "Moveable",
  "SimpleMoveable",
  "MoveablePoint",
  "BaseSys",
  "counter",
  "CrossPoint",
  "ContinuedFraction",
  "CompressionStream",
  "MasterControl",
]);

/** URL section -> kind. Longest prefix wins. */
const SECTION_KIND = [
  ["Games", "game"],
  ["SimpleGames", "game"],
  ["Curriculum/Games", "game"],
  ["Curriculum/Magic", "demo"],
  ["Curriculum/Algebra", "demo"],
  ["Curriculum/Arithmetic", "demo"],
  ["Curriculum/Combinatorics", "demo"],
  ["Curriculum/Probability", "demo"],
  ["Curriculum/Algorithms", "demo"],
  ["Curriculum/Calculus", "demo"],
  ["Curriculum/SocialScience", "demo"],
  ["Curriculum/Fallacies", "demo"],
  ["Curriculum/Geometry", "illustration"],
  ["arithmetic", "demo"],
  ["do_you_know", "demo"],
  ["exchange", "demo"],
  ["recurrence", "demo"],
  ["ctk", "demo"],
  ["blue", "demo"],
  ["pythagoras", "illustration"],
  ["triangle", "illustration"],
  // /proofs/ is deliberately absent: it mixes theorem diagrams with real games
  // (peg solitaire lives there, and so does the chocolate-bar game we ported),
  // so entries there fall through to the name and class heuristics instead.
  ["Generalization", "illustration"],
  ["Outline", "illustration"],
  ["m", "illustration"],
];

/** Name fragments that mark a puzzle even when the page section does not. */
const GAME_WORDS =
  /(game|puzzle|nim|hanoi|solitaire|tictactoe|tacti[xc]|maze|peg|towers?of|chomp|sprouts|checker|chess|knight|domino|match(stick|es)?|race|chase|jump|hop|slide|swap|guess|magic(square|trick)|counterfeit|weighing|crossing|ferry|jealous|missionar|wolfgoat|frogs?and|toads?)/i;

/**
 * Classes that only a game has: an explicit game/move/player/score model.
 *
 * CTKWinker is deliberately NOT in here. It looks like a "you won" animation,
 * but geometry applets use it to flash a completed construction too
 * (CircleOf6Circum, LemoineHomothety, FibonacciDissection are all theorem
 * diagrams that ship it), so it produces false positives.
 */
function classSignalsGame(classes) {
  return classes.some(
    (c) =>
      /(?:^|[a-z])(Game|Move|Player|Puzzle|Score|Winner)$/.test(c) ||
      /^(Board|Counter|CounterCoin)$/.test(c),
  );
}

function sectionOf(url) {
  if (!url) return null;
  const path = url.replace(/^https?:\/\/(?:www\.)?cut-the-knot\.org\//, "");
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function kindFromSection(section) {
  if (section == null) return null;
  let best = null;
  for (const [prefix, kind] of SECTION_KIND) {
    if (section === prefix || section.startsWith(prefix + "/")) {
      if (!best || prefix.length > best[0].length) best = [prefix, kind];
    }
  }
  return best ? best[1] : null;
}

function classify(rec, url) {
  const { name, classes } = rec;
  if (HELPER_PREFIX.test(name) || HELPER_NAMES.has(name)) return "helper";

  const sectionKind = kindFromSection(sectionOf(url));

  // An archive holding no class of its own name is a library, not an applet.
  if (classes.length && !classes.some((c) => c.toLowerCase().startsWith(name.toLowerCase()))) {
    if (!sectionKind) return "helper";
  }

  // The section Bogomolny filed a page under is the most reliable signal, so it
  // is consulted before the name and class heuristics.
  if (sectionKind === "game") return "game";

  // Geometry pages are theorem diagrams. The heuristics below misfire badly
  // there - "ThreePegInvariant" and "FourCrossingCircles" are not puzzles - so
  // a geometry page is never promoted to a game by its name or classes.
  if (sectionKind === "illustration") return "illustration";

  // Everywhere else (a curriculum demo section, or no page found at all) the
  // name and class model do promote: plenty of real games live under
  // /Curriculum/Arithmetic/ and /recurrence/.
  if (classSignalsGame(classes)) return "game";
  if (GAME_WORDS.test(name)) return "game";

  return sectionKind ?? "illustration";
}

/**
 * Lower sorts first. Within a kind, an applet whose page we already know is
 * cheaper to port than one whose page still has to be found by hand.
 */
function priorityFor(kind, url) {
  if (kind === "helper") return 9;
  const base = { game: 1, demo: 3, illustration: 5 }[kind] ?? 5;
  return url ? base : base + 1;
}

/* -------------------------------------------------------------------- build */

const catalogue = readGamesJs();
const portedByApplet = new Map();
const portedSlugs = new Set();
for (const g of catalogue.games) {
  portedSlugs.add(g.slug);
  const applet = SLUG_TO_APPLET[g.slug];
  if (applet === undefined) {
    throw new Error(
      `assets/games.js has slug "${g.slug}" with no entry in SLUG_TO_APPLET in ${"porting/build-manifest.mjs"}`,
    );
  }
  if (applet) portedByApplet.set(applet, g.slug);
}

const inventory = readInventory(REPO);
const entries = [];

for (const rec of inventory) {
  const slug = portedByApplet.get(rec.name) ?? null;
  const url = ctkUrls[rec.name] ?? null;
  let kind = slug ? "game" : classify(rec, url);
  let status = slug ? "ported" : "todo";
  let notes = "";

  const ov = overrides[rec.name];
  if (ov) {
    if (ov.kind) kind = ov.kind;
    if (ov.status) status = ov.status;
    if (ov.notes) notes = ov.notes;
  }
  if (kind === "helper" && status === "todo") status = "skip";

  entries.push({
    name: rec.name,
    archive: rec.archive,
    kind,
    priority: slug ? 0 : priorityFor(kind, ov?.ctkUrl ?? url),
    ctkUrl: ov?.ctkUrl ?? url,
    slug,
    status,
    notes,
  });
}

// Ported games with no applet in classes.zip, so every games.js slug is here.
for (const g of catalogue.games) {
  if (SLUG_TO_APPLET[g.slug]) continue;
  entries.push({
    name: g.title,
    archive: null,
    kind: "game",
    priority: 0,
    ctkUrl: SLUG_FALLBACK_URL[g.slug] ?? null,
    slug: g.slug,
    status: "ported",
    notes:
      g.slug === "euler2d"
        ? "Ported from xscreensaver/hacks/euler2d.c, not from a cut-the-knot applet."
        : "No applet for this page in classes.zip; ported from the cut-the-knot page.",
  });
}

entries.sort(
  (a, b) => a.priority - b.priority || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "en"),
);

const counts = {};
for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
const statuses = {};
for (const e of entries) statuses[e.status] = (statuses[e.status] ?? 0) + 1;

const manifest = {
  // Regenerate with: node porting/build-manifest.mjs
  generatedBy: "porting/build-manifest.mjs",
  source: "classes.zip",
  counts: { total: entries.length, byKind: counts, byStatus: statuses },
  kinds: {
    game: "Interactive puzzle or game with a win condition or an opponent.",
    demo: "Interactive demonstration or calculator: you manipulate it, but there is nothing to win.",
    illustration: "A diagram illustrating a theorem, usually with draggable points.",
    helper: "Shared library or page chrome, not an applet. Not for porting.",
  },
  statuses: {
    todo: "Not ported yet.",
    "in-progress": "Claimed by a session; see notes for which.",
    ported: "Live on the site; slug points at the folder.",
    failed: "Attempted and abandoned; see notes.",
    skip: "Deliberately not porting this one.",
  },
  applets: entries,
};

const json = JSON.stringify(manifest, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const current = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8") : "";
  if (current !== json) {
    console.error("porting/manifest.json is out of date; run: node porting/build-manifest.mjs");
    process.exit(1);
  }
  console.log(`manifest up to date (${entries.length} applets)`);
} else {
  writeFileSync(MANIFEST, json);
  console.log(`wrote porting/manifest.json: ${entries.length} entries`);
  console.log("  by kind:  ", JSON.stringify(counts));
  console.log("  by status:", JSON.stringify(statuses));
}

// Every slug in the catalogue must be represented in the manifest.
const covered = new Set(entries.filter((e) => e.slug).map((e) => e.slug));
const missing = [...portedSlugs].filter((s) => !covered.has(s));
if (missing.length) {
  console.error("slugs in games.js with no manifest entry:", missing.join(", "));
  process.exit(1);
}
