/*
 * run_game_logic actions and saved-position reader for Primes from the Zeros.
 * The core lives in prime-waves/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["prime-waves"].PrimeWavesCore;

export function actions(): GameActions {
  return {
    approximate: {
      describe: "Chebyshev's psi(x) and Riemann's explicit formula with the first k pairs of zeta zeros (k 0..100), for x from 2 to 200.",
      args: '{ "x": 30.5, "k": 50 }',
      run: (args) => {
        const x = num(args, "x", 30.5), k = core().clampK(num(args, "k", 10));
        const psi = core().psi(x), approx = core().approx(x, k);
        return { x, zerosUsed: k, psi, approx, error: psi - approx, smoothPartOnly: core().approx(x, 0) };
      },
    },
    zeros: {
      describe: "The imaginary parts of the first k zeros of zeta (k up to 100).",
      args: '{ "k": 10 }',
      run: (args) => ({ zeros: core().ZEROS.slice(0, core().clampK(num(args, "k", 10))) }),
    },
  };
}

export function position(state: Json): unknown {
  const k = core().clampK(state.k), X = core().clampX(state.x);
  let mean = 0, count = 0;
  for (let x = 2.25; x <= X; x += 0.5) { if (Number.isInteger(x)) continue; mean += Math.abs(core().psi(x) - core().approx(x, k)); count++; }
  return {
    zerosUsed: k, upToX: X, flattened: state.flat === true,
    latestZero: k > 0 ? core().ZEROS[k - 1] : null,
    meanErrorAgainstTrueCount: count ? mean / count : 0,
    note: k === 0 ? "No zeros yet: only the smooth curve x - ln 2 pi." : `${k} pairs of zeros are added to the smooth curve.`,
  };
}
