/*
 * run_game_logic actions and saved-position reader for Rectangle on a
 * Chessboard. The core lives in integer-rectangle/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["integer-rectangle"].IntegerRectangleCore;
function read(args: Json) {
  return {
    x: num(args, "x", 0.5), y: num(args, "y", 0.5),
    w: num(args, "w", 2.5), h: num(args, "h", 1.5),
  };
}

export function actions(): GameActions {
  return {
    areas: {
      describe: "Compute the light and dark areas a rectangle covers on a unit chessboard and test the even-side / centred condition.",
      args: '{ "x": 0.5, "y": 0.5, "w": 2.5, "h": 1.5 }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          rectangle: { x: r.x, y: r.y, w: r.w, h: r.h },
          light: r.light, dark: r.dark, difference: r.difference,
          balanced: r.balanced,
          conditions: { evenWidth: r.evenWidth, evenHeight: r.evenHeight, centered: r.centered },
          ruleBalanced: r.ruleBalanced,
          pieces: r.pieces,
          note: "The rule is an if and only if: an even side, or a centre on a grid line.",
        };
      },
    },
    split: {
      describe: "Split a rectangle into at most three pieces: one with even width, one with even height, and one with both sides under two.",
      args: '{ "x": 0.25, "y": 0.25, "w": 5.5, "h": 3.5 }',
      run: (args) => {
        const C = core();
        const pieces = C.decompose(read(args));
        return {
          pieces,
          count: pieces.length,
          coversArea: Math.abs(pieces.reduce((s, p) => s + p.w * p.h, 0) - read(args).w * read(args).h) < 1e-7,
          note: "Only the last small piece can decide the answer.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    x: r.x, y: r.y, w: r.w, h: r.h,
    light: r.light, dark: r.dark, balanced: r.balanced,
    conditions: { evenWidth: r.evenWidth, evenHeight: r.evenHeight, centered: r.centered },
    note: r.balanced ? "The two colours match." : "The two colours differ.",
  };
}
