/*
 * run_game_logic actions and saved-position reader for Line Through Grid.
 *
 * Both use the game's real core, copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["line-through-grid"].LineThroughGridCore;
type Cell = { column: number; row: number };

/** The two spinners of the applet: whole numbers from 1 to 50. */
function dimensions(args: Json) {
  const M = num(args, "M");
  const N = num(args, "N");
  if (!Number.isInteger(M) || !Number.isInteger(N)) {
    throw new Error("M and N must be whole numbers (the applet's spinners step by 1)");
  }
  if (M < 1 || M > 50 || N < 1 || N > 50) {
    throw new Error("M and N must be between 1 and 50");
  }
  return { M, N };
}

/** The applet's Reset method sizes the drawing from the window, in pixels. */
function canvas(args: Json) {
  const width = num(args, "width", 1000);
  const height = num(args, "height", 900);
  if (width < 1 || height < 1) throw new Error("width and height must be positive pixel sizes");
  return { width, height };
}

const key = (c: Cell) => `${c.column},${c.row}`;

export function actions(): GameActions {
  return {
    crossed_squares: {
      describe:
        "How many unit squares the diagonal of an M-by-N rectangle passes through. Checks the formula S = M + N - gcd(M, N) against a direct enumeration of the crossed cells and explains the squares lost at interior corner points.",
      args: '{ "M": 6, "N": 11 }',
      run: (args) => {
        const C = core();
        const { M, N } = dimensions(args);
        const s = C.start({ M, N });
        const formula: number = C.crossed(s);
        const cells = C.crossedCells(s) as Cell[];
        const g: number = C.gcd(M, N);
        const interior: number = C.interiorNodes(s);
        return {
          M: s.M,
          N: s.N,
          gcd: g,
          formula,
          enumerated: cells.length,
          agrees: formula === cells.length,
          interiorLatticePoints: interior,
          coprimeShortcut: C.coprimeFormula(s),
          crossedCells: cells.map((c) => ({ column: c.column, row: c.row })),
          note: g === 1
            ? `gcd(${M}, ${N}) = 1, so the diagonal misses every inside corner point and crosses ${M} + ${N} - 1 = ${formula} squares.`
            : `gcd(${M}, ${N}) = ${g}: the diagonal hits ${interior} inside corner point${interior === 1 ? "" : "s"}, where two grid lines are met at once, so ${M + N - 1} - ${interior} = ${formula} squares are crossed.`,
        };
      },
    },
    applet_paint: {
      describe:
        "Which cells the applet's own Draw method paints on a width-by-height canvas, with its 0.1-pixel guard, compared with the true crossed squares. At a normal canvas size the painting agrees; on a very small canvas the guard can erase end cells of a nearly flat diagonal without changing the maths.",
      args: '{ "M": 1, "N": 27, "width": 100, "height": 90 }',
      run: (args) => {
        const C = core();
        const { M, N } = dimensions(args);
        const { width, height } = canvas(args);
        const s = C.start({ M, N });
        const step = Math.min(Math.trunc((height - 20) / N), Math.trunc((width - 20) / M));
        const painted = C.paintedCells(s, { width, height }) as Cell[] | null;
        const enumerated = C.crossedCells(s) as Cell[];
        const paintedKeys = new Set((painted ?? []).map(key));
        const enumeratedKeys = new Set(enumerated.map(key));
        const missing = enumerated.filter((c) => !paintedKeys.has(key(c)));
        const extra = (painted ?? []).filter((c) => !enumeratedKeys.has(key(c)));
        const formula: number = C.crossed(s);
        return {
          M: s.M,
          N: s.N,
          width,
          height,
          cellStep: step > 0 ? step : null,
          formula,
          enumerated: enumerated.length,
          painted: painted ? painted.length : 0,
          agrees: painted ? painted.length === formula && missing.length === 0 && extra.length === 0 : false,
          missingFromPainting: missing,
          wronglyPainted: extra,
          note: step <= 0
            ? "The canvas leaves no room for a one-pixel cell, so the applet paints nothing (the mathematics still says the diagonal crosses the computed number of squares)."
            : painted && missing.length === 0 && extra.length === 0
              ? `With a ${step}px cell step, the applet's 0.1px guard (0.1 cell in this transcription) leaves the count unchanged: ${painted.length} painted squares, matching the formula.`
              : `At only ${step}px per cell, the applet's 0.1px guard drops ${missing.length} crossed square${missing.length === 1 ? "" : "s"} near the ends of the diagonal; this is a drawing artefact, not a change in the count ${formula}.`,
        };
      },
    },
  };
}

/** Echo the saved spinner values and count, then re-read them with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Line Through Grid state version ${stateVersion}`);
  const C = core();
  const { M, N } = dimensions(state);
  const s = C.start({ M, N });
  const formula: number = C.crossed(s);
  const g: number = C.gcd(M, N);
  const savedCrossed = num(state, "crossed", formula);
  const savedGcd = num(state, "gcd", g);
  const interior: number = C.interiorNodes(s);
  return {
    M: s.M,
    N: s.N,
    savedCrossed,
    savedGcd,
    crossed: formula,
    gcd: g,
    matchesSaved: savedCrossed === formula && savedGcd === g,
    enumeratedCells: (C.crossedCells(s) as Cell[]).length,
    interiorLatticePoints: interior,
    coprimeShortcut: C.coprimeFormula(s),
    note: g === 1
      ? `Coprime sides: the diagonal misses the inside corner points, so ${formula} = ${M} + ${N} - 1 squares are crossed.`
      : `The diagonal passes through ${interior} inside corner point${interior === 1 ? "" : "s"}, so ${formula} = ${M} + ${N} - ${g} squares are crossed.`,
  };
}
