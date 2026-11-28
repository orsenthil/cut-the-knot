/*
 * run_game_logic actions and saved-position reader for Integer Sine.
 *
 * Integer Sine is a picture, not a game: it puts one dot for each integer
 * n = 0, 1, ... N-1, at horizontal place n (or n reduced modulo 2π) and height
 * sin(n) (or tan(n)). Every reading here comes from the game's real core
 * (integer-sine/ on the site), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const MAX_DOTS = 16;

export function actions(): GameActions {
  const C = cores["integer-sine"].IntegerSineCore;

  return {
    plot: {
      describe:
        "Draws the integer dots exactly as the applet does. With modular=true each n is reduced modulo 2π and its height is sin(n) (or tan(n)); with modular=false the dots keep integer order. Returns the integer pixel (x, y) the applet computes for each dot and whether it is actually drawn — Java's (int) casts truncate toward zero and the two modes clip differently.",
      args: '{ "N": 10, "modular": true, "sin": true, "width": 400, "height": 300 }',
      run: (args) => {
        const N = num(args, "N", C.DEFAULTS.N);
        if (!C.SCALES.includes(N)) {
          throw new Error(`N must be one of the applet's scales: ${C.SCALES.join(", ")}`);
        }
        const modular = args.modular === undefined ? C.DEFAULTS.modular : Boolean(args.modular);
        const sin = args.sin === undefined ? C.DEFAULTS.sin : Boolean(args.sin);
        const width = num(args, "width", C.DEFAULTS.width);
        const height = num(args, "height", C.DEFAULTS.height);
        if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
          throw new Error("width and height must be positive integers");
        }

        const view = Object.assign(C.start({ N, modular, sin, width, height }), { sample: 0 });
        const points = C.draw(view);
        const shown = points.filter((p) => p.shown);
        return {
          options: { N, modular, sin, width, height },
          dotsComputed: points.length,
          dotsShown: shown.length,
          dotsClipped: points.length - shown.length,
          dots: points.slice(0, MAX_DOTS).map((p) => ({
            n: p.i,
            residue: C.residue(p.i),
            x: p.x,
            y: p.y,
            shown: p.shown,
          })),
          truncated: points.length > MAX_DOTS,
          status: C.describe(view),
          clippingRule: modular
            ? "Modular mode draws a dot only when the truncated y is between 0 and height; tan(n) often falls outside, so those dots vanish."
            : "Plain mode draws a dot only when the value is strictly between -2 and 2; tan(n)/4 is clipped much more often than sin(n).",
        };
      },
    },

    near_period: {
      describe:
        "Tests an integer k as a near-period of sin (or tan) on the integers: it reduces n and n+k modulo 2π the way the applet does and compares the values. Because 2π is irrational no integer is an exact period, but 44 ≈ 7·2π and 710 ≈ 113·2π make the residues creep only slightly, which is why the dots form stripes on the unit circle.",
      args: '{ "n": 1, "k": 44 }',
      run: (args) => {
        const n = num(args, "n", 1);
        const k = num(args, "k", 44);
        if (!Number.isInteger(n) || n < 0) throw new Error("n must be a non-negative integer");
        if (!Number.isInteger(k) || k < 1) throw new Error("k must be a positive integer");
        const sin = args.sin === undefined ? true : Boolean(args.sin);

        const multiple = Math.round(k / C.TWO_PI);
        const drift = k - multiple * C.TWO_PI;
        const r0 = C.residue(n);
        const r1 = C.residue(n + k);
        const f = sin ? Math.sin : Math.tan;
        const v0 = f(r0);
        const v1 = f(r1);
        return {
          n,
          k,
          function: sin ? "sin" : "tan",
          nearestMultipleOfTwoPi: multiple,
          driftFromMultiple: drift,
          residueN: r0,
          residueNPlusK: r1,
          residueShift: r1 - r0,
          residueSteps: [0, 1, 2, 3, 4].map((j) => C.residue(n + j * k)),
          ...(sin
            ? { sinN: v0, sinNPlusK: v1, sinGap: v1 - v0 }
            : { tanN: v0, tanNPlusK: v1, tanGap: v1 - v0 }),
          exactPeriod: false,
          note:
            Math.abs(drift) < 1
              ? `k is close to ${multiple}·2π but not equal to it: the residues advance by about ${drift.toFixed(6)} each step instead of repeating, so the points slowly fill the circle in stripes.`
              : "k is not close to a multiple of 2π: the residues jump around the circle rather than crawling along in stripes.",
        };
      },
    },
  };
}

/** Echoes the saved picture options plus what the core reads from that picture. */
export function position(state: Json, stateVersion: number): unknown {
  const C = cores["integer-sine"].IntegerSineCore;
  const N = num(state, "N", C.DEFAULTS.N);
  const modular = state.modular === undefined ? C.DEFAULTS.modular : Boolean(state.modular);
  const sin = state.sin === undefined ? C.DEFAULTS.sin : Boolean(state.sin);
  const width = num(state, "width", C.DEFAULTS.width);
  const height = num(state, "height", C.DEFAULTS.height);
  const sample = num(state, "sample", 0);

  const view = Object.assign(C.start({ N, modular, sin, width, height }), { sample });
  const points = C.shownPoints(view);
  const picked = points.find((p) => p.i === sample) || points[0];
  return {
    stateVersion,
    saved: { N, modular, sin, width, height, sample },
    dotsComputed: N,
    dotsShown: points.length,
    dotsClipped: N - points.length,
    cursor: picked
      ? { n: picked.i, residue: C.residue(picked.i), x: picked.x, y: picked.y }
      : null,
    reading: C.describe(view),
    note: modular
      ? "Positions are n reduced modulo 2π; 2π is irrational, so no residue ever repeats exactly."
      : "Positions follow the integers in order; there is no reduction modulo 2π.",
  };
}
