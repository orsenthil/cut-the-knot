"use strict";

/*
 * The concept graph and the recommender (assets/concepts.js, assets/recommend.js).
 *
 *   node porting/check-concepts.mjs
 *
 * Checks the data: the graph is acyclic, every prerequisite exists, and every
 * tag used by a game has an entry. Then checks the recommender on profiles
 * built here: a new player, a beginner, and someone who has played everything.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadWindowGlobal(relPath, name) {
  const window = {};
  new Function("window", readFileSync(join(REPO, relPath), "utf8"))(window);
  return window[name];
}

const { games, tags } = loadWindowGlobal("assets/games.js", "COOLMATHS");
const concepts = loadWindowGlobal("assets/concepts.js", "COOLMATHS_CONCEPTS");
const R = loadCore("assets/recommend.js", "Recommend");

/* ------------------------------------------------------------------ data */

let order = [];
try {
  order = R.topoOrder(concepts);
} catch (err) {
  check("the graph is acyclic and closed", false, err.message);
}
equal("every concept is in the order", order.length, Object.keys(concepts).length);

const position = new Map(order.map((name, i) => [name, i]));
for (const [name, c] of Object.entries(concepts)) {
  check(`${name} has a prereqs array`, Array.isArray(c.prereqs));
  for (const pre of c.prereqs) {
    check(`${pre} comes before ${name}`, position.get(pre) < position.get(name));
  }
}

for (const tag of Object.keys(tags)) check(`tag "${tag}" has a concept entry`, tag in concepts);
for (const name of Object.keys(concepts)) check(`concept "${name}" is a tag`, name in tags);
for (const g of games) {
  for (const t of g.tags) check(`${g.slug}: tag "${t}" has a concept entry`, t in concepts);
  check(`${g.slug}: level is 1, 2 or 3`, [1, 2, 3].includes(g.level), String(g.level));
  check(`${g.slug}: kind is game or demo`, g.kind === undefined || g.kind === "demo" || g.kind === "game");
}

const depth = R.depths(concepts);
check("the graph is shallow (depth <= 4)", Math.max(...Object.values(depth)) <= 4);

/* ---------------------------------------------- cycles and bad data throw */

let threw = false;
try {
  R.topoOrder({ a: { prereqs: ["b"] }, b: { prereqs: ["a"] } });
} catch {
  threw = true;
}
check("a cycle is reported", threw);

threw = false;
try {
  R.topoOrder({ a: { prereqs: ["nowhere"] } });
} catch {
  threw = true;
}
check("an unknown prerequisite is reported", threw);

/* ------------------------------------------------------------ new player */

const fresh = R.next({}, games, concepts, 3);
equal("a new player gets 3 suggestions", fresh.length, 3);
for (const r of fresh) {
  equal(`new player: ${r.game.slug} needs nothing first`, r.missing, []);
  equal(`new player: ${r.game.slug} is level 1`, r.game.level, 1);
  equal(`new player: ${r.game.slug} is a starting point`, r.why, "start");
}

/* --------------------------------------------------------------- ordering */

// For any profile: ready games come before stretch games, and nothing tried
// is suggested again.
function checkOrdering(label, progress) {
  const all = R.next(progress, games, concepts, games.length);
  let seenStretch = false;
  for (const r of all) {
    check(`${label}: ${r.game.slug} was not tried`, !(r.game.slug in progress));
    if (r.missing.length) seenStretch = true;
    else check(`${label}: ready game ${r.game.slug} is not after a stretch game`, !seenStretch);
  }
  equal(`${label}: every untried game is ranked`, all.length, games.filter((g) => !(g.slug in progress)).length);
  return all;
}

checkOrdering("new player", {});

/* --------------------------------------------------------------- beginner */

// Won the quiz and torque: arithmetic and algebra are practised.
const beginner = {
  "maths-quiz": { opens: 3, completed: 2, lastAt: 2000 },
  "torque": { opens: 1, completed: 1, lastAt: 3000 },
};
const m = R.mastery(beginner, games, concepts);
check("beginner: arithmetic is practised", m.arithmetic.practised);
check("beginner: algebra is practised", m.algebra.practised);
check("beginner: graph theory is not", !m["graph-theory"].practised);
equal("beginner: arithmetic games completed", m.arithmetic.completed, 2);

const quiz = games.find((g) => g.slug === "maths-quiz");
equal("the quiz teaches its own prerequisite", R.missingFor(quiz, concepts, R.mastery({}, games, concepts)), []);

const hanoi = games.find((g) => g.slug === "hanoi");
equal("hanoi wants counting first", R.missingFor(hanoi, concepts, m), ["counting"]);

const forBeginner = checkOrdering("beginner", beginner);
check("beginner: the first pick builds on something known", forBeginner[0].why === "builds-on", forBeginner[0].why);

// Trying without finishing earns half: one level-1 try is not enough, two are.
const oneTry = R.mastery({ "frogs-toads": { opens: 1 } }, games, concepts);
check("one unfinished level-1 game does not practise counting", !oneTry.counting.practised);
const twoTries = R.mastery({ "frogs-toads": { opens: 1 }, "chocolate": { opens: 1 } }, games, concepts);
check("two unfinished level-1 games do", twoTries.counting.practised);

/* --------------------------------------------------------- played it all */

const everything = Object.fromEntries(games.map((g, i) => [g.slug, { opens: 1, completed: 1, lastAt: i }]));
equal("nothing left to suggest", R.next(everything, games, concepts, 5), []);
for (const [name, cm] of Object.entries(R.mastery(everything, games, concepts))) {
  check(`played it all: ${name} is practised`, cm.practised || cm.total === 0);
}

done("concepts");
