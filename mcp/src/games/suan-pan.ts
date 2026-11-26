/*
 * run_game_logic actions and saved-position reader for Suan Pan in Various Number Systems. The
 * core lives in suan-pan/ and is copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["suan-pan"].SuanPanCore;

/** Wire values (0 .. 3r/2) as the tidied frame would show them: carries done, digits below r. */
function tidy(radix: number, values: number[]) {
  const out = values.slice();
  let spill = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    out[i] += spill;
    spill = Math.floor(out[i] / radix);
    out[i] %= radix;
  }
  return { digits: out, spilledOffTheLeft: spill > 0 };
}

export function actions(): GameActions {
  return {
    tidy: {
      describe: "Given the values on the wires of a suan pan (each 0 .. 3r/2, as the beads allow: up to r/2 ones and two fives worth r/2), what the frame shows after trading five ones for a five and two fives for a carry: the digits, the number in base 10, and whether anything carries off the leftmost wire.",
      args: '{ "radix": 10, "values": [0, 9, 12] }',
      run: (args) => {
        const radix = Math.round(num(args, "radix", 10));
        if (!core().RADICES.includes(radix)) throw new Error("radix must be even, 2..20");
        const values = numArray(args, "values").map(Math.round);
        if (values.length < 1 || values.length > 10 || values.some((v) => v < 0 || v > (3 * radix) / 2)) throw new Error(`1..10 wire values, each 0..${(3 * radix) / 2}`);
        const t = tidy(radix, values);
        return { before: values, after: t.digits, decimal: t.digits.reduce((n, d) => n * radix + d, 0), spilledOffTheLeft: t.spilledOffTheLeft };
      },
    },
  };
}

export function position(state: Json): unknown {
  const radix = Math.round(num(state, "radix", 10));
  const values = numArray(state, "values").map(Math.round);
  const t = tidy(radix, values);
  return {
    radix, wireValues: values,
    numberOnFrame: values.reduce((n, v) => n * radix + v, 0),
    tidyingPending: values.some((v) => v >= radix),
    afterTidying: t.digits, beadsPerWire: { earth: radix / 2, heaven: 2, heavenWorth: radix / 2 },
  };
}
