/*
 * run_game_logic actions and saved-position reader for BQTLemma.
 *
 * The illustration is Bui Quang Tuan's equal-areas lemma: A, B, C lie on one
 * line, AD is parallel to BE, BD is parallel to CE, and F is the midpoint of
 * AC. The core (copied into src/generated/cores/ at build time) keeps the two
 * parallel conditions by rebuilding one of E, D whenever a handle moves, and
 * measures the picture with cross-product areas. This module reports what the
 * core says: [DEM] = ([ABD] + [BCE]) / 2 and, from similar triangles,
 * [ABD] * [BCE] = [BDE]^2. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bqt-lemma"].BqtLemmaCore;

type Point = { x: number; y: number };
type Diagram = { A: Point; B: Point; C: Point; D: Point; E: Point; coef: number };

/* The core is exact up to floating point; tidy only what it prints. */
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pt = (p: Point) => ({ x: r3(p.x), y: r3(p.y) });

/** Accept [x, y] or {x, y}, as the other geometry readers do. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`"${key}" must have exactly two numbers, [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or {x, y}`);
}

/** The page keeps B on AC and D off it; reject diagrams that break that. */
function readBase(args: Json) {
  const C = core();
  const A = readPoint(args, "A"), B = readPoint(args, "B");
  const Cc = readPoint(args, "C"), D = readPoint(args, "D");
  const span = Math.hypot(Cc.x - A.x, Cc.y - A.y);
  if (span < 1e-6) throw new Error("A and C must be different points to define the base line");
  const tol = 1e-7 * span * span;
  if (Math.abs(C.signedArea(A, B, Cc)) > tol) {
    throw new Error("A, B and C must be collinear: the page keeps B on the line AC");
  }
  if (C.parameterOnAC(A, Cc, B) < -1e-9 || C.parameterOnAC(A, Cc, B) > 1 + 1e-9) {
    throw new Error("B must lie on the segment AC");
  }
  if (Math.abs(C.signedArea(A, Cc, D)) <= tol) {
    throw new Error("D must be off the line AC, or the parallel lines cannot meet at E");
  }
  const coef = num(args, "coef", 1 - C.parameterOnAC(A, Cc, B));
  if (coef < -1e-9 || coef > 1 + 1e-9) {
    throw new Error("coef must be between 0 and 1: it is B's position along AC");
  }
  return { A, B, C: Cc, D, coef };
}

/**
 * A complete core state. With no E given, the core rebuilds it from D by the
 * two parallel conditions, exactly as UpgradeE does for a fresh diagram.
 */
function readDiagram(args: Json): Diagram {
  const base = readBase(args);
  if (args.E === undefined || args.E === null) {
    return core().start(base) as Diagram;
  }
  return { ...base, E: readPoint(args, "E") };
}

/** Everything the core measures at one diagram, phrased for a tutor. */
function reading(s: Diagram) {
  const C = core();
  const m = C.measurements(s);
  if (!m.valid) {
    throw new Error("the parallel construction degenerated: move the points apart so the lines meet again");
  }
  const cl = C.claims(s);
  return {
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D), E: pt(s.E), F: pt(m.F),
    coef: r3(s.coef),
    areas: {
      DEM: r3(m.areas.DEM), ABD: r3(m.areas.ABD), BCE: r3(m.areas.BCE),
      AED: r3(m.areas.AED), CDE: r3(m.areas.CDE), BDE: r3(m.areas.BDE),
    },
    distancesToDE: {
      A: r3(m.altitudes.A), B: r3(m.altitudes.B),
      C: r3(m.altitudes.C), F: r3(m.altitudes.F),
    },
    identities: {
      equalAreas: {
        statement: "[DEM] = ([ABD] + [BCE]) / 2",
        left: r3(m.areas.DEM), right: r3(m.halfSum),
        residual: r3(m.areas.DEM - m.halfSum),
        holds: cl ? cl.main : false,
      },
      product: {
        statement: "[ABD] * [BCE] = [BDE]^2",
        left: r3(m.product), right: r3(m.square),
        residual: r3(m.product - m.square),
        holds: cl ? cl.product : false,
      },
    },
    checks: cl,
    atMidpoint: m.atMidpoint,
    note:
      "AD ∥ BE makes ABED a trapezoid, so [ABD] = [AED]; BD ∥ CE similarly gives " +
      "[BCE] = [CDE]. F is halfway along AC, so its distance to DE is the average " +
      "of the distances from A and C; hence [DEM] = ([ABD] + [BCE]) / 2. " +
      "Similar triangles around B give [ABD] * [BCE] = [BDE]^2.",
  };
}

const NAMES = ["A", "B", "C", "D", "E"] as const;

export function actions(): GameActions {
  return {
    equal_areas: {
      describe:
        "For A, B, C collinear on the page's 400 by 300 board (y down), with B on segment AC and a point D off that line, rebuild E from AD ∥ BE and BD ∥ CE and read the drawing. Reports E and the midpoint F, the areas of DEM, ABD, BCE, AED, CDE and BDE, the identities [DEM] = ([ABD] + [BCE]) / 2 and [ABD] * [BCE] = [BDE]^2 with residuals and the core's checks, and the four perpendicular distances to DE (the midpoint's is the average of A's and C's). Points may be [x, y] or {x, y}; coef is optional and defaults to B's position along AC.",
      args: '{ "A": [84, 240], "B": [225.6, 240], "C": [320, 240], "D": [133.33333333333334, 60] }',
      run: (args) => reading(readDiagram(args)),
    },
    move_point: {
      describe:
        "Move one handle of the diagram as the applet does. Pass the current A, B, C, D, E and coef (E may be omitted, in which case it is rebuilt from D), a point name in A, B, C, D, E, and its new position as to. The core applies the applet's asymmetric rule: moving A, B or D rebuilds E, while moving C or E rebuilds D; B always stays on AC. Reports the whole new diagram and the same two area identities with their checks.",
      args: '{ "A": {"x":84,"y":240}, "B": {"x":225.6,"y":240}, "C": {"x":320,"y":240}, "D": {"x":133.33333333333334,"y":60}, "E": {"x":258.4888888888889,"y":120}, "coef": 0.6, "point": "D", "to": {"x":150,"y":80} }',
      run: (args) => {
        const name = String(args.point ?? "");
        if (!NAMES.includes(name as (typeof NAMES)[number])) {
          throw new Error('point must be one of "A", "B", "C", "D", "E"');
        }
        const to = readPoint(args, "to");
        const next = core().withPoint(readDiagram(args), name, to);
        if (!next || !next.E) throw new Error(`could not move point ${name}`);
        const rebuilt = name === "C" || name === "E" ? "D" : "E";
        return {
          moved: { name, to: pt(to) },
          rebuilt,
          state: {
            A: pt(next.A), B: pt(next.B), C: pt(next.C),
            D: pt(next.D), E: pt(next.E), coef: r3(next.coef),
          },
          reading: reading(next),
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of that same diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported BQTLemma state version ${stateVersion}`);
  }
  const s = readDiagram(state);
  const savedF = state.F === undefined || state.F === null ? null : readPoint(state, "F");
  const mid = core().midPoint(s.A, s.C);
  return {
    stateVersion,
    // The fields Track.state saved, unchanged.
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D), E: pt(s.E),
    coef: r3(s.coef),
    savedF: savedF ? pt(savedF) : null,
    midpointMatchesSavedF: savedF
      ? Math.hypot(savedF.x - mid.x, savedF.y - mid.y) < 1e-6
      : null,
    reading: reading(s),
  };
}
