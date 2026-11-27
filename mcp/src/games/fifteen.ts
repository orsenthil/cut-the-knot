/*
 * run_game_logic actions and position reader for Sam Loyd's Fifteen.
 *
 * Every number below comes from the game's real core (fifteen/fifteen-core.js),
 * copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape: actions() for run_game_logic, position() for my_position.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Fifteen = typeof cores.fifteen.FifteenCore;

interface Board {
  n: number;
  mode: number;
  tiles: number[];
  moves: number;
}

/** A reproducible stand-in for the applet's Math.random() in Core.shuffle. */
function seededRandom(seed: number): () => number {
  let s = (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function integer(args: Json, key: string, fallback?: number): number {
  const v = num(args, key, fallback);
  if (!Number.isInteger(v)) {
    throw new Error(`argument "${key}" must be an integer, got ${JSON.stringify(args[key])}`);
  }
  return v;
}

function checkTiles(tiles: number[], n: number): void {
  if (tiles.length !== n * n) {
    throw new Error(`argument "tiles" must hold ${n * n} numbers for a ${n}x${n} board`);
  }
  const sorted = tiles.slice().sort((a, b) => a - b);
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k] !== k + 1) throw new Error('argument "tiles" must be a permutation of 1 through n*n');
  }
}

/** The board asked for: an explicit permutation, or a seeded shuffle of a fresh one. */
function board(C: Fifteen, args: Json): Board {
  const n = integer(args, "n", 4);
  const mode = integer(args, "mode", 0);
  if (n < C.MIN_N || n > C.MAX_N) throw new Error(`argument "n" must be between ${C.MIN_N} and ${C.MAX_N}`);
  if (mode < C.PLAIN || mode > C.MOEBIUS) throw new Error('argument "mode" must be 0 (Loyd), 1 (Cylinder) or 2 (Moebius)');
  if (args.tiles !== undefined) {
    const tiles = numArray(args, "tiles");
    checkTiles(tiles, n);
    return { n, mode, tiles, moves: 0 };
  }
  let b = C.start({ n, mode }) as Board;
  if (args.seed !== undefined) b = C.shuffle(b, seededRandom(num(args, "seed"))) as Board;
  return b;
}

function reading(C: Fifteen, b: Board) {
  const inversions: number = C.inversions(b);
  const blankRow: number = C.blankRow(b);
  const blank: number = C.blankIndex(b);
  return {
    n: b.n,
    mode: b.mode,
    modeName: (C.MODES as string[])[b.mode] ?? String(b.mode),
    tiles: b.tiles.slice(),
    inversions,
    blankRow,
    N: inversions + blankRow,
    Nmod2: (inversions + blankRow) % 2,
    inversionParity: inversions % 2,
    blankAt: { col: Math.floor(blank / b.n), row: blank % b.n },
    isSolved: Boolean(C.isSolved(b)),
    legalSlides: (C.legalMoves(b) as number[]).length,
  };
}

type Reading = ReturnType<typeof reading>;

/**
 * Which parity class can reach the solved order, from the page's invariant:
 * even boards keep N mod 2 (inversions + blank row), odd boards keep the
 * inversion parity alone. Cylinder crosses the classes on an odd number of
 * rows and Moebius crosses them at every size, so those boards are solvable.
 */
function solvability(C: Fifteen, b: Board, r: Reading) {
  const solved = reading(C, C.start({ n: b.n, mode: b.mode }) as Board);
  const even = b.n % 2 === 0;
  const matchesClass = even
    ? r.Nmod2 === solved.Nmod2
    : r.inversionParity === solved.inversionParity;
  let solvableBySlides = matchesClass;
  let parityRule: string;
  if (b.mode === C.MOEBIUS) {
    solvableBySlides = true;
    parityRule = "Moebius wrap joins the two parity classes";
  } else if (b.mode === C.CYLINDER && !even) {
    solvableBySlides = true;
    parityRule = "Cylinder wrap crosses the classes on an odd number of rows";
  } else {
    parityRule = even ? "inversions + blank row (N mod 2)" : "inversions alone";
  }
  return {
    solvableBySlides,
    parityRule,
    matchesSolvedClass: matchesClass,
    solvedBoard: {
      inversions: solved.inversions,
      blankRow: solved.blankRow,
      Nmod2: solved.Nmod2,
      inversionParity: solved.inversionParity,
    },
  };
}

export function actions(): GameActions {
  const C = cores.fifteen.FifteenCore;
  return {
    parity: {
      describe:
        "Count inversions and the empty square's row for a sliding-counter board, then say whether slides can reach the solved order. On even boards the invariant is inversions plus blank row (N mod 2, so only half the boards are solvable); on odd boards inversion parity alone is invariant, so an odd board with an even N can still be impossible. Optional tiles give an explicit board, otherwise seed shuffles a fresh one.",
      args: '{ "n": 4, "mode": 0, "seed": 7 }',
      run: (args) => {
        const b = board(C, args);
        const r = reading(C, b);
        const verdict = solvability(C, b, r);
        const acrossModes = [C.PLAIN, C.CYLINDER, C.MOEBIUS].map((m) => {
          const mb: Board = { ...b, mode: m };
          const mr = reading(C, mb);
          const mv = solvability(C, mb, mr);
          return {
            mode: m,
            name: mr.modeName,
            inversions: mr.inversions,
            blankRow: mr.blankRow,
            N: mr.N,
            Nmod2: mr.Nmod2,
            solvableFromThisArrangement: mv.solvableBySlides,
            why: mv.parityRule,
          };
        });
        return {
          board: {
            n: r.n,
            mode: r.mode,
            modeName: r.modeName,
            tiles: r.tiles,
            fromSeed: args.seed ?? null,
          },
          counting: {
            inversions: r.inversions,
            blankRow: r.blankRow,
            N: r.N,
            Nmod2: r.Nmod2,
            inversionParity: r.inversionParity,
            blankAt: r.blankAt,
            legalSlides: r.legalSlides,
          },
          verdict,
          acrossModes,
          note: r.n % 2 === 0
            ? "On an even board every slide preserves N mod 2, so only the boards in the solved board's class can ever be put right."
            : "On an odd board a vertical slide passes an even number of counters, so inversion parity is the invariant while N changes parity — the even-board test does not apply.",
        };
      },
    },

    cheat: {
      describe:
        "Apply the applet's Cheat (a swap of two counters) and show the parity before and after: it flips the invariant, so a solvable board lands in the impossible half that Shuffle cannot leave. The answer also builds a real 3x3 counterexample on the core, where N is even but the board still cannot be solved.",
      args: '{ "n": 4, "mode": 0, "seed": 7 }',
      run: (args) => {
        const b = board(C, args);
        const before = reading(C, b);
        const cheated = C.cheat(b) as Board;
        const after = reading(C, cheated);
        const beforeVerdict = solvability(C, b, before);
        const afterVerdict = solvability(C, cheated, after);

        // A concrete odd-board counterexample, all from the same core: Cheat a
        // fresh 3x3 board, then slide the blank up one row. Its N is even (the
        // 4x4 rule would call it solvable) but its inversion parity is wrong.
        const start3 = C.start({ n: 3, mode: 0 }) as Board;
        const ref3 = reading(C, start3);
        let bad3 = C.cheat(start3) as Board;
        bad3 = (C.move(bad3, 7) as Board | null) ?? bad3;
        const bad = reading(C, bad3);
        const counterexample = {
          n: 3,
          tiles: bad.tiles,
          inversions: bad.inversions,
          N: bad.N,
          Nmod2: bad.Nmod2,
          solvedNmod2: ref3.Nmod2,
          inversionParity: bad.inversionParity,
          solvedInversionParity: ref3.inversionParity,
          evenBoardRuleWouldSay: bad.Nmod2 === ref3.Nmod2 ? "solvable" : "unsolvable",
          actuallySolvable: bad.inversionParity === ref3.inversionParity,
        };

        return {
          before: {
            tiles: before.tiles,
            inversions: before.inversions,
            blankRow: before.blankRow,
            N: before.N,
            Nmod2: before.Nmod2,
            solvableBySlides: beforeVerdict.solvableBySlides,
          },
          afterCheat: {
            tiles: after.tiles,
            inversions: after.inversions,
            blankRow: after.blankRow,
            N: after.N,
            Nmod2: after.Nmod2,
            solvableBySlides: afterVerdict.solvableBySlides,
          },
          inversionParityFlipped: before.inversionParity !== after.inversionParity,
          Nmod2Flipped: before.Nmod2 !== after.Nmod2,
          note: b.mode === C.MOEBIUS
            ? "Cheat still flips the inversion parity, but the Moebius wrap joins the two classes, so here it need not trap the board."
            : "Cheat swaps two counters and leaves the empty square put; the inversion parity flips and, on an even board, so does N mod 2. Shuffle afterwards stays in the impossible half.",
          oddBoardCounterexample: counterexample,
        };
      },
    },
  };
}

/**
 * What the core says about the position the page saved with Track.state:
 * echo the saved board (n, mode, tiles, cursor, solved) and add the inversion
 * and blank-row reading, the parity class, and the cycle form when small.
 */
export function position(state: Json, stateVersion: number): unknown {
  const C = cores.fifteen.FifteenCore;
  const n = integer(state, "n");
  const mode = integer(state, "mode");
  const tiles = numArray(state, "tiles");
  checkTiles(tiles, n);
  const b: Board = { n, mode, tiles, moves: 0 };
  const r = reading(C, b);
  const verdict = solvability(C, b, r);
  return {
    stateVersion,
    saved: {
      n: r.n,
      mode: r.mode,
      modeName: r.modeName,
      tiles: r.tiles,
      cursor: state.cursor ?? null,
      solved: state.solved ?? null,
    },
    reading: {
      inversions: r.inversions,
      blankRow: r.blankRow,
      N: r.N,
      Nmod2: r.Nmod2,
      inversionParity: r.inversionParity,
      blankAt: r.blankAt,
      legalSlides: r.legalSlides,
      cycles: r.n <= 5 ? (C.cycles(b) as string) : null,
      coreSaysSolved: r.isSolved,
      matchesSavedSolved: state.solved === undefined ? null : Boolean(state.solved) === r.isSolved,
    },
    verdict,
    note: verdict.solvableBySlides
      ? `This board is in the solved board's class (${verdict.parityRule}); slides can put it right.`
      : `This board is in the other class (${verdict.parityRule}); no sequence of slides can solve it.`,
  };
}
