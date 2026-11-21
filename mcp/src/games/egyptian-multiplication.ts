/*
 * run_game_logic actions and saved-position reader for Egyptian Multiplication.
 *
 * Double 1 and b down a table until the next power of two would pass a, pick the
 * powers that add up to a (the 1-bits of a), and add the doubles of b beside
 * them: that is a * b. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["egyptian-multiplication"].EgyptianMultiplicationCore;

export function actions(): GameActions {
  return {
    multiply: {
      describe: "Multiply a (1 to 9999) by b (0 to 9999) the Egyptian way: the table of powers of two and doubles of b, which powers are chosen (the binary digits of a), and the sum that gives the product.",
      args: '{ "a": 85, "b": 18 }',
      run: (args) => {
        const C = core();
        const a = Math.trunc(num(args, "a", 85)), b = Math.trunc(num(args, "b", 18));
        if (a < 1 || a > 9999 || b < 0 || b > 9999) throw new Error("a runs from 1 to 9999 and b from 0 to 9999");
        const t = C.table(a, b);
        return {
          a, b,
          rows: t.rows,
          chosenPowers: t.chosen,
          binaryOfA: a.toString(2),
          sum: `${t.rows.filter((r: { chosen: boolean }) => r.chosen).map((r: { double: number }) => r.double).join(" + ")} = ${t.product}`,
          product: t.product,
          correct: t.product === a * b,
        };
      },
    },
    rhind_steps: {
      describe: "The papyrus's way of finding the powers of two in a: take the largest power not above what is left, subtract it, repeat. Each step with what is left.",
      args: '{ "a": 85 }',
      run: (args) => {
        const a = Math.trunc(num(args, "a", 85));
        if (a < 1 || a > 9999) throw new Error("a runs from 1 to 9999");
        const steps: { left: number; largestPower: number; remainder: number }[] = [];
        let left = a;
        while (left > 0) { const p = 2 ** Math.floor(Math.log2(left)); steps.push({ left, largestPower: p, remainder: left - p }); left -= p; }
        return { a, steps, powers: steps.map((s) => s.largestPower), binary: a.toString(2) };
      },
    },
  };
}

/** What the core says about the sum as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ digits: num(state, "digits", 2), a: num(state, "a", 1), b: num(state, "b", 0) });
  const t = C.table(s.a, s.b);
  return {
    a: s.a,
    b: s.b,
    binaryOfA: s.a.toString(2),
    rows: t.rows.length,
    chosenPowers: t.chosen,
    product: t.product,
    autonomousDigits: state.autonomous !== false,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
