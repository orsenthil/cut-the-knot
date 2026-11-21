/*
 * run_game_logic actions and saved-position reader for A Problem of Divisibility.
 *
 * Digits in a rectangle make a number of every row and every column. If p is
 * prime to 10 and all the numbers but one are divisible by p, so is the last.
 * Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["divisibility"].DivisibilityCore;

/** A digit matrix from the arguments: rows given as arrays of digits, or as strings of digits. */
function matrix(args: Json): number[][] {
  const raw = Array.isArray(args.digits) ? (args.digits as unknown[]) : [[1, 2, 3], [4, 5, 6]];
  const m = raw.map((r) => (Array.isArray(r) ? r.map(Number) : String(r).split("").map(Number)));
  if (m.length < 2 || m.length > 8 || m.some((r) => r.length !== m[0].length || r.length < 2 || r.length > 8 || r.some((d) => !Number.isInteger(d) || d < 0 || d > 9))) {
    throw new Error("digits must be 2 to 8 rows of 2 to 8 digits each, all the same length");
  }
  return m;
}

export function actions(): GameActions {
  return {
    check: {
      describe:
        "Read the rows and columns of a digit matrix as integers, say which are divisible by p, and give C and D (the row- and column-weighted sums, always equal). When p is prime to 10 and exactly one number is not divisible, that cannot happen: the answer says so.",
      args: '{ "digits": ["123", "456"], "p": 3 }',
      run: (args) => {
        const C = core();
        const digits = matrix(args);
        const p = Math.trunc(num(args, "p", 7));
        if (p < 2) throw new Error("p must be at least 2");
        const s = { rows: digits.length, cols: digits[0].length, p, digits, moves: 0, explored: false };
        const d = C.divisibility(s, p);
        const cd = C.combos(s);
        return {
          rows: C.rowNumbers(s),
          columns: C.colNumbers(s),
          rowsDivisible: d.rows,
          columnsDivisible: d.cols,
          divisibleCount: d.count,
          total: d.total,
          primeTo10: C.primeTo10(p),
          C: String(cd.C),
          D: String(cd.D),
          equal: cd.C === cd.D,
          note: d.notDivisible === 1 && C.primeTo10(p) ? "Impossible: p is prime to 10 and exactly one number is left over." : d.notDivisible === 1 ? "Exactly one number is not divisible, which can happen only because p is not prime to 10." : d.notDivisible === 0 ? "Every row and column is divisible by p." : "More than one number is not divisible by p.",
        };
      },
    },
    counterexample: {
      describe: "Whether p is prime to 10 and, if it is not, a 2 by 2 digit matrix with exactly one number not divisible by p (p up to 99).",
      args: '{ "p": 2 }',
      run: (args) => {
        const C = core();
        const p = Math.trunc(num(args, "p", 2));
        const primeTo10 = C.primeTo10(p);
        let found: number[][] | null = null;
        for (let k = 0; k < 10000 && !found; k++) {
          const digits = [[k % 10, Math.floor(k / 10) % 10], [Math.floor(k / 100) % 10, Math.floor(k / 1000) % 10]];
          if (C.divisibility({ rows: 2, cols: 2, p, digits, moves: 0, explored: false }, p).notDivisible === 1) found = digits;
        }
        return { p, primeTo10, counterexample2x2: found, note: primeTo10 ? "No such matrix exists: the theorem holds for p prime to 10." : found ? "p shares a factor with 10, so the theorem can fail." : "None found among 2 by 2 matrices." };
      },
    },
  };
}

/** What the core says about the matrix as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const digits = Array.isArray(state.digits) ? (state.digits as number[][]) : null;
  const s = C.start({ rows: num(state, "rows", 2), cols: num(state, "cols", 3), p: num(state, "p", 7), digits });
  const d = C.divisibility(s, s.p);
  return {
    size: `${s.rows} rows by ${s.cols} columns`,
    p: s.p,
    primeTo10: C.primeTo10(s.p),
    rows: C.rowNumbers(s),
    columns: C.colNumbers(s),
    divisibleCount: d.count,
    total: d.total,
    exactlyOneLeftOver: d.notDivisible === 1,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
