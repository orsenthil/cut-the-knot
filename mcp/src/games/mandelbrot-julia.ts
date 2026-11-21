/*
 * run_game_logic actions and saved-position reader for Mandelbrot and Julia
 * sets. The core lives in mandelbrot-julia/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["mandelbrot-julia"].MandelbrotJuliaCore;
type Complex = { re: number; im: number };
function complex(v: unknown, fallback: Complex): Complex {
  const x = v as Json;
  if (!x || !Number.isFinite(Number(x.re)) || !Number.isFinite(Number(x.im))) return fallback;
  return { re: Number(x.re), im: Number(x.im) };
}
function read(args: Json) {
  return {
    c: complex(args.c, core().start().c),
    maxIter: Number.isFinite(args.maxIter) ? num(args, "maxIter") : 48,
  };
}

export function actions(): GameActions {
  return {
    escape: {
      describe: "Report the Mandelbrot escape time for a complex parameter c and whether it is in the set.",
      args: '{ "c": { "re": -0.4, "im": 0.2 }, "maxIter": 48 }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const k = C.mandelbrot(state.c, state.maxIter);
        return {
          c: state.c, escape: k, bounded: k >= state.maxIter,
          orbit: C.orbit(state.c, state.maxIter),
          note: "Once |z| exceeds 2 the orbit escapes to infinity.",
        };
      },
    },
    julia: {
      describe: "Compute the Julia escape time for one starting point under the chosen c.",
      args: '{ "z": { "re": 0.5, "im": 0.5 }, "c": { "re": -0.4, "im": 0.2 }, "maxIter": 48 }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const z = complex(args.z, { re: 0, im: 0 });
        return { z, c: state.c, escape: C.julia(z, state.c, state.maxIter), note: "The Julia set fixes c and varies z." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    c: r.c, maxIter: r.maxIter, escape: r.mandelbrotEscape,
    inMandelbrotSet: r.inMandelbrotSet,
    note: r.inMandelbrotSet ? "The orbit of zero is bounded." : `The orbit escapes after ${r.mandelbrotEscape} steps.`,
  };
}
