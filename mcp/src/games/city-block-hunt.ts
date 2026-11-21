/*
 * run_game_logic actions and saved-position reader for City Block Hunt.
 *
 * The page makes two claims: the largest set of squares on which two treasures
 * agree (so that many touches still leave a doubt) is n^2 - 2n + 2, and two
 * touches of adjacent corners always locate the treasure. Both are checked
 * against the real core below — see city-block-hunt/city-block-hunt-core.js,
 * copied into src/generated/cores/ at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["city-block-hunt"].CityBlockHuntCore;

type Cell = { col: number; row: number };
type CellState = {
  n: number;
  treasure: Cell;
  grid: number[][];
  touches: number;
  won: boolean;
  hint: boolean;
  last: { col: number; row: number; d: number } | null;
};

const key = (c: Cell) => c.col + "," + c.row;

function cellsOf(n: number): Cell[] {
  const out: Cell[] = [];
  for (let col = 0; col < n; col++) for (let row = 0; row < n; row++) out.push({ col, row });
  return out;
}

/** Round a cell coordinate argument into the board. */
function cellArg(args: Json, name: string, fallback: number, n: number): number {
  const v = Math.round(num(args, name, fallback));
  return Math.max(0, Math.min(n - 1, v));
}

/** Rebuild the plain core state the page saved with Track.state. */
function restore(state: Json): CellState {
  const C = core();
  const n = C.clampN(state.n === undefined ? C.N_DEFAULT : num(state, "n"));
  const fresh: CellState = C.start({ n });
  const validGrid = Array.isArray(state.grid) && state.grid.length === n &&
    state.grid.every((col: unknown) => Array.isArray(col) && col.length === n);
  const grid: number[][] = validGrid
    ? (state.grid as number[][]).map((col) => col.map((v) => Number(v)))
    : fresh.grid;
  const t = state.treasure as Cell | undefined;
  const treasure = t && Number.isInteger(t.col) && Number.isInteger(t.row) &&
    t.col >= 0 && t.col < n && t.row >= 0 && t.row < n
    ? { col: t.col, row: t.row }
    : fresh.treasure;
  const last = state.last as CellState["last"];
  return {
    n,
    treasure,
    grid,
    touches: num(state, "touches", validGrid ? fresh.touches : 0),
    won: state.won === true || grid.some((col) => col.indexOf(-1) >= 0),
    hint: state.hint === true,
    last: last && Number.isFinite(last.col) && Number.isFinite(last.row) && Number.isFinite(last.d)
      ? { col: last.col, row: last.row, d: last.d }
      : null,
  };
}

/**
 * The largest set of cells on which two different treasures give the same
 * distance: touch them all and the treasure is still not pinned down. Found
 * from the core's own distance function, as in porting/check-city-block-hunt.mjs.
 */
function maxAmbiguous(n: number) {
  const C = core();
  const all = cellsOf(n);
  let best = 0;
  let pair: [Cell, Cell] | null = null;
  let layout: Cell[] = [];
  for (const a of all) {
    for (const b of all) {
      if (key(a) === key(b)) continue;
      const same = all.filter((c) => C.distance(c, a) === C.distance(c, b));
      if (same.length > best) {
        best = same.length;
        pair = [a, b];
        layout = same;
      }
    }
  }
  return { best, pair, layout };
}

/** Touch the two adjacent corners and see whether exactly one cell remains. */
function twoCorners(n: number, treasure: Cell) {
  const C = core();
  const plan = C.twoCornerPlan(n, treasure);
  let s = C.start({ n, treasure });
  const first = C.move(s, plan.first);
  const afterFirst = first ? C.candidates(first) : [];
  let afterSecond: Cell[] = [];
  if (first && !first.won) {
    const second = C.move(first, plan.second);
    if (second) afterSecond = C.candidates(second);
  }
  // If the treasure is on the first corner the hunt ends after one touch;
  // candidates() then already returns just that cell.
  const finalCandidates = first && first.won ? afterFirst : afterSecond;
  // The page's formula: from d1 = col+row and d2 = (n-1-col)+row.
  const col = (plan.d1 - plan.d2 + n - 1) / 2;
  const row = plan.d1 - col;
  return {
    plan,
    wonOnFirst: !!first && first.won,
    afterFirst,
    afterSecond,
    recovered: { col, row },
    located: finalCandidates.length === 1 && key(finalCandidates[0]) === key(treasure),
  };
}

export function actions(): GameActions {
  return {
    two_corner_opening: {
      describe:
        "Play the page's two-corner opening on an n by n board with the treasure at (col, row): show both clues, the candidates left after each touch, the cell recovered from the two clues, and whether the treasure is located.",
      args: '{ "n": 4, "col": 1, "row": 2 }',
      run: (args) => {
        const C = core();
        const n = C.clampN(num(args, "n", C.N_DEFAULT));
        const treasure = { col: cellArg(args, "col", 1, n), row: cellArg(args, "row", 2, n) };
        const t = twoCorners(n, treasure);
        return {
          n,
          treasure,
          corners: { first: t.plan.first, second: t.plan.second },
          clues: { d1: t.plan.d1, d2: t.plan.d2 },
          recoveredCell: t.recovered,
          formulaAgrees: t.recovered.col === treasure.col && t.recovered.row === treasure.row,
          candidatesAfterFirst: t.afterFirst,
          candidatesAfterSecond: t.afterSecond,
          touchesNeeded: t.wonOnFirst ? 1 : 2,
          located: t.located,
          note:
            `The first corner gives d1 = col + row = ${t.plan.d1}, the adjacent corner gives ` +
            `d2 = (${n} - 1 - col) + row = ${t.plan.d2}. Their difference fixes col, then row: ` +
            `col = (d1 - d2 + ${n} - 1)/2 = ${t.recovered.col}, row = d1 - col = ${t.recovered.row}. ` +
            `${t.located ? "Exactly one cell is left — the treasure." : "The two clues did not leave one cell."}`,
        };
      },
    },
    ambiguous_touches: {
      describe:
        "For a board size n, find the biggest set of squares on which two treasures agree — the most touches that can still leave you guessing — and compare it with the page's n^2 - 2n + 2 formula. Includes the agreeing pair and every square in that set.",
      args: '{ "n": 4 }',
      run: (args) => {
        const C = core();
        const n = C.clampN(num(args, "n", C.N_DEFAULT));
        const found = maxAmbiguous(n);
        const formula = n * n - 2 * n + 2;
        return {
          n,
          maxAmbiguousTouches: found.best,
          pageFormula: formula,
          agrees: found.best === formula,
          ambiguousPair: found.pair,
          layout: found.layout,
          layoutSize: found.layout.length,
          note:
            `Two treasures can only be told apart by a square at different distances from them. ` +
            `The largest set on which a pair agrees has ${found.best} squares, which is n^2 - 2n + 2 = ${formula} ` +
            `on a ${n} by ${n} board. ${n === 4 ? "So ten touches can still leave a doubt here — the magazine's answer of 4 was too small, and an eleventh touch breaks the tie." : "Touch any square off that set and the tie is broken."}`,
        };
      },
    },
    check_page_claims: {
      describe:
        "Exhaustively check both claims of the page on every board from 2 by 2 to 8 by 8: the largest ambiguous set equals n^2 - 2n + 2, and two adjacent-corner touches locate every possible treasure.",
      args: '{}',
      run: () => {
        const C = core();
        const sizes: unknown[] = [];
        let allHold = true;
        for (let n = C.N_MIN; n <= C.N_MAX; n++) {
          const found = maxAmbiguous(n);
          const formula = n * n - 2 * n + 2;
          let treasuresLocated = 0;
          for (const treasure of cellsOf(n)) if (twoCorners(n, treasure).located) treasuresLocated++;
          const total = n * n;
          const countAgrees = found.best === formula;
          const cornersAgree = treasuresLocated === total;
          if (!countAgrees || !cornersAgree) allHold = false;
          sizes.push({
            n,
            maxAmbiguousTouches: found.best,
            formula,
            countAgrees,
            treasuresLocated,
            treasuresChecked: total,
            cornersAgree,
          });
        }
        return {
          sizes,
          allHold,
          note: allHold
            ? "Both claims hold on every size the applet offers: the largest ambiguous set is n^2 - 2n + 2 and two adjacent corners always leave a single candidate cell."
            : "At least one of the page's claims fails on a board in this range; see the failing size.",
        };
      },
    },
  };
}

/** What the core says about the clues and possible treasures on screen now. */
export function position(state: Json): unknown {
  const C = core();
  const here = restore(state);
  const clues = C.clues(here);
  const candidates = C.candidates(here);
  const n = here.n;
  const found = maxAmbiguous(n);
  let treasuresLocated = 0;
  for (const treasure of cellsOf(n)) if (twoCorners(n, treasure).located) treasuresLocated++;
  return {
    n,
    touchesSoFar: here.touches,
    finished: here.won,
    hintOn: here.hint,
    clues,
    clueCount: clues.length,
    candidates,
    candidateCount: candidates.length,
    determined: candidates.length === 1,
    squaresLeftToTouch: C.legalMoves(here).length,
    lastTouch: here.last,
    pageClaimCheck: {
      largestAmbiguousSet: found.best,
      formula: n * n - 2 * n + 2,
      agrees: found.best === n * n - 2 * n + 2,
      twoCornersLocateEveryTreasure: treasuresLocated === n * n,
    },
    note: here.won
      ? `The treasure was found after ${here.touches} ${here.touches === 1 ? "touch" : "touches"}.`
      : `${clues.length} ${clues.length === 1 ? "clue leaves" : "clues leave"} ${candidates.length} ` +
        `${candidates.length === 1 ? "square" : "squares"} that could still hide the treasure: ` +
        `${candidates.map(key).join(" ")}. Every clue rules out cells at the wrong taxicab distance; ` +
        `${candidates.length === 1 ? "touch that last square to finish." : "touch another square to narrow them down."} ` +
        `The page's claim about n^2 - 2n + 2 concerns the most touches that can still leave a tie, not this position.`,
  };
}
