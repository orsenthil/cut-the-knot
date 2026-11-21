/*
 * run_game_logic actions and saved-position reader for Counting and Grouping.
 *
 * Dots are counted one at a time, and a tally of strokes in groups of g turns
 * into the equation N = q*g + r (division with remainder, the residue of N
 * modulo g). Every answer below comes from the game's real core (counting/ in
 * the site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["counting"].CountingCore;

const whole = (args: Json, key: string, fallback: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.trunc(num(args, key, fallback))));

function facts(C: ReturnType<typeof core>, n: number, g: number) {
  const q = Math.floor(n / g);
  const r = n % g;
  return {
    dots: n,
    groupSize: g,
    fullGroups: q,
    remainder: r,
    tally: C.tally(n, g),
    equation: C.equation(n, g),
    identity: `${n} = ${q} x ${g} + ${r}`,
    residueModuloGroupSize: r,
  };
}

export function actions(): GameActions {
  return {
    group: {
      describe:
        "Group N dots (or tally strokes) in groups of g and give the full groups, what is left over, the tally, and the equation the page shows once everything is counted (the sum and, from two full groups on, the product).",
      args: '{ "dots": 14, "group": 3 }',
      run: (args) => {
        const C = core();
        return facts(C, whole(args, "dots", 14, 1, 100000), whole(args, "group", 3, 1, 100000));
      },
    },
    remainders: {
      describe:
        "For N dots, the leftover for every group size from 1 up to a limit: the residues of N, with the group sizes that divide N exactly.",
      args: '{ "dots": 12, "limit": 13 }',
      run: (args) => {
        const C = core();
        const n = whole(args, "dots", 12, 1, 100000);
        const limit = whole(args, "limit", n + 1, 1, 2000);
        const table = [];
        for (let g = 1; g <= limit; g++) table.push({ group: g, fullGroups: Math.floor(n / g), remainder: n % g });
        return {
          dots: n,
          table,
          groupSizesThatDivideExactly: table.filter((t) => t.remainder === 0).map((t) => t.group),
          note: "The remainder is N mod g, between 0 and g-1; it is 0 exactly when g divides N.",
        };
      },
    },
  };
}

/** What the core says about the dots as the page saved them. */
export function position(state: Json): unknown {
  const C = core();
  const dots = Array.isArray(state.dots) ? state.dots.length : Math.trunc(num(state, "count", 0));
  const counted = Math.trunc(num(state, "counted", 0));
  const group = Math.max(1, Math.trunc(num(state, "group", 5)));
  const total = Math.max(1, dots);
  const c = Math.max(0, Math.min(total, counted));
  return {
    dots: total,
    counted: c,
    remaining: total - c,
    groupSize: group,
    maximum: num(state, "max", 10),
    finished: c === total,
    tallySoFar: C.tally(c, group),
    equation: c === total ? C.equation(total, group) : null,
    ifCountedNow: facts(C, c || 1, group).identity,
    moves: num(state, "moves", 0),
    note: c === total
      ? `All ${total} dots are counted: ${C.equation(total, group)}.`
      : `${c} of ${total} dots are counted; in groups of ${group} that is ${Math.floor(c / group)} full groups and ${c % group} left over so far.`,
  };
}
