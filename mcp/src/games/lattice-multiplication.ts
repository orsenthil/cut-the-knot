/*
 * run_game_logic actions and saved-position reader for Lattice Multiplication.
 * The core lives in lattice-multiplication/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["lattice-multiplication"].LatticeMultiplicationCore;
function read(args: Json) {
  return {
    a: Number.isFinite(args.a) ? num(args, "a") : 712,
    b: Number.isFinite(args.b) ? num(args, "b") : 23,
  };
}

export function actions(): GameActions {
  return {
    lattice: {
      describe: "Show the cell products, diagonal band sums and carried result of a lattice multiplication.",
      args: '{ "a": 712, "b": 23 }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          a: r.a, b: r.b, cells: r.cells, bands: r.bands,
          product: r.product, expected: r.expected,
          needsCarry: r.needsCarry,
          note: "Band sums are the convolution of the digit strings; carrying gives the product.",
        };
      },
    },
    bands: {
      describe: "Return only the diagonal band sums for two factors.",
      args: '{ "a": 4566, "b": 257 }',
      run: (args) => {
        const input = read(args);
        return { a: input.a, b: input.b, bands: core().bands(input.a, input.b), note: "Sums are listed most significant first." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    a: r.a, b: r.b, bands: r.bands, product: r.product,
    expected: r.expected, needsCarry: r.needsCarry,
    note: `${r.a} times ${r.b} is ${r.product}.`,
  };
}
