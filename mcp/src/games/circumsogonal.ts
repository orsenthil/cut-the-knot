/*
 * run_game_logic actions and saved-position reader for Isogonal Image of the
 * Circumcircle.
 *
 * The real core is circumsogonal/circumsogonal-core.js, copied into
 * src/generated/cores/ at build time. It follows the applet's construction:
 * at each corner V the line VP is reflected in the bisector (the applet turns
 * the far side by the signed angle from VP to the near side), the reflected
 * lines at A and B are intersected to give Q, the isogonal conjugate of P, and
 * when P is within the applet's 2 pixels of the circumcircle no Q is drawn:
 * the three reflected lines are parallel. Every number below is measured by
 * the core. See _shared.ts for the module shape.
 *
 * Coordinates are the illustration's 400 x 250 viewBox units, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circumsogonal"].CircumsogonalCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Position = { A: Point; B: Point; C: Point; P: Point };
type Line = { vertex: Point; from: Point; to: Point; R: Point; angle: number; matched: number };
type Measurements = {
  lines: { A: Line; B: Line; C: Line };
  circle: { center: Point; r: number };
  gap: number;
  onCircle: boolean;
  Q: Point | null;
  degenerate: boolean;
};
type Claims = { reflected: boolean; concurrent: boolean; parallel: boolean; onCircle: boolean; Q: Point | null; exact: Point | null };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const finite = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const deg = (rad: number): number | null => finite((rad * 180) / Math.PI);

function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    const x = Number(raw[0]), y = Number(raw[1]);
    if (raw.length !== 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
    }
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

/** Omit a point to use the illustration's opening one (P starts on the circle). */
function readPosition(C: Core, args: Json): Position {
  const seed = C.start({}) as Position;
  return {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
    P: readPoint(args, "P", seed.P),
  };
}

function reading(C: Core, s: Position) {
  const m = C.measurements(s) as unknown as Measurements;
  if (m.degenerate) {
    return { degenerate: true, note: "A, B and C are collinear (or coincide), so there is no triangle, no bisector and no circumcircle." };
  }
  const cl = C.claims(s) as unknown as Claims;
  const L = m.lines;
  const line = (l: Line) => ({
    through: pt(l.vertex),
    secondPoint: pt(l.R),
    angleFromVPtoSide_deg: deg(l.angle),
    angleFromOtherSideToLine_deg: deg(l.matched),
  });
  const maxParallelAngle = Math.max(
    C.lineAngle(s.A, L.A.R, s.B, L.B.R),
    C.lineAngle(s.A, L.A.R, s.C, L.C.R),
  );
  return {
    degenerate: false,
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    P: pt(s.P),
    circumcircle: { center: pt(m.circle.center), radius: finite(m.circle.r) },
    distanceFromPToCircle: finite(m.gap),
    pOnCircle: m.onCircle,
    reflectedLines: { A: line(L.A), B: line(L.B), C: line(L.C) },
    Q: pt(m.Q),
    exactConjugate: pt(cl.exact),
    checks: {
      eachLineIsTheReflectionOfVP: cl.reflected,
      threeLinesMeetAtQ: cl.concurrent,
      linesParallelWhenPOnCircle: m.onCircle ? cl.parallel : null,
      largestAngleBetweenLines_deg: deg(maxParallelAngle),
    },
    note: m.onCircle
      ? "P is within the applet's 2 pixels of the circumcircle: the three reflected lines are parallel and the isogonal conjugate is a point at infinity. Inscribed angles on the same arc explain it."
      : "The three reflected lines meet at Q, the isogonal conjugate of P, which in barycentrics is a²/α : b²/β : c²/γ. Conjugating Q gives P back; as P nears the circumcircle, Q runs off to infinity.",
  };
}

export function actions(): GameActions {
  const args = '{ "A": [197.53, 41.68], "B": [111.18, 189.31], "C": [281.35, 108.51], "P": [140, 140] }';
  return {
    conjugate: {
      describe:
        "For triangle A, B, C and a point P (each [x, y] or {x, y} on the illustration's 400 x 250 board, y down), report the circumcircle, how far P is from it, the three lines PA, PB, PC reflected in the angle bisectors, their meeting point Q (the isogonal conjugate of P, null when P is on the circle) and the conjugate from the barycentric formula. Checks: each line is the reflection of VP, the three meet at Q, and on the circle they are parallel. Omit a point to use the opening picture (P on the circle).",
      args,
      run: (a) => {
        const C = core();
        return reading(C, readPosition(C, a));
      },
    },
  };
}

/** Track.state saves the three corners and P; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Isogonal Image of the Circumcircle state version ${stateVersion}`);
  }
  const C = core();
  const s = readPosition(C, state);
  const result: (state: Json) => unknown = C.result;
  return {
    stateVersion,
    result: result(state),
    reading: reading(C, s),
    note: "Track.state saved the corners A, B, C and the point P. The core rebuilds the reflected lines, the circumcircle and Q from them.",
  };
}
