/*
 * run_game_logic actions and saved-position reader for GCD and LCM via Factor
 * Tree. The core (gcd-by-factor-tree/ in the site, copied into
 * src/generated/cores/ at build time) knows the factor trees and multisets.
 * See _shared.ts for the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["gcd-by-factor-tree"].GcdByFactorTreeCore;

function readNumbers(args: Json) {
  const n = num(args, "n", 20);
  const m = num(args, "m", 350);
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(m) || m < 1) throw new Error("n and m must be positive integers");
  return { n, m };
}

export function actions(): GameActions {
  return {
    analyze: {
      describe: "Factor two numbers into primes and report their gcd, lcm and the product identity N*M = gcd*lcm.",
      args: '{ "n": 20, "m": 350 }',
      run: (args) => {
        const r = core().analyze(readNumbers(args).n, readNumbers(args).m);
        return {
          n: r.n, m: r.m,
          factorsN: r.factorsN, factorsM: r.factorsM,
          gcd: r.gcd, lcm: r.lcm,
          productNM: r.productNM, productGcdLcm: r.productGcdLcm,
          holds: r.productNM === r.productGcdLcm,
          note: "gcd takes the smaller multiplicity of each prime, lcm the larger.",
        };
      },
    },
    factor_tree: {
      describe: "Show the factor tree of a number: each composite splits into two factors until only primes remain.",
      args: '{ "n": 60 }',
      run: (args) => {
        const n = num(args, "n", 60);
        if (!Number.isInteger(n) || n < 1) throw new Error("n must be a positive integer");
        return { n, tree: core().factorTree(n), note: "Leaves are prime factors; their product is n." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const { n, m } = readNumbers(state);
  const r = core().analyze(n, m);
  return { n, m, factorsN: r.factorsN, factorsM: r.factorsM, gcd: r.gcd, lcm: r.lcm, note: `${n}×${m} = ${r.gcd}×${r.lcm}` };
}
