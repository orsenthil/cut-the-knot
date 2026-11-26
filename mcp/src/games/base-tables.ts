/*
 * run_game_logic actions and saved-position reader for Addition and Multiplication Tables in
 * Various Bases. The core lives in base-tables/ and is copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["base-tables"].BaseTablesCore;

function cell(radix: number, op: string, a: number, b: number) {
  const C = core();
  const s = C.start({ radix, op });
  if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < s.radix && b < s.radix)) throw new Error(`a and b must be digits 0..${s.radix - 1}`);
  const sym = s.op === "+" ? "+" : "x";
  return { radix: s.radix, op: s.op, entry: `${C.DIGITS[a]} ${sym} ${C.DIGITS[b]} = ${C.entry(s, a, b)}`, inBase10: `${a} ${sym} ${b} = ${C.value(s, a, b)}` };
}

export function actions(): GameActions {
  return {
    table: {
      describe: "The + or x table of the digits of a base (2..36), every entry written in that base (digits 0-9 then A-Z), as the page draws it.",
      args: '{ "radix": 7, "op": "x" }',
      run: (args) => {
        const C = core();
        const s = C.start({ radix: num(args, "radix", 10), op: String(args.op ?? "+") });
        return { radix: s.radix, op: s.op, digits: C.DIGITS.slice(0, s.radix), rows: C.table(s).map((r: string[]) => r.join(" ")) };
      },
    },
    cell: {
      describe: "One entry of the table: a op b written in the base, and the same in base 10.",
      args: '{ "radix": 16, "op": "x", "a": 15, "b": 7 }',
      run: (args) => cell(Math.round(num(args, "radix", 10)), String(args.op ?? "+"), Math.round(num(args, "a")), Math.round(num(args, "b"))),
    },
  };
}

export function position(state: Json): unknown {
  const radix = Math.round(num(state, "radix", 10));
  const op = state.op === "x" ? "x" : "+";
  return { ...cell(radix, op, Math.round(num(state, "a", 3)), Math.round(num(state, "b", 4))), note: op === "x" ? `The digits of (r-1) x k add up to ${radix - 1} in base ${radix}.` : "Each row is the one above moved one place; carries start below the anti-diagonal." };
}
