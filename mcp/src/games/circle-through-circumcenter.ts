/*
 * run_game_logic actions and saved-position reader for Circle Through Circumcenter.
 *
 * O is the circumcentre of triangle ABC. The circle through B, O and C cuts the
 * lines AB and AC again at P and Q, and AO crosses PQ at X at a right angle.
 * The claim holds for obtuse triangles too; only a right angle at A breaks the
 * construction (then O is the midpoint of BC, so no circle passes through B,
 * O and C). The angle chase behind it is ∠APQ = ∠BCA, and ∠BAO either adds to
 * that angle (C acute) or differs from it by 90° (C obtuse).
 *
 * Every number below comes from the game's real core,
 * circle-through-circumcenter/circle-through-circumcenter-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-through-circumcenter"].CircleThroughCircumcenterCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Circle = { c: Point; r: number } | null;

const ANGLE_TOL = 1e-6; // direction cosines and radians
const DIST_TOL = 1e-4;  // page (viewBox) units
const round = (v: number): number => Math.round(v * 1e4) / 1e4;
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const deg = (radians: number): number => Math.round((radians * 180000) / Math.PI) / 1000;
const xy = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;

/** Accept [x, y] or { x, y }: JSON args use arrays, the page saves objects. */
function readPoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} needs finite x and y`);
  return { x, y };
}

/** A saved derived point may be absent (e.g. a degenerate drawing). */
function savedPoint(v: unknown): Point | null {
  try { return xy(readPoint(v, "point")); } catch { return null; }
}

function savedCircle(v: unknown): Circle {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Json;
  const c = savedPoint(o.c);
  const r = Number(o.r);
  if (!c || !Number.isFinite(r)) return null;
  return { c, r: round(r) };
}

/** Reject collapsed or collinear corners; a right angle at A is handled later. */
function readTriangle(C: Core, args: Json): Triangle {
  const home = C.start({});
  const A = args.A === undefined ? home.A : readPoint(args.A, "A");
  const B = args.B === undefined ? home.B : readPoint(args.B, "B");
  const Cc = args.C === undefined ? home.C : readPoint(args.C, "C");
  if (C.dist(A, B) < 1e-9 || C.dist(B, Cc) < 1e-9 || C.dist(Cc, A) < 1e-9) {
    throw new Error("A, B and C must be three different points");
  }
  if (Math.abs(C.cross(C.sub(B, A), C.sub(Cc, A))) < 1e-9) {
    throw new Error("A, B and C must not lie on one line");
  }
  return { A, B, C: Cc };
}

/** Cosine of the angle between lines pq and rs; 0 means perpendicular. */
function lineCosine(C: Core, p: Point, q: Point, r: Point, s: Point): number {
  return C.dot(C.unit(C.sub(q, p)), C.unit(C.sub(s, r)));
}

type Reading = {
  valid: boolean;
  points: { O: Point; P: Point; Q: Point; J: Point; X: Point } | null;
  circumcircle: Circle;
  circleBOC: Circle;
  anglesDegrees: { A: number; B: number; C: number } | null;
  sides: { a: number; b: number; c: number } | null;
  perpendicular: { cosineAO_PQ: number; angleAXPDegrees: number; holds: boolean } | null;
  angleRelation: {
    APQDegrees: number; BCADegrees: number; BAODegrees: number;
    relation: string; holds: boolean;
  } | null;
  onCircle: { B: boolean; O: boolean; C: boolean; P: boolean; Q: boolean } | null;
  onLines: { P_on_AB: boolean; Q_on_AC: boolean; X_on_AO: boolean; X_on_PQ: boolean } | null;
  note: string;
};

/** The whole construction and its claims, measured with the real core. */
function reading(C: Core, t: Triangle): Reading {
  const g = C.compute(t.A, t.B, t.C);
  if (!g) {
    return {
      valid: false,
      points: null, circumcircle: null, circleBOC: null,
      anglesDegrees: null, sides: null, perpendicular: null,
      angleRelation: null, onCircle: null, onLines: null,
      note: "With a right angle at A the circumcentre O is the midpoint of BC, so B, O and C lie on one line: there is no circle through them and no P, Q or X to draw. Move A so it does not lie on the circle with diameter BC.",
    };
  }

  const cos = lineCosine(C, g.A, g.O, g.P, g.Q);
  const atX = C.angle(g.X, g.A, g.P);
  const apq = C.angle(g.P, g.A, g.Q);
  const bao = C.angle(g.A, g.B, g.O);
  const cAcute = g.angles.C < Math.PI / 2;
  const rBOC = g.circle.r;
  const onBOC = (p: Point): boolean => near(C.dist(p, g.circle.c), rBOC, DIST_TOL);

  return {
    valid: true,
    points: { O: xy(g.O), P: xy(g.P), Q: xy(g.Q), J: xy(g.J), X: xy(g.X) },
    circumcircle: { c: xy(g.circumcircle.c), r: round(g.circumcircle.r) },
    circleBOC: { c: xy(g.circle.c), r: round(rBOC) },
    anglesDegrees: { A: deg(g.angles.A), B: deg(g.angles.B), C: deg(g.angles.C) },
    sides: { a: round(g.sides.a), b: round(g.sides.b), c: round(g.sides.c) },
    perpendicular: {
      cosineAO_PQ: round6(cos),
      angleAXPDegrees: deg(atX),
      holds: Math.abs(cos) < ANGLE_TOL && near(atX, Math.PI / 2, ANGLE_TOL),
    },
    angleRelation: {
      APQDegrees: deg(apq),
      BCADegrees: deg(g.angles.C),
      BAODegrees: deg(bao),
      relation: cAcute ? "APQ + BAO = 90" : "APQ - BAO = 90",
      holds: near(apq, g.angles.C, ANGLE_TOL)
        && (cAcute
          ? near(apq + bao, Math.PI / 2, ANGLE_TOL)
          : near(apq - bao, Math.PI / 2, ANGLE_TOL)),
    },
    onCircle: {
      B: onBOC(g.B), O: onBOC(g.O), C: onBOC(g.C), P: onBOC(g.P), Q: onBOC(g.Q),
    },
    onLines: {
      P_on_AB: C.distanceToLine(g.P, g.A, g.B) < DIST_TOL,
      Q_on_AC: C.distanceToLine(g.Q, g.A, g.C) < DIST_TOL,
      X_on_AO: C.distanceToLine(g.X, g.A, g.O) < DIST_TOL,
      X_on_PQ: C.distanceToLine(g.X, g.P, g.Q) < DIST_TOL,
    },
    note: `O is the circumcentre, and the circle through B, O and C meets AB again at P and AC again at Q. The cosine of the angle between AO and PQ is ${round6(cos)} and the angle at X is ${deg(atX)}°. ∠APQ = ∠BCA = ${deg(g.angles.C)}°; with ∠BAO = ${deg(bao)}° these ${cAcute ? "add to" : "differ by"} 90°, so AO ⟂ PQ${cAcute ? "" : " even though C is obtuse"}.`,
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the 400 x 300 page coordinates, y downward): report the circumcentre O, the circumcircle, the circle through B, O and C, its second cuts P on AB and Q on AC, the point J where AO meets that circle again, the crossing X = AO ∩ PQ, the angles and sides, and a direct check that AO is perpendicular to PQ. A right angle at A is reported as degenerate rather than throwing.",
      args: '{ "A": [200, 50], "B": [100, 240], "C": [300, 240] }',
      run: (args) => {
        const C = core();
        return reading(C, readTriangle(C, args));
      },
    },
    check_claim: {
      describe:
        "Check the illustration's claim AO ⟂ PQ for one triangle (A, B, C) or for several labelled triangles given as a `triangles` array (up to 8, each with optional `label`, A, B, C). For every non-degenerate triangle report the cosine between AO and PQ, the angle at their crossing X, ∠APQ = ∠BCA, the ∠BAO relation (adds to 90° when C is acute, differs by 90° when C is obtuse), whether P and Q lie on the circle through B, O and C, and whether they lie on AB and AC. A right angle at A is reported as valid: false with the reason. Returns allHold when every valid case satisfies both checks.",
      args: '{ "triangles": [ { "label": "acute", "A": [200, 50], "B": [100, 240], "C": [300, 240] }, { "label": "obtuse at C", "A": [100, 100], "B": [300, 100], "C": [120, 120] }, { "label": "obtuse at A", "A": [200, 220], "B": [100, 260], "C": [300, 260] }, { "label": "right at A (degenerate)", "A": [200, 200], "B": [100, 300], "C": [300, 300] } ] }',
      run: (args) => {
        const C = core();
        let cases: Array<{ label: string; triangle: Triangle }>;
        if (Array.isArray(args.triangles)) {
          const list = args.triangles;
          if (list.length === 0 || list.length > 8) {
            throw new Error('"triangles" must contain between 1 and 8 triangles');
          }
          cases = list.map((v, i) => {
            if (!v || typeof v !== "object" || Array.isArray(v)) {
              throw new Error(`triangles[${i}] must be an object with A, B and C`);
            }
            const o = v as Json;
            const label = typeof o.label === "string" && o.label.trim()
              ? o.label.trim() : `triangle ${i + 1}`;
            return { label, triangle: readTriangle(C, o) };
          });
        } else {
          cases = [{ label: "triangle", triangle: readTriangle(C, args) }];
        }

        const results = cases.map(({ label, triangle }) => {
          const r = reading(C, triangle);
          return {
            label,
            vertices: { A: xy(triangle.A), B: xy(triangle.B), C: xy(triangle.C) },
            valid: r.valid,
            anglesDegrees: r.anglesDegrees,
            perpendicular: r.perpendicular,
            angleRelation: r.angleRelation,
            onCircle: r.onCircle,
            onLines: r.onLines,
            claimHolds: r.perpendicular?.holds === true && r.angleRelation?.holds === true,
            note: r.note,
          };
        });
        const allHold = results.every((r) => !r.valid || r.claimHolds);
        return {
          allHold,
          cases: results,
          note: allHold
            ? "AO stays perpendicular to PQ in every valid case here, obtuse triangles included; a right angle at A has no circle through B, O and C."
            : "At least one valid triangle fails a check; inspect the residuals above.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const t = readTriangle(C, state);
  const options = (state.options && typeof state.options === "object")
    ? state.options as Json
    : C.start({}).options;
  const shownOptions = {
    names: options.names !== false,
    hint: options.hint !== false,
    premises: options.premises === true,
    statement: options.statement === true,
  };
  const saved = {
    A: xy(t.A), B: xy(t.B), C: xy(t.C),
    O: savedPoint(state.O), P: savedPoint(state.P), Q: savedPoint(state.Q),
    J: savedPoint(state.J), X: savedPoint(state.X),
    circumcircle: savedCircle(state.circumcircle),
    circle: savedCircle(state.circle),
    options: shownOptions,
  };
  const r = reading(C, t);
  return {
    stateVersion,
    ...saved,
    reading: r,
    note: C.describe({ A: t.A, B: t.B, C: t.C, options: shownOptions }),
  };
}
