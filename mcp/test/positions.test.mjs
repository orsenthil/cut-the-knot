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
check("gcd-by-factor-tree: a new problem has two numbers", read["gcd-by-factor-tree"]?.n >= 4 && read["gcd-by-factor-tree"].m >= 4 && read["gcd-by-factor-tree"].gcd > 0);
check("gcd-lcm-rectangles: M was changed to 12", read["gcd-lcm-rectangles"]?.m === 12 && read["gcd-lcm-rectangles"].holds === true);
check("gencon-construction: an angle was edited", read["gencon-construction"]?.angles[0] === 120 && read["gencon-construction"].works === true);
check("rouse-ball-fallacy: the congruences hold while the angle stays obtuse", read["rouse-ball-fallacy"]?.congruent === true && read["rouse-ball-fallacy"].angleDAE > 90);
check("archimedes-circumference: the slider changed n to 12", read["archimedes-circumference"]?.n === 12 && read["archimedes-circumference"].squeeze === true);
check("euler-hamilton-paths: a vertex was clicked", read["euler-hamilton-paths"]?.sequence.length === 1 && read["euler-hamilton-paths"].vertices >= 3);
check("huntington-hill-method: the seat stepper was used", read["huntington-hill-method"]?.total === read["huntington-hill-method"]?.seats);
check("hilbert-curve: the order slider changed", read["hilbert-curve"]?.order === 4 && read["hilbert-curve"].grid === 16);
check("hooper-paradox: the width was edited and area conserved", read["hooper-paradox"]?.w === 12 && read["hooper-paradox"].conserved === true);
check("horner-method: x was changed to 3", read["horner-method"]?.t === 3 && read["horner-method"].coefficients.length === 5);
check("iterated-function-systems: Fern was selected", read["iterated-function-systems"]?.system === "Fern" && read["iterated-function-systems"].maps === 4);
check("imo-1986-3: a step was applied", read["imo-1986-3"]?.steps === 1 && read["imo-1986-3"].values.length === 5);
check("indy-clock-hands: the angle was changed", Math.abs((read["indy-clock-hands"]?.alpha || 0) - Math.PI / 2) < 1e-9);
check("infinite-latin-square: the level slider changed", read["infinite-latin-square"]?.level === 4 && read["infinite-latin-square"].side === 16);
check("integer-rectangle: the width was set to 2", read["integer-rectangle"]?.w === 2 && read["integer-rectangle"].balanced === true);
check("interest-rates: investment mode was selected", read["interest-rates"]?.mode === "investment" && read["interest-rates"].accumulated > 0);
check("integer-rectangle-graph: a tiling is saved", read["integer-rectangle-graph"]?.tiles.length === 4 && read["integer-rectangle-graph"].valid === true);
check("robinson-induction: the split was applied", read["robinson-induction"]?.hCount === 2 && read["robinson-induction"].valid === true);
check("winkler-path-proof: the start has a red path", read["winkler-path-proof"]?.pathKind === "red" && read["winkler-path-proof"].valid === true);
check("sums-products-invariant: a pair was merged without changing the invariant", read["sums-products-invariant"]?.remaining === 4 && read["sums-products-invariant"].invariant === read["sums-products-invariant"].initialInvariant);
check("isbn-encoding: a cell was cycled", read["isbn-encoding"]?.symbols.length === 13 && read["isbn-encoding"].valid === false);
check("item-parity: a swap was made", read["item-parity"]?.moves === 1 && read["item-parity"].red === read["item-parity"].blue);
check("item-parity-generalized: five reds were set on top", read["item-parity-generalized"]?.redTop === 5 && read["item-parity-generalized"].equal === true);
check("critical-path-scheduling: four processors were chosen", read["critical-path-scheduling"]?.processors === 4 && read["critical-path-scheduling"].makespan >= read["critical-path-scheduling"].criticalLength);
check("jefferson-apportionment: the seat stepper was used", read["jefferson-apportionment"]?.total === read["jefferson-apportionment"]?.seats);
check("john-sharp-paradox: the sliver was revealed", read["john-sharp-paradox"]?.revealed === true && read["john-sharp-paradox"].discrepancy === 1);
check("johnson-trotter: one step was made", read["johnson-trotter"]?.steps === 1 && read["johnson-trotter"].permutation.length === 4);
check("mandelbrot-julia: a c outside the set was clicked", read["mandelbrot-julia"]?.inMandelbrotSet === false && read["mandelbrot-julia"].escape < read["mandelbrot-julia"].maxIter);
check("kaprekar-routine: the run reached 6174", read["kaprekar-routine"]?.result === 6174 && read["kaprekar-routine"].count > 1);
check("langford-skolem: Skolem mode was selected", read["langford-skolem"]?.kind === "skolem" && read["langford-skolem"].valid === true);
check("langman-paradox: cheat was enabled", read["langman-paradox"]?.cheat === true && Math.abs(read["langman-paradox"].cassini) === 1);
check("latin-squares: a swap broke the Latin property", read["latin-squares"]?.latin === false && read["latin-squares"].moves === 1);
check("lattice-multiplication: a factor was changed", read["lattice-multiplication"]?.a === 123 && read["lattice-multiplication"].product === read["lattice-multiplication"].expected);
check("lcm-algorithm: one step was made", read["lcm-algorithm"]?.steps === 1 && read["lcm-algorithm"].lcm === 30);
check("leibniz-triangle: the Leibniz triangle was selected", read["leibniz-triangle"]?.kind === "leibniz" && read["leibniz-triangle"].symmetric === true);
check("game-of-life: a glider was placed", read["game-of-life"]?.population === 5 && read["game-of-life"].generation === 0);
check("life-like-automaton: HighLife was chosen", read["life-like-automaton"]?.rule === "B36/S23");
check("logistic-model: the growth rate was changed", read["logistic-model"]?.r === 3.5 && read["logistic-model"].period !== null);
check("lone-divider: the default division was solved", read["lone-divider"]?.solved === true && read["lone-divider"].n === 4);
check("long-multiplication: compact was turned off", read["long-multiplication"]?.compact === false && read["long-multiplication"].sum === 17503);
check("other-primes: the x view, with 11 and 13 found by being missing", read["other-primes"]?.view.startsWith("x") && read["other-primes"].primesFoundByMissingNumbers.includes(11) && read["other-primes"].primesFoundByMissingNumbers.includes(13));
check("square-sieve: three steps done, 4 not yet decided correctly", read["square-sieve"]?.stepsDone === 3 && read["square-sieve"].nextStep === 4 && read["square-sieve"].finished === false);
check("euler-product: s = 2 sum and product close to pi^2/6", Math.abs(read["euler-product"]?.zeta - Math.PI ** 2 / 6) < 1e-9 && read["euler-product"].sumOverAllNumbers < read["euler-product"].zeta && read["euler-product"].productOverPrimes < read["euler-product"].zeta);
check("prime-counting: the page saved a range with Li above the true count", read["prime-counting"]?.primesUpToX > 1000 && read["prime-counting"].Li > read["prime-counting"].primesUpToX);
check("zeta-critical-line: the page jumped to the first zero", read["zeta-critical-line"]?.onCriticalLine === true && Math.abs(read["zeta-critical-line"].nearestZeroOnLine - 14.134725) < 1e-4 && read["zeta-critical-line"].distanceFromOrigin < 0.05);
check("prime-waves: ten zeros added", read["prime-waves"]?.zerosUsed === 10 && Math.abs(read["prime-waves"].latestZero - 49.773832) < 1e-5);
check("harmonic-series: the sum is a little under ln n + 1", read["harmonic-series"]?.sum > read["harmonic-series"].oresmeBound && Math.abs(read["harmonic-series"].sum - read["harmonic-series"].lnNPlusGamma) < 0.01);
check("basel-problem: the sum is under pi^2/6 and n x error is below 1", read["basel-problem"]?.sum < Math.PI ** 2 / 6 && read["basel-problem"].nTimesError < 1);
// The Unit Distance path.
check("unit-distance-points: the best four-point arrangement shown, 5 pairs", read["unit-distance-points"]?.points === 4 && read["unit-distance-points"].pairsAtUnitDistance === 5 && read["unit-distance-points"].reachedTheBest === true);
check("two-circles-two-points: the starting dots are too far apart to share a crossing", read["two-circles-two-points"]?.crossings === 0 && read["two-circles-two-points"].pairBoundForN.n === 9 && read["two-circles-two-points"].pairBoundForN.atMost === 20);
check("moser-spindle-colouring: one point painted, no clash, 4 colours possible", read["moser-spindle-colouring"]?.painted === 1 && read["moser-spindle-colouring"].clashes === 0 && read["moser-spindle-colouring"].solved === false && read["moser-spindle-colouring"].possibleWithThisManyColours === true);
check("sums-of-two-squares: the page jumped to the record 65 with 16 dots", read["sums-of-two-squares"]?.n === 65 && read["sums-of-two-squares"].r2 === 16);
check("grid-spacing-dial: the best dial for 16 by 16, 976 pairs", read["grid-spacing-dial"]?.c2 === 25 && read["grid-spacing-dial"].pairs === 976 && read["grid-spacing-dial"].atTheBest === true);
check("unit-distance-growth: the 36 by 36 grid, 7632 pairs", read["unit-distance-growth"]?.n === 1296 && read["unit-distance-growth"].count === 7632);
check("roots-of-unity-lattice: m = 12, r = 3 is ahead of the grid, 1056 against 976", read["roots-of-unity-lattice"]?.points === 256 && read["roots-of-unity-lattice"].unitPairs === 1056 && read["roots-of-unity-lattice"].bestSquareGrid.count === 976 && read["roots-of-unity-lattice"].aheadOfTheGrid === true);
check("no-equilateral-triangles: some triangle is monochromatic-countable and the note says the fewest is 1", typeof read["no-equilateral-triangles"]?.monochromaticTriangles === "number" && read["no-equilateral-triangles"].monochromaticTriangles >= 1);

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

// Counting squares in a square: (N-M+1)^2 places and the square pyramidal total.
{
  const p = at("counting-squares-in-square", { n: 5, m: 2, painted: [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false], pos: { x: 0, y: 0 }, moves: 1, explored: true });
  check("counting-squares-in-square: 2 x 2 squares in a 5 x 5 square have 16 places", p.places === 16 && p.painted === 2 && p.totalOfAllSizes === 55 && p.squareFits === true);
  const q = at("counting-squares-in-square", { n: 3, m: 6, painted: [], pos: { x: 0, y: 0 }, moves: 0, explored: false });
  check("counting-squares-in-square: a square bigger than the grid has no places", q.places === 0 && q.squareFits === false);
}

// Critical path: the page's project has critical path B E H C G of length 38.
{
  const tasks = [
    { name: "A", duration: 3, after: [] }, { name: "B", duration: 4, after: [] }, { name: "C", duration: 2, after: ["A", "H"] },
    { name: "D", duration: 4, after: ["A"] }, { name: "E", duration: 12, after: ["B"] }, { name: "F", duration: 5, after: ["B"] },
    { name: "G", duration: 12, after: ["C"] }, { name: "H", duration: 8, after: ["D", "E"] }, { name: "I", duration: 4, after: ["F"] },
  ];
  const p = at("critical-path", { tasks, endAfter: ["G", "H", "I"], procs: 2, list: "B E A D F I H C G", showCritical: true, scheduled: true, finish: 38, moves: 2, explored: true });
  check("critical-path: the page's critical path is B E H C G, 38 long", p.criticalPath.join("") === "BEHCG" && p.criticalPathLength === 38 && p.valid === true);
  check("critical-path: a finish at the critical path cannot be improved", p.finish === 38 && p.lowerBoundOnFinish === 38 && /cannot be improved/.test(p.note));
  const q = at("critical-path", { tasks: [{ name: "A", duration: 0, after: [] }], procs: 3, list: "", moves: 0, explored: false });
  check("critical-path: a bad duration is reported", q.valid === false && q.problems.length === 1);
}

// Curry's paradox: Fibonacci legs, rectangles one square apart, pieces in place.
{
  const p = at("curry-paradox", { fn: 5, four: false, inner: true, offsets: [{ dx: -8, dy: 10 }, { dx: 5, dy: 5 }], moves: 2, explored: true });
  check("curry-paradox: n = 6 has legs 13 and 5 and rectangles 15 and 16", p.n === 6 && p.triangleLegs[0] === 13 && p.triangleLegs[1] === 5 && p.rectangleBefore.area === 15 && p.rectangleAfter.area === 16 && p.areaDifference === 1);
  check("curry-paradox: both pieces placed", p.allInPlace === true && p.piecesInPlace === 2);
  const q = at("curry-paradox", { fn: 5, four: false, inner: true, offsets: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }], moves: 0, explored: false });
  check("curry-paradox: nothing moved is nothing in place", q.piecesInPlace === 0 && q.allInPlace === false);
}

// Shapes of constant width: the same width in every direction, whatever the angle.
{
  const p = at("cwidth", { angle: 35, mode: "trace", step: 5, seen: ["rotate", "trace"], moves: 8 });
  check("cwidth: the width is the side and the square has side 1", p.widthInEveryDirection === 1 && p.squareSide === 1 && p.angleModulo120 === 35);
  check("cwidth: two of three views seen is not all", p.allViewsSeen === false && p.view === "trace");
  const q = at("cwidth", { angle: 100, mode: "square", step: 10, seen: ["rotate", "trace", "square"], moves: 3 });
  check("cwidth: all views seen; at 100 degrees an arc touches the top and the left", q.allViewsSeen === true && q.touchedByArcs.includes("top") && q.touchedByArcs.includes("left"));
}

// Cycloids: the wheel, its marks and the cusps of a rim mark.
{
  const p = at("cycloids", { kind: "hypo", ratio: 4, r: 30, speed: 1, formula: false, curvesOnly: false, marks: [{ dist: 25, angle: 0, t0: 0, id: 0 }, { dist: 40, angle: 1, t0: 0, id: 1 }, { dist: 12, angle: 2, t0: 0, id: 2 }], time: 120, moves: 5, explored: true });
  check("cycloids: a hypocycloid with R/r = 4 has 4 cusps and a 25 pixel wheel", p.wheel === "hypo" && p.cuspsOfRimMark === 4 && p.wheelRadius === 25 && p.marksOnTheRim === 1 && p.marksOutside === 1 && p.marksInside === 1);
  const q = at("cycloids", { kind: "regular", ratio: 2, r: 30, speed: 0, marks: [], time: 0, moves: 0, explored: false });
  check("cycloids: a regular wheel with no spin", q.wheel === "regular" && q.spinFactor === 0 && q.rollsWithoutSlipping === false && q.marks === 0);
}

// Delian: the construction is exact at the ends and the middle only.
{
  const p = at("delian", { n: 3, moves: 1, explored: true });
  check("delian: N = 3 gives 1.26120 for the cube root of 2, which is 1.25992", p.cubeRootPoint === 1.26119796 || Math.abs(p.cubeRootPoint - 1.2612) < 1e-4);
  check("delian: only the two ends are exact for N = 3", p.pointsExactlyRight === 2 && p.pointsOnAB === 4);
  const q = at("delian", { n: 12, moves: 2, explored: true });
  check("delian: for N = 12 the middle point is exact too", q.pointsExactlyRight === 3 && q.worstPercent < 0.15);
}

// Distance to a line: the formula and the foot of the perpendicular.
{
  const p = at("distance-to-line", { p1: [0, 0], p2: [4, 3], p: [0, 5], normalize: false, levels: false, digits: 2, moves: 1, explored: true });
  check("distance-to-line: from (0,5) to the 3-4-5 line the distance is 4", p.distance === 4 && p.normNormal === 5);
  const q = at("distance-to-line", { p1: [0, 0], p2: [4, 3], p: [2, 1.5], normalize: true, levels: true, digits: 2, moves: 2, explored: true });
  check("distance-to-line: a point on the line is at distance 0 and the equation is normalized", q.distance === 0 && q.equationNormalized === true);
}

// Distributive law: a cut rewrites a product as a sum.
{
  const tree = { x: 0, y: 0, w: 5, h: 4, first: { x: 0, y: 0, w: 2, h: 4, first: null, second: null }, second: { x: 2, y: 0, w: 3, h: 4, first: null, second: null } };
  const p = at("distributive-law", { nx: 5, ny: 4, tree, parentheses: false, history: ["4*2+4*3", "4*5"], moves: 1, explored: true });
  check("distributive-law: 4*5 cut after two columns reads 4*2+4*3", p.written === "4*2+4*3" && p.value === 20 && p.pieces === 2 && p.cutsToGo === 18 && p.finished === false);
}

// Divisibility: rows and columns as integers.
{
  const p = at("divisibility", { rows: 2, cols: 3, p: 3, digits: [[1, 2, 3], [4, 5, 6]], moves: 1, explored: true });
  check("divisibility: 123, 456 and 14, 25, 36 with p = 3: three are divisible", p.divisibleCount === 3 && p.total === 5 && p.primeTo10 === true && p.exactlyOneLeftOver === false);
  const q = at("divisibility", { rows: 2, cols: 2, p: 2, digits: [[0, 1], [0, 0]], moves: 3, explored: true });
  check("divisibility: with p = 2 one odd number can be left over, since 2 is not prime to 10", q.exactlyOneLeftOver === true && q.primeTo10 === false);
}

// EAN-13: the check digit and the parity pattern of the left digits.
{
  const p = at("ean13", { digits: [9, 7, 8, 0, 1, 4, 2, 0, 0, 0, 5, 7, 1], moves: 3, explored: true });
  check("ean13: 9780142000571 is valid, a Bookland code with parity LGGLGL", p.valid === true && p.isBookland === true && p.leftParity === "LGGLGL" && p.checkDigit === 1);
  const q = at("ean13", { digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2], moves: 0, explored: false });
  check("ean13: the opening code 0123456789012 is a UPC-A with all left digits L", q.valid === true && q.isUpcA === true && q.leftParity === "LLLLLL");
}

// Egyptian multiplication: the chosen powers are the 1-bits of a.
{
  const p = at("egyptian-multiplication", { digits: 2, a: 85, b: 18, autonomous: true, binary: false, moves: 2, explored: true });
  check("egyptian-multiplication: 85 x 18 = 1530 from 64 + 16 + 4 + 1", p.product === 1530 && p.chosenPowers.join() === "1,4,16,64" && p.rows === 7 && p.binaryOfA === "1010101");
}

// Ambassadors at a round table: the page's condition and the enemy neighbours.
{
  const p = at("enemy-ambassadors", { n: 6, enemies: [[0, 1], [1, 2], [3, 4]], seat: [0, 1, 2, 3, 4, 5], selected: -1, moves: 0 });
  check("enemy-ambassadors: three enemy pairs sit side by side, and nobody has more than n-1 = 2 enemies", p.enemyNeighbourPairs === 3 && p.conditionHolds === true && p.solved === false && p.hintAvailable === true && p.mostEnemies === 2);
  const q = at("enemy-ambassadors", { n: 6, enemies: [[0, 2], [0, 4], [1, 3]], seat: [0, 1, 2, 3, 4, 5], selected: 2, moves: 1 });
  check("enemy-ambassadors: nobody next to an enemy is solved", q.solved === true && q.selectedPlace === 2);
}

// Equilateral Fibonacci: the trapezoids and their consecutive Fibonacci triples.
{
  const p = at("equilateral-fibonacci", { n: 55, moves: 1, explored: true });
  check("equilateral-fibonacci: N = 55 holds 9 shapes whose last trapezoid is 13, 21, 34 ending on row 55", p.shapes === 9 && p.trapezoids === 7 && p.lastTrapezoid.top === 13 && p.lastTrapezoid.leg === 21 && p.lastTrapezoid.base === 34 && p.lastTrapezoid.endsOnRow === 55);
}

// Euclid's game (typed numbers): N/gcd numbers end up on the board.
{
  const p = at("euclid-alg", { n1: 85, n2: 18, board: [18, 85], total: 85, turn: "you", started: false, last: null, moves: 0, message: "" });
  check("euclid-alg: from 85 and 18 the gcd is 1, 85 numbers end up on the board, 83 moves, so the first player wins", p.gcd === 1 && p.willEndWith === 85 && p.movesInTheWholeGame === 83 && p.firstPlayerWins === true && p.movesLeft === 83 && p.over === false);
  const q = at("euclid-alg", { n1: 18, n2: 12, board: [6, 12, 18], total: 3, turn: "you", started: true, last: "computer", moves: 1, message: "It's now over, I won" });
  check("euclid-alg: 18 and 12 end with 6, 12, 18 and the game is over", q.over === true && q.gcd === 6 && q.movesInTheWholeGame === 1);
}

// Euclid's algorithm: the steps and the gcd.
{
  const p = at("euclid-algorithm", { digits: 2, a: 85, b: 18, autonomous: true, moves: 1, explored: true });
  check("euclid-algorithm: 85 and 18 take 6 steps and have gcd 1", p.gcd === 1 && p.steps === 6 && p.coprime === true);
  const q = at("euclid-algorithm", { digits: 2, a: 89, b: 55, autonomous: true, moves: 2, explored: true });
  check("euclid-algorithm: the Fibonacci pair 89 and 55 takes 9 steps", q.steps === 9 && q.gcd === 1);
}

// Factorization: gcd and lcm from the exponents.
{
  const p = at("factorization", { t1: "360", t2: "84", n1: 360, n2: 84, brief: true, computed: true, moves: 1 });
  check("factorization: 360 and 84 have gcd 12 and lcm 2520, sharing 2 and 3", p.gcd === "12" && p.lcm === "2520" && p.coprime === false && p.sharedPrimes.join() === "2,3" && p.computed === true);
  const q = at("factorization", { t1: "1", t2: "97", n1: 1, n2: 97, brief: false, computed: true, moves: 2 });
  check("factorization: 1 and 97 are coprime with lcm 97", q.gcd === "1" && q.lcm === "97" && q.coprime === true && q.format === "long");
}

// Farey series: neighbours and the mediant.
{
  const p = at("farey", { n: 7, lines: true, oneHalf: true, selected: 9, moves: 3, explored: true });
  check("farey: in F(7) the tenth term is 1/2, between 3/7 and 4/7, and the mediant of its neighbours", p.terms === 19 && p.selected === "1/2" && p.neighbours.join() === "3/7,4/7" && p.selectedIsMediantOfNeighbours === true);
  const q = at("farey", { n: 5, lines: false, oneHalf: false, selected: -1, moves: 0, explored: false });
  check("farey: F(5) has 11 terms and nothing is selected", q.terms === 11 && q.selected === null);
}

// Fraction comparison sped up: is the middle fraction between the pair?
{
  const p = at("fc-exercise", { n1: 7, d1: 12, n2: 4, d2: 9, n0: 1, d0: 2, problems: 3, solved: 2, checked: true, response: "Correct!", seed: 5, moves: 4 });
  check("fc-exercise: 1/2 is between 7/12 and 4/9, and the larger of the pair is 7/12", p.middleIsBetween === true && p.larger === "7/12" && p.signsIfChecked === "> >" && p.correctAnswers === 2);
  const q = at("fc-exercise", { n1: 3, d1: 5, n2: 7, d2: 8, n0: 9, d0: 6, problems: 1, solved: 0, checked: false, response: "", seed: 1, moves: 0 });
  check("fc-exercise: 9/6 is outside 3/5 and 7/8", q.middleIsBetween === false && q.larger === "7/8");
}

// A faulty dissection: the pieces in the rectangle.
{
  const p = at("fibonacci-cheat", { honest: true, pieces: [{ id: 0, f: 1, placed: true }, { id: 1, f: 1, placed: true }, { id: 2, f: 1, placed: true }, { id: 3, f: 1, placed: true }], moves: 4, explored: true });
  check("fibonacci-cheat: all four pieces placed with the honest shapes shows the gap", p.allPlaced === true && p.piecesInTheRectangle === 4 && p.showingHonestPieces === true && /gap of 1 cell/.test(p.visibleAreaIfAllPlaced));
  const q = at("fibonacci-cheat", { honest: false, pieces: [{ id: 0, f: 0, placed: false }, { id: 1, f: 0.4, placed: false }, { id: 2, f: 1, placed: true }, { id: 3, f: 0, placed: false }], moves: 2, explored: false });
  check("fibonacci-cheat: one piece in the rectangle", q.piecesInTheRectangle === 1 && q.which.join() === "2" && q.allPlaced === false);
}

// Fif: the numbers each side holds, and the winner.
{
  const p = at("fif", { white: 0, black: 0, first: false, finished: false, whiteWins: 0, blackWins: 0, announce: "", rng: 1, moves: 0 });
  check("fif: an empty board has nine free numbers and the computer would open on 5", p.free.length === 9 && p.winner === null && p.computerWouldPlay === 5);
  // numbers 2 and 4 (cells 2 and 4 of the applet's bit order are number 2 and 5; build from the numbers through the core's own mapping)
  const bit = (n) => 1 << [3, 8, 1, 2, 4, 6, 7, 0, 5].indexOf(n - 1);
  const q = at("fif", { white: bit(1) | bit(5) | bit(9), black: bit(2) | bit(4), first: true, finished: true, whiteWins: 1, blackWins: 0, announce: "I won! It's now 1:0", rng: 1, moves: 3 });
  check("fif: the computer holding 1, 5 and 9 has won", q.winner === "computer" && q.computerHolds.join() === "1,5,9" && q.youHold.join() === "2,4" && q.score.computer === 1 && q.computerMovesFirst === true);
  const r = at("fif", { white: bit(1) | bit(7), black: bit(2) | bit(4), first: false, finished: false, whiteWins: 0, blackWins: 0, announce: "", rng: 1, moves: 2 });
  check("fif: against 2 and 4 the computer holding 1 and 7 would block at 9", r.computerWouldPlay === 9 && r.winner === null);
}

// Figurate numbers: the sum of a shape of the multiplication table.
{
  const p = at("figurate", { mode: "tetrahedral", n: 5, moves: 3, explored: true });
  check("figurate: the anti-diagonal for n = 5 holds 5 cells summing to 35 = 5*6*7/6", p.litCells === 5 && p.sum === 35 && p.shape === "tetrahedral");
  const q = at("figurate", { mode: "cubes", n: 7, moves: 1, explored: true });
  check("figurate: the gnomon of 7 sums to 7 cubed = 343", q.litCells === 13 && q.sum === 343);
}

// Filling a grid with good neighbours: the chips and what they would fill.
{
  const g = [0, 1, 2, 3].map((x) => [0, 1, 2, 3].map((y) => (x === y ? 0 : -1)));
  const p = at("fill-the-board", { n: 4, grid: g, step: 0, playing: false, moves: 4, explored: false });
  check("fill-the-board: four chips on the diagonal of a 4 by 4 board would fill it in 3 steps", p.chips === 4 && p.chipsFromTheseWouldFill === true && p.stepsFromTheChipsAlone === 3 && p.mode === "setup" && p.full === false && p.fewestChipsPossible === 4);
  const h = [0, 1, 2, 3].map((x) => [0, 1, 2, 3].map((y) => (x === 0 && y === 0 ? 0 : -1)));
  const q = at("fill-the-board", { n: 4, grid: h, step: 1, playing: true, moves: 3, explored: true });
  check("fill-the-board: one chip fills nothing", q.chips === 1 && q.chipsFromTheseWouldFill === false && q.mode === "play");
}

// Heads and tails: the counts of the three kinds of corner.
{
  const p = at("first-proof", { n: 3, direct: [true, false, true], hint: true, moves: 1, explored: true });
  check("first-proof: three pins with one turned round give one corner of each kind", p.HH === 1 && p.HT === 1 && p.TT === 1 && p.allThreeKindsPresent === true && p.HHequalsTT === true);
  const q = at("first-proof", { n: 6, direct: [true, true, false, false, true, true], hint: false, moves: 2, explored: true });
  check("first-proof: six pins, HH = TT = 1 and HT = 4", q.HH === 1 && q.TT === 1 && q.HT === 4 && q.HHequalsTT === true && q.allCornersAlike === false);
}

// The Josephus Flavius game: the safe place and when you would be removed.
{
  const p = at("flavius", { n: 41, k: 3, status: Array(41).fill(0), hits: 0, counter: -1, finished: false, selected: 30, order: [], moves: 1, explored: false });
  check("flavius: with 41 people and every third removed, place 31 (index 30) is the safe place and you would survive", p.safePlaceFromTop === 31 && p.youWouldSurvive === true && p.yourPlaceFromTop === 31 && p.youAreRemovedNumber === null);
  const q = at("flavius", { n: 10, k: 3, status: Array(10).fill(0), hits: 0, counter: -1, finished: false, selected: 2, order: [], moves: 1, explored: false });
  check("flavius: with 10 people and every third, the third place goes first", q.youWouldSurvive === false && q.youAreRemovedNumber === 1 && q.safePlaceFromTop === 4);
}

// Flipping items simultaneously II: the ring and whether the target can be reached.
{
  const blue = Array(12).fill(false); blue[11] = true;
  const p = at("flip-them-ii", { n: 12, m: 3, blue, helper: true, moves: 0, explored: false });
  check("flip-them-ii: the start of the 12-ring with M = 3 cannot reach the target, and one blue marked circle remains odd", p.puzzleSolvableFromTheStart === false && p.mDividesN === true && p.blueMarkedCircles === 1 && p.solved === false && p.blueCircles.join() === "12");
  const b2 = Array(7).fill(false); b2[0] = true;
  const q = at("flip-them-ii", { n: 7, m: 3, blue: b2, helper: false, moves: 4, explored: true });
  check("flip-them-ii: N = 7, M = 3 is solvable, and with only circle 1 blue it is solved", q.puzzleSolvableFromTheStart === true && q.solved === true && q.mDividesN === false);
}

// Flipping items simultaneously III: the fewest clicks.
{
  const blue = Array(12).fill(false), clicks = Array(12).fill(0);
  for (const i of [0, 3, 6, 9]) { clicks[i] = 1; for (const j of [i, i + 1, i + 2]) blue[j % 12] = !blue[j % 12]; }
  const p = at("flip-them-iii", { n: 12, m: 3, blue, clicks, moves: 4, explored: true });
  check("flip-them-iii: 12 circles, 3 at a time: four clicks make all blue, which is the fewest (12/3)", p.allBlue === true && p.clicksSoFar === 4 && p.fewestPossible === 4 && p.atTheFewest === true && p.solvable === true);
  const q = at("flip-them-iii", { n: 12, m: 8, blue: Array(12).fill(false), clicks: Array(12).fill(0), moves: 0, explored: false });
  check("flip-them-iii: 12 circles, 8 at a time: gcd 4, M1 = 2 is even: it cannot be done", q.solvable === false && q.fewestPossible === null && q.gcd === 4 && q.M1 === 2);
}

// Fourth degree polynomials: inflection points and the line through them.
{
  const p = at("fourth-degree", { c: [0, 1, -6, 0, 1], showGraph: true, showLine: true, showDiff: false, moves: 1, explored: true });
  check("fourth-degree: x^4 - 6x^2 + x has inflection points -1 and 1 and meets its line at +-sqrt 5", p.hasTwoInflectionPoints === true && p.inflectionPoints.join() === "-1,1" && Math.abs(p.otherCrossings[1] - 2.236068) < 1e-5);
  const q = at("fourth-degree", { c: [0, 0, 1, 0, 1], showGraph: true, showLine: true, showDiff: true, moves: 0, explored: false });
  check("fourth-degree: x^4 + x^2 has no inflection points", q.hasTwoInflectionPoints === false && q.inflectionPoints === null);
}

// Compare fractions practice: the pair, the right sign and the answer given.
{
  const p = at("fraction-comparison-exercise", { n1: 7, d1: 12, n2: 4, d2: 9, problems: 2, solved: 1, answered: 2, graphics: true, common: false, seed: 4, moves: 1 });
  check("fraction-comparison-exercise: 7/12 is more than 4/9 and the answer > was right", p.correctSign === ">" && p.wasRight === true && p.answered === ">" && p.correctAnswers === 1);
  const q = at("fraction-comparison-exercise", { n1: 2, d1: 4, n2: 3, d2: 6, problems: 1, solved: 0, answered: -1, graphics: false, common: false, seed: 1, moves: 0 });
  check("fraction-comparison-exercise: 2/4 and 3/6 are equal and nothing is answered yet", q.correctSign === "=" && q.answered === null && q.wasRight === null);
}

// The Futurama game: cycles of the mix-up and the swaps made.
{
  const p = at("futurama", { n: 3, perm: [1, 2, 0, 3, 4], usedX: [], usedY: [], stack: [], message: "", moves: 0, explored: false });
  check("futurama: a 3-cycle mix-up is one cycle A B C, nothing swapped, not solved", p.cycles.length === 1 && p.cycles[0].join("") === "ABC" && p.solved === false && p.mindsAtHome === 0);
  const q = at("futurama", { n: 3, perm: [0, 1, 2, 3, 4], usedX: [0], usedY: [], stack: [[0, 3]], message: "Fantasic!", moves: 2, explored: true });
  check("futurama: all minds home is solved, and the swap with X is remembered", q.solved === true && q.usedWithX.join() === "A" && q.swapsMade.join() === "AX" && q.mindsAtHome === 3);
}

// GCD and LCM via factor trees.
{
  const board = at("gcd-by-factor-tree", { n: 20, m: 350 });
  check("gcd-by-factor-tree: gcd 10, lcm 700 and the identity holds",
    board.gcd === 10 && board.lcm === 700 && board.n * board.m === board.gcd * board.lcm);
}

// GCD x LCM rectangles.
{
  const board = at("gcd-lcm-rectangles", { m: 12, n: 10 });
  check("gcd-lcm-rectangles: gcd 2, lcm 60 and the identity holds", board.gcd === 2 && board.lcm === 60 && board.holds === true);
}

// General polygon construction.
{
  const board = at("gencon-construction", { points: [{ x: 100, y: 300 }, { x: 320, y: 300 }, { x: 200, y: 110 }], angles: [90, 90, 90] });
  check("gencon-construction: three centres and 90 degree angles close a triangle", board.works === true && board.totalAngle === 270);
}

// Rouse Ball's fallacy.
{
  const board = at("rouse-ball-fallacy", {});
  check("rouse-ball-fallacy: angle ADC is right and DAE is obtuse", board.angleADC === 90 && board.angleDAE > 90 && board.congruent === true);
}

// Estimating circumference.
{
  const board = at("archimedes-circumference", { n: 96, radius: 1 });
  check("archimedes-circumference: 96 sides squeeze 2 pi tightly", board.squeeze === true && board.gap < 0.01);
}

// Euler and Hamilton paths.
{
  const board = at("euler-hamilton-paths", { graph: 0, mode: "euler", sequence: [0] });
  check("euler-hamilton-paths: a triangle has 3 vertices and 3 edges", board.vertices === 3 && board.edges === 3);
}

// Huntington-Hill apportionment.
{
  const board = at("huntington-hill-method", { seats: 23, populations: [100, 200, 300] });
  check("huntington-hill-method: 23 seats are allocated", board.total === 23 && board.final.length === 3);
}

// Hilbert and Moore curves.
{
  const board = at("hilbert-curve", { order: 3, kind: "hilbert" });
  check("hilbert-curve: order 3 visits 64 cells", board.grid === 8 && board.count === 64);
}

// Hooper's paradox: area conservation.
{
  const board = at("hooper-paradox", { w: 10, h: 3, a: 4 });
  check("hooper-paradox: the pieces cover 30 square units", board.originalArea === 30 && board.pieceTotal === 30 && board.conserved === true);
}

// Horner's method.
{
  const board = at("horner-method", { coefficients: [2, -3, 0, 1, 7], t: 2 });
  check("horner-method: the page example gives 17 and derivative 29", board.value === 17 && board.derivative === 29);
}

// Iterated function systems.
{
  const board = at("iterated-function-systems", { system: "Sierpinski gasket" });
  check("iterated-function-systems: the gasket has three contracting maps", board.maps === 3 && board.scales.every((s) => s <= 1));
}

// IMO 1986 problem 3.
{
  const board = at("imo-1986-3", { values: [4, -3, 2, -1, 5], steps: 0 });
  check("imo-1986-3: the start has potential 106", board.potential === 106 && board.negatives.length === 2);
}

// Indy's clock hands.
{
  const board = at("indy-clock-hands", { alpha: Math.PI / 3, red: Math.PI / 2 });
  check("indy-clock-hands: both hands have the red fraction", Math.abs(board.redFraction - 0.25) < 1e-9);
}

// Infinite Latin squares.
{
  const board = at("infinite-latin-square", { level: 3 });
  check("infinite-latin-square: the 8 by 8 corner is Latin", board.side === 8 && board.latin === true);
}

// Rectangle on a chessboard.
{
  const board = at("integer-rectangle", { x: 0.5, y: 0.5, w: 2, h: 1.5 });
  check("integer-rectangle: an even width balances", board.balanced === true && board.light === board.dark);
}

// Interest rates: the page's compounding table.
{
  const board = at("interest-rates", { principal: 1000, deposit: 0, depositsPerYear: 2, interest: 12, years: 1, mode: "investment" });
  check("interest-rates: 1000 at 12% twice a year is 1123.60", board.accumulated === 1123.6);
}

// Integer rectangles: both proofs on Winkler's tiling.
{
  const board = at("integer-rectangle-graph", { tiles: [
    { x: 0, y: 0, w: 1, h: 0.7, kind: "H" },
    { x: 0, y: 0.7, w: 1, h: 1.3, kind: "H" },
    { x: 1, y: 0, w: 1.5, h: 1, kind: "V" },
    { x: 1, y: 1, w: 1.5, h: 1, kind: "V" },
  ], step: 1, ambient: { x: 0, y: 0, w: 2.5, h: 2 } });
  check("integer-rectangle-graph: the graph trail ends at a special corner", board.endIsCorner === true && board.endSpecial === true && board.counting.S1 === 2);
}

// Robinson's induction.
{
  const board = at("robinson-induction", {});
  check("robinson-induction: Winkler's tiling has two H-tiles and two V-tiles", board.hCount === 2 && board.vCount === 2 && board.ambientSpecial === true);
}

// Winkler's path proof.
{
  const board = at("winkler-path-proof", {});
  check("winkler-path-proof: the red path has height 2", board.pathKind === "red" && board.sum === 2);
}

// Sums and products invariant.
{
  const board = at("sums-products-invariant", { values: [1, 2, 3, 4, 5, 6], count: 6, max: 6 });
  check("sums-products-invariant: 1..6 predicts 5039", board.invariant === 5039 && board.initialInvariant === 5039);
}

// ISBN encoding.
{
  const board = at("isbn-encoding", { symbols: ["0", "-", "3", "0", "6", "-", "4", "0", "6", "1", "5", "-", "2"] });
  check("isbn-encoding: 0-306-40615-2 is valid", board.valid === true && board.checkDigit === "2");
}

// Two colors in two rows.
{
  const board = at("item-parity", { cols: 4, rows: [["R", "R", "B", "B"], ["R", "B", "B", "R"]] });
  check("item-parity: the two rows have one joint of each colour", board.red === 1 && board.blue === 1 && board.equal === true);
}

// Generalized two-row parity with an odd row length.
{
  const board = at("item-parity-generalized", { cols: 7, rows: [
    ["R", "R", "R", "B", "B", "B", "B"],
    ["R", "R", "R", "R", "B", "B", "B"],
  ] });
  check("item-parity-generalized: an odd setup still balances", board.setupValid === true && board.equal === true);
}

// Scheduling and critical path.
{
  const board = at("critical-path-scheduling", { preset: "merge", processors: 2, priority: ["A", "B", "C"] });
  check("critical-path-scheduling: the merge path is 7", board.criticalLength === 7 && board.criticalPath.join("-") === "Start-A-C-End");
}

// Jefferson's apportionment.
{
  const board = at("jefferson-apportionment", { seats: 23, populations: [100, 200, 300] });
  check("jefferson-apportionment: 23 seats are allocated", board.total === 23 && board.final.length === 3);
}

// John Sharp's paradox.
{
  const board = at("john-sharp-paradox", { n: 7 });
  check("john-sharp-paradox: 169 to 168 differs by one", board.squareArea === 169 && board.rectangleArea === 168 && board.discrepancy === 1);
}

// Johnson–Trotter permutations.
{
  const board = at("johnson-trotter", { n: 3 });
  check("johnson-trotter: the first permutation is all left", board.permutation.join(",") === "1,2,3" && board.directions.every((d) => d === -1));
}

// Mandelbrot and Julia sets.
{
  const board = at("mandelbrot-julia", { c: { re: 0, im: 0 }, maxIter: 48 });
  check("mandelbrot-julia: c = 0 is in the set", board.inMandelbrotSet === true && board.escape === 48);
}

// Kaprekar's routine.
{
  const board = at("kaprekar-routine", { start: 6174, base: 10, width: 4, padded: true });
  check("kaprekar-routine: 6174 is a fixed point", board.result === 6174 && board.count === 1);
}

// Langford and Skolem sequences.
{
  const board = at("langford-skolem", { N: 4, D: 1, M: 2, H: 0, kind: "langford" });
  check("langford-skolem: n=4 has the classic solution", board.text === "41312432" && board.valid === true);
}

// Langman's paradox.
{
  const board = at("langman-paradox", { n: 6, cheat: false });
  check("langman-paradox: 64 to 65 differs by one", board.squareArea === 64 && board.rectangleArea === 65 && board.cassini === -1);
}

// Latin squares.
{
  const board = at("latin-squares", { size: 4, symmetric: true, grid: [[1, 2, 3, 4], [2, 3, 4, 1], [3, 4, 1, 2], [4, 1, 2, 3]] });
  check("latin-squares: the cyclic square solves both modes", board.latin === true && board.symmetricGrid === true && board.solved === true);
}

// Lattice multiplication.
{
  const board = at("lattice-multiplication", { a: 712, b: 23 });
  check("lattice-multiplication: the page's 712 by 23 example", board.product === 16376 && board.needsCarry === false);
}

// LCM algorithm.
{
  const board = at("lcm-algorithm", { originals: [6, 10, 15], values: [6, 10, 15], steps: 0 });
  check("lcm-algorithm: the target is 30", board.lcm === 30 && board.finished === false);
}

// Leibniz and Pascal triangles.
{
  const board = at("leibniz-triangle", { rows: 8, mod: 5, kind: "pascal" });
  check("leibniz-triangle: Pascal row sums are powers of two", board.rowSums[4] === 16 && board.symmetric === true);
}

// Conway's Life.
{
  const board = at("game-of-life", { size: 5, generation: 2, population: 1, encoded: "00000/01000/00000/00000/00000" });
  check("game-of-life: generation and population are read", board.generation === 2 && board.population === 1);
}

// Life-like automata.
{
  const board = at("life-like-automaton", { preset: "conway", birth: [3], survival: [2, 3] });
  check("life-like-automaton: Conway's rule is B3/S23", board.rule === "B3/S23");
}

// Logistic model.
{
  const board = at("logistic-model", { r: 3.2, p0: 0.25, iterations: 200 });
  check("logistic-model: r = 3.2 has period two", board.period === 2 && board.inInterval === true);
}

// Lone divider.
{
  const board = at("lone-divider", { n: 4, table: [[true, false, true, false], [false, true, false, true], [false, false, true, true]] });
  check("lone-divider: three choosers get pieces", board.solved === true && Object.keys(board.assignments).length === 3);
}

// Long multiplication.
{
  const board = at("long-multiplication", { a: 23, b: 761, compact: true });
  check("long-multiplication: the page's example gives 17503", board.sum === 17503 && board.correct === true);
}

// The Riemann Hypothesis path.
{
  const t = at("other-primes", { dim: 10, showX: false });
  check("other-primes: the odd primes up to 21 are the numbers missing from a 10x10 table", [3, 5, 7, 11, 13, 17, 19].every((p) => t.primesFoundByMissingNumbers.includes(p)) && !t.primesFoundByMissingNumbers.includes(9) && !t.primesFoundByMissingNumbers.includes(21));
  const q = at("square-sieve", { n: 50, next: 51, red: [] });
  check("square-sieve: all steps done leaves the squares red", q.finished === true && q.red.join() === "1,4,9,16,25,36,49");
  const e = at("euler-product", { s: 1, n: 100 });
  check("euler-product: s = 1 has no limit", e.zeta === null && e.gapSum === null);
  const p = at("prime-counting", { x: 1000000, view: "error" });
  check("prime-counting: 78498 primes up to a million, inside the hypothesis band", p.primesUpToX === 78498 && p.errorWithinHypothesisBand === true && p.view === "error");
  const z = at("zeta-critical-line", { sigma: 0.5, t: 50 });
  check("zeta-critical-line: 10 zeros below t = 50 are counted", z.zerosBelowT === 10 && Math.abs(z.nearestZeroOnLine - 49.773832) < 1e-4);
  const w0 = at("prime-waves", { k: 0, x: 60, flat: false }), w100 = at("prime-waves", { k: 100, x: 60, flat: false });
  check("prime-waves: 100 zeros fit the staircase far better than none", w100.meanErrorAgainstTrueCount < w0.meanErrorAgainstTrueCount / 3);
  const h = at("harmonic-series", { n: 1000000 });
  check("harmonic-series: a million terms give 14.39", Math.abs(h.sum - 14.3927267) < 1e-6);
  const b = at("basel-problem", { n: 100 });
  check("basel-problem: the corrected sum is far closer than the plain one", Math.abs(b.correctedError) < Math.abs(b.error) / 1000);
// The Unit Distance path, on positions built here.
{
  const u = at("unit-distance-points", { n: 3, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: Math.sqrt(3) / 2 }] });
  check("unit-distance-points: a unit triangle has 3 pairs, the most for 3 points", u.pairsAtUnitDistance === 3 && u.mostPossible === 3 && u.reachedTheBest === true);
  const u2 = at("unit-distance-points", { n: 3, points: [{ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: 2 }] });
  check("unit-distance-points: points not 1 apart have none", u2.pairsAtUnitDistance === 0 && u2.reachedTheBest === false);
  const t = at("two-circles-two-points", { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, crossings: 2, n: 100 });
  check("two-circles-two-points: unit-apart centres cross twice; 100 points allow at most 729", t.crossings === 2 && t.pairBoundForN.atMost === 729);
  const m = at("moser-spindle-colouring", { k: 3, colours: [0, 1, 2, 0, 0, 1, 2], clashes: 0 });
  check("moser-spindle-colouring: 3 colours are impossible, this try has clashes", m.possibleWithThisManyColours === false && m.solved === false);
  const m4 = at("moser-spindle-colouring", { k: 4, colours: cores["moser-spindle-colouring"].MoserCore.solve(4), clashes: 0 });
  check("moser-spindle-colouring: a full proper 4-colouring is solved", m4.solved === true && m4.clashes === 0);
  const s2 = at("sums-of-two-squares", { n: 1105, r2: 32, ways: [] });
  check("sums-of-two-squares: 1105 has 32 dots", s2.r2 === 32 && s2.factorisation.length === 3);
  const g = at("grid-spacing-dial", { k: 16, c2: 65 });
  check("grid-spacing-dial: c2 = 65 gives 912, not the best", g.pairs === 912 && g.atTheBest === false && g.best.c2 === 25);
  const gr = at("unit-distance-growth", { k: 64 });
  check("unit-distance-growth: 64 by 64 is 33080 pairs, under the ceiling", gr.count === 33080 && gr.count < gr.provedCeiling);
  const r = at("roots-of-unity-lattice", { m: 12, r: 4 });
  check("roots-of-unity-lattice: m = 12, r = 4 is behind the grid", r.unitPairs === 2800 && r.aheadOfTheGrid === false);
  const e = at("no-equilateral-triangles", { colours: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  check("no-equilateral-triangles: one colour makes all 15 monochromatic", e.monochromaticTriangles === 15);
}
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
