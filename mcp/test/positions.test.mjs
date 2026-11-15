/*
 * The position readers (position() in src/games/<slug>.ts).
 *
 *   npm test        (or: npx tsx test/positions.test.mjs)
 *
 * First on the examples in porting/live-fixtures/, which were saved by the
 * real pages in a browser (porting/check-positions-ui.mjs), so the reader
 * and the page are checked against each other. Then on positions built
 * here, where the right answer is known.
 */

import { readFileSync, readdirSync } from "node:fs";

import { describePosition } from "../src/games/registry.ts";
import { gameModules } from "../src/generated/games.ts";

let failures = 0;
let checks = 0;
function check(label, ok, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

/* ------------------------------------------- every example from a real page */

const dir = new URL("../../porting/live-fixtures/", import.meta.url);
const examples = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dir), "utf8"))]),
);

for (const slug of Object.keys(gameModules)) {
  check(`${slug} has an example saved by its page`, slug in examples);
  check(`${slug} can read a position`, typeof gameModules[slug].position === "function");
}

const read = {};
for (const [slug, example] of Object.entries(examples)) {
  try {
    read[slug] = describePosition(slug, example.state, example.stateVersion);
    check(`${slug}: the page's position is read`, read[slug] !== null && typeof read[slug] === "object");
    check(`${slug}: the reading is plain JSON`, JSON.stringify(read[slug]).length > 20);
  } catch (err) {
    check(`${slug}: the page's position is read`, false, err.message);
  }
}

// What the examples are: one move into each game where a move is one click.
// (The coins example is saved while the computer is still "thinking".)
check("coins: one coin taken", read.coins?.finished === false && read.coins.scores.you > 0);
check("hourglass: the 7-minute glass was turned", read.hourglass?.sandLeft.a === 7 && read.hourglass.flipsSoFar === 1 && read.hourglass.fewestFlipsFromAFreshStart === 3);
check("four-knights: one move made, not solved", read["four-knights"]?.movesSoFar === 1 && read["four-knights"].solved === false && read["four-knights"].knights.length === 4);
check("four-by-four: one cell each", read["four-by-four"]?.yourCells.length === 1 && read["four-by-four"].computerCells.length === 1);
check("torque: nothing hung yet", read.torque?.torqueSoFar === 0 && read.torque.hung.length === 0 && read.torque.inTheTray.length >= 2);
check("mind-reader: the named shape is on every multiple of 9", read["mind-reader"]?.checksOut === true);
check("eye-opener: the honest area is one short of the square", read["eye-opener"]?.honestArea === read["eye-opener"].squareItClaimsToFill - 1);
check("nimble: three chips, your move", read.nimble?.chips.length === 3 && read.nimble.turn === "you" && read.nimble.finished === false);

/* ------------------------------------------------ positions with known answers */

const at = (slug, state) => describePosition(slug, state, 1);

// Hourglass 7 and 11 for 15: the egg has had 4 of its 15 minutes.
{
  const p = at("hourglass", { a: 7, b: 11, target: 15, ta: 0, tb: 4, egg: 1, cooked: 4, flips: 2, elapsed: 7, running: false });
  check("hourglass: 11 minutes still to cook", p.stillToCook === 11 && p.overcooked === false && p.egg === "cooking");
  check("hourglass: turning the 7 gives 7 minutes of sand", p.whatEachActionLeadsTo.flipA.sandLeftA === 7);
  check("hourglass: 4 and 6 can never make 5", at("hourglass", { a: 4, b: 6, target: 5, ta: 0, tb: 0, egg: 0, cooked: 0, flips: 0, elapsed: 0 }).solvable === false);
  check("hourglass: an overcooked egg is called that", at("hourglass", { a: 7, b: 11, target: 15, ta: 0, tb: 0, egg: 2, cooked: 18, flips: 4, elapsed: 18 }).overcooked === true);
}

// Four knights: the start, and the finished swap.
{
  const home = at("four-knights", { occupied: {}, moves: 0 }).home;
  const start = at("four-knights", { occupied: home, moves: 0 });
  check("four-knights: the start is not solved", start.solved === false && start.fewestMovesFromTheStart === 16, String(start.fewestMovesFromTheStart));
  const swapped = Object.fromEntries(Object.entries(home).map(([ring, colour]) => [ring, colour === "red" ? "blue" : "red"]));
  check("four-knights: the swap is solved", at("four-knights", { occupied: swapped, moves: 16 }).solved === true);
  check("four-knights: every knight can move at the start", start.knights.every((k) => k.canMoveToRing.length >= 1));
}

// Torque: +2 at peg 3 and -3 at peg 2 balance; +2 at 3 alone tips right.
{
  const items = [{ id: "a", value: 2 }, { id: "b", value: -3 }];
  const pegs = [-3, -2, -1, 1, 2, 3];
  const level = at("torque", { pegs, items, placements: { a: 3, b: 2 } });
  check("torque: 2x3 - 3x2 is level", level.balanced === true && level.torqueSoFar === 0 && level.freePegs.length === 4);
  const tipped = at("torque", { pegs, items, placements: { a: 3 } });
  check("torque: 2 at peg 3 alone tips right", tipped.tipping === "right" && tipped.torqueSoFar === 6 && tipped.balanced === false && tipped.inTheTray.length === 1);
}

// Four by four: cells 0, 1, 2 are three of a row; 3 completes it.
{
  const p = at("four-by-four", { human: [0, 1, 2], machine: [20, 21, 22], skill: 4, moves: 6, over: false });
  check("four-by-four: you can win at cell 3", p.youCanWinAt.some((c) => c.cell === 3), JSON.stringify(p.youCanWinAt));
  check("four-by-four: the computer threatens cell 23", p.computerThreatensAt.some((c) => c.cell === 23));
  const blocked = at("four-by-four", { human: [0, 1, 2], machine: [3], skill: 4, moves: 4, over: false });
  check("four-by-four: a blocked row is no win", !blocked.youCanWinAt.some((c) => c.cell === 3));
  check("four-by-four: an empty board has all 76 lines open", at("four-by-four", { human: [], machine: [], skill: 4, moves: 0, over: false }).linesStillOpenForYou === 76);
}

// Eye opener, n = 10: nothing stretched at rest, a whole square once fitted.
{
  const rest = at("eye-opener", { n: 10, dx: 0, dy: 0, fitted: false, revealed: false });
  check("eye-opener: at rest the area is honest", rest.areaOnScreenNow === 99 && rest.hiddenStretchPerColumn === 0);
  const fitted = at("eye-opener", { n: 10, dx: rest.fitsAt.dx, dy: rest.fitsAt.dy, fitted: true, revealed: false });
  check("eye-opener: fitted, the screen shows a whole extra square", Math.abs(fitted.areaOnScreenNow - 100) < 1e-9, String(fitted.areaOnScreenNow));
}

// Nimble: 3 and 5 can be won by making them equal; 4 and 4 cannot be won.
{
  const p = at("nimble", { length: 7, chips: [3, 5], turn: "you", over: false });
  check("nimble: 3 and 5 have a Nim-sum of 6", p.nimSum === 6 && p.youCanWinFromHere === true);
  check("nimble: the winning move takes 5 down to 3", p.winningMoves.length === 1 && p.winningMoves[0].from === 5 && p.winningMoves[0].to === 3, JSON.stringify(p.winningMoves));
  const lost = at("nimble", { length: 7, chips: [4, 4], turn: "you", over: false });
  check("nimble: equal chips are lost for the player to move", lost.nimSum === 0 && lost.youCanWinFromHere === false && lost.winningMoves.length === 0);
  check("nimble: every chip home is finished", at("nimble", { length: 7, chips: [0, 0], turn: "you", over: true }).finished === true);
}

// A game with no reader, and a position that makes no sense.
check("a game with no reader gives null", describePosition("hanoi", {}, 1) === null);
let threw = false;
try {
  at("coins", { nonsense: true });
} catch {
  threw = true;
}
check("a nonsense position throws, for my_position to report", threw);

if (failures) {
  console.error(`FAIL positions: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok   positions (${checks} checks)`);
