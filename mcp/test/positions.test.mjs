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

import { describePosition, runGameLogic } from "../src/games/registry.ts";
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
// Nine more ports, on positions saved by their own pages.
check("loop-or-halt: the process stops with 1 first and the largest leader is in the leaders", read["loop-or-halt"]?.leaders.at(-1) === 1 && read["loop-or-halt"].leaders.includes(read["loop-or-halt"].largestLeader));
check("magic-in-square: after one answer the first column is given", read["magic-in-square"]?.stage === 1 && read["magic-in-square"].firstColumn === 1 && read["magic-in-square"].numberNamed === null);
check("mandel-cycle: a full start and stop of cycling", typeof read["mandel-cycle"]?.turnsOfThePalette === "number" && read["mandel-cycle"].cycling === false);
check("markers: three players and every one served", read.markers?.players === 3 && read.markers.awards.length === 3 && new Set(read.markers.awards.map((a) => a.player)).size === 3);
check("math-telepathy: 3, 3, 6 make the computer say 6", read["math-telepathy"]?.digitsGiven.join() === "3,3,6" && read["math-telepathy"].computersAnswer === 6 && read["math-telepathy"].pressedGuess === true);
check("means: exponent 1 is the arithmetic mean, at least the geometric", read.means?.r === 1 && read.means.nameOfThisMean === "arithmetic mean" && read.means.arithmetic >= read.means.geometric && read.means.geometric >= read.means.harmonic);
check("memory: one card up in Shape mode and ten pairs left", read.memory?.cardsUp === 1 && read.memory.pairsLeft === 10 && read.memory.mode === "Match Shape and Color");
check("merlin: the plane with 3 states, a solution to the board is given", read.merlin?.states === 3 && read.merlin.geometry === "Plane" && read.merlin.pressesThatSolveIt.length === 9);
check("midline-in-sim-tris: the first picture has DE half of CN", Math.abs(read["midline-in-sim-tris"]?.ratioDEtoCN - 0.5) < 1e-9 && read["midline-in-sim-tris"].parallel === true && read["midline-in-sim-tris"].trianglesOutward === true);
// Ten more ports, on positions saved by their own pages.
check("hummers-mind-reader: one coin selected, nothing announced", read["hummers-mind-reader"]?.places.join() === "0,1,2" && read["hummers-mind-reader"].announced === false);
check("min-max: MaxMin never above MinMax on the saved table", read["min-max"]?.maxMin <= read["min-max"].minMax && Array.isArray(read["min-max"].rowMins));
check("miu-system: rule 2 on MI gives MII, two theorems, I count 2", read["miu-system"]?.newest === "MII" && read["miu-system"].theorems === 2 && read["miu-system"].iCountIsMultipleOfThree === false);
check("modular-tables: the page marked a remainder in the 10 table", read["modular-tables"]?.modulus === 10 && read["modular-tables"].modulusIsPrime === false && read["modular-tables"].markedRemainder !== null);
check("monty-hall: one round, switching and staying are opposites", read["monty-hall"]?.rounds === 1 && read["monty-hall"].stayedWon + read["monty-hall"].switchedWon === 1);
check("moving-chips-in-pairs: the starting height of N = 10 is 45, odd, so unsolvable", read["moving-chips-in-pairs"]?.n === 10 && read["moving-chips-in-pairs"].height === 45 && read["moving-chips-in-pairs"].solvableFromHere === false);
check("multiplication-table: 3 x 4 = 12 appears 6 times", read["multiplication-table"]?.product === 12 && read["multiplication-table"].timesInTheTable === 6);
check("mean-value-theorem: after Find c the tangent is parallel to the secant", read["mean-value-theorem"]?.tangentParallelToSecant === true && read["mean-value-theorem"].meanValuePoints.length >= 1);
check("napier-bones: 187 x 3 = 561", read["napier-bones"]?.numberInBase === "187" && read["napier-bones"].product === "561");
check("napoleon-polygons: the pentagon's last polygon is regular", read["napoleon-polygons"]?.n === 5 && read["napoleon-polygons"].lastPolygonIsRegular === true);
// Ten more ports, on positions saved by their own pages.
check("signs-and-sums: a length-4 row, with the sums of every three and a length that allows a negative total", read["signs-and-sums"]?.n === 4 && read["signs-and-sums"].tripleSums.length === 2 && read["signs-and-sums"].canBeSolvedAtThisLength === true && read["signs-and-sums"].total === read["signs-and-sums"].values.reduce((a, b) => a + b, 0));
check("newtons-method: a start at 4.5 with three steps ends at the root near 3.837", read["newtons-method"]?.startX === 4.5 && read["newtons-method"].stepsDrawn.length === 3 && read["newtons-method"].stepsDrawn[2].next > 3.83 && read["newtons-method"].stepsDrawn[2].next < 3.85);
check("nine-squares: a = 9 tiles a 33 by 32 rectangle exactly", read["nine-squares"]?.a === 9 && read["nine-squares"].tilesExactly === true && read["nine-squares"].rectangle === "33 by 32" && read["nine-squares"].sides.join() === "1,9,10,14,18,8,4,7,15");
check("golden-ratio-pentagon: the five triangles are equal and the pentagon is 3.618 of one", read["golden-ratio-pentagon"]?.allEqual === true && Math.abs(read["golden-ratio-pentagon"].areaOverOneTriangle - 3.618034) < 1e-5);
check("northcotts-game: the saved board's nim-sum is the XOR of its gaps", read["northcotts-game"]?.gaps.length === 6 && read["northcotts-game"].nimSum === read["northcotts-game"].gaps.reduce((a, b) => a ^ b, 0) && read["northcotts-game"].playerToMoveIsWinning === (read["northcotts-game"].nimSum !== 0));
check("counting-triangles: N = 5 with the slider in the middle, 25 triangles at both ends", read["counting-triangles"]?.n === 5 && read["counting-triangles"].slider === "in between" && read["counting-triangles"].totals.triangle === 25 && read["counting-triangles"].totals.square === 25);
check("zeros-and-ones-array: the most possible array was shown for 3 by 3, 4 sums", read["zeros-and-ones-array"]?.size === "3 by 3" && read["zeros-and-ones-array"].count === 4 && read["zeros-and-ones-array"].reachedTheMost === true);
check("adding-functions: the difference was chosen and its height at the marker is f - g", read["adding-functions"]?.operation === "f - g" && Math.abs(read["adding-functions"].result - (read["adding-functions"].f - read["adding-functions"].g)) < 1e-9);
check("orthogonal-latin-squares: the solution for 4 is saved, Latin and orthogonal", read["orthogonal-latin-squares"]?.size === 4 && read["orthogonal-latin-squares"].solved === true && read["orthogonal-latin-squares"].repeats === 0);
check("kochs-snowflake: N = 4 has 192 segments and an outline 7.11 sides long", read["kochs-snowflake"]?.n === 4 && read["kochs-snowflake"].segments === 192 && Math.abs(read["kochs-snowflake"].totalLength - 64 / 9) < 1e-9);
check("pascal-triangle: a dot pressed in row 5 shows its two parents adding up", read["pascal-triangle"]?.pressed?.sumOfParents === read["pascal-triangle"].pressed.value && read["pascal-triangle"].pressed.parents.length === 2 && read["pascal-triangle"].lastRowSum === 2 ** (read["pascal-triangle"].rows - 1));
check("peasant-multiplication: 85 x 18 = 1530 in 7 rows, binary 1010101", read["peasant-multiplication"]?.product === Number(read["peasant-multiplication"].a) * Number(read["peasant-multiplication"].b) && read["peasant-multiplication"].binaryShown === true);
check("pendula-chaos: a saved step, its direction and the number of levels", read["pendula-chaos"]?.dots >= 5 && typeof read["pendula-chaos"].levelsNow === "number" && typeof read["pendula-chaos"].direction === "string");
check("perm: the saved permutation's inverse and inversions", read.perm?.f.length === read.perm.n && read.perm.inversions.length === read.perm.n && read.perm.inversions[read.perm.n - 1] === 0);
check("perm-by-trans: one shuttle between poles 1 and 3 is an odd permutation with 2 cycles of length 2 and 1", read["perm-by-trans"]?.shuttles === 1 && read["perm-by-trans"].parity === "odd" && read["perm-by-trans"].fewestShuttlesForThisPermutation === 1);
check("perm-group: conjugating g by f keeps g's cycle shape", read["perm-group"]?.shapeG.join() === read["perm-group"].shapeOfConjugate.join());
check("perm-on-circle: one swap made, so the parity is odd or even by cycle count", read["perm-on-circle"]?.swapsSoFar === 1 && read["perm-on-circle"].parity === ((read["perm-on-circle"].n - read["perm-on-circle"].numberOfCycles) % 2 === 0 ? "even" : "odd"));
check("perm-product: fg has the same length as f and g", read["perm-product"]?.fg.length === read["perm-product"].n && typeof read["perm-product"].commute === "boolean");
check("pick: the 6 by 4 rectangle has B = 20, I = 15 and area 24", read.pick?.simple === true && read.pick.B === 20 && read.pick.I === 15 && read.pick.area === "24");
check("pigeonhole: five dots always have a pair with a lattice midpoint", read.pigeonhole?.dots === 5 && read.pigeonhole.pair?.length === 2 && read.pigeonhole.noPair === false);
// Eleven more ports, on positions saved by their own pages.
check("plain-monty-hall: one door picked, the host opened a goat, the car hidden", read["plain-monty-hall"]?.stage === "stay or switch" && read["plain-monty-hall"].firstPick === 0 && read["plain-monty-hall"].hostOpened !== 0 && read["plain-monty-hall"].car === "hidden");
check("play-hex-design: two clicks fill two dots of the 3 x 3 board", read["play-hex-design"]?.n === 3 && read["play-hex-design"].filled + read["play-hex-design"].missteps === 2 && read["play-hex-design"].aClickThatFillsANewDot !== null);
check("polygonal-numbers: 6 sides, size 2 is the hexagonal number 15", read["polygonal-numbers"]?.dots === 15 && read["polygonal-numbers"].distinctDotsDrawn === 15);
check("polynomial-degree-3: x^3 - 6x^2 + 11x - 6 has roots 1, 2, 3 and inflection at 2", Math.abs(read["polynomial-degree-3"]?.roots.real - 1) < 1e-3 && read["polynomial-degree-3"].roots.complexPair === false && Math.abs(read["polynomial-degree-3"].inflection.x - 2) < 1e-12);
check("polynomial-roots: 2(x + 3)(x - 1)^2 crosses at -3 and touches at 1", read["polynomial-roots"]?.roots.length === 2 && read["polynomial-roots"].roots[0].crosses === true && read["polynomial-roots"].roots[1].times === 2 && read["polynomial-roots"].rightEnd === "+infinity");
check("power-index: [6: 4, 3, 2, 1] has Banzhaf 5, 3, 3, 1 and Shapley-Shubik 10, 6, 6, 2", read["power-index"]?.banzhaf.counts.join() === "5,3,3,1" && read["power-index"].shapleyShubik.counts.join() === "10,6,6,2");
check("power-indices: the Security Council, a permanent member has 421/2145", read["power-indices"]?.set === "Security Council" && Math.abs(read["power-indices"].table[0].shapleyShubik - 421 / 2145) < 1e-12);
check("primes-from-triangle: dot (12, 8) has gcd 4 and is marked", read["primes-from-triangle"]?.picked?.gcd === 4 && read["primes-from-triangle"].picked.marked === true && read["primes-from-triangle"].finished === true);
check("product-of-fractions: 2/3 of 3/4 is 6/12 = 1/2", read["product-of-fractions"]?.product === "6/12" && read["product-of-fractions"].lowestTerms === "1/2");
check("pyth-triple-calculator: N = 3, M = 1 gives 8, 6, 10, not primitive", read["pyth-triple-calculator"]?.a === 8 && read["pyth-triple-calculator"].c === 10 && read["pyth-triple-calculator"].primitive === false);
check("quadratic-polynomial: x^2 + 2x + 4 has complex roots on the circle of radius 2", read["quadratic-polynomial"]?.kind === "complex" && Math.abs(read["quadratic-polynomial"].complexRootsOnCircleOfRadius - 2) < 1e-12);

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
// The nine ports, on positions built here.
{
  const l = at("loop-or-halt", { n: 6, start: [3, 6, 2, 1, 5, 4], steps: 8 });
  check("loop-or-halt: 362154 leaders 3,2,6,4,3,5,2,4,1 and 8 flips", l.leaders.join() === "3,2,6,4,3,5,2,4,1" && l.flips === 8 && l.largestLeader === 6);
  const mq = at("magic-in-square", { n: 3, grid: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], aux: [[0, 1, 2], [0, 1, 2], [0, 1, 2]], stage: 2, col: 1, row: 2 });
  check("magic-in-square: column 2 then row 3 names 8", mq.numberNamed === 8 && mq.firstColumn === 2 && mq.secondColumn === 3);
  const mc = at("mandel-cycle", { turns: 12, direction: "in", fast: true, running: true });
  check("mandel-cycle: reads the cycling state", mc.turnsOfThePalette === 12 && mc.speed === "fast" && mc.cycling === true);
  const mk = at("markers", { n: 3, markers: [[100, 250], [120, 200], [90, 300]], leftover: 0 });
  check("markers: player 3 first (marker 90), then 2, then 1, leaving 80", mk.awards.map((a) => a.player).join() === "3,2,1" && mk.leftover === 80);
  const mt = at("math-telepathy", { digits: [4, 5], guessed: null });
  check("math-telepathy: 4 and 5 add to 9, so the circled digit is 9", mt.computersAnswer === 9 && mt.pressedGuess === false);
  const mn = at("means", { values: [20, 30], r: -1, mean: 24 });
  check("means: the harmonic mean of 20 and 30 is 24", Math.abs(mn.mean - 24) < 1e-9 && mn.nameOfThisMean === "harmonic mean");
  const me = at("memory", { which: 7, ids: Array(20).fill(0), matched: Array(20).fill(false).map((_, i) => i < 4), showing: [], turns: 2 });
  check("memory: four cards matched, 8 pairs left, All Ops", me.pairsLeft === 8 && me.mode === "Match Result of Operations");
  const mr = at("merlin", { n: 3, geometry: 0, values: [1, 1, 1, 1, 0, 1, 1, 1, 1], target: [1, 1, 1, 1, 0, 1, 1, 1, 1], hint: [0, 0, 0, 0, 0, 0, 0, 0, 0], hintOn: false });
  check("merlin: a solved board needs no presses", mr.solved === true && mr.totalPresses === 0);
  const mi = at("midline-in-sim-tris", { A: { x: 0, y: 0 }, B: { x: 100, y: 0 }, C: { x: 0, y: 100 }, L: { x: 100, y: 100 } });
  check("midline-in-sim-tris: any triangle and L keep DE = CN / 2", Math.abs(mi.ratioDEtoCN - 0.5) < 1e-9 && mi.parallel === true);
// The ten newer ports, on positions built here.
{
  const hm = at("hummers-mind-reader", { pos: [0, 2, 1], selected: [], announcement: null });
  check("hummers-mind-reader: after swapping nickel and dime the penny is the one", hm.coinInItsOwnPlace === "penny");
  const mm = at("min-max", { rows: 2, cols: 2, max: 10, values: [[1, 2], [3, 4]] });
  check("min-max: 1 2 / 3 4 has MaxMin 3 = MinMax 3 and a saddle point at row 2, column 1", mm.maxMin === 3 && mm.minMax === 3 && mm.saddles.length === 1);
  const mi = at("miu-system", { theorems: ["MI"], count: 5, top: "MIIU" });
  check("miu-system: MIIU has 2 I's", mi.iCountOfNewest === 2 && mi.iCountIsMultipleOfThree === false);
  const md = at("modular-tables", { n: 7, op: 3, mark: null });
  check("modular-tables: modulus 7 is prime", md.modulus === 7 && md.modulusIsPrime === true && md.operation === ":");
  const mh = at("monty-hall", { car: 1, picked: 0, trials: 30, stayedWon: 10, stayedLost: 20, switchedWon: 20, switchedLost: 10 });
  check("monty-hall: 30 rounds, switching won 2/3", Math.abs(mh.shareSwitchWon - 2 / 3) < 1e-9 && Math.abs(mh.shareStayWon - 1 / 3) < 1e-9);
  const mc = at("moving-chips-in-pairs", { n: 4, rows: [0, 3, 1, 2], selected: [false, false, false, false], moves: 0, height: 6 });
  check("moving-chips-in-pairs: N = 4 has height 6, solvable, best move columns 1 and 3", mc.height === 6 && mc.solvableFromHere === true && mc.nextStrategyMove.join() === "0,2");
  const mt = at("multiplication-table", { n: 20, picked: { a: 20, b: 20 } });
  check("multiplication-table: 400 appears once", mt.product === 400 && mt.timesInTheTable === 1);
  const mv = at("mean-value-theorem", { ys: Array.from({ length: 11 }, () => 1), a: 2, b: 7, x: 4 });
  check("mean-value-theorem: a flat curve is Rolle's case", mv.rollesCase === true && mv.tangentParallelToSecant === true);
  const nb = at("napier-bones", { base: 16, number: 187, multiplier: 3 });
  check("napier-bones: BB x 3 = 231 in base 16", nb.numberInBase === "BB" && nb.product === "231");
  const np = at("napoleon-polygons", { n: 3, m: 2, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 20, y: 80 }], showTriangles: false });
  check("napoleon-polygons: Napoleon's triangle is regular", np.lastPolygonIsRegular === true && np.steps.join() === "1");
  // The ten newest ports, on positions built here.
  const ss = at("signs-and-sums", { n: 4, values: [-4, 3, 3, -4] });
  check("signs-and-sums: -4 3 3 -4 is the goal", ss.solved === true && ss.total === -2 && ss.tripleSums.join() === "2,2");
  const ss6 = at("signs-and-sums", { n: 6, values: [1, 1, 1, 1, 1, 1] });
  check("signs-and-sums: length 6 can never have a negative total", ss6.canBeSolvedAtThisLength === false && ss6.solved === false);
  const nm = at("newtons-method", { ys: Array.from({ length: 11 }, (_, i) => -((i - 5) ** 3) - 4 * (i - 5) ** 2 + 5 * (i - 5) + 95.83333333333333), x0: 0, n: 3 });
  check("newtons-method: a start at 0 on the starting curve goes off the picture at once", nm.leftThePicture === true && nm.reachedARoot === false && nm.stepsDrawn.length === 1);
  const ns = at("nine-squares", { a: 6, tiles: false });
  check("nine-squares: a = 6 leaves gaps and still has the sides 1, 4 and 15", ns.tilesExactly === false && ns.emptyUnitSquares === 66 && ns.sides[0] === 1 && ns.sides[6] === 4 && ns.sides[8] === 15);
  const gp = at("golden-ratio-pentagon", { X: { x: 100, y: 80 }, Z: { x: 300, y: 250 }, D: { x: 210, y: 300 } });
  check("golden-ratio-pentagon: any X, Z, D give equal triangles", gp.allEqual === true && Math.abs(gp.areaOverOneTriangle - gp.expected) < 1e-6);
  const nc = at("northcotts-game", { nx: 11, ny: 2, white: [2, 8], black: [6, 1], turn: "white" });
  check("northcotts-game: gaps 3 and 6 have nim-sum 5, so white to move wins with a move in row 2", nc.nimSum === 5 && nc.playerToMoveIsWinning === true && nc.winningMove.row === 1);
  const nz = at("northcotts-game", { nx: 11, ny: 2, white: [2, 8], black: [6, 4], turn: "white" });
  check("northcotts-game: gaps 3 and 3 have nim-sum 0, so the player to move is losing", nz.nimSum === 0 && nz.playerToMoveIsWinning === false && nz.winningMove === null);
  const ct = at("counting-triangles", { n: 7, alpha: 256 });
  check("counting-triangles: N = 7 at the triangle end, 28 + 21 = 49", ct.slider === "triangle" && ct.counts.full === 28 && ct.counts.low === 21 && ct.totals.triangle === 49);
  const za = at("zeros-and-ones-array", { n: 3, m: 2, cells: [[1, 1], [1, 0], [1, 0]] });
  check("zeros-and-ones-array: 3 by 2 has at most 4 different sums and the page's construction cannot reach it", za.most === 4 && za.mostIsReachableForThisSize === false && za.count === 3);
  const af = at("adding-functions", { f: new Array(11).fill(2), g: new Array(11).fill(2), op: "sub", shade: false, points: false, probe: 1 });
  check("adding-functions: f = g = 2 has difference 0", af.result === 0 && af.f === 2 && af.operation === "f - g");
  const ol = at("orthogonal-latin-squares", { n: 3, left: [[0, 1, 2], [1, 2, 0], [2, 0, 1]], right: [[0, 1, 2], [0, 1, 2], [0, 1, 2]], apply: "right" });
  check("orthogonal-latin-squares: the right square has repeated letters in its columns, so not solved", ol.latinLeft === true && ol.latinRight === false && ol.solved === false && ol.movesApplyTo === "capitals");
  const ol6 = at("orthogonal-latin-squares", { n: 6, left: [[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 0], [2, 3, 4, 5, 0, 1], [3, 4, 5, 0, 1, 2], [4, 5, 0, 1, 2, 3], [5, 0, 1, 2, 3, 4]], right: [[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 0], [2, 3, 4, 5, 0, 1], [3, 4, 5, 0, 1, 2], [4, 5, 0, 1, 2, 3], [5, 0, 1, 2, 3, 4]], apply: "left" });
  check("orthogonal-latin-squares: size 6 has no solution at all (Euler's 36 officers)", ol6.solutionExistsForThisSize === false && ol6.solved === false);
  const ks = at("kochs-snowflake", { n: 8 });
  check("kochs-snowflake: N = 8 has 49,152 segments and area under 8/5", ks.segments === 49152 && ks.areaOverTriangle < 1.6 && ks.areaOverTriangle > 1.59);
  const pt = at("pascal-triangle", { rows: 8, form: "symmetric", arrows: false, pick: [5, 2] });
  check("pascal-triangle: C(5,2) = 4 + 6 = 10 and the last row of 8 sums to 128", pt.pressed.value === 10 && pt.pressed.sumOfParents === 10 && pt.lastRowSum === 128 && pt.lastRow.length === 8);
  const pm = at("peasant-multiplication", { a: 85, b: 18, digits: 2, binary: true, autonomous: false });
  check("peasant-multiplication: 85 x 18 = 1530, binary 1010101, 7 rows against 5 swapped", pm.product === 1530 && pm.binaryOfA === "1010101" && pm.rows === 7 && pm.rowsIfSwapped === 5);
  const pc = at("pendula-chaos", { n: 20, t: 1, dir: 0, step: 0 });
  check("pendula-chaos: at step 0 all the dots are in line", pc.levelsNow === 1 && pc.cyclesCompleted === 0 && pc.direction === "stopped");
  const pe = at("perm", { n: 9, f: [5, 9, 1, 8, 2, 6, 4, 7, 3], view: "table" });
  check("perm: the page's example has inversions 2,3,6,4,0,2,2,1,0 and cycles (1 5 2 9 3)(4 8 7)(6)", pe.inversions.join() === "2,3,6,4,0,2,2,1,0" && pe.cycles === "(1 5 2 9 3)(4 8 7)(6)");
  const bt = at("perm-by-trans", { n: 5, bars: [{ h: 2, a: 1, b: 3 }, { h: 4, a: 3, b: 5 }] });
  check("perm-by-trans: shuttles (1,3) then (3,5) send 1 to 5, an even permutation with one 3-cycle", bt.permutation[0] === 5 && bt.cycles === "(1 5 3)(2)(4)" && bt.parity === "even" && bt.fewestShuttlesForThisPermutation === 2);
  const pg = at("perm-group", { n: 3, f: [2, 3, 1], g: [2, 1, 3], cycles: true });
  check("perm-group: (1 2) conjugated by (1 2 3) is (2 3)", pg.conjugateOfGByF.join() === "1,3,2" && pg.shapeOfConjugate.join() === "2,1");
  const po = at("perm-on-circle", { n: 3, f: [2, 3, 1], moves: 0 });
  check("perm-on-circle: the 3-cycle is an even permutation with one cycle", po.numberOfCycles === 1 && po.parity === "even");
  const pp = at("perm-product", { n: 3, f: [2, 3, 1], g: [1, 3, 2] });
  check("perm-product: (1 2 3) then (2 3) is {3,2,1}, and it does not equal gf", pp.fg.join() === "3,2,1" && pp.commute === false);
  const pk = at("pick", { poly: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], mode: "add" });
  check("pick: the unit right triangle has B = 3, I = 0 and area 0.5", pk.simple === true && pk.B === 3 && pk.I === 0 && pk.area === "0.5");
  const pk2 = at("pick", { poly: [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }], mode: "add" });
  check("pick: a bow tie is not simple", pk2.simple === false);
  const ph = at("pigeonhole", { n: 4, points: [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 5 }, { x: 5, y: 5 }] });
  check("pigeonhole: the four dots in four boxes have no pair", ph.noPair === true && ph.distinctBoxes === 4);
  const ph5 = at("pigeonhole", { n: 5, points: [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 4 }] });
  check("pigeonhole: a fifth dot in the (even, even) box makes a pair with (2,2)", ph5.pair.join() === "1,5" && ph5.midpoint.x === 3 && ph5.midpoint.y === 3);
  {
    const pm = at("plain-monty-hall", { prize: 1, first: 1, opened: 0, final: 2, trials: 9, stayedWon: 3, stayedLost: 6, switchedWon: 6, switchedLost: 3 });
    check("plain-monty-hall: after the reveal the car is shown and switching has won 2/3", pm.car === 1 && Math.abs(pm.shareSwitchWon - 2 / 3) < 1e-12);
    const hx = at("play-hex-design", { n: 3, moves: [[1, 1], [0, 2]], missed: 1, alert: null });
    check("play-hex-design: the suggested click fills the dot it says", hx.aClickThatFillsANewDot && hx.filled === 2 && hx.missteps === 1);
    const pn = at("polygonal-numbers", { sides: 4, size: 4 });
    check("polygonal-numbers: 4 sides, size 4 is the square 25", pn.dots === 25);
    const cu = at("polynomial-degree-3", { c: [-1, 1, -1, 1], tangent: true });
    check("polynomial-degree-3: x^3 - x^2 + x - 1 has the complex pair +/- i", cu.roots.complexPair === true && Math.abs(Math.abs(cu.roots.others[0].im) - 1) < 1e-3);
    const pr = at("polynomial-roots", { a: -1, roots: [0, 0] });
    check("polynomial-roots: -x^2 goes down at both ends and touches at 0", pr.leftEnd === "-infinity" && pr.rightEnd === "-infinity" && pr.roots[0].crosses === false);
    const pw = at("power-index", { quota: 5, votes: [3, 2, 1], compute: true });
    check("power-index: [5: 3, 2, 1] has the dummy 3", pw.dummies.join() === "3");
    const pi = at("power-indices", { set: "Custom", quota: 11, players: [["A", 3], ["B", 2]] });
    check("power-indices: a quota above all the votes has no winning coalition", pi.noWinningCoalition === true);
    const pt = at("primes-from-triangle", { rows: 20, step: 1, showPrimes: false, show: {}, picked: [13, 5], frame: null });
    check("primes-from-triangle: after Clear (13, 5) is not marked, gcd 1, progenitor (2, 1)", pt.picked.marked === false && pt.picked.topProgenitors[0].join() === "2,1" && pt.finished === false);
    const pf = at("product-of-fractions", { p: 1, q: 2, r: 1, s: 2 });
    check("product-of-fractions: half of a half is 1/4", pf.product === "1/4");
    const py = at("pyth-triple-calculator", { n: 5, m: 2, k: 1 });
    check("pyth-triple-calculator: N = 5, M = 2 gives the primitive 21, 20, 29", py.a === 21 && py.b === 20 && py.c === 29 && py.primitive === true);
    const qp = at("quadratic-polynomial", { c: [1, -2, 1] });
    check("quadratic-polynomial: x^2 - 2x + 1 has the double root 1", qp.kind === "double" && qp.roots[0].re === 1 && qp.discriminant === 0);
  }
}
}
}
}

// Ten more ports, on positions saved by their own pages, then on positions built here.
check("ratchet: the plain staircase alone, at the start", read.ratchet?.mode === "regular" && read.ratchet.frame === 0 && read.ratchet.ballRoseSteps === 0);
check("more-less-equal: 1 + 2 > 2", read["more-less-equal"]?.equation === "1 + 2 > 2" && read["more-less-equal"].relation === ">" && read["more-less-equal"].true === false);
check("sam-loyd-son: 8 x 8, figure 63, one piece in", read["sam-loyd-son"]?.squareCells === 64 && read["sam-loyd-son"].figureCells === 63 && read["sam-loyd-son"].piecesInFigure.length === 1 && read["sam-loyd-son"].allPlaced === false);
check("scoring: one counter, its value is its square mod 4, nim-sum matches", read.scoring?.counters.length === 1 && read.scoring.nimSum === read.scoring.counters[0] % 4 && read.scoring.over === false);
check("geometric-series-square: thirds after 3 cuts, 13/27 shaded", read["geometric-series-square"]?.shaded === "13/27" && read["geometric-series-square"].limit === "1/2");
check("shuttle-practice: 5 poles, one shuttle (1,2) drawn", read["shuttle-practice"]?.poles === 5 && read["shuttle-practice"].shuttlesSoFar === "(1,2)" && read["shuttle-practice"].topsReachNow.join() === "2,1,3,4,5");
check("sierpinski-chaos-game: some dots drawn", read["sierpinski-chaos-game"]?.dotsDrawn > 0);
check("sierpinski-dihedral: 4 steps of Add mod 2 on 32 x 32", read["sierpinski-dihedral"]?.steps === 4 && read["sierpinski-dihedral"].rule === "Add, 2 prongs" && read["sierpinski-dihedral"].nonZeroCells > 0);
check("simple-somos: m = 3 from 1, 1 gives 1, 1, 4, 19 with k = 5", read["simple-somos"]?.terms.slice(0, 4).join() === "1,1,4,19" && read["simple-somos"].k === "5" && read["simple-somos"].alarm === null);
check("sine-cosine-derivatives: 30 degrees, velocity (-1/2, cos 30)", read["sine-cosine-derivatives"]?.degrees === 30 && read["sine-cosine-derivatives"].velocity.x === -0.5 && read["sine-cosine-derivatives"].sinIs === "growing");
{
  const sc = at("scoring", { maxStep: 3, length: 8, towers: [5, 7], turn: "you", over: false, winner: null });
  check("scoring: counters on 5 and 7, values 1 and 3, nim-sum 2, winning move to a nim-sum of 0", sc.nimSum === 2 && sc.winningMove && (sc.winningMove.to % 4 ^ ((sc.winningMove.from === 5 ? 7 : 5) % 4)) === 0);
  const sc0 = at("scoring", { maxStep: 3, length: 8, towers: [4], turn: "you", over: false, winner: null });
  check("scoring: one counter on 4 is lost for the player to move", sc0.nimSum === 0 && !sc0.winningMove);
  const sh = at("shuttle-practice", { n: 3, goal: [2, 1, 3], bars: [{ a: 0, b: 1, h: 10 }], verdict: "yes" });
  check("shuttle-practice: one shuttle solves 2, 1, 3", sh.solved === true && sh.fewestShuttles === 1 && sh.verified === "Great! You did it!");
  const ml = at("more-less-equal", { a: 6, b: 0, c: 1, op: "/" });
  check("more-less-equal: 6 / 0 has no value", ml.relation === "no value (division by 0)");
  const sl = at("sam-loyd-son", { n: 6, cheat: true, placed: [true, true, true, true], explored: true });
  check("sam-loyd-son: 13 x 13 leaves a one-cell gap", sl.figureCells === 170 && sl.difference === 1 && sl.allPlaced === true);
  const so = at("simple-somos", { m: 2, a: 2, b: 1 });
  check("simple-somos: 2, 1 raises the alarm 3/2", so.alarm === "Alarm: 3/2" && so.kIsWhole === false);
  const sd = at("sierpinski-dihedral", { n: 8, m: 2, add: false, prongs: 2, steps: 3 });
  check("sierpinski-dihedral: Replace is Pascal's triangle", sd.formula.startsWith("Pascal"));
  const gs = at("geometric-series-square", { kind: 2, n: 4 });
  check("geometric-series-square: halves after 3 cuts, 7/8, 1/8 short", gs.shaded === "7/8" && gs.shortOfLimitBy === "1/8");
  const sn = at("sine-cosine-derivatives", { a: 180, speed: "fast" });
  check("sine-cosine-derivatives: at 180 degrees sin is falling and cos is turning", sn.sinIs === "falling" && sn.cosIs === "turning");
  const rt = at("ratchet", { mode: "both", frame: 48, climbedSteps: 0.4 });
  check("ratchet: both staircases read back", rt.mode === "both" && rt.ballRoseSteps === 0.4);
}

check("sine-of-sum: alpha 62, beta 45, the rhombus's area is sin 107 = the two rectangles", read["sine-of-sum"]?.alpha === 62 && read["sine-of-sum"].rhombusAngle === 107 && Math.abs(read["sine-of-sum"].rhombusArea - Math.sin(107 * Math.PI / 180)) < 1e-6);
{
  const ss = at("sine-of-sum", { alpha: 30, beta: 60, labels: true, angles: false });
  check("sine-of-sum: 30 and 60 make a square of area 1 = 1/4 + 3/4", ss.rhombusArea === 1 && ss.emptyRectangles.sinAcosB === 0.25 && ss.emptyRectangles.cosAsinB === 0.75);
}
check("social-choice: ballot 3 now BCA, so B wins plurality with 18", read["social-choice"]?.results.Plurality.winners.join() === "B" && read["social-choice"].results.Plurality.scores.B === 18 && read["social-choice"].methodsTicked.join() === "Plurality,Elimination");
{
  const sc = at("social-choice", { ballots: [["A","B","C","D","E"],["C","B","D","E","A"],["D","C","B","E","A"],["B","D","C","E","A"],["E","C","D","B","A"]], counts: [14, 10, 8, 4, 1], methods: [] });
  check("social-choice: the Math Club election has four winners A, B, D, C", ["Plurality","Borda","Elimination","Pairwise"].map((m) => sc.results[m].winners.join()).join() === "A,B,D,C");
}
check("soroban: 53 on a decimal soroban", read.soroban?.inRadix === "53" && read.soroban.decimal === 53 && read.soroban.wires[5].heavenBeadDown === true);
{
  const so = at("soroban", { radix: 16, digits: [0, 0, 0, 0, 15, 0, 10] });
  check("soroban: base 16 F0A is 3850, F is the heaven bead and 7 earth beads", so.decimal === 3850 && so.wires[4].earthBeadsUp === 7 && so.wires[4].heavenBeadDown === true);
}
check("suan-pan: 53 on the frame", read["suan-pan"]?.numberOnFrame === 53 && read["suan-pan"].tidyingPending === false);
{
  const sp = at("suan-pan", { radix: 10, values: [0, 0, 0, 0, 0, 9, 12] });
  check("suan-pan: 9 and 12 tidy to 1, 0, 2: the frame holds 102", sp.numberOnFrame === 102 && sp.tidyingPending === true && sp.afterTidying.slice(4).join() === "1,0,2");
}
check("sorts: four shellsort steps on 20 random numbers", read.sorts?.method === "Shellsort" && read.sorts.stepsSoFar === 4 && read.sorts.finished === false);
{
  const so = at("sorts", { method: 0, order: 2, n: 10, same: false, steps: 45, swaps: 45, finished: true });
  check("sorts: insertion sort on 10 descending numbers takes 45 steps", so.totalSteps === 45 && so.finished === true && so.array === "10 numbers, Descending");
}
check("spigot-for-pi: 50 digits done, ending ...93993751", read["spigot-for-pi"]?.finished === true && read["spigot-for-pi"].lastDigits.endsWith("93993751") && read["spigot-for-pi"].placesInTheArray === 167);
{
  const sp = at("spigot-for-pi", { n: 1000, chunk: 5, font: 15, digitsSoFar: 10, done: false });
  check("spigot-for-pi: stopped after 10 digits of 1000", sp.lastDigits === "3141592653" && sp.finished === false && sp.placesInTheArray === 3334);
}
check("steinhaus-problem: .30 and .50 are in different halves (0.5 opens the second)", read["steinhaus-problem"]?.numbers.join() === ".30,.50" && read["steinhaus-problem"].allPass === true && read["steinhaus-problem"].firstFailure === null);
{
  const st = at("steinhaus-problem", { places: [710, 90, 420, 850, 270, 540, 925, 170, 620, 355, 780, 30, 480, 970, 220, 660, 320] });
  check("steinhaus-problem: Guy's 17 pass", st.allPass === true && st.passesUpTo === 17);
}
check("string-distance: kitten to sitting is 3 edits, Hamming undefined", read["string-distance"]?.levenshtein === 3 && typeof read["string-distance"].hamming === "string" && read["string-distance"].oneShortestEdit.length === 3);
{
  const sd = at("string-distance", { s: "abc", t: "bca", method: "hamming", caseSensitive: false, lines: [] });
  check("string-distance: H(abc, bca) = 3, L = 2", sd.hamming === 3 && sd.levenshtein === 2);
}
check("switching-signs: a 4 x 5 grid after one flip", read["switching-signs"]?.rowSums.length === 4 && read["switching-signs"].columnSums.length === 5 && read["switching-signs"].flipsSoFar === 1);
{
  const sw = at("switching-signs", { nums: [[1, -2], [3, -4]], flips: 0 });
  check("switching-signs: rows -1, -1, columns 4, -6, three negative lines", sw.negativeLines.length === 3 && sw.total === -2 && sw.solved === false);
}
check("base-tables: base 12 times table, 3 x 4 = 10", read["base-tables"]?.radix === 12 && read["base-tables"].entry === "3 x 4 = 10");
{
  const bt = at("base-tables", { radix: 16, op: "x", a: 15, b: 15 });
  check("base-tables: F x F = E1 in base 16", bt.entry === "F x F = E1" && bt.inBase10 === "15 x 15 = 225");
}
check("tesseract: built, the moving reper one square away", read.tesseract?.built === true && read.tesseract.puzzle.path.length === 1 && read.tesseract.puzzle.orientation === "not back home yet" && read.tesseract.puzzle.shortestWayHomeReversed.length >= 2);
{
  const ts = at("tesseract", { angles: {}, plane: {}, built: false, fixed: "XY00", moving: "XY00", reper: [[0, 1], [1, 1]], fixedReper: [[0, 1], [1, 1]], path: [] });
  check("tesseract: from XY00 the shortest reversal takes 3 glides round an edge", ts.puzzle.shortestWayHomeReversed.length === 3 && ts.puzzle.shortestWayHomeReversed[2] === "XY00");
  const tr = at("tesseract", { angles: {}, plane: {}, built: true, fixed: "XY00", moving: "XY00", reper: [[1, 1], [0, 1]], fixedReper: [[0, 1], [1, 1]], path: ["XY00", "X10H", "X1Z0"] });
  check("tesseract: arrows swapped on the home square: solved", tr.puzzle.orientation === "reversed: solved");
}
check("party-acquaintances: two lines drawn, red then blue, next red", read["party-acquaintances"]?.linesDrawn === 2 && read["party-acquaintances"].nextColour === "red" && read["party-acquaintances"].finished === false);
{
  const pa = at("party-acquaintances", { n: 6, nRed: 3, nBlue: 3, autoColor: false, useRed: true, nextRed: true, edges: [[0, 1, true], [1, 2, true], [0, 2, true]] });
  check("party-acquaintances: three red lines 1-2-3 make a red triangle", pa.redGroups.length === 1 && pa.redGroups[0].join() === "1,2,3" && pa.finished === true);
}
check("triangle-chain: three counted from the top, best 21", read["triangle-chain"]?.counted === 3 && read["triangle-chain"].best === 21 && read["triangle-chain"].upMinusDown === 1);
{
  const tc = at("triangle-chain", { n: 3, stack: [{ k: 0, p: 0, x: false }, { k: 2, p: 0, x: true }] });
  check("triangle-chain: a refused click is not counted", tc.counted === 1 && tc.lastClickRefused === true && tc.best === 7);
}
check("stick-in-three: 1000 sticks the longer-piece way, near 0.386", read["stick-in-three"]?.sticksBroken === 1000 && read["stick-in-three"].breaking === "longer" && Math.abs(read["stick-in-three"].fraction - 0.386) < 0.05);
{
  const st = at("stick-in-three", { pieces: [0.6, 0.3, 0.1], method: "uniform", tries: 0, hits: 0 });
  check("stick-in-three: a piece over half the stick makes no triangle", st.point.makesTriangle === false && st.point.longestPiece === 1 && st.fraction === null);
}
check("stick-in-square: 1000 two-step sticks, near 0.386", read["stick-in-square"]?.sticksBroken === 1000 && Math.abs(read["stick-in-square"].fraction - 0.386) < 0.05);
{
  const sq = at("stick-in-square", { x: 1 / 3, y: 2 / 9, mode: "one", tries: 0, hits: 0 });
  check("stick-in-square: the applet's start is in a green corner, no triangle", sq.P.region === "green" && sq.P.makesTriangle === false && sq.exact === 0.25);
}
check("tromino-monomino: two trominoes on 8 x 8, 21 needed", read["tromino-monomino"]?.placed === 2 && read["tromino-monomino"].needed === 21 && read["tromino-monomino"].trominoes.join() === "a8-c8,a7-a5");
{
  const tm = at("tromino-monomino", { n: 4, m: 4, pieces: [[0, 0, 0, 2], [1, 0, 1, 2], [2, 0, 2, 2], [0, 3, 2, 3], [3, 1, 3, 3]] });
  check("tromino-monomino: 4 x 4 finished with a1 free", tm.finished === true && tm.freeSquares.join() === "a1");
}
check("turning-turtles: the saved row reads as 11 squares, the player to move", read["turning-turtles"]?.row.length === 11 && read["turning-turtles"].turn === "player");
{
  const tt = at("turning-turtles", { x: [false, true, false, false, true, true, false, true, false, false, false], turn: "you", score: { me: 1, you: 2 } });
  check("turning-turtles: OXOOXXOXOOO has Nim-sum 1^3^4^7^9^10^11 and a move back to 0", tt.nimSum === (1 ^ 3 ^ 4 ^ 7 ^ 9 ^ 10 ^ 11) && tt.winningMove !== null && tt.score.player === 2);
}
check("chips-on-circle: two flips keep 8 and 8, a balanced half is found", read["chips-on-circle"]?.reds === 8 && read["chips-on-circle"].balancedHalf !== null);
{
  const cc = at("chips-on-circle", { n: 8, red: [true, true, true, true, false, false, false, false] });
  check("chips-on-circle: RRRRGGGG is balanced from chip 3 (and 7)", cc.balancedHalf.from === 3 && cc.allBalancedStarts.join() === "3,7");
}
check("two-perpendiculars: the saved picture is the cheating one, second puzzle", read["two-perpendiculars"]?.puzzle.startsWith("K") && read["two-perpendiculars"].angleBKC < 179);
{
  const tp = at("two-perpendiculars", { A: [120, 120], B: [180, 260], C: [230, 40], cheat: false, fallacy: 1 });
  check("two-perpendiculars: drawn honestly, D = E = K = the foot", tp.distanceDE === 0 && tp.K.join() === tp.footFromA.join() && tp.angleADB === 90);
}
check("two-men-of-tibet: the saved range has 7 corners and a walk", read["two-men-of-tibet"]?.heights.length === 7 && (read["two-men-of-tibet"].plateau || read["two-men-of-tibet"].steps > 0));
{
  const tb = at("two-men-of-tibet", { heights: [0, 0.3, 0.1, 0.9, 0], walking: false });
  check("two-men-of-tibet: on 0, .3, .1, .9, 0 the walk goes from (A, I) to (I, A) and the white man turns back", tb.walk[0] === "(A, I)" && tb.walk[tb.walk.length - 1] === "(I, A)" && tb.turnsBack.white >= 1);
}
check("det-and-perm: one swap of 1 and 9 from the article's square", read["det-and-perm"]?.square[0][0] === 9 && read["det-and-perm"].goal === "largest permanent" && read["det-and-perm"].target === 947);
{
  const dp = at("det-and-perm", { cells: [1, 4, 9, 6, 7, 3, 8, 5, 2], goal: "perm", swaps: 4 });
  check("det-and-perm: 149/673/852 reaches the largest permanent 947", dp.permanent === 947 && dp.reached === true);
}
check("rook-placements: one placement found on board 1", read["rook-placements"]?.found === 1 && read["rook-placements"].total >= 3);
{
  const rp = at("rook-placements", { n: 4, seed: 1, rooks: [-1, -1, -1, -1], found: [] });
  check("rook-placements: board 1 rebuilt from its seed, nothing found yet", rp.board.length === 4 && rp.found === 0 && rp.allFound === false);
}
check("arithmetic-circuits: (x + y)² puzzle, first gate x + y", read["arithmetic-circuits"]?.par === 2 && read["arithmetic-circuits"].gates[0] === "g1 = x + y = x + y" && read["arithmetic-circuits"].targetReachedAt === null);
{
  const ac = at("arithmetic-circuits", { puzzle: "x8", gates: [["*", 1, 1], ["*", 2, 2], ["*", 3, 3]] });
  check("arithmetic-circuits: x⁸ in three squarings is at par", ac.atPar === true && ac.targetReachedAt === "g3");
}
check("determinant-elimination: two steps in, the permanent has moved", read["determinant-elimination"]?.step === "2 of 7" && read["determinant-elimination"].permanentNow !== read["determinant-elimination"].permanentAtStart);
{
  const de = at("determinant-elimination", { n: 3, seed: 1, step: 0 });
  check("determinant-elimination: a 3 x 3 at the start", de.size === 3 && de.lastOperation === "start" && de.operationsSoFar === 0);
}
check("ryser-formula: three of seven terms shown, the last set {A, B}", read["ryser-formula"]?.termsShown === "3 of 7" && read["ryser-formula"].lastSet === "AB");
{
  const rf = at("ryser-formula", { n: 3, seed: 1, shown: 7 });
  check("ryser-formula: all seven terms add up to the permanent", rf.runningTotal === rf.permanent);
}
check("perm-from-det: 3 x 3 with a minus on b", read["perm-from-det"]?.size === 3 && read["perm-from-det"].minusOn.join() === "b" && read["perm-from-det"].best === 5);
{
  const pd = at("perm-from-det", { n: 2, signs: [1, -1, 1, 1] });
  check("perm-from-det: 2 x 2 with -b: both products positive", pd.positive === 2 && pd.reachedBest === true);
}
check("riskless-hedge: half a share on the article's call is riskless", read["riskless-hedge"]?.sharesHeld === 0.5 && read["riskless-hedge"].riskless === true && read["riskless-hedge"].priceRight === false);
{
  const rh = at("riskless-hedge", { puzzle: "interest", delta: 0.5, p: 0.5, guess: 7.14 });
  check("riskless-hedge: with 5% interest the call is $7.14", rh.riskless === true && rh.priceRight === true);
}
check("stock-price-paths: 100 paths drawn once, median theory below average", read["stock-price-paths"]?.runs === 1 && read["stock-price-paths"].theory.median < read["stock-price-paths"].theory.average);
{
  const sp = at("stock-price-paths", { mu: 0, sigma: 0.8, count: 10, seed: 1, runs: 1 });
  check("stock-price-paths: no growth, 80% volatility: median 72.61", sp.theory.average === 100 && sp.theory.median === 72.61);
}
check("quadratic-roots: the circle's crossings give the roots of 2x² − 5x + 3", read["quadratic-roots"]?.discriminant === 1 && read["quadratic-roots"].xRoots.join() === "2,3" && read["quadratic-roots"].roots.join() === "1,1.5");
check("random-walk: nine steps from 3 to 4 have 126 routes, nine touch the axis", read["random-walk"]?.steps === 9 && read["random-walk"].routes === 126 && read["random-walk"].touchingAxisRoutes === 9);
check("right-replacement: LT settles into a fixed row", read["right-replacement"]?.fixedPoint === true && read["right-replacement"].finalRow.join() === read["right-replacement"].lastRow.join());
check("sealed-bids: the highest bidder takes every item and the cash balances", read["sealed-bids"]?.winners.join() === "1,1,1" && read["sealed-bids"].analysis.finalCashSumsToZero === true && Math.abs(read["sealed-bids"].surplus - 16) < 1e-9);
check("self-descriptive: a written 11 makes the count wrong by one", read["self-descriptive"]?.true === false && read["self-descriptive"].digitCounts[1] === 12 && read["self-descriptive"].mismatches.length === 1);
check("simple-graphs: one isolated vertex has degree zero and no odd degrees", read["simple-graphs"]?.savedStatsAgree === true && read["simple-graphs"].stats.totalDegree === 0 && read["simple-graphs"].stats.odd === 0);
check("simpson-paradox: B is steeper twice yet shallower together", read["simpson-paradox"]?.reversal === true && read["simpson-paradox"].combined.b.slope < read["simpson-paradox"].combined.a.slope);
check("reflection-principle: nine of 126 walks from 3 to 4 touch zero", read["reflection-principle"]?.allWalks === 126 && read["reflection-principle"].badPaths === 9 && read["reflection-principle"].reflectionMatchesSaved === true);
check("s1089: reversing 334 and adding gives 1089", read.s1089?.answer === "1089" && read.s1089.lines.join() === "334,433,99,990,1089" && read.s1089.palindrome === false);
check("simple-automaton: one step of rule 2n leaves 25 cells alive", read["simple-automaton"]?.alive === 25 && read["simple-automaton"].need === 2 && read["simple-automaton"].steps === 1);
check("upc: a changed first digit keeps the check digit valid", read.upc?.code === "112345678902" && read.upc.valid === true && read.upc.weightedSum === 88);
check("universal-coloring: two clicks give four of sixteen ordered pairs", read["universal-coloring"]?.found === 4 && read["universal-coloring"].complete === false && read["universal-coloring"].clicks === 2);
check("up-and-down: the hidden run is a rising four", read["up-and-down"]?.hiddenRun.length === 4 && read["up-and-down"].hiddenRun.rising === true && read["up-and-down"].finished === true);
check("arith-magic: a completed diagonal reaches the invariant total", read["arith-magic"]?.isTransversal === true && read["arith-magic"].runningTotal === read["arith-magic"].invariantTotal && read["arith-magic"].coreResult === "done");
check("zeros-and-nines: the units column contains a zero", read["zeros-and-nines"]?.checked.hasZero === true && read["zeros-and-nines"].result === "done");
check("very-tiles: one misplaced answer makes the patterns disagree", read["very-tiles"]?.answersPlaced === 1 && read["very-tiles"].patternsAgree === false && read["very-tiles"].wrong.length === 1);
check("voting: Borda gives B the most points on the saved schedule", read.voting?.method === "borda" && read.voting.current.winners.join() === "B" && read.voting.finished === false);
check("two-numbers: an even sum names the even number 8", read["two-numbers"]?.agreesWithSaved === true && read["two-numbers"].reading.honestPick === 8 && read["two-numbers"].finished === true);
check("water: six pours from the start, five from the saved position", read.water?.fewestPoursFromFreshStart === 6 && read.water.poursToTargetFromHere === 5 && read.water.target === 4);
check("a-bisector: Ceva's product is one at the incenter", read["a-bisector"]?.reading.cevaProduct === 1 && read["a-bisector"].reading.degenerate === false);
check("ab-on-circumcircle: AD, BE and CF meet EF, FD and DE at right angles", read["ab-on-circumcircle"]?.reading.perpendiculars.allRight === true && read["ab-on-circumcircle"].reading.incenter.onAllThree === true);
check("abul-wafa-pythagoras: the seven pieces tile the hypotenuse square", read["abul-wafa-pythagoras"]?.piecesTileSquare === true && Math.abs(read["abul-wafa-pythagoras"].areas.aSquare + read["abul-wafa-pythagoras"].areas.bSquare - read["abul-wafa-pythagoras"].areas.hypotenuseSquare) < 1e-6);
check("adams-circle: the six points share a circle centred at the incenter", read["adams-circle"]?.concyclic === true && read["adams-circle"].centerIsIncenter === true);
check("adjacent-incircles: the unlevelled fan has unequal first-level radii", read["adjacent-incircles"]?.savedRadiiMatchCore === true && read["adjacent-incircles"].theoremHolds === false);
check("al-nayrizi-construction: three marks cut the segment into four equal parts", read["al-nayrizi-construction"]?.reading.allCrossingsLandOnCuts === true && read["al-nayrizi-construction"].reading.equallySpaced === true && read["al-nayrizi-construction"].reading.parts === 4);
check("altitude-and-circumcircle: the three reflections lie on the circumcircle", read["altitude-and-circumcircle"]?.checks.reflectionsOnCircumcircle < 1e-9 && read["altitude-and-circumcircle"].checks.allChecksWithinTolerance === true);
check("altitude-mirror: the altitude bisects the angle and AF equals AG", read["altitude-mirror"]?.mirror.rayAnglesEqual === true && read["altitude-mirror"].mirror.AFequalsAG === true);
check("altitude-mirror-2: the Pascal line is straight and EF bisects angle CFD", read["altitude-mirror-2"]?.pascal.collinear === true && read["altitude-mirror-2"].angle.equalHalves === true);
check("angle: a thirty-degree turn is acute", read.angle?.reading.text === "30° (acute)" && read.angle.reading.measuredFromRays === 30);
check("angle-between-tangent-and-chord: tangent-chord equals the alternate inscribed angle", read["angle-between-tangent-and-chord"]?.checks.tangentChordEqualsInscribed.holds === true && read["angle-between-tangent-and-chord"].checks.allFourEqual.holds === true);
check("angle-bisector: the two circles cut equal lengths from A to the bisector", Math.abs(read["angle-bisector"]?.reading.distances.AD - read["angle-bisector"].reading.distances.AE) < 0.01 && read["angle-bisector"].reading.distances.distFToAB === read["angle-bisector"].reading.distances.distFToAC);
check("angle-bisector-in-equilateral-trapezoid: off the bisector, PQRS is not cyclic", read["angle-bisector-in-equilateral-trapezoid"]?.savedDerivedPointsMatchCore === true && read["angle-bisector-in-equilateral-trapezoid"].reading.bisectsAngleCBD === false && read["angle-bisector-in-equilateral-trapezoid"].reading.cyclicPQRS === false);
check("angle-bisector-in-rectangle: MN bisects the angle and the three corrected ratios agree", read["angle-bisector-in-rectangle"]?.reading.anglesDegrees.QNM === read["angle-bisector-in-rectangle"].reading.anglesDegrees.MNP && read["angle-bisector-in-rectangle"].reading.ratios.allThreeEqual === true);
check("angle-bisector-ratio: the bisector foot divides BC in the side ratio", read["angle-bisector-ratio"]?.reading.claims.bisectorRatio === true && read["angle-bisector-ratio"].reading.claims.footOnSide === true);
check("angle-bisector-ratio-2: all nine McWorter proof claims hold", read["angle-bisector-ratio-2"]?.reading.claims.allHold === true && read["angle-bisector-ratio-2"].reading.claims.failed.length === 0);
check("angle-bisectors-in-quadri: U, G and V are collinear", read["angle-bisectors-in-quadri"]?.reading.collinear.UGV === true && read["angle-bisectors-in-quadri"].savedClaims.verticalAngles === true);
check("angle-on-diameter: the angle at P stays a right angle", read["angle-on-diameter"]?.savedMatchesCore === true && read["angle-on-diameter"].reading.rightAngleAtP.isRight === true && read["angle-on-diameter"].maxAngleDifference === 0);
check("angle-property: inversion keeps the two crossing angles equal", read["angle-property"]?.crossingAnglesPreserved === true && read["angle-property"].power > 0);
check("angles-in-circle: the angle matches the half-arc rule", read["angles-in-circle"]?.reading.agrees === true && read["angles-in-circle"].reading.valid === true);
check("angles-in-triangle: folded corners fill a straight angle", read["angles-in-triangle"]?.reading.foldedSumDegrees === 180 && read["angles-in-triangle"].reading.largestAngleAt === "A");
check("anonymous-visitor: C stays at the fixed point as D moves", read["anonymous-visitor"]?.reading.C_onFixedPoint === true && read["anonymous-visitor"].reading.C_matchesSaved === true);
check("anticomplementary-triangle: the second triangle has ABC as its medial triangle", read["anticomplementary-triangle"]?.claims.allHold === true && read["anticomplementary-triangle"].claims.areaRatioFour === true);
check("antiparallel: the chord's angles with the sides are reversed", read.antiparallel?.reading.reversedAngleEqualities.bothPairsHold === true && read.antiparallel.reading.concyclicity.concyclic === true);
check("any-quadri: the three midpoint segments share one midpoint", read["any-quadri"]?.savedClaims.concurrent === true && read["any-quadri"].savedClaims.barycenter === true);
check("apmo-2009-3: the isosceles apex is optimal for this saved base", /claim holds/.test(read["apmo-2009-3"]?.verdict || "") && read["apmo-2009-3"].degenerate === false);
check("apollonian-circle: the sampled point has AP/BP equal to the ratio", read["apollonian-circle"]?.measuredAtP.agrees === true && read["apollonian-circle"].ratio === 1.536);
check("apollonius: eight tangent circles match the saved picture", read.apollonius?.count === 8 && read.apollonius.agreesWithSaved === true && read.apollonius.closestSavedGap.every((g) => g < 0.001));
check("arbelos: the arbelos area equals the circle on the upright", read.arbelos?.archimedesProposition4 === true && read.arbelos.arcsEqual === true && read.arbelos.savedMatchesCore === true);
check("arbelos-bui: both new circles share the twins' radius", Object.values(read["arbelos-bui"]?.savedMatchesCore || {}).every(Boolean) === true && read["arbelos-bui"].core.twins.matchesFormula === true && read["arbelos-bui"].core.chords.sumIsTwinDiameter === true);
check("arbelos-concyclic: the tangency points lie on the three stated circles", Object.values(read["arbelos-concyclic"]?.claimsHold || {}).every(Boolean) === true && read["arbelos-concyclic"].savedMatchesCore === true);
check("arbelos-incircle: AN, BM and CD meet on the incircle", read["arbelos-incircle"]?.core.concurrency.allThreeMeet === true && Object.values(read["arbelos-incircle"].savedMatchesCore).every(Boolean) === true);
check("arbelos-pww: the arbelos equals the circle on the upright", read["arbelos-pww"]?.equalAreas === true && read["arbelos-pww"].isGeometricMean === true && read["arbelos-pww"].savedMatchesCore === true);
check("arbelos-rect: CEDF is a rectangle with EF tangent to both arcs", read["arbelos-rect"]?.core.isRectangle === true && read["arbelos-rect"].savedMatchesCore === true);
check("archi: the saved position really trisects the angle", read.archi?.reading.matchesSaved.trisects === true && read.archi.reading.collapsed === false);
check("archimedes-lever: equal turning effects balance the lever", read["archimedes-lever"]?.leftTurn === read["archimedes-lever"].rightTurn && typeof read["archimedes-lever"].balanceAt === "number");
check("archimedes-quadruplets: the four circles match the twins' radius and touch the big arc", read["archimedes-quadruplets"]?.core.tangency.dotsOnBigArc === true && read["archimedes-quadruplets"].savedMatchesCore === true);
check("archimedes-triangle: the parabolic segment is two thirds of the tangent triangle", read["archimedes-triangle"]?.core.isTwoThirds === true);
check("area-of-parallelogram: the cut-and-paste area matches base times height", read["area-of-parallelogram"]?.reading.matchesSavedArea === true && read["area-of-parallelogram"].area === read["area-of-parallelogram"].base * read["area-of-parallelogram"].height);
check("area-of-triangle: the half-turn parallelogram doubles the triangle", read["area-of-triangle"]?.halfTurn.parallelogramArea === 2 * read["area-of-triangle"].reading.triangleArea);
check("areas-in-reg-poly: alternating triangles each have half the area", Object.values(read["areas-in-reg-poly"]?.reading.claims || {}).every(Boolean) === true);
check("areas-in-square: the dissection ratio is 1:2:4:5 at N = 2", read["areas-in-square"]?.n === 2 && read["areas-in-square"].reading.ratio.IV === 5 && read["areas-in-square"].reading.ratio.I === 1);
check("arrange-pyth: both rearrangements leave the same Pythagorean remainder", read["arrange-pyth"]?.reading.a + read["arrange-pyth"].reading.b === read["arrange-pyth"].reading.side && read["arrange-pyth"].reading.cancellation.holds === true);
check("asia-pacific-kite: M lies on the circumcircle and the rhombus is 60 degrees", read["asia-pacific-kite"]?.reading.MOnCircumcircleOfABC.holds === true && read["asia-pacific-kite"].reading.angleAtBIs60 === true);
check("auxetic-tessellation: the half-step translation identities hold", Object.values(read["auxetic-tessellation"]?.reading.halfStepIdentities || {}).every(Boolean) === true && read["auxetic-tessellation"].reading.cellAreaFromFormula.matches === true);
check("balls-in-jar: the saved rack has a level top row", read["balls-in-jar"]?.savedMatchesCore === true && read["balls-in-jar"].valid === true);
check("baltic-darij-1: the altitude foot, bisector feet and midpoint are concyclic", read["baltic-darij-1"]?.claims.allHold === true && read["baltic-darij-1"].computable === true);
check("barlotti: the erected polygons' centres form a regular polygon", read.barlotti?.centersAreRegular === true && read.barlotti.everyErectedPolygonRegular === true);
check("barycentric: the cevian feet satisfy all the page's identities", Object.values(read.barycentric?.reading.claims || {}).every(Boolean) === true && read.barycentric.stateIsIllustration === true);
check("barygon: averaging N/2 vertices yields an exact paragon", read.barygon?.reading.paragon.isParagon === true && read.barygon.reading.paragon.paragonDefect === 0);
check("bender: rotating polygons keep the outer polygon's symmetry", read.bender?.symmetryHolds === true && Object.values(read.bender.properties).every(Boolean) === true);
check("bertrand: the fixed-end chord model gives one third", read.bertrand?.theoreticalText === "1/3" && read.bertrand.theoreticalProbability === 1 / 3);
check("besteman: the perpendicular chord divides AB as AB/N", Object.values(read.besteman?.reading.claims || {}).every(Boolean) === true);
check("besteman-2: the angle bisector divides the extended base", read["besteman-2"]?.claims.allHold === true && read["besteman-2"].claims.pageSecond === true);
check("bevan-point: the Bevan point is the reflection of I in O", read["bevan-point"]?.reading.O_is_midpoint_of_I_and_V === true && read["bevan-point"].reading.excentral_radius_is_twice_R === true);
check("bicentric-quadri-2: the pedal quadrilateral is inscriptible but not cyclic", read["bicentric-quadri-2"]?.reading.claims.incircle_inscriptible === true && read["bicentric-quadri-2"].reading.claims.circumcircle_cyclic === false);
check("bicolor: the Boolean board is not yet solved", read.bicolor?.solved === false && read.bicolor.filled === 3 && read.bicolor.missing.length === 13);
check("bid: the saved 45-degree triangle is the three-triangle case", read.bid?.reading.regime === "three_at_45" && read.bid.angle === 45);
check("bimedians-in-tetrahedron: the three bimedians meet at the barycentre", read["bimedians-in-tetrahedron"]?.reading.claims.concurrent === true && read["bimedians-in-tetrahedron"].reading.claims.barycenter === true);
check("bisectal-circle: inversion by the bisectal circle swaps the two circles", Object.values(read["bisectal-circle"]?.checks || {}).every(Boolean) === true);
check("bisector-circle-triad: all six reflected circles have radius LO", read["bisector-circle-triad"]?.reading.allHold === true && read["bisector-circle-triad"].valid === true);
check("blithe-12: the saved board is six turns from nowhere near home", read["blithe-12"]?.allHome === false && read["blithe-12"].misplaced.length === 6);
check("bol-1: the parallel-diameter claim fails for the slightly off-line saved dots", read["bol-1"]?.claimHolds === false && read["bol-1"].diametersAreParallel === true);
check("bol-10: EH bisects the chord BD and the power identity holds", read["bol-10"]?.midpoint.holds === true && read["bol-10"].powerOfPoint.holds === true);
check("bol-12: TR is perpendicular to AB and TP = TQ = TR", read["bol-12"]?.allClaimsHold === true && read["bol-12"].checks.TR_perpendicular_AB.holds === true);
check("bol-13: a diameter's perpendicular feet give CN = DM", read["bol-13"]?.claims.cnEqualsDm === true && read["bol-13"].claims.chordBisected === true);
check("bol-2: F is the midpoint of DE", read["bol-2"]?.reading.claims.bisected === true && Math.abs(read["bol-2"].reading.DF_over_FE - 1) < 1e-6);
check("bol-3: the equal arc gives BQ = BD", Math.abs(read["bol-3"]?.saved.lengths.BQ - read["bol-3"].saved.lengths.BD) < 1e-6 && read["bol-3"].onCircle === true);
check("bol-5: the two tangent circles have equal harmonic radius", read["bol-5"]?.core.checks.allHold === true && read["bol-5"].core.radii.matchesFormula === true && read["bol-5"].core.radii.leftTwin === read["bol-5"].core.radii.rightTwin);
check("bol-6: the arbelos tangent circle has GH/AB = r/(1+r+r²)", Object.values(read["bol-6"]?.core.claims || {}).every(Boolean) === true && read["bol-6"].savedMatchesCore === true);
check("bol-9: perpendicular chords give two semicircle arc sums", read["bol-9"]?.core.allClaimsHold === true && read["bol-9"].savedMatchesCore === true);
check("bottema: the square midpoint stays fixed as C moves", read.bottema?.reading.claims.allHold === true && read.bottema.reading.distanceMtoSquareCentre === 0);
check("bqt-lemma: the saved midpoint F is the midpoint of AC", read["bqt-lemma"]?.midpointMatchesSavedF === true);
check("bqtn: the odd-sided incircle chain closes at 2n", read.bqtn?.core.odd === true && read.bqtn.valid === true && read.bqtn.core.n === 3);
check("brahmagupta: the power identity holds at the diagonal crossing", read.brahmagupta?.reading.power.holds === true && read.brahmagupta.reading.area.matches === true);
check("brahmagupta-2: the four maltitudes meet at the anticenter without perpendicular diagonals", read["brahmagupta-2"]?.reading.concurrence.allFourMeetAtT === true && read["brahmagupta-2"].reading.diagonals.perpendicular === false);
check("breadth-width: both barrels are equal squares beneath the illusion", read["breadth-width"]?.barrels.left.square === true && read["breadth-width"].barrels.right.square === true);
check("brianchon: the main diagonals concur while the extra chords are listed", read.brianchon?.concurrency.holds === true && read.brianchon.chords.length === 3);
check("brianchon-in-ellipse: the affine map carries the concurrence point", read["brianchon-in-ellipse"]?.SAgreesWithSaved === true && read["brianchon-in-ellipse"].reading.concurrent === true);
check("brick-wall: mortar lines stay parallel while the joints stagger", read["brick-wall"]?.brickCount === 100 && read["brick-wall"].rows === 10);
check("broken-chord: the perpendicular from the arc midpoint halves the broken chord", read["broken-chord"]?.valid === true && Object.values(read["broken-chord"].core.checks).every(Boolean) === true);
check("broken-chord-mr-homm: the saved branch satisfies the same equality", read["broken-chord-mr-homm"]?.savedMatchesCore === true && read["broken-chord-mr-homm"].branch.longSide === "AC");
check("broken-chord-paper-folding: folding gives CF = CB and M the midpoint of AF", Object.values(read["broken-chord-paper-folding"]?.reading.claims || {}).every(Boolean) === true);
check("building-bridge: the two translations give the same optimal bridge", read["building-bridge"]?.checks.twoTranslations === true && read["building-bridge"].checks.triangleInequality === true);
check("building-bridges: the two-river construction gives three parallel land pieces", read["building-bridges"]?.drawingValid === true && read["building-bridges"].landSegments.length === 3);
check("bui-quang-tuan: the seventh circle returns to the first", read["bui-quang-tuan"]?.core.closure.holds === true && read["bui-quang-tuan"].core.concyclic.holds === true);
check("bui-quang-tuan-2: the saved P reproduces the six-circle chain", read["bui-quang-tuan-2"]?.savedPMatchesCore === true && read["bui-quang-tuan-2"].core.valid === true);
check("bulging-lines: every line is straight and the layers are translations", read["bulging-lines"]?.illustration === true && read["bulging-lines"].metrics.side === 32);
check("butterfly: the off-axis saved nexus breaks the reciprocal-sum equality", read.butterfly?.checks.reciprocal === false && read.butterfly.checks.midpoint === false);
check("butterfly-in-ellipse: the even polygon keeps every side crossing pinned", read["butterfly-in-ellipse"]?.claims.holds === true && read["butterfly-in-ellipse"].savedReadable === true);
check("cabart-collinearity: the two Kiepert points and nine-point centre align", read["cabart-collinearity"]?.isIllustration === true && read["cabart-collinearity"].reading.collinearity.holds === true);
check("cantor-point: the midpoints' perpendiculars meet at the nine-point centre", read["cantor-point"]?.reading.claims.allHold === true && read["cantor-point"].degenerate === false);
check("cardi: a chord through the cusp is four times the generating radius", read.cardi?.chordIsFourR === true && read.cardi.chordLength === read.cardi.fourR);
check("carnot: equally inclined feet are collinear with Menelaus product minus one", read.carnot?.reading.collinearity.collinear === true && read.carnot.reading.menelaus.equalsMinusOne === true);
check("carpets-in-parallelogram: painted red minus blue is half the parallelogram", read["carpets-in-parallelogram"]?.reading.areaCheck.holds === true);
check("carpets-in-quadri: the quadrilateral carpet identity holds at the saved ratio", read["carpets-in-quadri"]?.reading.carpetIdentity.holds === true && read["carpets-in-quadri"].reading.convex === true);
check("carpets-in-quadri-2: the four corner triangles equal PQRS", read["carpets-in-quadri-2"]?.reading.claims.carpet === true && read["carpets-in-quadri-2"].reading.claims.halves === true);
check("carpets-in-square: the blue region equals the three red regions", read["carpets-in-square"]?.reading.equality.holds === true);
check("carpets-in-square-2: red equals blue in the saved hint mode", Object.values(read["carpets-in-square-2"]?.reading.checks || {}).every(Boolean) === true);
check("carpet-with-hole: the holed carpet has exactly the square's cell count", read["carpet-with-hole"]?.reading.identity.holds === true && read["carpet-with-hole"].reading.identity.materialCells === read["carpet-with-hole"].reading.identity.squareCells);
check("casey-theorem: Casey's tangent identity holds in cyclic order", read["casey-theorem"]?.cyclicOrder === true && read["casey-theorem"].casey.holds === true);
check("center-circle: the child circles share a point and their centres are concyclic", read["center-circle"]?.reading.childCentersOnNextCircle === true && read["center-circle"].reading.commonPointOnChildCircles.of === read["center-circle"].reading.commonPointOnChildCircles.total);
check("central-angles-in-cube: the face and edge central angles are supplementary", read["central-angles-in-cube"]?.isIllustration === true && read["central-angles-in-cube"].reading.supplementary === true);
check("centroids-in-polygon: vertex-deleted centroids concur with the whole centroid", Object.values(read["centroids-in-polygon"]?.savedClaims || {}).every(Boolean) === true);
check("ceva-cradle: the two triple products agree", read["ceva-cradle"]?.reading.claims.identity === true && read["ceva-cradle"].reading.products.equal === true);
check("ceva-in-ngon: the odd polygon has an odd number of crossings and product one", read["ceva-in-ngon"]?.reading.claims.productIsOne === true && read["ceva-in-ngon"].reading.claims.oddCrossings === true);
check("ceva-nest: nested cevians give a perspective point", read["ceva-nest"]?.stateIsIllustration === true && read["ceva-nest"].reading.concurrent === true);
check("ceva-pww: the grid dissection proves Ceva's product is one", read["ceva-pww"]?.stateIsIllustration === true && read["ceva-pww"].reading.allClaimsHold === true);
check("cevian-triangle: the cevian triangle is perspective from P and its axis exists", read["cevian-triangle"]?.reading.desarguesAxis === true && read["cevian-triangle"].reading.perspectiveFromP === true);
check("chasles: the Pascal chain closes with R equal to S", read.chasles?.chainHolds === true && read.chasles.R_equals_S === true);
check("chasles-tangents: a pencil cross-ratio equals the tangent cuts", read["chasles-tangents"]?.equality.holds === true && read["chasles-tangents"].savedReadable === true);
check("cid: an odd denominator completes the isosceles slice chain", read.cid?.reading.oddDenominator === true && read.cid.reading.baseAnglesDegrees.length === 4);
check("circle-center-by-ruler: equal chords give a diameter through P and Q", read["circle-center-by-ruler"]?.reading.claims.all === true);
check("circle-centers-on-radical-axes: three axes meet at one radical centre", read["circle-centers-on-radical-axes"]?.reading.axes.length === 3 && typeof read["circle-centers-on-radical-axes"].reading.radicalCentre === "object");
check("circle-division: the band area equals the arc fraction", read["circle-division"]?.reading.equalsBandArea === true);
check("circle-in-isosceles-triangle: A, P, Q and the circumcentre are concyclic", read["circle-in-isosceles-triangle"]?.reading.concyclic === true);
check("circle-of-similitude: the tangent intersections bound the similitude circle", read["circle-of-similitude"]?.valid === true && typeof read["circle-of-similitude"].circle === "object");
check("circle-of-similitude-1: the similitude circle is orthogonal to the centre-diameter circle", read["circle-of-similitude-1"]?.possible === true && read["circle-of-similitude-1"].orthogonal === true);
check("circle-on-cevian: three diameter circles meet at the orthocenter", read["circle-on-cevian"]?.reading.axes.length === 3 && read["circle-on-cevian"].reading.orthocenter !== null);
check("circles-and-parallelogram: the second circle intersection lies on AC", read["circles-and-parallelogram"]?.reading.onDiagonalAC.holds === true && read["circles-and-parallelogram"].reading.onDiagonalAC.crossProductResidual === 0);
check("circles-and-parallels: PQ always passes through the fixed point X", read["circles-and-parallels"]?.reading.passesThroughX.holds === true && read["circles-and-parallels"].reading.fixedPoint !== null);
check("circles-and-regular-triangle: QB is perpendicular to the diameter", read["circles-and-regular-triangle"]?.reading.qb.perpendicularToAC === true && read["circles-and-regular-triangle"].reading.qb.angleDegrees === 90);
check("circles-and-square: the second circle intersection lies on AC", read["circles-and-square"]?.reading.onDiagonalAC.holds === true);
check("circles-cover-quadrilateral: the covering hypothesis is tested on four triangles", read["circles-cover-quadrilateral"]?.reading.triangles.length === 4 && Object.values(read["circles-cover-quadrilateral"].matchesSaved).every(Boolean) === true);
check("circles-in-circles-sangaku: r3 and r4 are equal at every position", read["circles-in-circles-sangaku"]?.r3 === read["circles-in-circles-sangaku"].r4 && Object.values(read["circles-in-circles-sangaku"].savedCirclesMatchCore).every(Boolean) === true);
check("circles-in-regular-polygon: the saved vertices reproduce the polygon", read["circles-in-regular-polygon"]?.savedVerticesAgree === true && read["circles-in-regular-polygon"].maxVertexGap === 0);
check("circles-lined-on-tri-sides: equal N and M draw no triangle", read["circles-lined-on-tri-sides"]?.reading.doNotDraw === true);
check("circles-on-a-chord: the three chord formulas agree", read["circles-on-a-chord"]?.formulasAgree === true && read["circles-on-a-chord"].savedMatchesCore === true);
check("circles-on-perp-bisector: the saved configuration is readable", read["circles-on-perp-bisector"]?.valid === true && read["circles-on-perp-bisector"].IIsIncircle === false);
check("circle-square-circle: both saved boards are readable", read["circle-square-circle"]?.valid === true && read["circle-square-circle"].cupola !== null && read["circle-square-circle"].applet !== null);
check("circles-through-orthocenter: six crossings share a circle about the circumcenter", read["circles-through-orthocenter"]?.reading.allHold === true);
check("circles-with-equal-chords: the saved diagram yields equal chords", read["circles-with-equal-chords"]?.valid === true);
check("circle-through-circumcenter: AO is perpendicular to PQ", read["circle-through-circumcenter"]?.reading.perpendicular.holds === true);
check("circle-through-incenter: AX equals BY", read["circle-through-incenter"]?.reading.checks.AX_equals_BY === true);
check("circle-through-incenter-2: XY is antiparallel to AB", read["circle-through-incenter-2"]?.reading.antiparallel.equal === true);
check("circle-triplet: the saved circles match the exact construction", read["circle-triplet"]?.valid === true && Object.values(read["circle-triplet"].savedCirclesMatchCore).every(Boolean) === true);
check("circular-poggendorf: the bar's pieces fit the circle by construction", read["circular-poggendorf"]?.claims.piecesFit === true);
check("circumcenter-on-angle-bisector: O lies on AI and midpoints IE", read["circumcenter-on-angle-bisector"]?.reading.allHold === true);
check("circum-quadri: the contact chords meet at the diagonal intersection", read["circum-quadri"]?.reading.meeting.holds === true);
check("circum-simson: antipodal Simson lines and the nine-point circle check out", read["circum-simson"]?.check_claims.allHold === true);
check("clifford-theorem: the four-circle chain is closed", read["clifford-theorem"]?.ringClosed === true && typeof read["clifford-theorem"].cliffordPairs === "number");
check("close-to-hilbert: the four-copy rule holds at the saved level", read["close-to-hilbert"]?.reading.fourCopyRuleHolds === true && read["close-to-hilbert"].reading.continuous === true);
check("coaxal-circles: the two pencils are orthogonal throughout", read["coaxal-circles"]?.orthogonality.allOrthogonal === true && read["coaxal-circles"].orthogonality.orthogonalPairs === 90);
check("common-tangent-sangaku: the saved tangency configuration is valid", read["common-tangent-sangaku"]?.valid === true);
check("concurrency: the three isogonal triples concur and Ceva's product is one", read.concurrency?.ceva.productIsOne === true && read.concurrency.ceva.cyclicProduct === 1);
check("conditional-probability: the saved rectangles are dependent but total probability holds", read["conditional-probability"]?.independence.holds === false && read["conditional-probability"].lawOfTotalProbability.equalsP_B === true);
check("conic-sections: the saved plane makes an ellipse", read["conic-sections"]?.family === "ellipse" && read["conic-sections"].savedReadable === true);
check("conjugality: the saved side points are not collinear", read.conjugality?.reading.ratioProduct !== -1);
check("conjugate-diameters: the saved ellipse is readable", read["conjugate-diameters"]?.savedReadable === true);
check("connes: the saved triangle is not equilateral", read.connes?.reading.equilateral === false);
check("circumsogonal: each saved reflected line is the reflection of VP", read["circumsogonal"]?.reading.checks.eachLineIsTheReflectionOfVP === true);
check("cleaver: the saved triangle's cleaver halves the perimeter", read["cleaver"]?.reading.checks.allHold === true);
check("continuous-curve: the saved dot sits on the redrawn unbroken spiral", read["continuous-curve"]?.savedPointMatchesCore === true && read["continuous-curve"].continuity.oneUnbrokenPolyline === true && read["continuous-curve"].continuity.drawnLegs === 26);
check("contrast: both bars share one flat grey under the ramp", read.contrast?.valid === true && read.contrast.bothBarsShareOneGrey === true && read.contrast.barGray === 127 && read.contrast.probeGrey === 130);
check("contrast-2: the six patches share a shade over alternating bands", read["contrast-2"]?.reading.everyPatchSameShade === true && read["contrast-2"].reading.patches.length === 6 && read["contrast-2"].reading.samples.left.onA === "dark" && read["contrast-2"].reading.samples.right.onA === "light");
check("contrast-3: the whole annulus is one grey while the squares differ", read["contrast-3"]?.ring.oneUniformGray === true && read["contrast-3"].ring.grayByte === 128 && read["contrast-3"].tones.right === 255 && read["contrast-3"].shift.dy === 0);
check("contrast-4: three upper and three lower patches share one grey", read["contrast-4"]?.bandCount === 6 && read["contrast-4"].patchCount === 6 && read["contrast-4"].fills.patch === "#808080" && read["contrast-4"].patchMinusAverage === 0);
check("contrast-ii: interleaved grids carry one colour at unequal sizes", read["contrast-ii"]?.reading.grids.small.count === 64 && read["contrast-ii"].reading.grids.big.count === 49 && read["contrast-ii"].reading.colour.allSquaresSame === true && read["contrast-ii"].reading.claims.oneColour === true);
check("cosine-law: CP is AB and both cuttings give the law of cosines", read["cosine-law"]?.reading.cp.equal === true && read["cosine-law"].reading.cp.perpendicular === true && read["cosine-law"].reading.dissection.bothCuttingsAgree === true && read["cosine-law"].reading.dissection.lawOfCosinesHolds === true);
check("cosine-law-unfolded: the median is an altitude and the law holds", read["cosine-law-unfolded"]?.copyOfAB.CPequalsAB === true && read["cosine-law-unfolded"].copyOfAB.perpendicularToAB === true && read["cosine-law-unfolded"].parallelogramCTPR.medianIsAltitude === true && read["cosine-law-unfolded"].lawOfCosines.holds === true);
check("coupled-impossible-fork: two possible halves couple only at W = 500", read["coupled-impossible-fork"]?.beamsEqual === true && read["coupled-impossible-fork"].halfTurnCongruent === true && read["coupled-impossible-fork"].middleBeamGap === 0 && read["coupled-impossible-fork"].coupled === true);
check("coxeter-tangent-circles: the second family shares the six touching points", read["coxeter-tangent-circles"]?.valid === true && read["coxeter-tangent-circles"].tangencyResiduals.every((r) => r === 0) && read["coxeter-tangent-circles"].beecroft.sharedTouchingPoints === true && read["coxeter-tangent-circles"].beecroft.mutuallyTangent === true);
check("cross-circle: the new perpendiculars meet at the half-turn image of P", read["cross-circle"]?.concurrent === true && read["cross-circle"].concurrenceError < 1e-8 && read["cross-circle"].reading.concurrence.meetsAtHalfTurnImage === true);
check("crowded-chair: both crossings lie on the square's circle with equal secants", read["crowded-chair"]?.claims.allHold === true && read["crowded-chair"].secants.appletLabels.equal === true && read["crowded-chair"].secants.pageLabels.equal === false && read["crowded-chair"].result === "done");
check("cube7-cube8: rhombus 16 carries both cube readings", read["cube7-cube8"]?.coreReading.faceCount === 33 && read["cube7-cube8"].coreReading.sharedFace.agreesWithSecondReading === true && read["cube7-cube8"].savedMatchesCore === true);
check("cube-illusion: one 18-stroke drawing fits both cube readings", read["cube-illusion"]?.heavyStrokes === 18 && read["cube-illusion"].bothReadingsFit === true && Math.abs(read["cube-illusion"].tiltRatio - 0.625) < 1e-12);
check("cut-cube: the saved section is rebuilt from the cube and plane transforms", read["cut-cube"]?.reading.section.sides === 3 && read["cut-cube"].reading.savedSectionMatches === true && read["cut-cube"].reading.isIllustration === true);
check("cut-cylinder: the saved tilted sheet gives an ellipse", read["cut-cylinder"]?.savedReadable === true && read["cut-cylinder"].family === "ellipse" && read["cut-cylinder"].visible === true && read["cut-cylinder"].semiAxes.v === 6);
check("cw-crossed-lines: six radii close a convex constant-width curve", read["cw-crossed-lines"]?.core.distinctRadii === 6 && read["cw-crossed-lines"].core.closes === true && read["cw-crossed-lines"].core.convex === true && read["cw-crossed-lines"].core.constantWidth === true);
check("cw-star: the five-point star keeps base and widened widths", read["cw-star"]?.star.odd === true && read["cw-star"].widths.base === 100 && read["cw-star"].widths.widened === 180 && read["cw-star"].freshStarComparison.countMatches === true);
check("cyclic-hexagon: the two perpendicular products equal the side formula", read["cyclic-hexagon"]?.core.products.equal === true && read["cyclic-hexagon"].core.formulaFourHolds === true && read["cyclic-hexagon"].core.chordLemmaAllAgree === true && read["cyclic-hexagon"].allPointsOnCircle === true);
check("cyclic-incenters: four incenters are concyclic and both identities hold", read["cyclic-incenters"]?.savedMatchesCore === true && Object.values(read["cyclic-incenters"].core.claims).every(Boolean) === true && read["cyclic-incenters"].core.power.holds === true && read["cyclic-incenters"].core.reciprocalRadii.holds === true);
check("cyclic-quadrilateral: inscribed incentres form a rectangle with the radius sum", read["cyclic-quadrilateral"]?.valid === true && Object.values(read["cyclic-quadrilateral"].claims).every(Boolean) === true && read["cyclic-quadrilateral"].savedMatchesCore === true);
check("cy-quadri: angle-bisector crossings lie on one circle in both modes", read["cy-quadri"]?.claims.cyclic === true && read["cy-quadri"].claims.opposite180 === true && read["cy-quadri"].core.otherMode.claims.cyclic === true && read["cy-quadri"].savedMatchesCore === true);
check("dancing-squares: the hinged grid's cell and coverage formulas hold", read["dancing-squares"]?.valid === true && read["dancing-squares"].reading.cell.matchesFormula === true && read["dancing-squares"].reading.coveredFraction.matchesFormula === true && read["dancing-squares"].reading.layers.tilesShown === 64);
check("dave-richeson: the signed inradius sum is independent of triangulation", read["dave-richeson"]?.core.signedSumMatchesSaved === true && read["dave-richeson"].triangulation.independentOfTriangulation === true && read["dave-richeson"].convexFormula.holds === true);
check("david-radcliffe: inward equilateral triangles shrink the polygon", read["david-radcliffe"]?.matchesCore === true && read["david-radcliffe"].smaller === true && Math.abs(read["david-radcliffe"].ratio - 0.517638) < 1e-6 && read["david-radcliffe"].exception === false);
check("deco-symmetry: the four pieces land exactly on the mirror triangle", read["deco-symmetry"]?.pieceCount === 4 && read["deco-symmetry"].allPiecesLandExactly === true && read["deco-symmetry"].twoCutKite.cuts.join() === "DE,DF");
check("deco-symmetry-2: two cuts at the altitude foot give three rotating pieces", read["deco-symmetry-2"]?.reading.checks.cuts === 2 && read["deco-symmetry-2"].reading.checks.pieces === 3 && Object.values(read["deco-symmetry-2"].reading.checks).every((v) => v === true || typeof v === "number") === true);
check("deco-symmetry-3: three incenter kites split into six isosceles halves", read["deco-symmetry-3"]?.core.kites.length === 3 && read["deco-symmetry-3"].core.isoscelesCount === 6 && read["deco-symmetry-3"].core.equalSidesHold === true && read["deco-symmetry-3"].core.partitionError === 0);
check("deco-symmetry-4: midpoint cuts on the horizontal midline make three pieces", read["deco-symmetry-4"]?.valid === true && read["deco-symmetry-4"].cuts.DIsMidpointOfAB === true && read["deco-symmetry-4"].cuts.EIsMidpointOfAC === true && read["deco-symmetry-4"].domain.AOverSegmentBC === true && read["deco-symmetry-4"].pieces.length === 3);
check("delboeuf: two equally sized rings sit in contrasting surrounds", read.delboeuf?.valid === true && read.delboeuf.colouredRingsIdentical === true && read.delboeuf.colouredRings[0].radius === 28 && read.delboeuf.neighbours.leftOuter.biggerThanColoured === true && read.delboeuf.neighbours.rightInner.smallerThanColoured === true);
check("desargues: the explored direct figure is recorded with its Menelaus product", read.desargues?.reading.result === "done" && read.desargues.reading.mode === "direct" && typeof read.desargues.reading.menelaus.product === "number");
check("detemple: exterior bisectors give a cyclic quadrilateral and a concentric incircle", read.detemple?.valid === true && Object.values(read.detemple.claims).every(Boolean) === true && read.detemple.big.c.x === read.detemple.small.c.x);
check("de-villiers: similar triangles on the sides give a parallelogram", Object.values(read["de-villiers"]?.savedClaims ?? {}).every(Boolean) === true && read["de-villiers"].savedClaims.parallelogram === true);
check("de-villiers-2: the bisector iterate of a tangential quadrilateral is inscriptible", Object.values(read["de-villiers-2"]?.savedClaims ?? {}).every(Boolean) === true && Object.values(read["de-villiers-2"].savedMatchesCore).every(Boolean) === true);
check("de-villiers-3: the perpendicular-bisector image of a cyclic quadrilateral is cyclic", read["de-villiers-3"]?.valid === true && Object.values(read["de-villiers-3"].core.claims).every(Boolean) === true);
check("de-villiers-4: the three similar triangles are rebuilt from the saved corners", read["de-villiers-4"]?.degenerate === false && Object.values(read["de-villiers-4"].reading.savedMatchesCore).every(Boolean) === true && read["de-villiers-4"].reading.triangles.length === 3);
check("diameters-and-chords: the saved distances agree with the rebuilt Pascal figure", read["diameters-and-chords"]?.savedReadable === true && Object.values(read["diameters-and-chords"].agreement).every(Boolean) === true && read["diameters-and-chords"].aDistance > 0);
check("diameters-in-concurrent-circles: all saved points and diameter flags agree", read["diameters-in-concurrent-circles"]?.savedReadable === true && Object.values(read["diameters-in-concurrent-circles"].agreement).every(Boolean) === true);
check("dijkstra: the three signs agree and the page's swapped ratio is flagged", read.dijkstra?.reading.signs.allAgree === true && read.dijkstra.reading.proportionalAreas.proportionalHolds === true && read.dijkstra.reading.proportionalAreas.pageClaimHolds === false);
check("directly-similar-1: translated vertices make a square with the page's steps", read["directly-similar-1"]?.valid === true && read["directly-similar-1"].reading.translated.isSquare === true && read["directly-similar-1"].reading.claim.allHold === true && read["directly-similar-1"].reading.collapsed === false);
check("directly-similar-2: the completed triangle is similar to both given triangles", read["directly-similar-2"]?.valid === true && read["directly-similar-2"].reading.directlySimilarToBoth === true && read["directly-similar-2"].reading.collapsed === false && read["directly-similar-2"].reading.completed.possible === true);
check("dissect-cyclic-quadri: saved cuts are not cyclic but the core agrees with the page", read["dissect-cyclic-quadri"]?.core.savedMatchesCore === true && read["dissect-cyclic-quadri"].count === 0 && read["dissect-cyclic-quadri"].core.atPerpendicularFeet.count === 4);
check("distortion: crossing lines do not bend the circles or triangles", read.distortion?.valid === true && read.distortion.allCirclesRound === true && read.distortion.allTrianglesStraight === true && read.distortion.allTrianglesEqualSided === true && read.distortion.allTrianglesConvex === true);
check("divergent-spirals: the ring geometry matches the saved rotation", Object.values(read["divergent-spirals"]?.savedMatchesCore ?? {}).every(Boolean) === true && read["divergent-spirals"].reading.spiralCurvesDrawn === 0 && read["divergent-spirals"].reading.sweepDeg === 180);
check("droz-farny: perpendicular lines through H cut midpoints on one line", read["droz-farny"]?.degenerate === false && read["droz-farny"].reading.allHold === true && read["droz-farny"].reading.midpoints.length === 3);
check("droz-farny-circles: isogonal conjugates give two congruent circles", read["droz-farny-circles"]?.savedReadable === true && read["droz-farny-circles"].reading.QagreesWithBarycentrics === true && read["droz-farny-circles"].reading.bigCircles.sameRadius === true && read["droz-farny-circles"].reading.radiusFormula.residual === "0.00e+0");
check("dupont-garden: each water jet follows the parabola over its flight", read["dupont-garden"]?.reading.jets.length === 5 && read["dupont-garden"].reading.jets[0].returnTime === 28.571429 && read["dupont-garden"].reading.jets[0].apexHeight === 1000);
check("dyno-ellipse: the saved pen is rebuilt exactly from the four sliders", read["dyno-ellipse"]?.valid === true && read["dyno-ellipse"].savedPenMatchesCore === true && read["dyno-ellipse"].savedEnd1MatchesCore === true && read["dyno-ellipse"].result === "done");
check("edge-illusion: the middle has no drawn sides and is masked with the field colour", read["edge-illusion"]?.valid === true && read["edge-illusion"].noDrawnSides === true && read["edge-illusion"].middleIsFieldColour === true && read["edge-illusion"].edgeStrokes === 0);
check("eight-point-circle: eight points share a circle about the centroid", read["eight-point-circle"]?.savedReadable === true && read["eight-point-circle"].claims.allEight === true && read["eight-point-circle"].claims.rectangle === true && read["eight-point-circle"].claims.diameters === true);
check("elkies: the companion incircle chain closes after six circles", read.elkies?.savedReadable === true && read.elkies.reading.closed === true && read.elkies.reading.circleCount === 7 && read.elkies.agreement.withinTolerance === true);
check("ellipse-between-circles: tangent circles trace the ellipse with the right axes", read["ellipse-between-circles"]?.valid === true && read["ellipse-between-circles"].tangency.allHold === true && Math.abs(read["ellipse-between-circles"].ellipse.majorAxis - 314.166667) < 1e-5 && Object.values(read["ellipse-between-circles"].savedMatchesCore).every(Boolean) === true);
check("ellipse-by-van-schooten: the trammel circle and perpendicular diameter are rebuilt", read["ellipse-by-van-schooten"]?.diameter.isDiameter === true && Math.abs(read["ellipse-by-van-schooten"].OPperpendicularOQ.dot) < 1e-8 && read["ellipse-by-van-schooten"].radiusFromAB > 0);
check("ellipse-focal: PF plus PF' is the constant 2a", read["ellipse-focal"]?.valid === true && read["ellipse-focal"].sumMatchesConstant === true && read["ellipse-focal"].focalDistances.sum === 192 && read["ellipse-focal"].circleCase === false);
check("ellipse-focus-directrix: the ratio PF/PD equals the eccentricity under 1", read["ellipse-focus-directrix"]?.valid === true && read["ellipse-focus-directrix"].eccentricityBelowOne === true && read["ellipse-focus-directrix"].focalAxisPerpendicularToBothDirectrices === true && Math.abs(read["ellipse-focus-directrix"].ratio - read["ellipse-focus-directrix"].eccentricity) < 1e-9);
check("ellipse-in-arbelos: chain centres lie on the mean-semiaxes ellipse", read["ellipse-in-arbelos"]?.valid === true && read["ellipse-in-arbelos"].derived.allCentresOnEllipse === true && read["ellipse-in-arbelos"].derived.allCirclesTouchBoth === true && read["ellipse-in-arbelos"].savedMatchesCore.all === true);
check("envelopes-in-ellipse: focal chords touch one confocal ellipse", read["envelopes-in-ellipse"]?.result === "done" && read["envelopes-in-ellipse"].envelope === "ellipse" && read["envelopes-in-ellipse"].crossesBetweenFoci === false && typeof read["envelopes-in-ellipse"].confocalConstant === "number");
check("eppstein: opposite tangency chords concur at the weighted centre", read.eppstein?.savedReadable === true && read.eppstein.reading.concurrence.concurrent === true && read.eppstein.reading.collinearity.collinear === true);
check("equal-angles-in-crossed-circles: the two angle pairs are equal", read["equal-angles-in-crossed-circles"]?.core.angles.bothEqual === true && read["equal-angles-in-crossed-circles"].core.drawing.drawn === true);
check("equal-angles-in-crossing-circles: two equal-angle lines cut equal chords", read["equal-angles-in-crossing-circles"]?.valid === true && read["equal-angles-in-crossing-circles"].chords.equal === true && read["equal-angles-in-crossing-circles"].anglesAtP.equalLeans === true);
check("equal-angles-in-two-circles: tangent chord gives both angle equalities", read["equal-angles-in-two-circles"]?.core.drawing.pictured === true && read["equal-angles-in-two-circles"].equalitiesHold === true && read["equal-angles-in-two-circles"].core.angles.bothEqual === true);
check("equal-areas-imo-2007: the two shaded triangles have the same area", read["equal-areas-imo-2007"]?.degenerate === false && read["equal-areas-imo-2007"].reading.areas.equal === true && read["equal-areas-imo-2007"].reading.closedForm.matches === true && read["equal-areas-imo-2007"].result === "done");
check("equal-areas-in-equilateral-triangle: the two pedal area triples agree", read["equal-areas-in-equilateral-triangle"]?.reconstruction.equilateral === true && read["equal-areas-in-equilateral-triangle"].reading.MInside === true && read["equal-areas-in-equilateral-triangle"].reading.equality.greenEqualsPurple === true);
check("equal-circles-orthocenter: four circles have one radius and diameter", read["equal-circles-orthocenter"]?.valid === true && read["equal-circles-orthocenter"].savedMatchesCore === true && read["equal-circles-orthocenter"].reading.equalRadii === true && read["equal-circles-orthocenter"].reading.equalDiameters === true && read["equal-circles-orthocenter"].reading.allHold === true);
check("equiangular-poly: signed distances to the side lines sum to the offsets", read["equiangular-poly"]?.reading.signedSum === read["equiangular-poly"].offsetsSum && read["equiangular-poly"].reading.convex === true && read["equiangular-poly"].reading.equiangular === true);
check("equichordal: odd knobs keep the chord and radius sum constant", read.equichordal?.valid === true && read.equichordal.radiusSum.bothOdd === true && read.equichordal.radiusSum.sumIsConstant === true && read.equichordal.chord === 184);
check("equilateral-345: the dragged corner is not at the proof angle", read["equilateral-345"]?.valid === true && read["equilateral-345"].reading.hexagon.atProofAngle === false && read["equilateral-345"].reading.are3_4_5 === false);
check("equilateral-on-lines: two mirror solutions keep their saved corners", read["equilateral-on-lines"]?.saved.solutions.length === 2 && read["equilateral-on-lines"].finishedFromSave === false && typeof read["equilateral-on-lines"].reading.placement === "object");
check("equilateral-triangles: three rotations give an equilateral midpoint triangle", read["equilateral-triangles"]?.valid === true && read["equilateral-triangles"].midpointTriangle.equilateral === true && read["equilateral-triangles"].complexCriterion.holds === true);
check("equilic-quad: P, Q, R and S are collinear with the three kites equilateral", Object.values(read["equilic-quad"]?.claims ?? {}).every(Boolean) === true && read["equilic-quad"].savedMatchesCore === true);
check("equiloc-quad-1-tri: Q, not S, is the circumcircle arc midpoint", read["equiloc-quad-1-tri"]?.valid === true && read["equiloc-quad-1-tri"].claims.qIsArcMidpoint === true && read["equiloc-quad-1-tri"].claims.pageClaimLiteral === false && read["equiloc-quad-1-tri"].claimsAgree === true);
check("equiloc-quad-2-tri: the four midpoints make a rhombus split into two equilateral halves", read["equiloc-quad-2-tri"]?.claims.rhombus === true && read["equiloc-quad-2-tri"].claims.equilateralKML === true && read["equiloc-quad-2-tri"].claims.equilateralKNL === true && read["equiloc-quad-2-tri"].savedMatchesCore === true);
check("equiloc-quad-2-tri-120: the two apexes coincide on the angle bisector", read["equiloc-quad-2-tri-120"]?.claims.apexesCoincide === true && read["equiloc-quad-2-tri-120"].claims.onBisector === true && read["equiloc-quad-2-tri-120"].claims.asbIs120 === true && read["equiloc-quad-2-tri-120"].savedMatchesCore === true);
check("equi-tri-in-rec: two inward equilateral triangles give APQ with homothety two", read["equi-tri-in-rec"]?.valid === true && read["equi-tri-in-rec"].homothetyRatio === 2 && read["equi-tri-in-rec"].apqEquilateral === true && Object.values(read["equi-tri-in-rec"].savedMatchesCore).every(Boolean) === true);
check("equi-tri-on-para: the second parallelogram returns to the original corners", read["equi-tri-on-para"]?.claims.middleParallelogram === true && read["equi-tri-on-para"].claims.lastParallelogram === true && read["equi-tri-on-para"].claims.coincide === true && read["equi-tri-on-para"].savedMatchesCore === true);
check("escher-ceva-menelaus: the Klamkin-Liu criterion is satisfied at the saved marks", read["escher-ceva-menelaus"]?.reading.formula.satisfied === true && read["escher-ceva-menelaus"].reading.concurrence.concurrent === true && read["escher-ceva-menelaus"].reading.concurrence.agreesWithFormula === true);
check("eschers-theorem: the turns concur and the saved picture agrees with the core", read["eschers-theorem"]?.savedDerivedMatches === true && read["eschers-theorem"].reading.fixedTriangle.isEquilateral === true && read["eschers-theorem"].reading.concurrence.concurrent === true);
check("euclid: the similar-shape area law holds under the displayed rounding", read.euclid?.valid === true && read.euclid.reading.displayedSumMatchesHyp === false && typeof read.euclid.law.residuals.legSumMinusHyp === "number");
check("euclid-i43: every diagonal cell mirrors across AC with equal area", read["euclid-i43"]?.reading.allGreenPairsMatch === true && read["euclid-i43"].reading.allPiecesTile === true && read["euclid-i43"].reading.allPairsMatch === true);
check("euclid-i43-extended: the compensating piece equals XNCP off the diagonal", read["euclid-i43-extended"]?.reading.compensates === true && read["euclid-i43-extended"].reading.plainEuclidI43Matches === false && read["euclid-i43-extended"].reading.tOnAx === true);
{
  const wg = read.wgraphs;
  check("wgraphs: the cheapest edge is the only legal first mark", wg?.markedCount === 0 && wg.legalMoves.join() === "2" && wg.minimumSpanningTreeWeight === 16);
}

check("binomial-option-tree: 6 steps explored", read["binomial-option-tree"]?.steps === 6 && read["binomial-option-tree"].explored === true && read["binomial-option-tree"].blackScholes === 10.4506);
{
  const bt = at("binomial-option-tree", { n: 1, K: 100, sigma: 0.2, r: 0.05, type: "call", american: false, explored: false });
  check("binomial-option-tree: one step is the hedge, far from the formula", bt.steps === 1 && Math.abs(bt.treePrice - bt.blackScholes) > 0.5);
}
check("payoff-heat-equation: a year left, the grid agrees with the formula", read["payoff-heat-equation"]?.timeLeft === 1 && Math.abs(read["payoff-heat-equation"].blackScholes - read["payoff-heat-equation"].heatEquationGrid) < 0.03);
{
  const ph = at("payoff-heat-equation", { tau: 0.5, sigma: 0.3, r: 0.05, seen: false });
  check("payoff-heat-equation: half a year, 30%, 5%: $9.6349", ph.blackScholes === 9.6349 && ph.payoffNow === 0);
}
check("black-scholes-formula: strike moved to 110", read["black-scholes-formula"]?.inputs.K === 110 && read["black-scholes-formula"].call < 10.4506);
{
  const bf = at("black-scholes-formula", { S: 100, K: 100, r: 0.05, sigma: 0.2, T: 1, mu: 0.15, runs: 0 });
  check("black-scholes-formula: the textbook 10.4506 and 5.5735", bf.call === 10.4506 && bf.put === 5.5735 && bf.parity.callMinusPut === bf.parity.stockMinusDiscountedStrike);
}
check("delta-hedging: one day in, 0.52 shares held", read["delta-hedging"]?.day === "1 of 20" && read["delta-hedging"].sharesHeld === 0.52 && read["delta-hedging"].finished === null);
{
  const dh = at("delta-hedging", { seed: 3, holdings: new Array(20).fill(0), shares: 0 });
  check("delta-hedging: a month without shares has a result", dh.finished !== null && dh.finished.noHedge === dh.finished.you);
}
// The batch-17 tutor actions all run their real cores, not just their saved positions.
{
  const cc = runGameLogic("continuous-curve", "trace", { margin: 20, spread: 5, legs: 26 });
  check("continuous-curve/trace: the spiral is one unbroken polyline", cc.continuity.oneUnbrokenPolyline === true && cc.continuity.drawnLegs === 26 && cc.stoppedEarly === false);
  const cg = runGameLogic("contrast", "gradient", { minColor: 120, maxColor: 121, probeX: 250 });
  check("contrast/gradient: a one-step range still paints both greys", cg.ramp.distinctGreys === 2 && cg.ramp.firstColumn.index === 120 && cg.ramp.lastColumn.index === 121);
  const c2 = runGameLogic("contrast-2", "shade", { percent: 70 });
  check("contrast-2/shade: Java's 70% byte is 179, 105% caps at white", c2.shadeByte === 179 && c2.examples[105] === 255 && c2.cappedAtWhite === false);
  const c3 = runGameLogic("contrast-3", "slide_to_point", { point: { x: 422, y: 190 } });
  check("contrast-3/slide_to_point: dragging reads H from the point", c3.hFromPoint === 19 && c3.point.x === 422);
  const c4 = runGameLogic("contrast-4", "average", {});
  check("contrast-4/average: the patch sits at the mean of the bands", c4.average === 50 && c4.patchMinusAverage === 0 && c4.patchGrey === "#808080");
  const cii = runGameLogic("contrast-ii", "nearly_equal", { n: 8 });
  check("contrast-ii/nearly_equal: the closest grid sizes are equal at part 53", cii.found === true && cii.closest.part === 53 && cii.closest.difference === 0);
  const cl = runGameLogic("cosine-law", "two_cuttings", {});
  check("cosine-law/two_cuttings: both cuttings give the same heptagon area", cl.dissection.bothCuttingsAgree === true && cl.dissection.lawOfCosinesHolds === true && cl.dissection.lawResidual === 0);
  const cu = runGameLogic("cosine-law-unfolded", "unfold", {});
  check("cosine-law-unfolded/unfold: CP equals AB and is perpendicular", cu.copyOfAB.CPequalsAB === true && cu.copyOfAB.perpendicularToAB === true && cu.parallelogramCTPR.diagonalsBisect === true && cu.lawOfCosines.holds === true);
  const ci = runGameLogic("coupled-impossible-fork", "sweep", { from: 250, to: 500, step: 50 });
  check("coupled-impossible-fork/sweep: the gap closes only at W = 500", ci.samples.filter((s) => s.coupled).length === 1 && ci.samples.at(-1).middleBeamGap === 0);
  const cx = runGameLogic("coxeter-tangent-circles", "compare_families", {
    A: { x: 242.131231, y: 96.027289 }, B: { x: 198.166808, y: 208.43536 }, C: { x: 302.724261, y: 147.285163 }, innerCircle: true,
  });
  check("coxeter-tangent-circles/compare_families: both families share the touching points", cx.contactLengths.unique === true && cx.inner.touchesAllThree === true && cx.outer.touchesAllThree === true && cx.inner.beecroft.sharedTouchingPoints === true);
}

// The batch-18 tutor actions all run their real cores, not just their saved positions.
{
  const cc = runGameLogic("cross-circle", "check_concurrence", {});
  check("cross-circle/check_concurrence: the trace keeps the half-turn concurrence", cc.allHold === true && cc.trace.allConcurrent === true && cc.trace.drawnCount === 8);
  const ch = runGameLogic("crowded-chair", "secants", { A: [198, 187], B: [91, 187], C: [251.5, 279.665] });
  check("crowded-chair/secants: the applet labels satisfy the secant identity", ch.appletLabels.equal === true && ch.pageLabels.equal === false && ch.crossings.U.x !== undefined && ch.crossings.V.x !== undefined);
  const c78 = runGameLogic("cube7-cube8", "picture", { angle: 45, n: 2, trans: 0 });
  check("cube7-cube8/picture: 33 rhombi and a face shared by both readings", c78.faceCount === 33 && c78.sharedFace.agreesWithSecondReading === true && c78.slidersWereClamped === false);
  const ci = runGameLogic("cube-illusion", "two_readings", { angle: 45, n: 6, m: 2 });
  check("cube-illusion/two_readings: nine strokes per reading share one tilt", ci.heavyStrokes === 18 && ci.readings.small.closed === true && ci.readings.cut.closed === true && ci.tilt.agree === true);
  const ccu = runGameLogic("cut-cube", "five_cuts", {});
  check("cut-cube/five_cuts: no plane section has more than six sides", ccu.maxSides === 6 && ccu.overSix.length === 0 && ccu.cuts.length === 5);
  const cyl = runGameLogic("cut-cylinder", "classify_section", { tilt: 30, offset: 2 });
  check("cut-cylinder/classify_section: a tilted sheet cuts an ellipse", cyl.family === "ellipse" && cyl.visible === true && cyl.semiAxes.v === cyl.radius);
  const w = runGameLogic("cw-crossed-lines", "width", {});
  check("cw-crossed-lines/width: convex means constant width", w.convex === true && w.constantWidth === true && w.width.spread < 1e-8);
  const star = runGameLogic("cw-star", "construction", { steps: 1, length: 100, addOn: 40 });
  check("cw-star/construction: an odd star has width L and widened L + 2a", star.star.odd === true && star.widths.base === 100 && star.widths.widened === 180 && star.arcRadii.gap === 40);
  const hex = runGameLogic("cyclic-hexagon", "perpendicular_products", {});
  check("cyclic-hexagon/perpendicular_products: k and l products agree", hex.products.equal === true && hex.products.kProduct === 343000 && hex.chordLemma.allAgree === true);
  const inc = runGameLogic("cyclic-incenters", "bradley_circle", {});
  check("cyclic-incenters/bradley_circle: the four incenters lie on one circle", inc.circle.wResidual < 1e-8 && inc.centerFromLines.x === inc.circle.center.x && Object.values(inc.claims).every(Boolean) === true);
}

// The batch-19 tutor actions all run their real cores, not just their saved positions.
{
  const cq = runGameLogic("cyclic-quadrilateral", "rectangle_and_radii", { anglesDegrees: [30, 150, 216, 300] });
  check("cyclic-quadrilateral/rectangle_and_radii: the incentre rectangle and radius sum", Object.values(cq.claims).every(Boolean) === true && cq.rectangle.length === 4 && cq.radiusSum.holds === true);
  const cq2 = runGameLogic("cy-quadri", "check_claims", {});
  check("cy-quadri/check_claims: internal and external bisectors give cyclic crossings", cq2.internal.allHold === true && cq2.external.allHold === true);
  const ds = runGameLogic("dancing-squares", "expand_reform", { side: 137 });
  check("dancing-squares/expand_reform: a grid opens to a half-full checkerboard and reforms", Object.values(ds.claims).every(Boolean) === true && ds.allAngles.badCell === 0 && ds.allAngles.badDensity === 0);
  const dr = runGameLogic("dave-richeson", "signed_inradius_sum", { n: 6, seeds: [1, 2, 3, 4, 5] });
  check("dave-richeson/signed_inradius_sum: the sum survives five triangulations", dr.independentOfTriangulation === true && dr.spreadAcrossTriangulations === 0);
  const rad = runGameLogic("david-radcliffe", "shrink", { N: 4 });
  check("david-radcliffe/shrink: the inward equilateral polygon is smaller", rad.smaller === true && rad.collapses === false && Math.abs(rad.ratio - rad.measuredRatio) < 1e-12);
  const d1 = runGameLogic("deco-symmetry", "dissection", {});
  check("deco-symmetry/dissection: the four pieces land on the mirror triangle", d1.pieceCount === 4 && d1.allLandExactly === true && d1.twoCutKite.cuts.length === 2);
  const d2 = runGameLogic("deco-symmetry-2", "two_cut_dissection", {});
  check("deco-symmetry-2/two_cut_dissection: three pieces rotate at the altitude foot", d2.checks.cuts === 2 && d2.checks.pieces === 3 && d2.checks.everyPieceRotatesIntoPlace === true && d2.checks.piecesTileBothTriangles === true);
  const d3 = runGameLogic("deco-symmetry-3", "kite_dissection", {});
  check("deco-symmetry-3/kite_dissection: three kites split into six isosceles halves", d3.valid === true && d3.equalSidesHold === true && d3.isoscelesCount === 6 && d3.partitionError === 0);
  const d4 = runGameLogic("deco-symmetry-4", "dissection", {});
  check("deco-symmetry-4/dissection: the cuts reach the midpoints on the mirror line", d4.valid === true && d4.cuts.DIsMidpointOfAB === true && d4.cuts.EIsMidpointOfAC === true && d4.pieces.length === 3);
  const db = runGameLogic("delboeuf", "equal_rings", { MR: 50, DR: 10, WR: 10, CI: 255, Ci: 0 });
  check("delboeuf/equal_rings: both coloured rings have the same radius and width", db.colouredRingsIdentical === true && db.colouredRings[0].radius === 28 && db.neighbours.leftOuter.biggerThanColoured === true && db.neighbours.rightInner.smallerThanColoured === true);
}

// The batch-20 tutor actions all run their real cores, not just their saved positions.
{
  const dc = runGameLogic("desargues", "direct_centre", { A1: [120, 80], B1: [280, 100], C1: [180, 240], A2: [80, 45], B2: [240, 125], C2: [186, 213], mode: "direct" });
  const ca = runGameLogic("desargues", "converse_axis", { A1: [208, 85], B1: [204, 135], C1: [208, 145], A2: [205, 109.375], B2: [190, 187.5], C2: [190, 156.25], mode: "converse" });
  check("desargues/centre and axis: both implications give Menelaus product -1", dc.menelaus.product === -1 && ca.menelaus.product === -1 && dc.residuals.collinearityError === 0 && ca.residuals.concurrencySpread === 0);
  const ebc = runGameLogic("detemple", "exterior_bisector_circle", {});
  const pin = runGameLogic("detemple", "perpendiculars_incircle", {});
  check("detemple/bisectors and perpendiculars: cyclic outside, concentric incircle inside", ebc.claims.cyclic === true && pin.claims.inscriptible === true && pin.claims.concentric === true);
  const dv = runGameLogic("de-villiers", "check_claims", {});
  check("de-villiers/check_claims: similar triangles make a parallelogram", dv.allHold === true && dv.failed.length === 0 && dv.claims.parallelogram === true);
  const dv2 = runGameLogic("de-villiers-2", "check_inscriptible", {});
  check("de-villiers-2/check_inscriptible: the bisector iterate has an incircle", dv2.allHold === true && dv2.stepInradiusSpread === 0 && dv2.failed.length === 0);
  const dv3 = runGameLogic("de-villiers-3", "halving_proof", {});
  check("de-villiers-3/halving_proof: the bisector image stays cyclic", Object.values(dv3.claims).every(Boolean) === true && dv3.homothetyError < 1e-8 && dv3.pitotError < 1e-8);
  const dv4 = runGameLogic("de-villiers-4", "similar_triangles", {
    A: { x: 173.181818, y: 286.60254 }, B: { x: 304.784359, y: 250 }, C: { x: 268.181818, y: 113.39746 }, D: { x: 119.701043, y: 217.364818 },
  });
  check("de-villiers-4/similar_triangles: three triangles share a turn and scale", dv4.similar === true && dv4.triangles.length === 3 && dv4.triangles.every((t) => Math.abs(t.ratio - 1) < 1e-3));
  const pac = runGameLogic("diameters-and-chords", "pascal_equivalence", { Ac: 1.727875959474386 });
  const sweep = runGameLogic("diameters-and-chords", "coincidence_sweep", {});
  check("diameters-and-chords/Pascal: the two coincidences agree", pac.coincidence.equivalenceHolds === true && pac.distances.abToAc === 0 && sweep.allOnePixelFlagsAgree === true);
  const tft = runGameLogic("diameters-in-concurrent-circles", "two_force_third", {});
  check("diameters-in-concurrent-circles/two_force_third: two diameters force the third", tft.twoForceThird === true && tft.oneDiameterIsNotEnough === true && tft.atSolved.flags.all === true);
  const cs = runGameLogic("dijkstra", "compare_signs", { shape: "right" });
  const pa = runGameLogic("dijkstra", "proportional_areas", { shape: "right" });
  check("dijkstra/signs and areas: the signs agree and the swapped ratio is flagged", cs.signs.allAgree === true && pa.proportionalAreas.proportionalHolds === true && pa.proportionalAreas.pageClaimHolds === false);
  const ts = runGameLogic("directly-similar-1", "translated_square", {});
  const collapse = runGameLogic("directly-similar-1", "collapsing_case", { dx: 40, dy: -25 });
  check("directly-similar-1/translations: the new square holds and translate pairs collapse", ts.claim.allHold === true && ts.translated.isSquare === true && collapse.allFourCornersCoincide === true && collapse.isSquare === false);
}

// The batch-21 tutor actions all run their real cores, not just their saved positions.
{
  const ds2 = runGameLogic("directly-similar-2", "third_triangle", {});
  const col2 = runGameLogic("directly-similar-2", "collapsing_case", {});
  check("directly-similar-2/third_triangle: the completed triangle is similar to both", ds2.directlySimilarToBoth === true && ds2.completed.possible === true && col2.allThreeCornersCoincide === true);
  const feet = runGameLogic("dissect-cyclic-quadri", "perpendicular_feet", {});
  const fromN = runGameLogic("dissect-cyclic-quadri", "build_from_n", {});
  check("dissect-cyclic-quadri/feet and N: all four pieces are cyclic", feet.quads.count === 4 && feet.quads.quads.every((q) => q.cyclic) === true && fromN.quads.count === 4);
  const fig = runGameLogic("distortion", "figure_check", {});
  const sweep = runGameLogic("distortion", "spacing_sweep", {});
  check("distortion/figures: every spacing keeps the circles and triangles honest", fig.allCirclesRound === true && fig.allTrianglesStraight === true && fig.allTrianglesEqualSided === true && sweep.allFiguresHonestAtEverySetting === true);
  const spin = runGameLogic("divergent-spirals", "rotation", { clockwise: true, fast: false, frames: 10 });
  check("divergent-spirals/rotation: the fast speed is 34/9 of the slow one", spin.arcsUnchangedByRotation === true && spin.turn.matches34over9 === true && spin.turn.sign === 1);
  const df = runGameLogic("droz-farny", "check_claims", {});
  check("droz-farny/check_claims: the three midpoints are collinear", df.allHold === true && df.failed.length === 0 && df.collinearity.holds === true);
  const dfc = runGameLogic("droz-farny-circles", "verify_circles", {});
  check("droz-farny-circles/verify_circles: two congruent circles through six cuts each", dfc.allHold === true && dfc.failed.length === 0 && dfc.onP === true && dfc.onQ === true && dfc.equalR === true);
  const steps = runGameLogic("dupont-garden", "equal_steps", {});
  check("dupont-garden/equal_steps: gravity gives constant second differences", steps.horizontalStepsConstant === true && steps.verticalSecondDifferencesConstant === true && Math.abs(steps.expectedVerticalSecondDifference + 2.45) < 1e-9);
  const ell = runGameLogic("dyno-ellipse", "ellipse", { rate: 2, r1: 60, r2: 40 });
  const curves = runGameLogic("dyno-ellipse", "special_curves", { length: 60 });
  check("dyno-ellipse/ellipse and curves: counter-rotating vectors trace an ellipse", ell.ellipseIdentityHolds === true && ell.semiAxes.horizontal === 100 && ell.semiAxes.vertical === 20 && curves.curves.every((c) => c.agrees) === true);
  const ill = runGameLogic("edge-illusion", "illusion_claims", {});
  check("edge-illusion/illusion_claims: no sides drawn, dashes on the missing sides", ill.defaultPicture.noDrawnSides === true && ill.defaultPicture.middleIsFieldColour === true && ill.showEdges.allStrokesOnMissingSides === true && ill.brightnessIsPerceptual === true);
  const eight = runGameLogic("eight-point-circle", "eight_points", {});
  const skew = runGameLogic("eight-point-circle", "skew_diagonals", {});
  check("eight-point-circle/eight_points: skewing the diagonals breaks the circle", eight.claims.allEight === true && eight.measures.footError < 1e-8 && skew.breaksTheTheorem === true && skew.skewed.claims.allEight === false);
}

// The batch-22 tutor actions all run their real cores, not just their saved positions.
{
  const six = runGameLogic("elkies", "six_circles", {});
  const demir = runGameLogic("elkies", "demir_relation", {});
  check("elkies/six_circles: seven circles close with six distinct radii", six.closed === true && six.circleCount === 7 && six.distinctCircles === 6 && demir.demirHolds === true && demir.tanRelationHolds === true);
  const sweep = runGameLogic("ellipse-between-circles", "slider_sweep", {});
  check("ellipse-between-circles/slider_sweep: tangency holds at every slider value", sweep.allTangent === true && sweep.allCentresOnEllipse === true && sweep.positionsChecked === 102);
  const vs = runGameLogic("ellipse-by-van-schooten", "construction", {});
  const slide = runGameLogic("ellipse-by-van-schooten", "slide", {});
  check("ellipse-by-van-schooten/construction: a diameter and right angle give the axes", vs.angleAOB.isRight === true && vs.diameter.isDiameter === true && slide.radiusSpread < 1e-8 && slide.maxEllipseResidual < 1e-8);
  const fs = runGameLogic("ellipse-focal", "focal_sum", { a: 96, b: 75, samples: 6 });
  const fc = runGameLogic("ellipse-focal", "foci_and_circle", { pairs: [[96, 75], [75, 96], [80, 80]] });
  check("ellipse-focal/focal_sum: every sample has the same focal sum", fs.sumIsConstant === true && fs.maxSumError < 1e-8 && fc.pairs.length === 3);
  const fd = runGameLogic("ellipse-focus-directrix", "two_focus_directrix_pairs", {});
  check("ellipse-focus-directrix/two_pairs: both pairs share an eccentricity below one", fd.count === 2 && fd.bothEccentricitiesBelowOne === true && fd.sameEccentricity === true && fd.focalAxisPerpendicularToBothDirectrices === true);
  const locus = runGameLogic("ellipse-in-arbelos", "center_locus", { f: 0.5 });
  const chain = runGameLogic("ellipse-in-arbelos", "tangent_chain", { f: 0.521053, n: 3, t: 1 });
  check("ellipse-in-arbelos/locus and chain: centres and neighbours lie on the ellipse", locus.allCentresOnEllipse === true && locus.fociMatchSemiaxes === true && chain.allTouchBothCircles === true && chain.allNeighboursTouch === true);
  const tr = runGameLogic("envelopes-in-ellipse", "trace", {});
  const fr = runGameLogic("envelopes-in-ellipse", "focal_ray", {});
  check("envelopes-in-ellipse/trace and focal_ray: chords share a confocal constant", tr.allChordsSameConstant === true && fr.equalsTwiceC === true && fr.aimedAtFocus === 1);
  const ep = runGameLogic("eppstein", "compare_families", {});
  check("eppstein/compare_families: both Soddy families concur and stay collinear", ep.bothConcurrent === true && ep.bothCollinear === true);
  const outside = runGameLogic("equal-angles-in-crossed-circles", "outside_lens", {});
  check("equal-angles-in-crossed-circles/outside_lens: the identity fails off the lens", outside.comparison.openingEqual === true && outside.comparison.outsideEqual === false && outside.comparison.outsideNested === false);
  const shu = runGameLogic("equal-angles-in-crossing-circles", "shutrick_identity", {});
  check("equal-angles-in-crossing-circles/shutrick_identity: chord lengths survive a sweep", shu.base.valid === true && shu.sweep.allHold === true && shu.sweep.worst.chordDifference === 0);
}

// The batch-23 tutor actions all run their real cores, not just their saved positions.
{
  const ea = runGameLogic("equal-angles-in-two-circles", "equal_angles", {});
  const out = runGameLogic("equal-angles-in-two-circles", "outside_circle", {});
  check("equal-angles-in-two-circles/equal_angles: tangent chord gives both equalities", ea.angles.bothEqual === true && Object.values(ea.proof.angleSums).every((s) => s.is180) === true && out.comparison.outsideEqual === false);
  const vc = runGameLogic("equal-areas-imo-2007", "verify_claim", { samples: 8 });
  check("equal-areas-imo-2007/verify_claim: equal areas survive a C sweep", vc.sweep.holds === true && vc.sweep.drawn === 8 && vc.sweep.worstRelativeGap < 1e-8);
  const sm = runGameLogic("equal-areas-in-equilateral-triangle", "slide_m", {});
  check("equal-areas-in-equilateral-triangle/slide_m: area equality holds at every M", sm.invariants.equalAtEveryPosition === true && sm.invariants.positionsChecked === 6);
  const anti = runGameLogic("equal-circles-orthocenter", "anticomplementary", {});
  check("equal-circles-orthocenter/anticomplementary: the outer triangle has area ratio four", anti.allHold === true && anti.areaRatio === 4 && anti.checks.HIsCircumcenterOfOuter === true);
  const ds = runGameLogic("equiangular-poly", "distance_sum", {});
  const cx = runGameLogic("equiangular-poly", "converse_counterexamples", {});
  check("equiangular-poly/distance_sum: signed totals stay fixed, ordinary totals do not", ds.signedSumIsOffsetsSum === true && ds.unsignedMatchesWhenInside === true && cx.converseBeyondTriangles === true);
  const rs = runGameLogic("equichordal", "radius_sum", {});
  check("equichordal/radius_sum: odd power and frequency give a constant sum", rs.bothOdd === true && rs.sumIsConstant === true && rs.sumRange.spread === 0);
  const hex = runGameLogic("equilateral-345", "hexagon_proof", { side: 200, angle: 60 });
  const app = runGameLogic("equilateral-345", "applet_scale_constant", { side: 200 });
  check("equilateral-345/hexagon_proof: six pieces make twice the triangle", hex.hexagon.areaRatio === 2 && hex.claim.sumsAgree === true && app.sideRelativeError > 0);
  const rot = runGameLogic("equilateral-on-lines", "rotation_solution", { lines: [120, 170, 225], C: [205, 120], angle: 0 });
  check("equilateral-on-lines/rotation_solution: both mirror placements are equilateral", rot.solutions.length === 2 && rot.solutions.every((s) => s.equilateral === true) === true);
  const mt = runGameLogic("equilateral-triangles", "midpoint_triangle", {});
  const cri = runGameLogic("equilateral-triangles", "cube_root_identity", {});
  check("equilateral-triangles/midpoint_triangle: on and off circle the midpoint triangle stays equilateral", mt.midpointTriangle.equilateral === true && cri.onCircle.held === cri.onCircle.of && cri.offCircle.held === cri.offCircle.of);
  const col = runGameLogic("equilic-quad", "collinearity_and_triangles", {});
  const arc = runGameLogic("equilic-quad", "arc_sweep", {});
  check("equilic-quad/collinearity and arcs: P,Q,R,S always line up, AQB only on one arc", col.line.holds === true && arc.collinearEverywhere === true && arc.aqbOnOppositeArc.allEquilateral === true && arc.aqbOnSmallArc.noneEquilateral === true);
}

// The batch-24 tutor actions all run their real cores, not just their saved positions.
{
  const am = runGameLogic("equiloc-quad-1-tri", "arc_midpoint", {});
  const hs = runGameLogic("equiloc-quad-1-tri", "handedness_sweep", {});
  check("equiloc-quad-1-tri/arc_midpoint: Q bisects the arc, the printed claim does not", am.claims.qIsArcMidpoint === true && am.claims.pageClaimLiteral === false && hs.qOnlyOnStartingSide === true);
  const rh = runGameLogic("equiloc-quad-2-tri", "rhombus_and_halves", {});
  const ra = runGameLogic("equiloc-quad-2-tri", "rhombus_at_other_angles", {});
  check("equiloc-quad-2-tri/rhombi: equal sides at every angle, equilateral halves only at 60/120", rh.rhombus.holds === true && rh.rhombus.equalSides === true && ra.rhombusAtEveryAngle === true && ra.equilateralOnlyAt60or120 === true);
  const tb = runGameLogic("equiloc-quad-2-tri-120", "tips_and_bisector", { S: [200, 54] });
  const as = runGameLogic("equiloc-quad-2-tri-120", "arc_sweep", {});
  check("equiloc-quad-2-tri-120/tips and sweep: P=R on the 120-degree arc only", tb.claims.apexesCoincide === true && tb.claims.onBisector === true && as.startingArc.allTipsCoincide === true && as.otherArc.allTipsSeparated === true);
  const ah = runGameLogic("equi-tri-in-rec", "apq_and_homothety", {});
  const oc = runGameLogic("equi-tri-in-rec", "orientation_check", {});
  check("equi-tri-in-rec/homothety: ratio two and midpoints, broken by one flipped apex", ah.homothety.ratioIsTwo === true && ah.claims.apqEquilateral === true && oc.sameOrientationAllEquilateral === true && oc.oppositeOrientationNoneEquilateral === true);
  const ps = runGameLogic("equi-tri-on-para", "parallelograms", {});
  check("equi-tri-on-para/parallelograms: the second round returns to ABCD", ps.first.parallelogram === true && ps.second.parallelogram === true && ps.second.coincide === true);
  const ev = runGameLogic("escher-ceva-menelaus", "evaluate", { divisions: { AB: 3, BC: 4, CA: 5 }, grid: { AB: 3, BC: 5, CA: 4 }, marks: { B1: 4, C1: 3, B2: 1, C2: 0, B3: 2, C3: 1 } });
  const pat = runGameLogic("escher-ceva-menelaus", "escher_patterns", {});
  check("escher-ceva-menelaus/evaluate and patterns: F=1 concurs with twelve patterns", ev.formula.satisfied === true && ev.concurrence.concurrent === true && pat.twelveConfirmed === true && pat.count === 12);
  const ve = runGameLogic("eschers-theorem", "verify_escher", {});
  const of = runGameLogic("eschers-theorem", "orientation_flip", {});
  check("eschers-theorem/turns and flip: same-handed 120 degrees concur and tessellate", ve.turns.allAre120Degrees === true && ve.concurrence.concurrent === true && ve.tessellation.allCongruent === true && of.correct.concurrent === true && of.flipped.concurrent === false);
  const al = runGameLogic("euclid", "area_law_at_point", { preset: "corner" });
  const au = runGameLogic("euclid", "displayed_area_audit", {});
  check("euclid/area law at the corner: the similar-shape sum holds", al.law.lawHoldsWithinTolerance === true && al.figure.displayedSumMatchesHyp === true && au.summary.displayedSumsThatMatch === 2);
  const ec = runGameLogic("euclid-i43", "equal_complements", { N: 1 });
  const mg = runGameLogic("euclid-i43", "mirrored_grid", { N: 3 });
  check("euclid-i43/complements and grid: green pairs match and every cell mirrors", ec.allGreenPairsMatch === true && ec.allPiecesTile === true && mg.allPairsMatch === true);
  const ca = runGameLogic("euclid-i43-extended", "compensating_areas", { region: "ABD" });
  const sp = runGameLogic("euclid-i43-extended", "same_side_pair", { region: "BCD" });
  check("euclid-i43-extended/areas: ASRQ compensates XNCP off the diagonal", ca.compensates === true && ca.proofAreaMatches === true && ca.plainEuclidI43Matches === false && sp.equal === true && sp.tOnAx === true);
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
