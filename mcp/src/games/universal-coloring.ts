/*
 * run_game_logic actions and saved-position reader for Universal Coloring.
 *
 * The core lives in universal-coloring/ and is copied into
 * src/generated/cores/ at build time. The page saves its whole position
 * ({ n, dots, clicks }) with Track.state, so position() can hand it straight
 * to the same core and report which ordered pairs the circle covers.
 * See _shared.ts for the module shape and docs/contracts.md section 4.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["universal-coloring"].UniversalColoringCore;

/** The pair chart labels colours A, B, C, ...; the page numbers them 1, 2, ... */
const label = (c: number): string => String.fromCharCode(65 + c);
const pairName = (p: number[]): string => `${label(p[0])}${label(p[1])}`;

/** The applet's spinner only allows whole numbers 2 through 6. */
function readN(args: Json, key = "n"): number {
  const C = core();
  const n = Math.round(num(args, key));
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`"${key}" must be a whole number from ${C.MIN_N} to ${C.MAX_N}`);
  }
  return n;
}

/** The circle has exactly n*n dots, each holding a colour 0 .. n-1. */
function readDots(args: Json, n: number): number[] {
  const dots = numArray(args, "dots").map(Math.round);
  if (dots.length !== n * n) {
    throw new Error(`"dots" must have exactly n*n = ${n * n} entries, got ${dots.length}`);
  }
  if (dots.some((c) => !Number.isInteger(c) || c < 0 || c >= n)) {
    throw new Error(`every dot must be a whole colour from 0 to ${n - 1}`);
  }
  return dots;
}

/** Turn the core's n by n table of lit arcs into an explicit list of pairs. */
function presentPairs(C: any, state: { n: number; dots: number[] }): number[][] {
  const lit = C.edges(state);
  const pairs: number[][] = [];
  for (let a = 0; a < state.n; a++) {
    for (let b = 0; b < state.n; b++) {
      if (lit[a][b]) pairs.push([a, b]);
    }
  }
  return pairs;
}

export function actions(): GameActions {
  return {
    construct: {
      describe:
        "Build a de Bruijn colouring for n colours (2 to 6) using the core's Hierholzer Euler tour of the complete digraph with loops, starting at colour 'first' (0-based, wrapped into range). Show the circle, the ordered pairs it makes, and verify that all n*n pairs occur both clockwise and anticlockwise.",
      args: '{ "n": 4, "first": 0 }',
      run: (args) => {
        const C = core();
        const n = readN(args);
        const first = ((Math.trunc(num(args, "first", 0)) % n) + n) % n;
        const dots = C.solution(n, first) as number[];
        const state = { n, dots, clicks: 0 };
        const forward = C.check(state);
        const backward = C.check({ n, dots: C.reverseCycle(dots), clicks: 0 });
        const pairsRoundCircle = dots.map((c, i) => [c, dots[(i + 1) % dots.length]]);
        return {
          n,
          first,
          dots,
          dotsAsLetters: dots.map(label),
          pairsRoundCircle,
          totalPairs: forward.total,
          found: forward.found,
          missing: forward.missing,
          complete: forward.complete,
          reverseFound: backward.found,
          reverseComplete: backward.complete,
          universalBothWays: forward.complete && backward.complete,
          result: C.result(state),
          note:
            `The tour gives ${dots.length} dots: ${dots.map(label).join("")} round the circle. ` +
            `Successive dots make ${forward.found} of ${forward.total} ordered pairs; read the other way they make ${backward.found} of ${backward.total}. ` +
            "Every colour has n arcs leaving it (one to each colour, itself included) and n arcs entering it, so an Euler tour uses all n*n arcs exactly once. " +
            "Reversing the circle turns each pair (a,b) into (b,a), so a universal circle stays universal when read in the opposite direction.",
        };
      },
    },

    check_coloring: {
      describe:
        "Check a supplied circle against the puzzle. Give n (2 to 6) and 'dots', an array of exactly n*n whole colours from 0 to n-1. Report which ordered pairs occur between successive dots, which are missing, whether the circle is universal, and whether it is universal when read backwards.",
      args: '{ "n": 3, "dots": [0, 0, 1, 0, 2, 1, 1, 2, 2] }',
      run: (args) => {
        const C = core();
        const n = readN(args);
        const dots = readDots(args, n);
        const state = { n, dots, clicks: 0 };
        const check = C.check(state);
        const reverse = C.check({ n, dots: C.reverseCycle(dots), clicks: 0 });
        const present = presentPairs(C, state);
        return {
          n,
          dots,
          dotsAsLetters: dots.map(label),
          pairsRoundCircle: dots.map((c, i) => [c, dots[(i + 1) % dots.length]]),
          totalPairs: check.total,
          found: check.found,
          present,
          presentAsLetters: present.map(pairName),
          missing: check.missing,
          missingAsLetters: check.missing.map(pairName),
          complete: check.complete,
          reverseComplete: reverse.complete,
          result: C.result(state),
          note:
            `${check.found} of ${check.total} ordered pairs are on the circle. ` +
            (check.missing.length
              ? `Missing: ${check.missing.map(pairName).join(", ")}. `
              : `All ${check.total} pairs are present, including every loop (a,a). `) +
            (reverse.complete
              ? "Reading the circle backwards is universal too, since each pair (a,b) then appears as (b,a)."
              : `Reading backwards finds only ${reverse.found} of ${reverse.total} pairs.`),
        };
      },
    },
  };
}

/** Explain the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Universal Coloring state version ${stateVersion}`);
  const C = core();
  const n = readN(state);
  const dots = readDots(state, n);
  const clicks = Math.trunc(num(state, "clicks", 0));
  const s = { n, dots, clicks };
  const check = C.check(s);
  const reverse = C.check({ n, dots: C.reverseCycle(dots), clicks });
  const present = presentPairs(C, s);
  return {
    stateVersion,
    n,
    dots,
    clicks,
    totalPairs: check.total,
    found: check.found,
    present,
    presentAsLetters: present.map(pairName),
    missing: check.missing,
    missingAsLetters: check.missing.map(pairName),
    pairsRoundCircle: dots.map((c, i) => [c, dots[(i + 1) % dots.length]]),
    complete: check.complete,
    done: C.result(s) === "done",
    result: C.result(s),
    reverseComplete: reverse.complete,
    note:
      `${clicks} click(s) so far: ${check.found} of ${check.total} ordered pairs of colours are on the circle. ` +
      (check.missing.length
        ? `Still missing: ${check.missing.map(pairName).join(", ")}. ` +
          "Each colour must be followed by every colour, itself included; the circle is an Euler tour of that complete digraph."
        : `All ${check.total} pairs are present, so the circle is a de Bruijn cycle and reading either way round meets every pair. ` +
          `Reading backwards finds ${reverse.found} of ${reverse.total} pairs.`),
  };
}
