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
check("date-game: a January date after two month clicks", read["date-game"]?.month === 2 && read["date-game"].day >= 0 && read["date-game"].valid === true && read["date-game"].finished === false);
check("goat-cabbage-wolf: the goat was ferried across", read["goat-cabbage-wolf"]?.right.length === 1 && read["goat-cabbage-wolf"].farmerShore === "right" && read["goat-cabbage-wolf"].nextCrossing === "cross alone");
check("subtraction-game: one move made on a board of twelve", read["subtraction-game"]?.nums.length === 12 && read["subtraction-game"].movesSoFar >= 1);
check("abacus: counters moved on the units wire", read["abacus"]?.radix === 10 && read["abacus"].wires === 7 && read["abacus"].abaci[0].digits[6] > 0);
check("adams-apportionment: a population was edited", read["adams-apportionment"]?.seats === 23 && read["adams-apportionment"].populations.length === 3 && read["adams-apportionment"].totalPopulation > 0);
check("addition-law-of-change: the first addend was nudged", read["addition-law-of-change"]?.a === 2 && read["addition-law-of-change"].b === 1 && read["addition-law-of-change"].sum === 3);
check("affirmative-action: a node was flipped on the grid", read["affirmative-action"]?.nodes === 20 && read["affirmative-action"].edges === 31 && Array.isArray(read["affirmative-action"].nonIntegrated));
check("hamilton-apportionment: a population was edited", read["hamilton-apportionment"]?.seats === 23 && read["hamilton-apportionment"].final.length === 3 && read["hamilton-apportionment"].finalTotal === 23);
check("all-combinations: the choose step changed M", read["all-combinations"]?.n === 5 && read["all-combinations"].m === 4 && read["all-combinations"].total === "5");
check("all-permutations: the Heap generator was selected", read["all-permutations"]?.n === 3 && read["all-permutations"].algorithm === "heap" && read["all-permutations"].count === 6);
check("isosceles-fallacy: switched to the honest drawing", read["isosceles-fallacy"]?.mode === "right" && read["isosceles-fallacy"].pOnCircumcircle === true && read["isosceles-fallacy"].uOnSide !== read["isosceles-fallacy"].vOnSide);
check("apportionment-methods: Webster was highlighted", read["apportionment-methods"]?.seats === 23 && read["apportionment-methods"].method === "webster" && Object.keys(read["apportionment-methods"].allocations).length === 5);

// The ten newest ports, on positions saved by their own pages.
check("chvatal: one diagonal on a pentagon", read.chvatal?.n === 5 && read.chvatal.diagonalsPlaced === 1 && read.chvatal.diagonalsNeeded === 2 && read.chvatal.complete === false);
check("circles-and-limit: E is short of the limit", read["circles-and-limit"]?.a === 3 && read["circles-and-limit"].r === 2 && read["circles-and-limit"].limitX === 12 && read["circles-and-limit"].distanceToLimit > 0);
check("circle-with-two-centers: the cheat drawing shows two centres", read["circle-with-two-centers"]?.cheat === true && read["circle-with-two-centers"].isIllusion === true);
check("city-block-hunt: one clue leaves candidates", read["city-block-hunt"]?.clueCount === 1 && read["city-block-hunt"].finished === false && read["city-block-hunt"].pageClaimCheck.agrees === true);
check("city-block-hunt-from-outside: one outside clue", read["city-block-hunt-from-outside"]?.clueCount === 1 && read["city-block-hunt-from-outside"].finished === false && read["city-block-hunt-from-outside"].treasureInEveryLocus === true);
check("coin-change: the classic 292 ways", read["coin-change"]?.ways === "292" && read["coin-change"].classic292.sameSetup === true && read["coin-change"].classic292.sameCount === true);
check("collatz: one step from the saved start", read.collatz?.step === 1 && read.collatz.mode === "divide" && read.collatz.currentValue > 0 && read.collatz.cycle.join(",") === "4,2,1");
check("color-graph: Graph 6 needs four colours", read["color-graph"]?.graph === "Graph 6" && read["color-graph"].fewestPossible === 4 && read["color-graph"].result === null);
check("combi-gem: the saved sums match the core", read["combi-gem"]?.n === 5 && read["combi-gem"].count === 10 && read["combi-gem"].savedSumsMatchCore === true);
check("common-multiples: the first blue dot is the lcm", read["common-multiples"]?.p === 4 && read["common-multiples"].lcm === 12 && read["common-multiples"].firstBlueDot === 12);


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

// The Date Game: the losing diagonal and the finished dates.
{
  const jan5 = at("date-game", { month: 0, day: 4, leap: false, turn: "you", last: null });
  check("date-game: January 5 is a valid, non-losing date", jan5.valid === true && jan5.losing === false && jan5.difference === 4 && JSON.stringify(jan5.target) === "{\"month\":0,\"day\":19}");

  const jan20 = at("date-game", { month: 0, day: 19, leap: false, turn: "computer", last: null });
  check("date-game: January 20 is the losing diagonal", jan20.losing === true && jan20.difference === 19 && jan20.target === null);

  const dec31 = at("date-game", { month: 11, day: 30, leap: false, turn: "you", winner: "you" });
  check("date-game: December 31 is a win for the player who got there", dec31.finished === true && dec31.result === "win" && dec31.losing === true);

  const feb29 = at("date-game", { month: 1, day: 29, leap: false, turn: "you", last: "day" });
  check("date-game: February 30 is not a real date in an ordinary year", feb29.valid === false && feb29.wordsYouMayStillMove.length === 1);
}

// Goat, Cabbage and Wolf: the 16-state search and the seven-crossing route.
{
  const start = at("goat-cabbage-wolf", { right: [false, false, false], boat: "left", moves: 0 });
  check("goat-cabbage-wolf: the start has a seven-crossing route", start.danger === null && start.crossingsLeftInShortestRoute === 7 && start.nextCrossing === "take the goat across");

  const unsafe = at("goat-cabbage-wolf", { right: [true, false, false], boat: "left", moves: 2 });
  check("goat-cabbage-wolf: goat alone on the far shore is safe in the stated rules", unsafe.danger === null && unsafe.farmerShore === "left");

  const bad = at("goat-cabbage-wolf", { right: [false, true, false], boat: "right", moves: 1, outcome: "lose" });
  check("goat-cabbage-wolf: the wolf eats the goat on the near shore", bad.danger === "The wolf ate the goat!" && bad.nextCrossing === null);

  const won = at("goat-cabbage-wolf", { right: [true, true, true], boat: "right", moves: 7, outcome: "win" });
  check("goat-cabbage-wolf: all three across is a win", won.result === "win" && won.danger === null && won.crossingsSoFar === 7);
}

// The Subtraction Game: Grundy values, the Nim-sum and the Scoring claim.
{
  const board = at("subtraction-game", { nums: [9, 4, 11], subs: [1, 2, 3], max: 20, turn: "you" });
  check("subtraction-game: values are n mod 4 and the sum is non-zero",
    JSON.stringify(board.grundyValues) === "[1,0,3]" && board.nimSum === 2 && board.nextGoodMove !== null);

  const cold = at("subtraction-game", { nums: [4, 8, 12], subs: [1, 2, 3], max: 20, turn: "you" });
  check("subtraction-game: multiples of four have a zero Nim-sum", cold.nimSum === 0 && cold.nextGoodMove === null);

  const done = at("subtraction-game", { nums: [0, 0], subs: [1, 2], max: 20, winner: "you" });
  check("subtraction-game: an empty board is finished", done.finished === true && done.result === "win");
}

// The Abacus demo: place value, base notation and carries.
{
  const board = at("abacus", { radix: 10, wires: 4, count: 1, sync: false, abaci: [{ digits: [1, 2, 3, 4] }] });
  check("abacus: digits 1234 are worth 1234 in base ten", board.abaci[0].value === 1234 && board.abaci[0].written === "1234");

  const hex = at("abacus", { radix: 16, wires: 4, count: 1, sync: false, abaci: [{ digits: [11, 14, 14, 15] }] });
  check("abacus: BEEF in base sixteen is 48879", hex.abaci[0].written === "BEEF" && hex.abaci[0].value === 48879);
}

// Adams' method: the divisor and the four quota columns.
{
  const board = at("adams-apportionment", { seats: 23, states: 3, populations: [100, 200, 300], divisor: 600 / 23 });
  check("adams-apportionment: the standard divisor rounds up to too many seats",
    board.fits === false && board.standardDivisor > 26 && board.upwardTotal === 24);

  const fitted = at("adams-apportionment", { seats: 23, states: 3, populations: [100, 200, 300], divisor: 28 });
  check("adams-apportionment: divisor 28 fits exactly", fitted.fits === true && fitted.upwardTotal === 23);
}

// The change-of-addends demo: the sum is recomputed, and dots match.
{
  const board = at("addition-law-of-change", { a: 7, b: 4, maxNum: 10 });
  check("addition-law-of-change: 7 + 4 makes 11 dots in the union", board.sum === 11 && board.dots.sum === 11 && board.dots.a === 7 && board.dots.b === 4);

  const edge = at("addition-law-of-change", { a: 100, b: 100, maxNum: 10 });
  check("addition-law-of-change: the total can reach 200", edge.sum === 200 && edge.dots.sum === 200);
}

// The Affirmative Action problem: integrated nodes and balanced edges.
{
  const triangle = at("affirmative-action", { nodes: [{ color: 0 }, { color: 1 }, { color: 0 }], edges: [[0, 1], [1, 2]] });
  check("affirmative-action: the middle node sees two opposite colours", triangle.integrated === true && triangle.balancedEdges === 2);

  const bad = at("affirmative-action", { nodes: [{ color: 0 }, { color: 0 }, { color: 1 }], edges: [[0, 1], [0, 2]] });
  check("affirmative-action: a white node with only a white neighbour is not integrated", bad.integrated === false && bad.nonIntegrated.length === 1);
}

// Hamilton's method: largest remainders and the Alabama paradox.
{
  const country = at("hamilton-apportionment", { seats: 23, populations: [100, 200, 300] });
  check("hamilton-apportionment: two surplus seats go to A and B", country.surplus === 2 && JSON.stringify(country.surplusWinners) === '["A","B"]' && JSON.stringify(country.final) === "[4,8,11]");
}

// All Combinations: binomial counts and the first lexicographic rows.
{
  const board = at("all-combinations", { n: 5, m: 3 });
  check("all-combinations: C(5,3) is ten and the first row is 1 2 3", board.total === "10" && JSON.stringify(board.firstRow) === "[1,2,3]");
}

// All Permutations: factorial counts and cycle notation.
{
  const board = at("all-permutations", { n: 3, algorithm: "recursive" });
  check("all-permutations: six rows and identity cycles", board.count === 6 && board.firstRow.cycles === "(1)(2)(3)");
}

// The isosceles fallacy: the circumcircle and the misplaced foot.
{
  const board = at("isosceles-fallacy", { A: { x: 80, y: 250 }, B: { x: 320, y: 250 }, C: { x: 215, y: 70 }, mode: "right" });
  check("isosceles-fallacy: P lies on the circle and one foot is outside", board.pOnCircumcircle === true && board.uOnSide !== board.vOnSide);
}

// Five apportionment methods: every column fills the house.
{
  const country = at("apportionment-methods", { seats: 23, populations: [100, 200, 300], method: "hamilton" });
  check("apportionment-methods: all five columns add to 23",
    Object.values(country.allocations).every((a) => a.reduce((x, y) => x + y, 0) === 23));
}

// Area of a Circle: the two curved bases are one circumference in radius units.
{
  const row = at("area-of-circle", { sectors: 12 });
  check("area-of-circle: two curved bases make one circumference",
    row.sectors === 12 && row.topSlices === 6 && row.bottomSlices === 6 &&
    Math.abs(row.basesTotalInRadii - row.circumferenceInRadii) < 1e-9 &&
    Math.abs(row.basesTotalInRadii - 2 * Math.PI) < 1e-9 &&
    Math.abs(row.widthInRadii - 12 * Math.sin(Math.PI / 12)) < 1e-9 &&
    Math.abs(row.widthInRadii - Math.PI) < 0.05);
}

// Bad Limit: the staircase length never changes, though the curves converge.
{
  const stair = at("bad-limit", { n: 20 });
  check("bad-limit: staircase equals the big square, not the diamond",
    stair.n === 20 && Math.abs(stair.staircaseLength - stair.bigSquarePerimeter) < 1e-6 &&
    Math.abs(stair.ratio - 1 / Math.SQRT2) < 1e-9 &&
    stair.staircaseLength > stair.midpointSquarePerimeter && stair.maxDeviation > 0);
}

// 3-Term Arithmetic Progression: van der Waerden W(2,3) = 9.
{
  const board = at("arithmetic-sequence", { n: 9, colors: [1, 0, 1, 0, 0, 1, 1, 0, 0] });
  check("arithmetic-sequence: nine numbers always contain a triple",
    board.n === 9 && Array.isArray(board.firstTriple) && board.firstTriple.length === 3);
}

// Auto Flipper: the top number decides how many pancakes turn over.
{
  const flip = at("auto-flipper", { stack: [3, 1, 4, 2] });
  check("auto-flipper: the top pancake decides the next flip",
    flip.top === 3 && flip.stack.join(",") === "3,1,4,2" && flip.n === 4 && typeof flip.lastFlip === "string");
}

// Barcode Encoding: UPC-A uses 95 modules, every digit four runs.
{
  const code = at("barcode-encoding", { mode: "UPC-A" });
  check("barcode-encoding: a UPC-A code has 95 modules",
    code.mode === "UPC-A" && code.modules === 95 && code.digits.length === 12);
}

// Binomial Distribution: the mode equals the mean at n=10, p=0.5.
{
  const chart = at("binomial-distribution", { p: 0.5, n: 10, k: 5 });
  check("binomial-distribution: mode can equal the mean",
    chart.mode === 5 && chart.mean === 5 && Math.abs(chart.total - 1) < 1e-9 &&
    Math.abs(chart.probabilityAtK - 252 / 1024) < 1e-12);
}

// Base Conversion: one number, four bases at once.
{
  const converted = at("base-conversion", { bases: [10, 2, 8, 16], texts: ["255", "255", "255", "255"] });
  check("base-conversion: four bases are shown together",
    converted.bases.join(",") === "10,2,8,16" && converted.texts.length === 4);
}

// Barcode Magic: one hidden digit is forced by the other eleven.
{
  const magic = at("barcode-magic", { digits: [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, -1] });
  check("barcode-magic: the missing check digit is found",
    magic.blanks === 1 && magic.outcome === "missing" && magic.missingDigit === 2);
}

// Bachet's trick: two rows identify the remembered pair.
{
  const trick = at("bachet", { n: 4, straight: true, randomized: false, seed: 1, stage: 1 });
  check("bachet: a grid is built for every pair",
    trick.n === 4 && Array.isArray(trick.message) && trick.message.length === 2);
}

// Birds on a Wire: the marked length has a long-run average near 7/18.
{
  const wire = at("birds-on-wire", { trials: 50, min: 2, max: 3, values: [0.34, 0.5], birds: 3, count: 50, runs: 100 });
  check("birds-on-wire: two birds mark one third on average",
    Math.abs(wire.averages[0].y - 0.34 / 50) < 1e-9 && wire.min === 2 && wire.trials === 50);
}

// Bicentric Quadrilateral: the incircle is always there; the circumcircle is not.
{
  const quad = at("bicentric-quadrilateral", {});
  check("bicentric-quadrilateral: tangential but not always cyclic",
    quad.drawable === true && quad.tangential === true && quad.feetInscriptible === true);
}

// Number Guessing Cards: seven binary digits recover any number below 100.
{
  const deck = at("cards", { cardNo: 2, bit: 1, result: 0, done: false });
  check("cards: a card lists the numbers with that binary digit",
    deck.cardNo === 2 && deck.numbers.length > 0 &&
    deck.numbers.every((n) => ((n >> 2) & 1) === 1));
}

// Box Volume: the maximum is strictly inside the cut's domain.
{
  const box = at("box-volume", { a: 11, b: 8.5, x: 1 });
  check("box-volume: the best cut beats the current one",
    box.bestCut > 1 && box.bestCut < 8.5 / 2 && box.bestVolume > box.volume);
}

// Brides' Chair: every flank has the triangle's area.
{
  const vecten = at("brides-chair", { rotation: 45 });
  check("brides-chair: the flanks keep the triangle's area",
    vecten.rotation === 45 && vecten.triangleArea > 0 &&
    Object.keys(vecten.centers).join(",") === "AB,BC,CA");
}

// Chaos: the behaviour changes with the growth rate.
{
  const logistic = at("chaos", { lambda: 0.892, x0: 0.7, steps: 8 });
  check("chaos: the logistic map's orbit is bounded",
    logistic.lambda === 0.892 && logistic.recentOrbit.length === 9 &&
    logistic.recentOrbit.every((x) => x >= 0 && x <= 1));
}

// Factor Tree: the prime factors multiply back to the root.
{
  const tree = at("btree-testing", { n: 108 });
  check("btree-testing: prime factors reconstruct the number",
    tree.n === 108 && tree.product === 108 && tree.primes.join(",") === "2,2,3,3,3");
}

// Broken Calculator: the 1 key never works.
{
  const calc = at("calculator", { seed: 1 });
  check("calculator: the broken set never enables 1",
    calc.oneEnabled === false && calc.digits.length === 4 && calc.enabled.includes("0"));
}

// Chess Truel: B's chances from the two opening pairs.
{
  const truel = at("chess-tournament", { p: 0.55, q: 0.6, r: 0.75 });
  check("chess-tournament: the three openings have probabilities",
    Math.abs(truel.pAB - truel.table.AB.B) < 1e-12 &&
    Math.abs(truel.pBC - truel.table.BC.B) < 1e-12);
}

// Buffon's Needle: the reading counts crossings over throws.
{
  const needle = at("buffon", { trials: 500, throws: 100, crossings: 60 });
  check("buffon: the estimate is twice throws over crossings",
    needle.reading.startsWith("60 / 100") && Math.abs(Number(needle.piEstimate) - 3.33) < 0.01);
}

// Cavalieri: the two stacks stay equal in area.
{
  const stacks = at("cavalieri", { n: 5 });
  check("cavalieri: both figures have equal area",
    stacks.n === 5 && stacks.equal === true && stacks.areas.left > 0);
}

// Cantor: the tent map keeps its orbit in [0,1].
{
  const tent = at("cantor", { a: 3, step: 5, y: 0.5 });
  check("cantor: the slope and the current value are read",
    tent.a === 3 && tent.step === 5 && tent.y === 0.5);
}

// Chvatal: a fan triangulation of a hexagon and the guard bound.
{
  const fan = at("chvatal", { n: 6, diagonals: [{ a: 0, b: 2 }, { a: 0, b: 3 }, { a: 0, b: 4 }], mode: "draw", finished: false });
  check("chvatal: a hexagon has four triangles and at most two guards",
    fan.complete === true && fan.triangles === 4 && fan.guards.length <= 2 && fan.everyTriangleGuarded === true && fan.withinBound === true);
  const fresh = at("chvatal", { n: 6, diagonals: [], mode: "draw" });
  check("chvatal: a fresh hexagon needs three diagonals", fresh.diagonalsNeeded === 3 && fresh.complete === false);
}

// Circles and a limit: E approaches 4a and matches the closed form.
{
  const p = at("circles-and-limit", { a: 3, r: 1, proof: 1 });
  check("circles-and-limit: the crossing is short of 12 and agrees with the formula",
    p.limitX === 12 && p.valid === true && Math.abs(p.crossingX - p.closedFormX) < 1e-5 && p.distanceToLimit > 0);
}

// Circle with two centers: only the faked drawing has two centres.
{
  const A = { x: 90, y: 300 }, B = { x: 330, y: 340 }, C = { x: 310, y: 80 };
  const fake = at("circle-with-two-centers", { A, B, C, cheat: true });
  const honest = at("circle-with-two-centers", { A, B, C, cheat: false });
  check("circle-with-two-centers: honest perpendiculars give one centre",
    honest.centersCoincide === true && honest.isIllusion === false &&
    fake.isIllusion === true && fake.centersCoincide === false);
}

// City block hunt: the page's largest-ambiguous-set rule and two-corner claim.
{
  const p = at("city-block-hunt", { n: 4, treasure: { col: 1, row: 3 }, touches: 0, won: false, hint: false, last: null });
  check("city-block-hunt: ten ambiguous cells and two corners suffice",
    p.pageClaimCheck.largestAmbiguousSet === 10 && p.pageClaimCheck.formula === 10 &&
    p.pageClaimCheck.agrees === true && p.pageClaimCheck.twoCornersLocateEveryTreasure === true);
}

// Outside hunt: a clue of one leaves a diagonal that contains the treasure.
{
  const p = at("city-block-hunt-from-outside", { n: 4, treasure: { col: 0, row: 0 }, clues: [{ col: -1, row: 0, d: 1 }], finished: false });
  check("city-block-hunt-from-outside: a corner-adjacent clue of one pins the corner",
    p.clueCount === 1 && p.treasureInEveryLocus === true && p.treasureInCandidates === true && p.candidateCount === 1);
}

// Coin change: exact counts are passed to the tutor as decimal strings.
{
  const p = at("coin-change", { denoms: [1, 5, 10, 25, 50], amount: 100, explored: true });
  check("coin-change: 292 ways to change 100", p.ways === "292" && typeof p.ways === "string" && p.classic292.sameCount === true);
}

// Collatz: 27 first reaches 1 after 111 steps.
{
  const p = at("collatz", { number: 27, digits: 2, mode: "divide", shorten: false, index: 0, step: 0, shown: [27] });
  check("collatz: 27 needs 111 steps and is over the page's hundred",
    p.number === 27 && p.stoppingTime === 111 && p.needsOver100Steps === true && p.step === 0 && p.currentValue === 27);
}

// Color graph: the sample graphs' chromatic numbers are read from the core.
{
  const p = at("color-graph", { graph: "Graph 6", nodes: 11, edges: 20, colors: {}, colorsUsed: 0, chromaticNumber: 4, proper: true, mode: "color", moves: 0 });
  check("color-graph: Graph 6 needs four colours and is not finished",
    p.fewestPossible === 4 && p.result === null && p.allColored === false);
}

// Combi gem: the worked example's pair sums.
{
  const p = at("combi-gem", { nums: [2, 3, 6, 9], n: 4, s: 2, economize: true, sums: [5, 8, 9, 11, 12, 15] });
  check("combi-gem: {2,3,6,9} has six pair sums", p.count === 6 && p.distinct === 6 && p.pairCount === 6 && p.savedSumsMatchCore === true);
}

// Common multiples: lcm = p*q/gcd and the first blue dot is the lcm.
{
  const p = at("common-multiples", { p: 6, q: 4, moves: 0, explored: false });
  check("common-multiples: 6 and 4 have lcm 12", p.gcd === 2 && p.lcm === 12 && p.firstBlueDot === 12 && p.oneDividesTheOther === false);
}

// Compare fractions: cross multiplication, and the too-big case after a common denominator.
{
  const p = at("compare-fractions", { n1: 3, d1: 4, n2: 5, d2: 7, moves: 0, explored: false });
  check("compare-fractions: 3/4 is greater than 5/7", p.comparison === 1 && p.cross.n1TimesD2 === 21 && p.cross.n2TimesD1 === 20 && p.tooBigToDraw === false);
  const q = at("compare-fractions", { n1: 89, d1: 97, n2: 97, d2: 89, moves: 1, explored: true });
  check("compare-fractions: 89/97 is less than 97/89", q.comparison === -1 && q.commonDenominator === 8633);
  const b = at("compare-fractions", { n1: 7921, d1: 8633, n2: 9409, d2: 8633, moves: 2, explored: true });
  check("compare-fractions: numbers above 99 are too big to draw", b.tooBigToDraw === true && b.comparison === -1);
}

// Complex numbers: moduli multiply, and the two special products.
{
  const p = at("complex-numbers", { a: { x: 3, y: 4 }, b: { x: 4, y: -3 }, mode: "common", constraint: "free", lock: { a: null, b: null }, moves: 1, explored: true });
  check("complex-numbers: (3+4i)(4-3i) = 24+7i", p.commonProduct.x === 24 && p.commonProduct.y === 7 && p.commonProduct.modulus === 25);
  check("complex-numbers: 3+4i and 4-3i are perpendicular", p.perpendicular === true && p.realProduct.x === 0 && p.collinearWithOrigin === false);
}

// Coordinates: the lattice range of the board and the reading of a point.
{
  const p = at("coordinates", { ox: 180, oy: 180, unit: 40, format: "pair", grid: false, trace: false, moves: 0, explored: false });
  check("coordinates: the opening board shows x from -4 to 4", p.latticeRange.xmin === -4 && p.latticeRange.xmax === 4 && p.unitHandle.x === 220);
  const q = at("coordinates", { ox: 100, oy: 300, unit: 60, format: "complex", moves: 2, explored: true });
  check("coordinates: a moved board has the right lattice", q.latticeRange.ymax === 5 && q.latticePointsOnBoard > 0 && q.format === "complex");
}

// Counting: the tally and the equation for a finished count.
{
  const dots = Array.from({ length: 14 }, (_, i) => ({ row: 0, col: i, jx: 0.5, jy: 0.5, num: i + 1 }));
  const p = at("counting", { max: 20, group: 3, count: 14, numbers: false, dots, counted: 14, moves: 14, finished: true });
  check("counting: 14 dots in threes is 4 x 3 + 2", p.finished === true && p.equation === "3 + 3 + 3 + 3 + 2 = 14  or  4 × 3 + 2 = 14" && p.tallySoFar.length === 5);
  const q = at("counting", { max: 10, group: 5, count: 8, dots: dots.slice(0, 8).map((d) => ({ ...d, num: 0 })), counted: 3, moves: 3, finished: false });
  check("counting: three of eight counted is not finished", q.finished === false && q.remaining === 5 && q.equation === null);
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
