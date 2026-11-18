/*
 * run_game_logic actions and saved-position reader for the isosceles-fallacy
 * demo. The core (isosceles-fallacy/ in the site, copied into
 * src/generated/cores/ at build time) computes the construction. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["isosceles-fallacy"].IsoscelesFallacyCore;

type Point = { x: number; y: number };

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

function readTriangle(args: Json) {
  const start = core().start();
  return {
    A: args.A ? readPoint(args.A, "A") : start.A,
    B: args.B ? readPoint(args.B, "B") : start.B,
    C: args.C ? readPoint(args.C, "C") : start.C,
    mode: args.mode === "right" ? "right" : args.mode === "faulty" ? "faulty" : "faulty",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle ABC, report the bisector/perpendicular-bisector intersection P, the perpendicular feet U and V, the circumcircle, and whether the fake proof's additions hold.",
      args: '{ "A": {"x":80,"y":250}, "B": {"x":320,"y":250}, "C": {"x":215,"y":70}, "mode": "right" }',
      run: (args) => {
        const C = core();
        const g = C.geometry(readTriangle(args));
        return {
          M: g.M, P: g.P, U: g.U, V: g.V, circumcenter: g.O, radius: g.R,
          pOnCircumcircle: g.pOnCircle,
          uOnSide: g.uOnSide, vOnSide: g.vOnSide,
          equalPairs: {
            AP_BP: Math.abs(g.ap - g.bp) < 1e-7,
            CU_CV: Math.abs(g.cu - g.cv) < 1e-7,
            PU_PV: Math.abs(g.pu - g.pv) < 1e-7,
          },
          sides: { AC: g.ac, BC: g.bc },
          note: g.pOnCircle && g.uOnSide !== g.vOnSide
            ? "One foot lies outside its side, so the segment addition in the fake proof fails."
            : "The misleading drawing keeps both feet on the sides.",
        };
      },
    },
    compare_modes: {
      describe:
        "Compare the misleading and honest drawings of the same triangle, naming the point where the picture was shifted.",
      args: '{ "A": {"x":80,"y":250}, "B": {"x":320,"y":250}, "C": {"x":215,"y":70} }',
      run: (args) => {
        const C = core();
        const base = readTriangle(args);
        const faulty = C.geometry({ ...base, mode: "faulty" });
        const right = C.geometry({ ...base, mode: "right" });
        return {
          faulty: { P: faulty.P, pOnCircumcircle: faulty.pOnCircle, uOnSide: faulty.uOnSide, vOnSide: faulty.vOnSide },
          right: { P: right.P, pOnCircumcircle: right.pOnCircle, uOnSide: right.uOnSide, vOnSide: right.vOnSide },
          shiftedP: C.dist(faulty.P, right.P) > 1e-6,
          note: "The applet nudges the bisector and perpendicular-bisector points so P sits inside the triangle.",
        };
      },
    },
  };
}

/** What the core says about a saved board. */
export function position(state: Json): unknown {
  const C = core();
  const board = readTriangle(state);
  const g = C.geometry(board);
  return {
    A: board.A, B: board.B, C: board.C,
    mode: board.mode,
    pOnCircumcircle: g.pOnCircle,
    uOnSide: g.uOnSide,
    vOnSide: g.vOnSide,
    note: board.mode === "right"
      ? "The honest construction puts P on the circumcircle."
      : "The misleading construction shifts P inside the triangle.",
  };
}
