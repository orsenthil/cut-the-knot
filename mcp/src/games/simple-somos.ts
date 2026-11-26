/*
 * run_game_logic actions and saved-position reader for Simple Somos Sequence. The core lives in
 * simple-somos/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["simple-somos"].SimpleSomosCore;

function read(args: Json, count: number) {
  const C = core();
  const s = C.start({ m: num(args, "m", 2), a: num(args, "a", 1), b: num(args, "b", 1) });
  const r = C.sequence(s, count);
  const [p, q] = C.invariant(s);
  return {
    m: s.m, a: s.a, b: s.b, terms: r.terms,
    alarm: r.alarm ? `Alarm: ${r.alarm.num}/${r.alarm.den}` : null,
    k: q === 1n ? p.toString() : `${p}/${q}`, kIsWhole: q === 1n,
    recurrence: q === 1n ? `a(n+1) = ${p} a(n) - a(n-1)` : null,
  };
}

export function actions(): GameActions {
  return {
    sequence: {
      describe: "The terms of a(1) = a, a(2) = b, a(n) = (a(n-1)^2 + m)/a(n-2) (m, a, b in 1..100), up to count terms, the alarm if a division is not exact, and the invariant k = (a^2 + b^2 + m)/(ab).",
      args: '{ "m": 2, "a": 1, "b": 1, "count": 10 }',
      run: (args) => read(args, Math.max(2, Math.min(60, Math.round(num(args, "count", 10))))),
    },
  };
}

export function position(state: Json): unknown {
  return read(state, 12);
}
