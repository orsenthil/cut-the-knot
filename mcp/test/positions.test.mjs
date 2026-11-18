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
import { cores } from "../src/generated/cores.js";
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
check("another-sticky-problem: after a break and the reply, a set-A position", read["another-sticky-problem"]?.finished === false && read["another-sticky-problem"].set === "A" && read["another-sticky-problem"].totalLength === 21 && read["another-sticky-problem"].legalMoves > 0);
check("soup-fish: after a pick", read["soup-fish"]?.finished === false && typeof read["soup-fish"]?.you === "number");
check("table-to-zero-game: after a subtract", read["table-to-zero-game"]?.finished === false && Array.isArray(read["table-to-zero-game"]?.grid));
check("trans-example: one shuttle drawn", read["trans-example"]?.finished === false && read["trans-example"]?.shuttles === 1);
check("trigg-tromino: one square picked", read["trigg-tromino"]?.finished === false && read["trigg-tromino"].building === 1 && read["trigg-tromino"].piecesPlaced === 0);
check("tromino: one step shown on an 8x8 board", read.tromino?.finished === false && read.tromino.boardSize === 8 && read.tromino.step === 1 && read.tromino.piecesPlaced === 1 && read.tromino.piecesNeeded === 21 && read.tromino.placedByStep[0] === 1);
check("tromino-rep-tile: one split on an 8x8 board", read["tromino-rep-tile"]?.finished === false && read["tromino-rep-tile"].boardSize === 8 && read["tromino-rep-tile"].step === 1 && read["tromino-rep-tile"].piecesPlaced === 6 && read["tromino-rep-tile"].piecesNeeded === 21 && read["tromino-rep-tile"].biggestPiece === 2);
check("tromino-puzzle: one L on a 4x4 board", read["tromino-puzzle"]?.finished === false && read["tromino-puzzle"].boardSize === 4 && read["tromino-puzzle"].piecesPlaced === 1 && read["tromino-puzzle"].piecesNeeded === 5 && read["tromino-puzzle"].squaresLeft === 12 && read["tromino-puzzle"].canPlaceAnother === true);
check("deficient-squares: one L on a 5x5 board", read["deficient-squares"]?.finished === false && read["deficient-squares"].boardSize === 5 && read["deficient-squares"].piecesPlaced === 1 && read["deficient-squares"].piecesNeeded === 8 && read["deficient-squares"].squaresLeft === 21 && read["deficient-squares"].tileable === true && read["deficient-squares"].canPlaceAnother === true);
check("two-color-solitaire: one pair removed from 8 cards", read["two-color-solitaire"]?.finished === false && read["two-color-solitaire"].deckSize === 8 && read["two-color-solitaire"].cardsLeft === 6 && read["two-color-solitaire"].pairsRemoved === 1 && read["two-color-solitaire"].magicTrickApplies === true && read["two-color-solitaire"].coloursAlternate === true && read["two-color-solitaire"].legalGapCount > 0);
check("up-and-down-game: one number placed in box 1", read["up-and-down-game"]?.filled === 1 && read["up-and-down-game"].boxes[0] === 3 && read["up-and-down-game"].finished === false && read["up-and-down-game"].canStillBeCompleted === true);
check("wythoff-nim: one move made from two heaps of 3", read["wythoff-nim"]?.finished === false && read["wythoff-nim"].heaps.length === 2 && read["wythoff-nim"].movesSoFar >= 1);
check("y-theory: a clicked cell on a board of seven", read["y-theory"]?.n === 7 && read["y-theory"].cellCount === 28 && read["y-theory"].winner !== null && read["y-theory"].reducedWinner === read["y-theory"].winner);


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

// Another Sticky Problem: the start is A, a B position has a reply to A, and a
// position outside both sets is named as such.
{
  const start = at("another-sticky-problem", { n: 10, sticks: [10, 11] });
  check(
    "another-sticky-problem: the start is set A with 19 breaks and no removal",
    start.finished === false && start.set === "A" && start.totalSticks === 2 && start.evenSticks === 1 && start.legalMoves === 19 && start.removableLengths.length === 0,
  );
  const b = at("another-sticky-problem", { n: 3, sticks: [3, 3, 1] });
  check(
    "another-sticky-problem: three sticks with no even one is B, and has a reply to A",
    b.set === "B" && b.winningReply?.type === "break" && b.winningReply.length === 3 && b.winningReply.at === 1,
  );
  const neither = at("another-sticky-problem", { n: 2, sticks: [2, 2] });
  check("another-sticky-problem: two even sticks are outside A and B", neither.set === null && neither.legalMoves === 3);
  const removal = at("another-sticky-problem", { n: 2, sticks: [1, 1, 2] });
  check(
    "another-sticky-problem: 1, 1, 2 offers removing one length-1 stick",
    removal.set === "B" && JSON.stringify(removal.removableLengths) === "[1]" && removal.counts["1"] === 2,
  );
  const over = at("another-sticky-problem", { n: 3, sticks: [] });
  check("another-sticky-problem: an empty board is finished", over.finished === true && over.set === "A" && over.legalMoves === 0);
}

// Fish Soup: human owns FISH+SOUP+SWAN (mask 7).
{
  const p = at("soup-fish", {
    you: 7,
    computer: 0,
    over: true,
    result: "you",
    winLetter: "S",
    perm: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  });
  check("soup-fish: S-line win", p.finished === true && p.winLetter === "S" && p.result === "you");
}

// Make It All Zeros: mid-game after one column subtract.
{
  const p = at("table-to-zero-game", {
    grid: [[0, 2]],
    nx: 2,
    ny: 1,
    over: false,
    historyLength: 1,
  });
  check("table-to-zero-game: mid 1×2", p.finished === false && p.grid[0][0] === 0);
}

// Trans Example: one shuttle swaps two bottoms; a full verify ends the play.
{
  const bars = [{ a: 0, b: 2, h: 0.5 }];
  const p = at("trans-example", { n: 5, mode: "draw", bars, labels: [0, 0, 0, 0, 0], itinerary: null });
  check("trans-example: one shuttle swaps bottoms 1 and 3",
    p.finished === false && JSON.stringify(p.topToBottom) === JSON.stringify([3, 2, 1, 4, 5]));
  const done = at("trans-example", { n: 5, mode: "verify", bars, labels: [3, 2, 1, 4, 5], itinerary: null });
  check("trans-example: all bottoms labelled is done", done.finished === true && done.traced === 5);
}

// Trigg Tromino: empty board, one pick, and a finished covering.
{
  const empty = at("trigg-tromino", { size: 8, owner: [], pieces: [], building: [] });
  check("trigg-tromino: empty board has 60 free squares", empty.emptySquares === 60 && empty.finished === false);
  const picking = at("trigg-tromino", { size: 8, pieces: [], building: [[0, 0]] });
  check("trigg-tromino: one square in the building piece", picking.building === 1 && picking.piecesPlaced === 0);
  const T = cores["trigg-tromino"].TriggTrominoCore;
  const pieces = T.findCovering(0);
  const covered = at("trigg-tromino", { size: 8, pieces, building: [] });
  check("trigg-tromino: a fault-free covering reads as finished with 0 faults",
    covered.finished === true && covered.faultCount === 0 && covered.piecesPlaced === 20);
}

// Tromino: the saved summary rebuilds the same induction, step by step.
{
  const start = at("tromino", { exp: 3, n: 8, hole: { col: 2, row: 5 }, level: 0, pieces: 0 });
  check("tromino: a fresh 8x8 board needs 21 pieces", start.finished === false && start.piecesNeeded === 21 && start.piecesPlaced === 0 && start.hole.col === 3 && start.hole.row === 6);
  const mid = at("tromino", { exp: 3, n: 8, hole: { col: 2, row: 5 }, level: 2, pieces: 5 });
  check("tromino: two steps place one then four Ls", mid.step === 2 && mid.piecesPlaced === 5 && JSON.stringify(mid.placedByStep) === JSON.stringify([1, 4, 0]));
  const done = at("tromino", { exp: 3, n: 8, hole: { col: 2, row: 5 }, level: 3, pieces: 21 });
  check("tromino: the last step finishes the tiling", done.finished === true && done.piecesPlaced === 21 && done.piecesNeeded === 21);
}

// Tromino as a Rep-tile: the saved summary rebuilds the nested picture.
{
  const opening = at("tromino-rep-tile", { exp: 3, n: 8, hole: { col: 2, row: 5 }, level: 0, pieces: 3 });
  check("tromino-rep-tile: the opening picture is one L per size", opening.finished === false && opening.piecesPlaced === 3 && opening.biggestPiece === 4 && opening.piecesNeeded === 21 && opening.hole.col === 3 && opening.totalSteps === 2);
  const mid = at("tromino-rep-tile", { exp: 3, n: 8, hole: { col: 2, row: 5 }, level: 1, pieces: 6 });
  check("tromino-rep-tile: the first press splits only the biggest L", mid.step === 1 && mid.piecesPlaced === 6 && mid.biggestPiece === 2 && JSON.stringify(mid.piecesBySize) === JSON.stringify({ 2: 5, 1: 1 }));
  const done = at("tromino-rep-tile", { exp: 3, n: 8, hole: { col: 2, row: 5 }, level: 2, pieces: 21 });
  check("tromino-rep-tile: the second press finishes the tiling", done.finished === true && done.piecesPlaced === 21 && done.biggestPiece === 1);
  const tiny = at("tromino-rep-tile", { exp: 1, n: 2, hole: { col: 0, row: 0 }, level: 0, pieces: 1 });
  check("tromino-rep-tile: the 2x2 board is already one L", tiny.finished === true && tiny.totalSteps === 0 && tiny.piecesPlaced === 1);
}

// Tromino Puzzle: a full 4x4 tiling wins, and four careless pieces get stuck.
{
  const tiling = [
    [[0, 1], [1, 1], [1, 0]],
    [[1, 2], [2, 2], [2, 1]],
    [[0, 2], [0, 3], [1, 3]],
    [[2, 3], [3, 3], [3, 2]],
    [[3, 1], [3, 0], [2, 0]],
  ];
  const done = at("tromino-puzzle", { exp: 2, n: 4, blank: { row: 0, col: 0 }, pieces: tiling });
  check("tromino-puzzle: the five Ls cover the 4x4 board", done.finished === true && done.piecesPlaced === 5 && done.piecesNeeded === 5 && done.squaresLeft === 0 && done.gap.col === 1 && done.gap.row === 1);
  const pocketPieces = [
    [[0, 1], [1, 1], [1, 0]],
    [[0, 2], [0, 3], [1, 3]],
    [[1, 2], [2, 2], [2, 3]],
    [[2, 0], [2, 1], [3, 1]],
  ];
  const pocket = at("tromino-puzzle", { exp: 2, n: 4, blank: { row: 0, col: 0 }, pieces: pocketPieces });
  check("tromino-puzzle: four pieces leave a three-square pocket", pocket.finished === false && pocket.piecesPlaced === 4 && pocket.squaresLeft === 3 && pocket.canPlaceAnother === false);
  check("tromino-puzzle: a bad piece throws", (() => {
    try {
      at("tromino-puzzle", { exp: 2, n: 4, blank: { row: 0, col: 0 }, pieces: [[[1, 0], [1, 1], [1, 2]]] });
      return false;
    } catch {
      return true;
    }
  })());
}

// Deficient Squares: a full 5x5 tiling wins, a 5x5 bad gap is not tileable,
// and a 6x6 board can never be won.
{
  const tiling = [
    [[0, 1], [0, 2], [1, 2]],
    [[0, 3], [0, 4], [1, 4]],
    [[1, 1], [1, 0], [2, 0]],
    [[1, 3], [2, 3], [2, 4]],
    [[2, 2], [2, 1], [3, 1]],
    [[3, 0], [4, 0], [4, 1]],
    [[3, 2], [4, 2], [4, 3]],
    [[3, 3], [3, 4], [4, 4]],
  ];
  const done = at("deficient-squares", { n: 5, blank: { row: 0, col: 0 }, pieces: tiling });
  check("deficient-squares: the eight Ls cover the 5x5 board", done.finished === true && done.piecesPlaced === 8 && done.piecesNeeded === 8 && done.squaresLeft === 0 && done.gap.row === 1 && done.gap.col === 1 && done.tileable === true);
  const badGap = at("deficient-squares", { n: 5, blank: { row: 0, col: 1 }, pieces: [] });
  check("deficient-squares: a 5x5 odd gap is not tileable", badGap.finished === false && badGap.tileable === false && typeof badGap.note === "string" && /corner/.test(badGap.note));
  const six = at("deficient-squares", { n: 6, blank: { row: 2, col: 3 }, pieces: [] });
  check("deficient-squares: a 6x6 board is not tileable", six.finished === false && six.tileable === false && six.piecesNeeded === null && /multiple of 3/.test(six.note));
  check("deficient-squares: a wasted piece on a 6x6 is still not a win", (() => {
    const wasted = at("deficient-squares", { n: 6, blank: { row: 2, col: 3 }, pieces: [[[0, 0], [0, 1], [1, 1]]] });
    return wasted.finished === false && wasted.piecesPlaced === 1 && wasted.tileable === false;
  })());
}

// Solitaire in Two Colors: the invariant and the two kinds of ending.
{
  const full = at("two-color-solitaire", { n: 8, order: [1, 5, 2, 6, 3, 7, 4, 8] });
  check("two-color-solitaire: a full 8-card circle starts even", full.finished === false && full.stuck === false && full.deckSize === 8 && full.cardsLeft === 8 && full.pairsRemoved === 0 && full.oddDifference === 0 && full.evenDifference === 0 && full.magicTrickApplies === true && full.coloursAlternate === true);
  const empty = at("two-color-solitaire", { n: 8, order: [] });
  check("two-color-solitaire: an empty circle is a win", empty.finished === true && empty.stuck === false && empty.cardsLeft === 0 && empty.pairsRemoved === 4 && /Every one of the 8 cards/.test(empty.note));
  const six = at("two-color-solitaire", { n: 6, order: [1, 4, 2, 5, 3, 6] });
  check("two-color-solitaire: 6 cards are balanced only in colour", six.finished === false && six.magicTrickApplies === false && six.oddDifference === 1 && six.evenDifference === -1 && six.legalGapCount === 2);
  const stuck = at("two-color-solitaire", { n: 6, order: [3, 6] });
  check("two-color-solitaire: two cards of opposite parity are stuck", stuck.finished === false && stuck.stuck === true && stuck.cardsLeft === 2 && stuck.legalGapCount === 0 && /Stuck/.test(stuck.note));
  check("two-color-solitaire: a broken circle order throws", (() => {
    try {
      at("two-color-solitaire", { n: 8, order: [1, 1, 2, 3] });
      return false;
    } catch {
      return true;
    }
  })());
}

// Monotone Number Sequences: a win, a forced loss, a fixable run and a board
// that cannot be completed. Nine can be done; ten never can.
{
  const win = at("up-and-down-game", { n: 9, boxes: [3, 2, 1, 6, 5, 4, 9, 8, 7], moves: 9 });
  check("up-and-down-game: the block board wins", win.finished === true && win.result === "win" && win.fault === null && win.canStillBeCompleted === true);

  const loss = at("up-and-down-game", { n: 10, boxes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], moves: 10 });
  check("up-and-down-game: ten in order loses with a run highlighted", loss.finished === true && loss.result === "lose" && loss.fault.direction === "up" && JSON.stringify(loss.fault.boxes) === "[1,2,3,4]" && loss.canStillBeCompleted === false);

  const fixable = at("up-and-down-game", { n: 9, boxes: [1, 2, 3, 4, null, null, null, null, null], moves: 4 });
  check("up-and-down-game: a run on a partial board is pointed out but not the end", fixable.finished === false && fixable.fault.direction === "up" && fixable.filled === 4 && fixable.canStillBeCompleted === false);

  const partial = at("up-and-down-game", { n: 9, boxes: [3, 2, 1, null, null, null, null, null, null], moves: 3 });
  check("up-and-down-game: a clean prefix can be completed", partial.finished === false && partial.fault === null && partial.loose.length === 6 && partial.canStillBeCompleted === true && partial.exampleCompletion.length === 9);

  const listed = describePosition("up-and-down-game", { n: 9, boxes: [1, 2, 3, 4, 5, 6, 7, 8, 9], moves: 9 }, 1);
  check("up-and-down-game: a rising full board has a down-free but up-full fault", listed.result === "lose" && listed.fault.direction === "up");
}

// Wythoff's Nim: cold pairs, the applet's four wrong table entries, and a
// finished board.
{
  const cold = at("wythoff-nim", { max: 15, heaps: [3, 5], mode: "one", turn: "you", moves: 2 });
  check("wythoff-nim: 3 and 5 is a cold pair", cold.cold === true && cold.difference === 2 && JSON.stringify(cold.truePairForThisDifference) === "[3,5]" && cold.finished === false && cold.turn === "you");

  const warm = at("wythoff-nim", { max: 15, heaps: [4, 7], mode: "two", turn: "computer", moves: 4 });
  check("wythoff-nim: 4 and 7 is cold too, and the computer is to move", warm.cold === true && warm.turn === "computer" && warm.mode === "two" && warm.legalMoves > 0);

  const won = at("wythoff-nim", { max: 15, heaps: [0, 0], mode: "one", turn: "computer", moves: 9 });
  check("wythoff-nim: an empty board is over and a win for the last mover", won.finished === true && won.result === "win" && won.legalMoves === 0);

  const bad = at("wythoff-nim", { max: 15, heaps: [1, 4], mode: "one", turn: "you", moves: 1 });
  check("wythoff-nim: the true pair for difference 3 is 4 and 7", bad.cold === false && bad.difference === 3 && JSON.stringify(bad.truePairForThisDifference) === "[4,7]");
}

// The game of Y: the winner, the chain and the reduction.
{
  const board = (n, colors) => {
    const cells = Array(n * n).fill(null);
    let k = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) cells[i * n + j] = colors[k++];
    }
    return { n, cells };
  };
  const allBlue3 = board(3, ["blue", "blue", "blue", "blue", "blue", "blue"]);
  const blue = at("y-theory", allBlue3);
  check("y-theory: an all-blue Y_3 board has a six-cell blue chain", blue.winner === "blue" && blue.chainLength === 6 && blue.redCells === 0 && blue.reducedWinner === "blue");

  const split = at("y-theory", board(2, ["blue", "red", "blue"]));
  check("y-theory: a two-blue one-red triangle is a blue win", split.winner === "blue" && split.n === 2 && split.cellCount === 3);

  const single = at("y-theory", board(1, ["red"]));
  check("y-theory: one red cell is a red win with no reduction", single.winner === "red" && single.n === 1 && single.reducedWinner === null);
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
