/*
 * run_game_logic actions and saved-position reader for City Block Hunt From
 * Outside. Answers come from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 *
 * The key idea: a touch in the strip just outside the grid reports the
 * taxicab distance to the hidden treasure. Every touch therefore leaves a
 * "locus" of grid squares that could still hold it. Next to a corner that
 * locus collapses to a single diagonal, and two diagonals usually cross at
 * exactly one square -- the treasure. The page's "Show hint" lights the UNION
 * of all loci; the squares all clues agree on are the INTERSECTION. Both
 * always contain the treasure, and both are reported below.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["city-block-hunt-from-outside"].CityBlockHuntFromOutsideCore;

interface Pt {
  col: number;
  row: number;
}

interface Clue extends Pt {
  d: number;
}

interface GameState {
  n: number;
  treasure: Pt;
  clues: Clue[];
  finished: boolean;
}

/** Pull a plain {col, row} point out of an unknown value. */
function asPoint(v: unknown): Pt | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const col = Number(o.col);
  const row = Number(o.row);
  if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
  return { col, row };
}

/** The treasure, clamped into the grid; a fresh random one if none was saved. */
function readTreasure(args: Json, n: number): Pt {
  const C = core();
  const p = asPoint(args.treasure);
  if (p) return { col: C.clampIndex(p.col, n), row: C.clampIndex(p.row, n) };
  return C.start({ n }).treasure;
}

/** Rebuild the outside clues, computing any missing distance from the treasure. */
function readClues(args: Json, n: number, treasure: Pt): Clue[] {
  const C = core();
  const raw = args.clues;
  if (!Array.isArray(raw)) return [];
  return raw.map((x, i) => {
    const p = asPoint(x);
    if (!p) throw new Error(`clues[${i}] must have numeric col and row`);
    const o = x as Record<string, unknown>;
    const col = C.clampCell(p.col, n);
    const row = C.clampCell(p.row, n);
    let d = o.d === undefined || o.d === null ? NaN : Number(o.d);
    if (!Number.isFinite(d)) d = C.taxicab(col, row, treasure);
    return { col, row, d };
  });
}

/** The full state the page saves with Track.state (it is the core's plain state). */
function readState(args: Json): GameState {
  const C = core();
  const n = C.clampN(num(args, "n", C.GRID.initial));
  const treasure = readTreasure(args, n);
  return { n, treasure, clues: readClues(args, n, treasure), finished: args.finished === true };
}

function allSquares(n: number): Pt[] {
  const out: Pt[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) out.push({ col, row });
  }
  return out;
}

function intersects(a: Pt[], b: Pt[]): Pt[] {
  const keys = new Set(b.map((p) => `${p.col},${p.row}`));
  return a.filter((p) => keys.has(`${p.col},${p.row}`));
}

/** Squares every clue so far still allows (the intersection of their loci). */
function candidates(state: GameState): Pt[] {
  const C = core();
  let out = allSquares(state.n);
  for (const clue of state.clues) {
    out = intersects(out, C.clueLocus(state.n, clue.col, clue.row, clue.d));
  }
  return out;
}

/** Does a locus lie on one diagonal (c + row = k or c - row = k)? */
function diagonal(locus: Pt[]): { kind: "sum" | "difference" | null; constant: number | null } {
  if (!locus.length) return { kind: null, constant: null };
  const sum = locus[0].col + locus[0].row;
  const diff = locus[0].col - locus[0].row;
  if (locus.every((p) => p.col + p.row === sum)) return { kind: "sum", constant: sum };
  if (locus.every((p) => p.col - p.row === diff)) return { kind: "difference", constant: diff };
  return { kind: null, constant: null };
}

/** A strip is "next to a corner" when it touches row/col 0 or N-1. */
function cornerAdjacent(n: number, col: number, row: number): boolean {
  if (col < 0 || col >= n) return row === 0 || row === n - 1;
  if (row < 0 || row >= n) return col === 0 || col === n - 1;
  return false;
}

function stripName(n: number, col: number, row: number): string {
  if (row < 0) return `above column ${col + 1}`;
  if (row >= n) return `below column ${col + 1}`;
  if (col < 0) return `left of row ${row + 1}`;
  return `right of row ${row + 1}`;
}

function contains(locus: Pt[], p: Pt): boolean {
  return locus.some((cell) => cell.col === p.col && cell.row === p.row);
}

function describeClue(C: ReturnType<typeof core>, n: number, treasure: Pt, clue: Clue) {
  const locus = C.clueLocus(n, clue.col, clue.row, clue.d);
  return {
    col: clue.col,
    row: clue.row,
    d: clue.d,
    strip: stripName(n, clue.col, clue.row),
    outside: C.isOutside(n, clue.col, clue.row),
    cornerAdjacent: cornerAdjacent(n, clue.col, clue.row),
    diagonal: diagonal(locus),
    locusSize: locus.length,
    locus,
    treasureInLocus: contains(locus, treasure),
  };
}

export function actions(): GameActions {
  return {
    clue_locus: {
      describe:
        "For one touch just outside the grid and the distance it shows, list every grid square that could still hide the treasure. A touch next to a corner leaves a single diagonal; say whether the treasure is on it.",
      args: '{ "n": 4, "col": -1, "row": 0, "d": 2, "treasure": { "col": 1, "row": 0 } }',
      run: (args) => {
        const C = core();
        const n = C.clampN(num(args, "n", C.GRID.initial));
        const col = num(args, "col");
        const row = num(args, "row");
        const treasure = readTreasure(args, n);
        let d = args.d === undefined || args.d === null ? NaN : Number(args.d);
        if (!Number.isFinite(d)) d = C.taxicab(col, row, treasure);

        const locus = C.clueLocus(n, col, row, d);
        const diag = diagonal(locus);
        const corner = cornerAdjacent(n, col, row);
        const shape = diag.kind
          ? `the ${locus.length} possible squares lie on the single diagonal ${diag.kind === "sum" ? "col + row" : "col - row"} = ${diag.constant}`
          : `it leaves ${locus.length} possible squares, so combine it with another clue to narrow them`;
        const inLocus = contains(locus, treasure);
        return {
          n,
          touch: { col, row },
          strip: stripName(n, col, row),
          outside: C.isOutside(n, col, row),
          d,
          cornerAdjacent: corner,
          diagonal: diag,
          locus,
          candidateCount: locus.length,
          treasure: { col: treasure.col, row: treasure.row },
          treasureInLocus: inLocus,
          note: `A touch ${stripName(n, col, row)}${corner ? " is next to a corner, so" : ", away from a corner,"} ${shape}. The treasure is ${inLocus ? "on" : "NOT on"} this locus.`,
        };
      },
    },

    candidates: {
      describe:
        "From the outside clues collected so far, give the squares 'Show hint' lights (the union of every clue's locus) and the tighter set every clue agrees on (their intersection). Confirm the treasure lies in both.",
      args: '{ "n": 4, "treasure": { "col": 1, "row": 2 }, "clues": [ { "col": -1, "row": 0 }, { "col": -1, "row": 2 } ] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const lit = C.hintCells(state);
        const left = candidates(state);
        const clues = state.clues.map((clue) => describeClue(C, state.n, state.treasure, clue));
        const everyLocus = clues.length === 0 || clues.every((c) => c.treasureInLocus);
        return {
          n: state.n,
          treasure: state.treasure,
          finished: state.finished,
          outsideClues: clues,
          litSquareCount: lit.length,
          litSquares: lit,
          candidateCount: left.length,
          candidates: left,
          treasureInEveryLocus: everyLocus,
          treasureInCandidates: contains(left, state.treasure) && everyLocus,
          note: `${clues.length} outside clue(s): 'Show hint' lights ${lit.length} square(s) (the union of the loci), but only ${left.length} square(s) agree with every clue (the intersection). The treasure is in ${everyLocus ? "every locus" : "NOT every locus"}${contains(left, state.treasure) ? " and in the intersection" : " and NOT in the intersection"}.`,
        };
      },
    },

    best_next_touch: {
      describe:
        "Assuming a given treasure is the real one, find which outside touch would leave the fewest possible treasure squares -- the best next clue to ask for.",
      args: '{ "n": 4, "treasure": { "col": 1, "row": 2 }, "clues": [] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const left = candidates(state);
        const options = C.legalMoves(state)
          .filter((m: Pt) => C.isOutside(state.n, m.col, m.row))
          .map((m: Pt) => {
            const d = C.taxicab(m.col, m.row, state.treasure);
            const locus = C.clueLocus(state.n, m.col, m.row, d);
            const next = intersects(left, locus);
            return {
              col: m.col,
              row: m.row,
              strip: stripName(state.n, m.col, m.row),
              d,
              cornerAdjacent: cornerAdjacent(state.n, m.col, m.row),
              diagonal: diagonal(locus),
              candidateCount: next.length,
            };
          })
          .sort((a, b) => a.candidateCount - b.candidateCount);
        const best = options.slice(0, 5);
        return {
          n: state.n,
          treasure: state.treasure,
          candidateCountNow: left.length,
          best,
          note: best.length
            ? `Touching ${best[0].strip} would report ${best[0].d} and leave only ${best[0].candidateCount} possible square(s), the tightest clue available now. Corner-adjacent touches give a diagonal of just N squares.`
            : "There are no outside touches for this grid.",
        };
      },
    },
  };
}

/** What the core says about the hunt currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const lit = C.hintCells(here);
  const left = candidates(here);
  const clues = here.clues.map((clue) => describeClue(C, here.n, here.treasure, clue));
  const everyLocus = clues.length === 0 || clues.every((c) => c.treasureInLocus);
  const found = here.finished;
  return {
    n: here.n,
    treasure: { col: here.treasure.col, row: here.treasure.row },
    finished: found,
    outcome: C.result(here),
    outsideClues: clues,
    clueCount: clues.length,
    litSquareCount: lit.length,
    litSquares: lit,
    candidateCount: left.length,
    candidates: left,
    treasureInEveryLocus: everyLocus,
    treasureInCandidates: contains(left, here.treasure) && everyLocus,
    note: found
      ? `The treasure in column ${here.treasure.col + 1}, row ${here.treasure.row + 1} has been found.`
      : `${clues.length} outside clue(s) collected. 'Show hint' lights ${lit.length} square(s) (the union of the loci); ${left.length} square(s) agree with every clue (the intersection). The treasure is ${everyLocus ? "in every locus" : "NOT in every locus"}${contains(left, here.treasure) ? " and in the intersection" : " and NOT in the intersection"}.`,
  };
}
