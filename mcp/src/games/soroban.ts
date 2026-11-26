/*
 * run_game_logic actions and saved-position reader for Soroban in Various Number Systems. The
 * core lives in soroban/ and is copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["soroban"].SorobanCore;

function build(radix: number, digits: number[]) {
  const C = core();
  if (!C.RADICES.includes(radix)) throw new Error("radix must be even, 2..20");
  if (digits.length < 1 || digits.length > 10) throw new Error("1 to 10 wires");
  let s = C.start({ radix, wires: digits.length });
  digits.forEach((d, i) => {
    const t = C.setDigit(s, i, Math.round(d));
    if (!t) throw new Error(`digit ${d} is not 0..${radix - 1}`);
    s = t;
  });
  return s;
}

function describe(s: ReturnType<ReturnType<typeof core>["start"]>) {
  const C = core();
  const half = s.radix / 2;
  const r = C.reading(s);
  return {
    radix: s.radix, inRadix: r.inRadix, decimal: r.decimal,
    wires: s.wires.map((_: unknown, i: number) => {
      const v = C.value(s, i);
      return { digit: C.DIGITS[v], heavenBeadDown: v >= half, earthBeadsUp: v % half };
    }),
    beadsPerWire: { heaven: 1, heavenWorth: half, earth: half - 1 },
  };
}

export function actions(): GameActions {
  return {
    show: {
      describe: "How a number is set on a soroban in an even radix (2..20): its digits in that radix and, for each wire, whether the heaven bead (worth radix/2) is down and how many earth beads are up. Give the number in base 10 and the number of wires (default 7).",
      args: '{ "radix": 12, "number": 2026, "wires": 7 }',
      run: (args) => {
        const radix = Math.round(num(args, "radix", 10)), wires = Math.round(num(args, "wires", 7));
        let n = Math.round(num(args, "number"));
        if (n < 0 || n >= radix ** wires) throw new Error(`number must be 0..${radix ** wires - 1} for ${wires} wires`);
        const digits = new Array(wires).fill(0);
        for (let i = wires - 1; i >= 0; i--) { digits[i] = n % radix; n = Math.floor(n / radix); }
        return describe(build(radix, digits));
      },
    },
  };
}

export function position(state: Json): unknown {
  return describe(build(Math.round(num(state, "radix", 10)), numArray(state, "digits")));
}
