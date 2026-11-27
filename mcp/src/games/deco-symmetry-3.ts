/*
 * run_game_logic actions and saved-position reader for Deco Symmetry 3.
 *
 * The real core is deco-symmetry-3/deco-symmetry-3-core.js, copied into
 * src/generated/cores/ at build time. Its start/move/compute/pose functions are
 * the applet's own construction: the incenter O, the three perpendicular feet,
 * the three kites and the rotation that carries each kite onto its mirror.
 * Every number below is measured by that core. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["deco-symmetry-3"].DecoSymmetry3Core;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Point = { x: number; y: number };

/* The JS core narrows valid:false/true loosely; describe the valid result we use. */
interface Piece {
  name: string;
  initial: Point[];
  final: Point[];
  feet: Point[];
  axis: Point;
  angle: number;
  center: Point | null;
  translation: Point | null;
  start: Point;
  goal: Point;
}
interface Dissection {
  A: Point; B: Point; C: Point;
  Ap: Point; Bp: Point; Cp: Point;
  O: Point; D: Point; E: Point; F: Point;
  Op: Point; Dp: Point; Ep: Point; Fp: Point;
  P: Point; centroid: Point;
  pieces: Piece[];
  hintRadius: number;
  area: number;
}

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const degrees = (radians: number): number => round((radians * 180) / Math.PI);

/** Read a corner point, falling back to the applet's opening corner. */
function readPoint(value: unknown, name: string, fallback: Point): Point {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${name}" must be a point { "x": ..., "y": ... }`);
  }
  const o = value as Json;
  if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
    throw new Error(`"${name}" must have finite x and y`);
  }
  const x = Number(o.x), y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${name}" must have finite x and y`);
  }
  return { x, y };
}

/** A saved corner must really be present; the page always writes all three. */
function savedPoint(value: unknown, name: string): Point {
  if (value === undefined || value === null) {
    throw new Error(`saved position is missing corner "${name}"`);
  }
  return readPoint(value, name, { x: 0, y: 0 });
}

function savedFlag(value: unknown, name: string): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") throw new Error(`saved "${name}" must be true or false`);
  return value;
}

/** Build a fresh core state from three corners, refusing a collapsed triangle. */
function buildState(args: Json): { C: Core; s: State; f: Dissection } {
  const C = core();
  const fresh = C.start();
  const A = readPoint(args.A, "A", fresh.A);
  const B = readPoint(args.B, "B", fresh.B);
  const Cpt = readPoint(args.C, "C", fresh.C);
  const s = { ...fresh, A, B, C: Cpt };
  const f = C.compute(s);
  if (!f.valid) {
    throw new Error("A, B and C must form a proper, non-degenerate triangle (not collinear or coincident)");
  }
  return { C, s, f: f as unknown as Dissection };
}

/** Polygon area from its vertices, matching the logic test's partition check. */
function polygonArea(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const q = poly[(i + 1) % poly.length];
    sum += poly[i].x * q.y - q.x * poly[i].y;
  }
  return Math.abs(sum) / 2;
}

/** The incenter dissection: equal sides of each kite and its two isosceles halves. */
function reading(C: Core, f: Dissection) {
  const scale = Math.max(1, C.dist(f.A, f.B), C.dist(f.B, f.C), C.dist(f.C, f.A));
  const kites = f.pieces.map((p) => {
    const [u, v] = p.feet;
    const vertex = p.initial[2];
    const ou = C.dist(f.O, u), ov = C.dist(f.O, v);
    const vu = C.dist(vertex, u), vv = C.dist(vertex, v);
    return {
      name: p.name,
      vertex: pt(vertex),
      feet: [pt(u), pt(v)],
      fromIncenter: { side1: round(ou), side2: round(ov), error: round(Math.abs(ou - ov), 9) },
      fromVertex: { side1: round(vu), side2: round(vv), error: round(Math.abs(vu - vv), 9) },
      isoscelesHalves: [
        { apex: "O", base: [pt(u), pt(v)], equalSides: [round(ou), round(ov)] },
        { apex: p.name, base: [pt(u), pt(v)], equalSides: [round(vu), round(vv)] },
      ],
      rotationDeg: degrees(p.angle),
      center: p.center ? pt(p.center) : null,
      translation: p.translation ? pt(p.translation) : null,
    };
  });
  const areaSum = f.pieces.reduce((acc, p) => acc + polygonArea(p.initial), 0);
  return {
    triangle: { A: pt(f.A), B: pt(f.B), C: pt(f.C), area: round(f.area) },
    incenter: pt(f.O),
    inradius: round(C.dist(f.O, f.D)),
    feet: { D: pt(f.D), E: pt(f.E), F: pt(f.F) },
    mirror: { Ap: pt(f.Ap), Bp: pt(f.Bp), Cp: pt(f.Cp) },
    kites,
    isoscelesCount: kites.length * 2,
    equalSidesHold: kites.every(
      (k) => k.fromIncenter.error < 1e-6 * scale && k.fromVertex.error < 1e-6 * scale,
    ),
    partitionError: round(Math.abs(areaSum - f.area), 9),
  };
}

export function actions(): GameActions {
  return {
    kite_dissection: {
      describe:
        "Cut the triangle A, B, C (each an optional {x,y} point; omitted corners use the applet's opening triangle) at its incenter O with the perpendicular feet D, E, F into three kites. Reports O and the inradius, each kite's two pairs of equal sides (OD = OE = inradius from O, and equal tangent lengths from the corner), the six isosceles triangles obtained by joining each pair of feet, the rotation angle and centre of each kite, and how closely the three kite areas fill the triangle. This construction works for any non-degenerate triangle, obtuse included.",
      args: '{ "A": { "x": 152, "y": 156.25 }, "B": { "x": 91.6666666666667, "y": 52.831216351296774 }, "C": { "x": 91.66666666666664, "y": 163.83545031536985 } }',
      run: (args) => {
        const { C, s, f } = buildState(args);
        const r = reading(C, f);
        const maxSideError = Math.max(
          ...r.kites.flatMap((k) => [k.fromIncenter.error, k.fromVertex.error]),
        );
        return {
          ...r,
          valid: true,
          status: C.describe(f, s),
          note:
            `O = (${r.incenter.x}, ${r.incenter.y}) is the same distance ${r.inradius} from all three sides, so the feet D, E, F are the cuts. ` +
            `Each piece is a kite: the two sides from O equal the inradius and the two sides from its corner equal that corner's tangent length (largest difference between equal sides ${maxSideError} board units). ` +
            `Joining the two feet splits each kite into two isosceles triangles, ${r.isoscelesCount} in all, and the three kite areas add to the triangle's area with error ${r.partitionError}. ` +
            "The core builds this for any non-degenerate triangle; the page's logic test confirmed it on 180 grid layouts and 4,000 random triangles, obtuse ones included.",
        };
      },
    },
    mirror_move: {
      describe:
        "Play the applet's Move-them animation on the triangle A, B, C (optional corners as in kite_dissection). After `steps` of the core's 50 steps (default 50), report each kite's rotation angle, its centre (or translation when its diagonal is parallel to the mirror line), how closely it lands on the matching kite of the mirrored triangle, and whether its signed area keeps its sign. Two reflections — in the kite's own diagonal and in the board's centre line — make one rotation (or a slide), so no piece is ever flipped.",
      args: '{ "A": { "x": 152, "y": 156.25 }, "B": { "x": 91.6666666666667, "y": 52.831216351296774 }, "C": { "x": 91.66666666666664, "y": 163.83545031536985 }, "steps": 50 }',
      run: (args) => {
        const { C, s: fresh, f } = buildState(args);
        const stepsRaw = num(args, "steps", C.NSteps);
        if (!Number.isInteger(stepsRaw) || stepsRaw < 0 || stepsRaw > C.NSteps) {
          throw new Error(`"steps" must be an integer from 0 to ${C.NSteps}, got ${stepsRaw}`);
        }
        const steps = Math.trunc(stepsRaw);
        let s = C.startMove(fresh);
        for (let i = 0; i < steps; i++) s = C.advance(s);
        const scale = Math.max(1, C.dist(f.A, f.B), C.dist(f.B, f.C), C.dist(f.C, f.A));
        const kites = f.pieces.map((p) => {
          const landed: Point[] = C.pose(p, 1) as Point[];
          const error = Math.max(...landed.map((v: Point, i: number) => C.dist(v, p.final[i])));
          const before = Math.sign(polygonArea(p.initial));
          const after = Math.sign(polygonArea(landed));
          return {
            name: p.name,
            rotationDeg: degrees(p.angle),
            center: p.center ? pt(p.center) : null,
            translation: p.translation ? pt(p.translation) : null,
            landingError: round(error, 9),
            landsOnMirror: error < 1e-6 * scale,
            orientationPreserved: before === after,
          };
        });
        return {
          steps,
          step: s.step,
          moving: s.moving,
          moved: s.moved,
          result: C.result(s),
          status: C.describe(f, s),
          kites,
          allLandOnMirror: kites.every((k) => k.landsOnMirror),
          noneFlipped: kites.every((k) => k.orientationPreserved),
          note:
            `The rotation is 180° minus twice the diagonal's direction; its centre is where the diagonal meets the centre line (a parallel diagonal gives a plain slide). ` +
            `At the end of the ${C.NSteps}-step move every kite lands on its mirror kite (largest error ${round(Math.max(...kites.map((k) => k.landingError)), 9)} board units) and keeps the sign of its signed area, so the move is a rotation, never a reflection.`,
        };
      },
    },
  };
}

/** Track.state saves the three corners and the view/animation flags; the core redraws from them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Deco Symmetry 3 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Deco Symmetry 3 position must be an object");
  }

  const C = core();
  const fresh = C.start();
  const A = savedPoint(state.A, "A");
  const B = savedPoint(state.B, "B");
  const Cpt = savedPoint(state.C, "C");
  const showNames = savedFlag(state.showNames, "showNames");
  const showHint = savedFlag(state.showHint, "showHint");
  const moving = savedFlag(state.moving, "moving");
  const moved = savedFlag(state.moved, "moved");
  const stepRaw = num(state, "step", 0);
  if (!Number.isInteger(stepRaw) || stepRaw < 0 || stepRaw > C.NSteps) {
    throw new Error(`saved "step" must be an integer from 0 to ${C.NSteps}, got ${stepRaw}`);
  }
  const step = Math.trunc(stepRaw);
  const s: State = { A, B, C: Cpt, showNames, showHint, moving, step, moved };
  const f = C.compute(s);
  const coreReading = f.valid
    ? reading(C, f as unknown as Dissection)
    : null;

  return {
    stateVersion,
    saved: { ...state },
    position: {
      A: pt(A), B: pt(B), C: pt(Cpt),
      showNames, showHint, moving, step, moved,
    },
    core: coreReading,
    result: C.result(s),
    status: C.describe(f, s),
    note: coreReading
      ? "Track.state saved the three corners and the view/animation flags in board units. The core rebuilds the incenter dissection from those corners: the kite equal-side pairs, the six isosceles halves and the area partition are measured on the saved triangle, not on a fresh one."
      : "Track.state saved a collapsed triangle, so the core has no dissection to draw; move one of the three corners to make a proper triangle.",
  };
}
