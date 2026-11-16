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
check("no-silver-dollar: three counters, your move", read["no-silver-dollar"]?.positions.length === 3 && read["no-silver-dollar"].turn === "you" && read["no-silver-dollar"].finished === false);
check("one-pile: a take each, your move", read["one-pile"]?.takesSoFar.length === 2 && read["one-pile"].turn === "you" && read["one-pile"].finished === false);
check("odd-scoring: 11 steps, a move each, your move", read["odd-scoring"]?.bandSteps === 11 && read["odd-scoring"].turn === "you" && read["odd-scoring"].yourSteps === 2 && read["odd-scoring"].finished === false);
check("parrondo: a finished run names a best series", read.parrondo?.ready === true && typeof read.parrondo.best?.name === "string");
check("pegsolitaire: one jump from central", read.pegsolitaire?.pegs === 31 && read.pegsolitaire.movesSoFar === 1 && read.pegsolitaire.won === false);
check("pick-label: after opening a box", read["pick-label"]?.phase === "label" && read["pick-label"].revealed !== null);
check("pigeon-checkers: one jump on N=3", read["pigeon-checkers"]?.n === 3 && read["pigeon-checkers"].movesSoFar === 1 && read["pigeon-checkers"].invariant?.impossible === true);
check("plainim: mid-game, your move", read.plainim?.finished === false && read.plainim.turn === "you" && read.plainim.heaps.length === 3);
check("pm: mid-game on N=5", read.pm?.finished === false && read.pm.n === 5 && read.pm.turn === "you" && read.pm.youShouldWinThisLength === true);
check("proizvolov-game: finished N=3 sum is 9", read["proizvolov-game"]?.finished === true && read["proizvolov-game"].sum === 9 && read["proizvolov-game"].holds === true);
check("raisin-game: mid-game after a cut", read["raisin-game"]?.finished === false && read["raisin-game"].heaps?.length === 2);
check("reverse-desert: after one jump", read["reverse-desert"]?.finished === false && read["reverse-desert"].scouts === 2 && read["reverse-desert"].movesSoFar === 1);
check("row-column-swap: after one row swap", read["row-column-swap"]?.finished === true && read["row-column-swap"].n === 3 && read["row-column-swap"].movesSoFar === 1);
check("rsolitaire: after one reverse jump on Cross", read.rsolitaire?.pegs === 2 && read.rsolitaire.movesSoFar === 1 && read.rsolitaire.won === false);
check("scoring-misere: after a slide", read["scoring-misere"]?.finished === false && Array.isArray(read["scoring-misere"]?.positions));
check("scoring-misere-2: after a take", read["scoring-misere-2"]?.finished === false && Array.isArray(read["scoring-misere-2"]?.heaps));
check("sct: after a merge", read.sct?.counts && read.sct.movesSoFar >= 1);
check("sticky-problem: after a break", read["sticky-problem"]?.finished === false && Array.isArray(read["sticky-problem"]?.sticks));


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

// No Silver Dollar: alternate gaps are Nim heaps; 3, 7, 10 has heaps 3 and 2.
{
  const p = at("no-silver-dollar", { length: 25, positions: [3, 7, 10], turn: "you", over: false, winner: null, moves: 0 });
  check("no-silver-dollar: alternate gaps are 2 and 3", p.heaps.join(",") === "2,3");
  check("no-silver-dollar: Nim-sum 1 reduces the left gap", p.nimSum === 1 && p.winningMove?.counter === 1 && p.winningMove.to === 2);
  const lost = at("no-silver-dollar", { length: 25, positions: [2, 3], turn: "you", over: false, winner: null, moves: 0 });
  check("no-silver-dollar: zero Nim-sum has no winning move", lost.nimSum === 0 && lost.winningMove === null && lost.youCanWinFromHere === false);
  const theirs = at("no-silver-dollar", { length: 25, positions: [3, 7, 10], turn: "computer", over: false, winner: null, moves: 1 });
  check("no-silver-dollar: on the computer's turn a Nim-sum that is not 0 is bad for you", theirs.youCanWinFromHere === false && theirs.winningMove === null);
  const won = at("no-silver-dollar", { length: 25, positions: [0, 1, 2], turn: "computer", over: true, winner: "you", moves: 5 });
  check("no-silver-dollar: a finished game says who won", won.finished === true && won.winner === "you");
}

// One Pile: losing piles are those with S mod (Min+Max) < Min.
{
  const p = at("one-pile", { n: 100, min: 3, max: 5, turn: "you", over: false, winner: null, history: [] });
  check("one-pile: 100 mod 8 is 4, so taking 3 or 4 leaves a multiple-of-8 remainder below 3", p.remainder === 4 && p.youCanWinFromHere === true && p.winningTakes.join(",") === "3,4");
  const lost = at("one-pile", { n: 96, min: 3, max: 5, turn: "you", over: false, winner: null, history: [] });
  check("one-pile: 96 is a multiple of 8, lost for the player to move", lost.youCanWinFromHere === false && lost.winningTakes.length === 0);
  const theirs = at("one-pile", { n: 96, min: 3, max: 5, turn: "computer", over: false, winner: null, history: [4] });
  check("one-pile: a losing pile on the computer's turn is good for you", theirs.youCanWinFromHere === true);
  const done = at("one-pile", { n: 2, min: 3, max: 5, turn: "you", over: true, winner: "you", history: [5] });
  check("one-pile: a finished game names the winner", done.finished === true && done.winner === "you");
}

// Odd Scoring: from 11 steps the winning first move is 2; 9 steps is lost.
{
  const p = at("odd-scoring", { steps: 11, left: 11, you: 0, computer: 0, turn: "you", over: false, winner: null });
  check("odd-scoring: 11 steps is won by taking 2", p.youCanWinFromHere === true && p.winningMoves.join(",") === "2");
  const lost = at("odd-scoring", { steps: 9, left: 9, you: 0, computer: 0, turn: "you", over: false, winner: null });
  check("odd-scoring: 9 steps is lost against perfect play", lost.youCanWinFromHere === false && lost.winningMoves.length === 0);
  const theirs = at("odd-scoring", { steps: 11, left: 9, you: 2, computer: 0, turn: "computer", over: false, winner: null });
  check("odd-scoring: after taking 2 the computer is the one who is lost", theirs.youCanWinFromHere === true && theirs.winningMoves.length === 0);
  const done = at("odd-scoring", { steps: 3, left: 0, you: 2, computer: 1, turn: "you", over: true, winner: "you" });
  check("odd-scoring: an even total wins a finished game", done.finished === true && done.winner === "you");

  const idle = at("parrondo", { ready: false });
  check("parrondo: before Go the reader says not ready", idle.ready === false);
  const ran = at("parrondo", {
    ready: true,
    trials: 100,
    games: 50,
    options: { modulus: 3, codes: "AB ABBAB", pA: 0.495, pB1: 0.095, pB2: 0.745, games: 50, trials: 100, epsilon: 0.005 },
    finals: [
      { name: "A", average: -2 },
      { name: "B", average: -1 },
      { name: "ABBAB", average: 4 },
      { name: "AB", average: 1 },
    ],
  });
  check("parrondo: ranks ABBAB first from the saved finals", ran.best?.name === "ABBAB" && ran.ranked[0].average === 4);

  // Central solitaire after (3,1)→(3,3): EMPTY is 2, not 0 (0 is outside).
  const peg = at("pegsolitaire", {
    gameNo: 6,
    name: "Central solitaire",
    centerGoal: true,
    board: [
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 2, 2, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
    ],
    starting: [
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 2, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
    ],
    selected: null,
    historyLength: 1,
    designing: false,
    won: false,
    pegs: 31,
  });
  check("pegsolitaire: after one central jump, 31 pegs and not won", peg.pegs === 31 && peg.movesSoFar === 1 && peg.won === false && peg.legalJumps > 0);
}

// Plainim: heaps 6 and 4 on 4 columns have Nim-sum 2; equal heaps are lost.
{
  const p = at("plainim", {
    cols: 4,
    rows: 2,
    misere: false,
    heaps: [6, 4],
    turn: "you",
    over: false,
    winner: null,
    wins: 0,
    losses: 0,
  });
  check("plainim: 6 and 4 have Nim-sum 2", p.nimSum === 2 && p.youCanWinFromHere === true);
  check(
    "plainim: a winning move leaves Nim-sum 0",
    p.winningMoves.length > 0 &&
      p.winningMoves.every((m) => {
        const heaps = [6, 4];
        heaps[m.row - 1] ^= m.mask;
        return (heaps[0] ^ heaps[1]) === 0;
      }),
  );
  const lost = at("plainim", {
    cols: 4,
    rows: 2,
    misere: false,
    heaps: [5, 5],
    turn: "you",
    over: false,
    winner: null,
    wins: 0,
    losses: 0,
  });
  check("plainim: equal heaps are lost for the player to move", lost.nimSum === 0 && lost.youCanWinFromHere === false && lost.winningMoves.length === 0);
  check(
    "plainim: empty board is finished",
    at("plainim", {
      cols: 4,
      rows: 2,
      misere: false,
      heaps: [0, 0],
      turn: "you",
      over: true,
      winner: "you",
      wins: 0,
      losses: 1,
    }).finished === true,
  );
}

// Plus or Minus: N=5 is always odd; N=3 is always even.
{
  const five = at("pm", {
    n: 5,
    signs: [1, 2, 1, 2],
    turn: "you",
    over: false,
    winner: null,
    total: null,
    wins: 0,
    losses: 0,
    random: false,
    pendingSign: 1,
  });
  check("pm: N=5 is a win for you", five.youShouldWinThisLength === true && five.triangular === 15);
  const three = at("pm", {
    n: 3,
    signs: [1, 1],
    turn: "you",
    over: true,
    winner: "computer",
    total: 6,
    wins: 1,
    losses: 0,
    random: false,
    pendingSign: 1,
  });
  check("pm: finished N=3 names the computer", three.finished === true && three.winner === "computer" && three.youShouldWinThisLength === false);
}

// Proizvolov: pick 6,1,4 from N=3 → sum 9.
{
  const p = at("proizvolov-game", { n: 3, picked: [6, 1, 4], clue: false, showAll: true });
  check(
    "proizvolov-game: left 6,4,1 and sum 9",
    JSON.stringify(p.left) === "[6,4,1]" && p.sum === 9 && p.holds === true,
  );
}

// Candy Squares: (6,5) is winning; (5,5) is losing.
{
  const win = at("raisin-game", {
    max: 15,
    random: false,
    heaps: [6, 5],
    turn: "you",
    over: false,
    winner: null,
    wins: 0,
    losses: 0,
  });
  check("raisin-game: 6 and 5 is winning", win.youCanWinFromHere === true && win.winningCuts.length > 0);
  const lose = at("raisin-game", {
    max: 15,
    random: false,
    heaps: [5, 5],
    turn: "you",
    over: false,
    winner: null,
    wins: 0,
    losses: 0,
  });
  check("raisin-game: 5 and 5 is losing", lose.youCanWinFromHere === false && lose.winningCuts.length === 0);
}


// Reverse Desert: after the known 3-move win the desert is clear.
{
  const p = at("reverse-desert", {
    cols: 4,
    habitable: 3,
    level: 2,
    board: [
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0],
    ],
    starting: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    historyLength: 3,
    won: true,
  });
  check("reverse-desert: finished win", p.finished === true && p.desertClear === true && p.scouts === 2);
}

// Row & Column Swaps: olympiad target stays unmatched after a swap.
{
  const p = at("row-column-swap", {
    n: 3,
    grid: [
      [3, 4, 5],
      [0, 1, 2],
      [6, 7, 8],
    ],
    historyLength: 1,
    explored: true,
  });
  check("row-column-swap: explored after a swap", p.finished === true && p.matchesTarget === false && p.hasOlympiadTarget === true);
  const start = at("row-column-swap", {
    n: 3,
    grid: [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ],
    historyLength: 0,
    explored: false,
  });
  check("row-column-swap: fresh start not finished", start.finished === false && start.matchesTarget === false);
}

// Reverse Solitaire: mid Cross after the first dual jump.
{
  const p = at("rsolitaire", {
    gameNo: 0,
    name: "Cross",
    board: [
      [0, 0, 2, 2, 2, 0, 0],
      [0, 0, 2, 2, 2, 0, 0],
      [2, 2, 2, 2, 2, 2, 2],
      [2, 1, 1, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2],
      [0, 0, 2, 2, 2, 0, 0],
      [0, 0, 2, 2, 2, 0, 0],
    ],
    historyLength: 1,
    won: false,
  });
  check("rsolitaire: two pegs after first jump", p.pegs === 2 && p.won === false && p.legalJumps > 0);
  const start = at("rsolitaire", {
    gameNo: 0,
    name: "Cross",
    board: [
      [0, 0, 2, 2, 2, 0, 0],
      [0, 0, 2, 2, 2, 0, 0],
      [2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 1, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2],
      [0, 0, 2, 2, 2, 0, 0],
      [0, 0, 2, 2, 2, 0, 0],
    ],
    historyLength: 0,
    won: false,
  });
  check("rsolitaire: fresh Cross has four opening jumps", start.pegs === 1 && start.legalJumps === 4);
}

// Scoring Misère: leaving a single counter at 1 is a forced loss if you must move.
{
  const mid = at("scoring-misere", {
    positions: [4],
    maxStep: 3,
    length: 8,
    turn: "you",
    over: false,
    historyLength: 1,
    wins: 0,
    losses: 0,
  });
  check("scoring-misere: mid-game has moves", mid.finished === false && mid.legalMoves > 0);
  const lost = at("scoring-misere", {
    positions: [0],
    maxStep: 3,
    length: 8,
    turn: "you",
    over: true,
    winner: "computer",
    historyLength: 2,
    wins: 0,
    losses: 1,
  });
  check("scoring-misere: finished loss", lost.finished === true && lost.winner === "computer");
}

// Scoring Misère 2: (4,1) is a second-player win for M=3.
{
  const p = at("scoring-misere-2", {
    heaps: [4, 1],
    maxMove: 3,
    maxHeap: 15,
    turn: "you",
    over: false,
    historyLength: 0,
  });
  check("scoring-misere-2: (4,1) second wins", p.finished === false && p.heaps[0] === 4);
}

// SCT: mid-game after one elimination merge.
{
  const p = at("sct", {
    shapes: [3, 0, 1, 2],
    eliminate: true,
    over: false,
    historyLength: 1,
  });
  check("sct: counts after merge", p.counts.s === 1 && p.counts.c === 1 && p.counts.t === 1 && p.finished === false);
}

// Sticky Problem: after breaking a four into 1+3 from the standard start.
{
  const p = at("sticky-problem", {
    sticks: [1, 1, 3, 4, 4, 4],
    turn: "computer",
    over: false,
    mode: "break",
  });
  check(
    "sticky-problem: mid-game N-position",
    p.finished === false && p.isP === false && p.counts.k === 2 && p.counts.m === 1,
  );
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
