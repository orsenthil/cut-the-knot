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

/** The "Look for the math" section: intro, then one entry per <h2>. */
function parseMath(html) {
  const block = extractById(html, "math", "details");
  if (!block) return null;
  const body = block.replace(/<summary>[\s\S]*?<\/summary>/i, "");
  const pieces = body.split(/<h2[^>]*>/i);
  const intro = text(pieces[0]);
  const sections = [];
  for (const piece of pieces.slice(1)) {
    const end = piece.indexOf("</h2>");
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
  "nimble/nimble-core.js": ["NimbleCore"],
  "no-silver-dollar/no-silver-dollar-core.js": ["NoSilverDollarCore"],
  "one-pile/one-pile-core.js": ["OnePileCore"],
  "odd-scoring/odd-scoring-core.js": ["OddScoringCore"],
  "parrondo/parrondo-core.js": ["ParrondoCore"],
  "pegsolitaire/pegsolitaire-core.js": ["PegsolitaireCore"],
  "pick-label/pick-label-core.js": ["PickLabelCore"],
  "pigeon-checkers/pigeon-checkers-core.js": ["PigeonCheckersCore"],
  "plainim/plainim-core.js": ["PlainimCore"],
  "pm/pm-core.js": ["PmCore"],
  "proizvolov-game/proizvolov-game-core.js": ["ProizvolovGameCore"],
  "raisin-game/raisin-game-core.js": ["RaisinGameCore"],
  "reverse-desert/reverse-desert-core.js": ["ReverseDesertCore"],
  "row-column-swap/row-column-swap-core.js": ["RowColumnSwapCore"],
  "rsolitaire/rsolitaire-core.js": ["RsolitaireCore"],
  "scoring-misere/scoring-misere-core.js": ["ScoringMisereCore"],
  "scoring-misere-2/scoring-misere-2-core.js": ["ScoringMisere2Core"],
  "sct/sct-core.js": ["SctCore"],
  "sticky-problem/sticky-problem-core.js": ["StickyProblemCore"],
  "another-sticky-problem/another-sticky-problem-core.js": ["AnotherStickyProblemCore"],
  "soup-fish/soup-fish-core.js": ["SoupFishCore"],
  "table-to-zero-game/table-to-zero-game-core.js": ["TableToZeroGameCore"],
  "trans-example/trans-example-core.js": ["TransExampleCore"],
  "trigg-tromino/trigg-tromino-core.js": ["TriggTrominoCore"],
  "deficient-squares/deficient-squares-core.js": ["DeficientSquaresCore"],
  "tromino/tromino-core.js": ["TrominoCore"],
  "tromino-rep-tile/tromino-rep-tile-core.js": ["TrominoRepTileCore"],
  "tromino-puzzle/tromino-puzzle-core.js": ["TrominoPuzzleCore"],
  "two-color-solitaire/two-color-solitaire-core.js": ["TwoColorSolitaireCore"],
  "up-and-down-game/up-and-down-game-core.js": ["UpAndDownGameCore"],
  "wythoff-nim/wythoff-nim-core.js": ["WythoffNimCore"],
  "y-theory/y-theory-core.js": ["YTheoryCore"],
  "date-game/date-game-core.js": ["DateGameCore"],
  "goat-cabbage-wolf/goat-cabbage-wolf-core.js": ["GoatCabbageWolfCore"],
  "subtraction-game/subtraction-game-core.js": ["SubtractionGameCore"],
  "abacus/abacus-core.js": ["AbacusCore"],
  "adams-apportionment/adams-apportionment-core.js": ["AdamsApportionmentCore"],
  "addition-law-of-change/addition-law-of-change-core.js": ["AdditionLawOfChangeCore"],
  "affirmative-action/affirmative-action-core.js": ["AffirmativeActionCore"],
  "hamilton-apportionment/hamilton-apportionment-core.js": ["HamiltonApportionmentCore"],
  "all-combinations/all-combinations-core.js": ["AllCombinationsCore"],
  "all-permutations/all-permutations-core.js": ["AllPermutationsCore"],
  "isosceles-fallacy/isosceles-fallacy-core.js": ["IsoscelesFallacyCore"],
  "apportionment-methods/apportionment-methods-core.js": ["ApportionmentMethodsCore"],
  "area-of-circle/area-of-circle-core.js": ["AreaOfCircleCore"],
  "bad-limit/bad-limit-core.js": ["BadLimitCore"],
  "arithmetic-sequence/arithmetic-sequence-core.js": ["ArithmeticSequenceCore"],
  "auto-flipper/auto-flipper-core.js": ["AutoFlipperCore"],
  "barcode-encoding/barcode-encoding-core.js": ["BarcodeEncodingCore"],
  "binomial-distribution/binomial-distribution-core.js": ["BinomialDistributionCore"],
  "base-conversion/base-conversion-core.js": ["BaseConversionCore"],
  "barcode-magic/barcode-magic-core.js": ["BarcodeMagicCore"],
  "bachet/bachet-core.js": ["BachetCore"],
  "birds-on-wire/birds-on-wire-core.js": ["BirdsOnWireCore"],
  "bicentric-quadrilateral/bicentric-quadrilateral-core.js": ["BicentricQuadrilateralCore"],
  "cards/cards-core.js": ["CardsCore"],
  "box-volume/box-volume-core.js": ["BoxVolumeCore"],
  "brides-chair/brides-chair-core.js": ["BridesChairCore"],
  "chaos/chaos-core.js": ["ChaosCore"],
  "btree-testing/btree-testing-core.js": ["BTreeTestingCore"],
  "calculator/calculator-core.js": ["CalculatorCore"],
  "chess-tournament/chess-tournament-core.js": ["ChessTournamentCore"],
  "buffon/buffon-core.js": ["BuffonCore"],
  "cavalieri/cavalieri-core.js": ["CavalieriCore"],
  "cantor/cantor-core.js": ["CantorCore"],
  "chvatal/chvatal-core.js": ["ChvatalCore"],
  "circles-and-limit/circles-and-limit-core.js": ["CirclesAndLimitCore"],
  "circle-with-two-centers/circle-with-two-centers-core.js": ["CircleWithTwoCentersCore"],
  "city-block-hunt/city-block-hunt-core.js": ["CityBlockHuntCore"],
  "city-block-hunt-from-outside/city-block-hunt-from-outside-core.js": ["CityBlockHuntFromOutsideCore"],
  "coin-change/coin-change-core.js": ["CoinChangeCore"],
  "collatz/collatz-core.js": ["CollatzCore"],
  "color-graph/color-graph-core.js": ["ColorGraphCore"],
  "combi-gem/combi-gem-core.js": ["CombiGemCore"],
  "common-multiples/common-multiples-core.js": ["CommonMultiplesCore"],
  "compare-fractions/compare-fractions-core.js": ["CompareFractionsCore"],
  "complex-numbers/complex-numbers-core.js": ["ComplexNumbersCore"],
  "coordinates/coordinates-core.js": ["CoordinatesCore"],
  "counting/counting-core.js": ["CountingCore"],
  "counting-squares-in-square/counting-squares-in-square-core.js": ["CountingSquaresInSquareCore"],
  "critical-path/critical-path-core.js": ["CriticalPathCore"],
  "curry-paradox/curry-paradox-core.js": ["CurryParadoxCore"],
  "cwidth/cwidth-core.js": ["CwidthCore"],
  "cycloids/cycloids-core.js": ["CycloidsCore"],
  "delian/delian-core.js": ["DelianCore"],
  "distance-to-line/distance-to-line-core.js": ["DistanceToLineCore"],
  "distributive-law/distributive-law-core.js": ["DistributiveLawCore"],
  "divisibility/divisibility-core.js": ["DivisibilityCore"],
  "ean13/ean13-core.js": ["Ean13Core"],
  "egyptian-multiplication/egyptian-multiplication-core.js": ["EgyptianMultiplicationCore"],
  "enemy-ambassadors/enemy-ambassadors-core.js": ["EnemyAmbassadorsCore"],
  "equilateral-fibonacci/equilateral-fibonacci-core.js": ["EquilateralFibonacciCore"],
  "euclid-alg/euclid-alg-core.js": ["EuclidAlgCore"],
  "euclid-algorithm/euclid-algorithm-core.js": ["EuclidAlgorithmCore"],
  "factorization/factorization-core.js": ["FactorizationCore"],
  "farey/farey-core.js": ["FareyCore"],
  "fc-exercise/fc-exercise-core.js": ["FcExerciseCore"],
  "fibonacci-cheat/fibonacci-cheat-core.js": ["FibonacciCheatCore"],
  "fif/fif-core.js": ["FifCore"],
  "figurate/figurate-core.js": ["FigurateCore"],
  "fill-the-board/fill-the-board-core.js": ["FillTheBoardCore"],
  "first-proof/first-proof-core.js": ["FirstProofCore"],
  "flavius/flavius-core.js": ["FlaviusCore"],
  "flip-them-ii/flip-them-ii-core.js": ["FlipThemIICore"],
  "flip-them-iii/flip-them-iii-core.js": ["FlipThemIIICore"],
  "fourth-degree/fourth-degree-core.js": ["FourthDegreeCore"],
  "fraction-comparison-exercise/fraction-comparison-exercise-core.js": ["FractionComparisonExerciseCore"],
  "futurama/futurama-core.js": ["FuturamaCore"],
  "gcd-by-factor-tree/gcd-by-factor-tree-core.js": ["GcdByFactorTreeCore"],
  "gcd-lcm-rectangles/gcd-lcm-rectangles-core.js": ["GcdLcmRectanglesCore"],
  "gencon-construction/gencon-construction-core.js": ["GenConConstructionCore"],
  "rouse-ball-fallacy/rouse-ball-fallacy-core.js": ["RouseBallFallacyCore"],
  "archimedes-circumference/archimedes-circumference-core.js": ["ArchimedesCircumferenceCore"],
  "euler-hamilton-paths/euler-hamilton-paths-core.js": ["EulerHamiltonPathsCore"],
  "huntington-hill-method/huntington-hill-method-core.js": ["HuntingtonHillMethodCore"],
  "hilbert-curve/hilbert-curve-core.js": ["HilbertCurveCore"],
  "hooper-paradox/hooper-paradox-core.js": ["HooperParadoxCore"],
  "horner-method/horner-method-core.js": ["HornerMethodCore"],
  "iterated-function-systems/iterated-function-systems-core.js": ["IteratedFunctionSystemsCore"],
  "imo-1986-3/imo-1986-3-core.js": ["Imo1986_3Core"],
  "indy-clock-hands/indy-clock-hands-core.js": ["IndyClockHandsCore"],
  "infinite-latin-square/infinite-latin-square-core.js": ["InfiniteLatinSquareCore"],
  "integer-rectangle/integer-rectangle-core.js": ["IntegerRectangleCore"],
  "interest-rates/interest-rates-core.js": ["InterestRatesCore"],
  "integer-rectangle-graph/integer-rectangle-graph-core.js": ["IntegerRectangleGraphCore"],
  "robinson-induction/robinson-induction-core.js": ["RobinsonInductionCore"],
  "winkler-path-proof/winkler-path-proof-core.js": ["WinklerPathProofCore"],
  "sums-products-invariant/sums-products-invariant-core.js": ["SumsProductsInvariantCore"],
  "isbn-encoding/isbn-encoding-core.js": ["IsbnEncodingCore"],
  "item-parity/item-parity-core.js": ["ItemParityCore"],
  "item-parity-generalized/item-parity-generalized-core.js": ["ItemParityGeneralizedCore"],
  "critical-path-scheduling/critical-path-scheduling-core.js": ["CriticalPathSchedulingCore"],
  "jefferson-apportionment/jefferson-apportionment-core.js": ["JeffersonApportionmentCore"],
  "john-sharp-paradox/john-sharp-paradox-core.js": ["JohnSharpParadoxCore"],
  "johnson-trotter/johnson-trotter-core.js": ["JohnsonTrotterCore"],
  "mandelbrot-julia/mandelbrot-julia-core.js": ["MandelbrotJuliaCore"],
  "kaprekar-routine/kaprekar-routine-core.js": ["KaprekarRoutineCore"],
  "langford-skolem/langford-skolem-core.js": ["LangfordSkolemCore"],
  "langman-paradox/langman-paradox-core.js": ["LangmanParadoxCore"],
  "latin-squares/latin-squares-core.js": ["LatinSquaresCore"],
  "lattice-multiplication/lattice-multiplication-core.js": ["LatticeMultiplicationCore"],
  "lcm-algorithm/lcm-algorithm-core.js": ["LcmAlgorithmCore"],
  "leibniz-triangle/leibniz-triangle-core.js": ["LeibnizTriangleCore"],
  "game-of-life/game-of-life-core.js": ["GameOfLifeCore"],
  "life-like-automaton/life-like-automaton-core.js": ["LifeLikeAutomatonCore"],
  "logistic-model/logistic-model-core.js": ["LogisticModelCore"],
  "lone-divider/lone-divider-core.js": ["LoneDividerCore"],
  "long-multiplication/long-multiplication-core.js": ["LongMultiplicationCore"],
  "other-primes/other-primes-core.js": ["OtherPrimesCore"],
  "square-sieve/square-sieve-core.js": ["SquareSieveCore"],
  "euler-product/euler-product-core.js": ["EulerProductCore"],
  "prime-counting/prime-counting-core.js": ["PrimeCountingCore"],
  "zeta-critical-line/zeta-critical-line-core.js": ["ZetaCriticalLineCore"],
  "prime-waves/prime-waves-core.js": ["PrimeWavesCore"],
  "harmonic-series/harmonic-series-core.js": ["HarmonicSeriesCore"],
  "basel-problem/basel-problem-core.js": ["BaselProblemCore"],
  "unit-distance-points/unit-distance-points-core.js": ["UnitDistanceCore"],
  "two-circles-two-points/two-circles-two-points-core.js": ["TwoCirclesCore"],
  "moser-spindle-colouring/moser-spindle-colouring-core.js": ["MoserCore"],
  "sums-of-two-squares/sums-of-two-squares-core.js": ["TwoSquaresCore"],
  "grid-spacing-dial/grid-spacing-dial-core.js": ["GridDialCore"],
  "unit-distance-growth/unit-distance-growth-core.js": ["UnitGrowthCore"],
  "roots-of-unity-lattice/roots-of-unity-lattice-core.js": ["RootsCore"],
  "no-equilateral-triangles/no-equilateral-triangles-core.js": ["NoEquilateralTrianglesCore"],
  "loop-or-halt/loop-or-halt-core.js": ["LoopOrHaltCore"],
  "magic-in-square/magic-in-square-core.js": ["MagicInSquareCore"],
  "mandel-cycle/mandel-cycle-core.js": ["MandelCycleCore"],
  "markers/markers-core.js": ["MarkersCore"],
  "math-telepathy/math-telepathy-core.js": ["MathTelepathyCore"],
  "means/means-core.js": ["MeansCore"],
  "memory/memory-core.js": ["MemoryCore"],
  "merlin/merlin-core.js": ["MerlinCore"],
  "midline-in-sim-tris/midline-in-sim-tris-core.js": ["MidlineCore"],
  "hummers-mind-reader/hummers-mind-reader-core.js": ["HummersCore"],
  "min-max/min-max-core.js": ["MinMaxCore"],
  "miu-system/miu-system-core.js": ["MIUCore"],
  "modular-tables/modular-tables-core.js": ["ModularCore"],
  "monty-hall/monty-hall-core.js": ["MontyCore"],
  "moving-chips-in-pairs/moving-chips-in-pairs-core.js": ["ChipsCore"],
  "multiplication-table/multiplication-table-core.js": ["MultiplicationCore"],
  "mean-value-theorem/mean-value-theorem-core.js": ["MVTCore"],
  "napier-bones/napier-bones-core.js": ["NapierCore"],
  "napoleon-polygons/napoleon-polygons-core.js": ["NapoleonCore"],
  "signs-and-sums/signs-and-sums-core.js": ["SignsAndSumsCore"],
  "newtons-method/newtons-method-core.js": ["NewtonCore"],
  "nine-squares/nine-squares-core.js": ["NineSquaresCore"],
  "golden-ratio-pentagon/golden-ratio-pentagon-core.js": ["PentagonCore"],
  "northcotts-game/northcotts-game-core.js": ["NorthcottCore"],
  "counting-triangles/counting-triangles-core.js": ["TrianglesCore"],
  "zeros-and-ones-array/zeros-and-ones-array-core.js": ["ZeroOneCore"],
  "adding-functions/adding-functions-core.js": ["FunctionsCore"],
  "orthogonal-latin-squares/orthogonal-latin-squares-core.js": ["LatinCore"],
  "kochs-snowflake/kochs-snowflake-core.js": ["KochCore"],
  "pascal-triangle/pascal-triangle-core.js": ["PascalTriangleCore"],
  "peasant-multiplication/peasant-multiplication-core.js": ["PeasantCore"],
  "pendula-chaos/pendula-chaos-core.js": ["PendulaCore"],
  "perm/perm-core.js": ["PermCore"],
  "perm-by-trans/perm-by-trans-core.js": ["PermTransCore"],
  "perm-group/perm-group-core.js": ["PermGroupCore"],
  "perm-on-circle/perm-on-circle-core.js": ["PermCircleCore"],
  "perm-product/perm-product-core.js": ["PermProductCore"],
  "pick/pick-core.js": ["PickCore"],
  "pigeonhole/pigeonhole-core.js": ["PigeonholeCore"],
  "plain-monty-hall/plain-monty-hall-core.js": ["PlainMontyHallCore"],
  "play-hex-design/play-hex-design-core.js": ["PlayHexDesignCore"],
  "polygonal-numbers/polygonal-numbers-core.js": ["PolygonalNumbersCore"],
  "polynomial-degree-3/polynomial-degree-3-core.js": ["PolynomialDegree3Core"],
  "polynomial-roots/polynomial-roots-core.js": ["PolynomialRootsCore"],
  "power-index/power-index-core.js": ["PowerIndexCore"],
  "power-indices/power-indices-core.js": ["PowerIndicesCore"],
  "primes-from-triangle/primes-from-triangle-core.js": ["PrimesFromTriangleCore"],
  "product-of-fractions/product-of-fractions-core.js": ["ProductOfFractionsCore"],
  "pyth-triple-calculator/pyth-triple-calculator-core.js": ["PythTripleCalculatorCore"],
  "quadratic-polynomial/quadratic-polynomial-core.js": ["QuadraticPolynomialCore"],
  "ratchet/ratchet-core.js": ["RatchetCore"],
  "more-less-equal/more-less-equal-core.js": ["MoreLessEqualCore"],
  "sam-loyd-son/sam-loyd-son-core.js": ["SamLoydSonCore"],
  "scoring/scoring-core.js": ["ScoringCore"],
  "geometric-series-square/geometric-series-square-core.js": ["GeometricSeriesSquareCore"],
  "shuttle-practice/shuttle-practice-core.js": ["ShuttlePracticeCore"],
  "sierpinski-chaos-game/sierpinski-chaos-game-core.js": ["SierpinskiChaosGameCore"],
  "sierpinski-dihedral/sierpinski-dihedral-core.js": ["SierpinskiDihedralCore"],
  "simple-somos/simple-somos-core.js": ["SimpleSomosCore"],
  "sine-cosine-derivatives/sine-cosine-derivatives-core.js": ["SineCosineDerivativesCore"],
  "sine-of-sum/sine-of-sum-core.js": ["SineOfSumCore"],
  "social-choice/social-choice-core.js": ["SocialChoiceCore"],
  "soroban/soroban-core.js": ["SorobanCore"],
  "suan-pan/suan-pan-core.js": ["SuanPanCore"],
  "sorts/sorts-core.js": ["SortsCore"],
  "spigot-for-pi/spigot-for-pi-core.js": ["SpigotForPiCore"],
  "steinhaus-problem/steinhaus-problem-core.js": ["SteinhausProblemCore"],
  "string-distance/string-distance-core.js": ["StringDistanceCore"],
  "switching-signs/switching-signs-core.js": ["SwitchingSignsCore"],
  "base-tables/base-tables-core.js": ["BaseTablesCore"],
  "tesseract/tesseract-core.js": ["TesseractCore"],
  "party-acquaintances/party-acquaintances-core.js": ["PartyAcquaintancesCore"],
  "triangle-chain/triangle-chain-core.js": ["TriangleChainCore"],
  "stick-in-three/stick-in-three-core.js": ["StickInThreeCore"],
  "stick-in-square/stick-in-square-core.js": ["StickInSquareCore"],
  "tromino-monomino/tromino-monomino-core.js": ["TrominoMonominoCore"],
  "turning-turtles/turning-turtles-core.js": ["TurningTurtlesCore"],
  "chips-on-circle/chips-on-circle-core.js": ["ChipsOnCircleCore"],
  "two-perpendiculars/two-perpendiculars-core.js": ["TwoPerpendicularsCore"],
  "two-men-of-tibet/two-men-of-tibet-core.js": ["TwoMenOfTibetCore"],
  "det-and-perm/det-and-perm-core.js": ["DetAndPermCore"],
  "rook-placements/rook-placements-core.js": ["RookPlacementsCore"],
  "arithmetic-circuits/arithmetic-circuits-core.js": ["ArithmeticCircuitsCore"],
  "determinant-elimination/determinant-elimination-core.js": ["DeterminantEliminationCore"],
  "ryser-formula/ryser-formula-core.js": ["RyserFormulaCore"],
  "perm-from-det/perm-from-det-core.js": ["PermFromDetCore"],
  "riskless-hedge/riskless-hedge-core.js": ["RisklessHedgeCore"],
  "stock-price-paths/stock-price-paths-core.js": ["StockPricePathsCore"],
  "quadratic-roots/quadratic-roots-core.js": ["QuadraticRootsCore"],
  "random-walk/random-walk-core.js": ["RandomWalkCore"],
  "reflection-principle/reflection-principle-core.js": ["ReflectionPrincipleCore"],
  "right-replacement/right-replacement-core.js": ["RightReplacementCore"],
  "s1089/s1089-core.js": ["S1089Core"],
  "sealed-bids/sealed-bids-core.js": ["SealedBidsCore"],
  "self-descriptive/self-descriptive-core.js": ["SelfDescriptiveCore"],
  "simple-automaton/simple-automaton-core.js": ["SimpleAutomatonCore"],
  "simple-graphs/simple-graphs-core.js": ["SimpleGraphsCore"],
  "simpson-paradox/simpson-paradox-core.js": ["SimpsonParadoxCore"],
  "two-numbers/two-numbers-core.js": ["TwoNumbersCore"],
  "universal-coloring/universal-coloring-core.js": ["UniversalColoringCore"],
  "up-and-down/up-and-down-core.js": ["UpAndDownCore"],
  "upc/upc-core.js": ["UpcCore"],
  "very-tiles/very-tiles-core.js": ["VeryTilesCore"],
  "voting/voting-core.js": ["VotingCore"],
  "water/water-core.js": ["WaterCore"],
  "wgraphs/wgraphs-core.js": ["WgraphsCore"],
  "zeros-and-nines/zeros-and-nines-core.js": ["ZerosAndNinesCore"],
  "arith-magic/arith-magic-core.js": ["ArithMagicCore"],
  "a-bisector/a-bisector-core.js": ["ABisectorCore"],
  "ab-on-circumcircle/ab-on-circumcircle-core.js": ["AbOnCircumcircleCore"],
  "abul-wafa-pythagoras/abul-wafa-pythagoras-core.js": ["AbulWafaPythagorasCore"],
  "adams-circle/adams-circle-core.js": ["AdamsCircleCore"],
  "adjacent-incircles/adjacent-incircles-core.js": ["AdjacentIncirclesCore"],
  "al-nayrizi-construction/al-nayrizi-construction-core.js": ["AlNayriziConstructionCore"],
  "altitude-and-circumcircle/altitude-and-circumcircle-core.js": ["AltitudeAndCircumcircleCore"],
  "altitude-mirror/altitude-mirror-core.js": ["AltitudeMirrorCore"],
  "altitude-mirror-2/altitude-mirror-2-core.js": ["AltitudeMirror2Core"],
  "angle/angle-core.js": ["AngleCore"],
  "angle-between-tangent-and-chord/angle-between-tangent-and-chord-core.js": ["AngleBetweenTangentAndChordCore"],
  "angle-bisector/angle-bisector-core.js": ["AngleBisectorCore"],
  "angle-bisector-in-equilateral-trapezoid/angle-bisector-in-equilateral-trapezoid-core.js": ["AngleBisectorInEquilateralTrapezoidCore"],
  "angle-bisector-in-rectangle/angle-bisector-in-rectangle-core.js": ["AngleBisectorInRectangleCore"],
  "angle-bisector-ratio/angle-bisector-ratio-core.js": ["AngleBisectorRatioCore"],
  "angle-bisector-ratio-2/angle-bisector-ratio-2-core.js": ["AngleBisectorRatio2Core"],
  "angle-bisectors-in-quadri/angle-bisectors-in-quadri-core.js": ["AngleBisectorsInQuadriCore"],
  "angle-on-diameter/angle-on-diameter-core.js": ["AngleOnDiameterCore"],
  "angle-property/angle-property-core.js": ["AnglePropertyCore"],
  "angles-in-circle/angles-in-circle-core.js": ["AnglesInCircleCore"],
  "binomial-option-tree/binomial-option-tree-core.js": ["BinomialOptionTreeCore"],
  "payoff-heat-equation/payoff-heat-equation-core.js": ["PayoffHeatEquationCore"],
  "black-scholes-formula/black-scholes-formula-core.js": ["BlackScholesFormulaCore"],
  "delta-hedging/delta-hedging-core.js": ["DeltaHedgingCore"],
  "angles-in-triangle/angles-in-triangle-core.js": ["AnglesInTriangleCore"],
  "anonymous-visitor/anonymous-visitor-core.js": ["AnonymousVisitorCore"],
  "anticomplementary-triangle/anticomplementary-triangle-core.js": ["AnticomplementaryTriangleCore"],
  "antiparallel/antiparallel-core.js": ["AntiparallelCore"],
  "any-quadri/any-quadri-core.js": ["AnyQuadriCore"],
  "apmo-2009-3/apmo-2009-3-core.js": ["Apmo20093Core"],
  "apollonian-circle/apollonian-circle-core.js": ["ApollonianCircleCore"],
  "apollonius/apollonius-core.js": ["ApolloniusCore"],
  "arbelos/arbelos-core.js": ["ArbelosCore"],
  "arbelos-bui/arbelos-bui-core.js": ["ArbelosBuiCore"],
  "arbelos-concyclic/arbelos-concyclic-core.js": ["ArbelosConcyclicCore"],
  "arbelos-incircle/arbelos-incircle-core.js": ["ArbelosIncircleCore"],
  "arbelos-pww/arbelos-pww-core.js": ["ArbelosPwwCore"],
  "arbelos-rect/arbelos-rect-core.js": ["ArbelosRectCore"],
  "archi/archi-core.js": ["ArchiCore"],
  "archimedes-lever/archimedes-lever-core.js": ["ArchimedesLeverCore"],
  "archimedes-quadruplets/archimedes-quadruplets-core.js": ["ArchimedesQuadrupletsCore"],
  "archimedes-triangle/archimedes-triangle-core.js": ["ArchimedesTriangleCore"],
  "area-of-parallelogram/area-of-parallelogram-core.js": ["AreaOfParallelogramCore"],
  "area-of-triangle/area-of-triangle-core.js": ["AreaOfTriangleCore"],
  "areas-in-reg-poly/areas-in-reg-poly-core.js": ["AreasInRegPolyCore"],
  "areas-in-square/areas-in-square-core.js": ["AreasInSquareCore"],
  "arrange-pyth/arrange-pyth-core.js": ["ArrangePythCore"],
  "asia-pacific-kite/asia-pacific-kite-core.js": ["AsiaPacificKiteCore"],
  "auxetic-tessellation/auxetic-tessellation-core.js": ["AuxeticTessellationCore"],
  "balls-in-jar/balls-in-jar-core.js": ["BallsInJarCore"],
  "baltic-darij-1/baltic-darij-1-core.js": ["BalticDarij1Core"],
  "barlotti/barlotti-core.js": ["BarlottiCore"],
  "barycentric/barycentric-core.js": ["BarycentricCore"],
  "barygon/barygon-core.js": ["BarygonCore"],
  "bender/bender-core.js": ["BenderCore"],
  "bertrand/bertrand-core.js": ["BertrandCore"],
  "besteman/besteman-core.js": ["BestemanCore"],
  "besteman-2/besteman-2-core.js": ["Besteman2Core"],
  "bevan-point/bevan-point-core.js": ["BevanPointCore"],
  "bicentric-quadri-2/bicentric-quadri-2-core.js": ["BicentricQuadri2Core"],
  "bicolor/bicolor-core.js": ["BicolorCore"],
  "bid/bid-core.js": ["BidCore"],
  "bimedians-in-tetrahedron/bimedians-in-tetrahedron-core.js": ["BimediansInTetrahedronCore"],
  "bisectal-circle/bisectal-circle-core.js": ["BisectalCircleCore"],
  "bisector-circle-triad/bisector-circle-triad-core.js": ["BisectorCircleTriadCore"],
  "blithe-12/blithe-12-core.js": ["Blithe12Core"],
  "bol-1/bol-1-core.js": ["Bol1Core"],
  "bol-10/bol-10-core.js": ["Bol10Core"],
  "bol-12/bol-12-core.js": ["Bol12Core"],
  "bol-13/bol-13-core.js": ["Bol13Core"],
  "bol-2/bol-2-core.js": ["Bol2Core"],
  "bol-3/bol-3-core.js": ["Bol3Core"],
  "bol-5/bol-5-core.js": ["Bol5Core"],
  "bol-6/bol-6-core.js": ["Bol6Core"],
  "bol-9/bol-9-core.js": ["Bol9Core"],
  "bottema/bottema-core.js": ["BottemaCore"],
  "bqt-lemma/bqt-lemma-core.js": ["BqtLemmaCore"],
  "bqtn/bqtn-core.js": ["BqtnCore"],
  "brahmagupta/brahmagupta-core.js": ["BrahmaguptaCore"],
  "brahmagupta-2/brahmagupta-2-core.js": ["Brahmagupta2Core"],
  "breadth-width/breadth-width-core.js": ["BreadthWidthCore"],
  "brianchon/brianchon-core.js": ["BrianchonCore"],
  "brianchon-in-ellipse/brianchon-in-ellipse-core.js": ["BrianchonCore"],
  "brick-wall/brick-wall-core.js": ["BrickWallCore"],
  "broken-chord/broken-chord-core.js": ["BrokenChordCore"],
  "broken-chord-mr-homm/broken-chord-mr-homm-core.js": ["BrokenChordMrHommCore"],
  "broken-chord-paper-folding/broken-chord-paper-folding-core.js": ["BrokenChordPaperFoldingCore"],
  "building-bridge/building-bridge-core.js": ["BuildingBridgeCore"],
  "building-bridges/building-bridges-core.js": ["BuildingBridgesCore"],
  "bui-quang-tuan/bui-quang-tuan-core.js": ["BuiQuangTuanCore"],
  "bui-quang-tuan-2/bui-quang-tuan-2-core.js": ["BuiQuangTuan2Core"],
  "bulging-lines/bulging-lines-core.js": ["BulgingLinesCore"],
  "butterfly/butterfly-core.js": ["ButterflyCore"],
  "butterfly-in-ellipse/butterfly-in-ellipse-core.js": ["ButterflyInEllipseCore"],
  "cabart-collinearity/cabart-collinearity-core.js": ["CabartCollinearityCore"],
  "cantor-point/cantor-point-core.js": ["CantorPointCore"],
  "cardi/cardi-core.js": ["CardiCore"],
  "carnot/carnot-core.js": ["CarnotCore"],
  "carpets-in-parallelogram/carpets-in-parallelogram-core.js": ["CarpetsInParallelogramCore"],
  "carpets-in-quadri/carpets-in-quadri-core.js": ["CarpetsInQuadriCore"],
  "carpets-in-quadri-2/carpets-in-quadri-2-core.js": ["CarpetsInQuadri2Core"],
  "carpets-in-square/carpets-in-square-core.js": ["CarpetsInSquareCore"],
  "carpets-in-square-2/carpets-in-square-2-core.js": ["CarpetsInSquare2Core"],
  "carpet-with-hole/carpet-with-hole-core.js": ["CarpetWithHoleCore"],
  "casey-theorem/casey-theorem-core.js": ["CaseyTheoremCore"],
  "center-circle/center-circle-core.js": ["CenterCircleCore"],
  "central-angles-in-cube/central-angles-in-cube-core.js": ["CentralAnglesInCubeCore"],
  "centroids-in-polygon/centroids-in-polygon-core.js": ["CentroidsInPolygonCore"],
  "ceva-cradle/ceva-cradle-core.js": ["CevaCradleCore"],
  "ceva-in-ngon/ceva-in-ngon-core.js": ["CevaInNgonCore"],
  "ceva-nest/ceva-nest-core.js": ["CevaNestCore"],
  "ceva-pww/ceva-pww-core.js": ["CevaPwwCore"],
  "cevian-triangle/cevian-triangle-core.js": ["CevianTriangleCore"],
  "chasles/chasles-core.js": ["ChaslesCore"],
  "chasles-tangents/chasles-tangents-core.js": ["ChaslesTangentsCore"],
  "cid/cid-core.js": ["CidCore"],
  "circle-center-by-ruler/circle-center-by-ruler-core.js": ["CircleCenterByRulerCore"],
  "circle-centers-on-radical-axes/circle-centers-on-radical-axes-core.js": ["CircleCentersOnRadicalAxesCore"],
  "circle-division/circle-division-core.js": ["CircleDivisionCore"],
  "circle-in-isosceles-triangle/circle-in-isosceles-triangle-core.js": ["CircleInIsoscelesTriangleCore"],
  "circle-of-similitude/circle-of-similitude-core.js": ["CircleOfSimilitudeCore"],
  "circle-of-similitude-1/circle-of-similitude-1-core.js": ["CircleOfSimilitude1Core"],
  "circle-on-cevian/circle-on-cevian-core.js": ["CircleOnCevianCore"],
  "circles-and-parallelogram/circles-and-parallelogram-core.js": ["CirclesAndParallelogramCore"],
  "circles-and-parallels/circles-and-parallels-core.js": ["CirclesAndParallelsCore"],
  "circles-and-regular-triangle/circles-and-regular-triangle-core.js": ["CirclesAndRegularTriangleCore"],
  "circles-and-square/circles-and-square-core.js": ["CirclesAndSquareCore"],
  "circles-cover-quadrilateral/circles-cover-quadrilateral-core.js": ["CirclesCoverQuadrilateralCore"],
  "circles-in-circles-sangaku/circles-in-circles-sangaku-core.js": ["CirclesInCirclesSangakuCore"],
  "circles-in-regular-polygon/circles-in-regular-polygon-core.js": ["CirclesInRegularPolygonCore"],
  "circles-lined-on-tri-sides/circles-lined-on-tri-sides-core.js": ["CirclesLinedOnTriSidesCore"],
  "circles-on-a-chord/circles-on-a-chord-core.js": ["CirclesOnAChordCore"],
  "circles-on-perp-bisector/circles-on-perp-bisector-core.js": ["CirclesOnPerpBisectorCore"],
  "circle-square-circle/circle-square-circle-core.js": ["CircleSquareCircleCore"],
  "circles-through-orthocenter/circles-through-orthocenter-core.js": ["CirclesThroughOrthocenterCore"],
  "circles-with-equal-chords/circles-with-equal-chords-core.js": ["CirclesWithEqualChordsCore"],
  "circle-through-circumcenter/circle-through-circumcenter-core.js": ["CircleThroughCircumcenterCore"],
  "circle-through-incenter/circle-through-incenter-core.js": ["CircleThroughIncenterCore"],
  "circle-through-incenter-2/circle-through-incenter-2-core.js": ["CircleThroughIncenter2Core"],
  "circle-triplet/circle-triplet-core.js": ["CircleTripletCore"],
  "circular-poggendorf/circular-poggendorf-core.js": ["CircularPoggendorfCore"],
  "circumcenter-on-angle-bisector/circumcenter-on-angle-bisector-core.js": ["CircumcenterOnAngleBisectorCore"],
  "circum-quadri/circum-quadri-core.js": ["CircumQuadriCore"],
  "circum-simson/circum-simson-core.js": ["CircumSimsonCore"],
  "circumsogonal/circumsogonal-core.js": ["CircumsogonalCore"],
  "cleaver/cleaver-core.js": ["CleaverCore"],
  "clifford-theorem/clifford-theorem-core.js": ["CliffordTheoremCore"],
  "close-to-hilbert/close-to-hilbert-core.js": ["CloseToHilbertCore"],
  "coaxal-circles/coaxal-circles-core.js": ["CoaxalCirclesCore"],
  "common-tangent-sangaku/common-tangent-sangaku-core.js": ["CommonTangentSangakuCore"],
  "concurrency/concurrency-core.js": ["ConcurrencyCore"],
  "conditional-probability/conditional-probability-core.js": ["ConditionalProbabilityCore"],
  "conic-sections/conic-sections-core.js": ["ConicSectionsCore"],
  "conjugality/conjugality-core.js": ["ConjugalityCore"],
  "conjugate-diameters/conjugate-diameters-core.js": ["ConjugateDiametersCore"],
  "connes/connes-core.js": ["ConnesCore"],
  "continuous-curve/continuous-curve-core.js": ["ContinuousCurveCore"],
  "contrast/contrast-core.js": ["ContrastCore"],
  "contrast-2/contrast-2-core.js": ["Contrast2Core"],
  "contrast-3/contrast-3-core.js": ["Contrast3Core"],
  "contrast-4/contrast-4-core.js": ["Contrast4Core"],
  "contrast-ii/contrast-ii-core.js": ["ContrastIiCore"],
  "cosine-law/cosine-law-core.js": ["CosineLawCore"],
  "cosine-law-unfolded/cosine-law-unfolded-core.js": ["CosineLawUnfoldedCore"],
  "coupled-impossible-fork/coupled-impossible-fork-core.js": ["CoupledImpossibleForkCore"],
  "coxeter-tangent-circles/coxeter-tangent-circles-core.js": ["CoxeterTangentCirclesCore"],
  "cross-circle/cross-circle-core.js": ["CrossCircleCore"],
  "crowded-chair/crowded-chair-core.js": ["CrowdedChairCore"],
  "cube7-cube8/cube7-cube8-core.js": ["Cube7Cube8Core"],
  "cube-illusion/cube-illusion-core.js": ["CubeIllusionCore"],
  "cut-cube/cut-cube-core.js": ["CutCubeCore"],
  "cut-cylinder/cut-cylinder-core.js": ["CutCylinderCore"],
  "cw-crossed-lines/cw-crossed-lines-core.js": ["CwCrossedLinesCore"],
  "cw-star/cw-star-core.js": ["CwStarCore"],
  "cyclic-hexagon/cyclic-hexagon-core.js": ["CyclicHexagonCore"],
  "cyclic-incenters/cyclic-incenters-core.js": ["CyclicIncentersCore"],
  "cyclic-quadrilateral/cyclic-quadrilateral-core.js": ["CyclicQuadrilateralCore"],
  "cy-quadri/cy-quadri-core.js": ["CyQuadriCore"],
  "dancing-squares/dancing-squares-core.js": ["DancingSquaresCore"],
  "dave-richeson/dave-richeson-core.js": ["DaveRichesonCore"],
  "david-radcliffe/david-radcliffe-core.js": ["DavidRadcliffeCore"],
  "deco-symmetry/deco-symmetry-core.js": ["DecoSymmetryCore"],
  "deco-symmetry-2/deco-symmetry-2-core.js": ["DecoSymmetry2Core"],
  "deco-symmetry-3/deco-symmetry-3-core.js": ["DecoSymmetry3Core"],
  "deco-symmetry-4/deco-symmetry-4-core.js": ["DecoSymmetry4Core"],
  "delboeuf/delboeuf-core.js": ["DelboeufCore"],
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
    hiddenTags: entry.hiddenTags ?? [],
    level: entry.level ?? 2,
    kind: entry.kind ?? "game",
    url: `https://coolmaths.ai/${slug}/`,
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
  site: "https://coolmaths.ai/",
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
