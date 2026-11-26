/*
 * run_game_logic actions and saved-position reader for Product of Simple Fractions. The core
 * lives in product-of-fractions/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["product-of-fractions"].ProductOfFractionsCore;

function read(C: ReturnType<typeof core>, s: { p: number; q: number; r: number; s: number }) {
  const pr = C.product(s), red = C.reducedProduct(s);
  return { left: `${s.p}/${s.q}`, right: `${s.r}/${s.s}`, product: `${pr.n}/${pr.d}`, lowestTerms: `${red.n}/${red.d}`, cells: { coloredBothWays: pr.n, inAll: pr.d } };
}

export function actions(): GameActions {
  return {
    product: {
      describe: "p/q x r/s = pr/qs as the picture counts it: q rows times s columns make qs cells, pr of them coloured both ways; also in lowest terms. Numbers 1..99, numerators at most their denominators.",
      args: '{ "p": 2, "q": 3, "r": 3, "s": 4 }',
      run: (args) => {
        const C = core();
        return read(C, C.start({ p: Math.round(num(args, "p")), q: Math.round(num(args, "q")), r: Math.round(num(args, "r")), s: Math.round(num(args, "s")) }));
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ p: Math.round(num(state, "p", 1)), q: Math.round(num(state, "q", 2)), r: Math.round(num(state, "r", 1)), s: Math.round(num(state, "s", 2)) });
  return { ...read(C, s), note: "Taking p/q of r/s keeps p of every q rows in each of the r coloured columns: pr cells of qs." };
}
