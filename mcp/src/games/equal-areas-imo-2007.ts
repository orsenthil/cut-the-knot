/*
 * run_game_logic actions and saved-position reader for Equal Areas, IMO 2007.
 *
 * The real core is equal-areas-imo-2007/equal-areas-imo-2007-core.js, copied
 * into src/generated/cores/ at build time; it reconstructs the applet's own
 * Compute(). In triangle ABC the bisector at C meets side AB at S and the
 * circumcircle again at R. The perpendicular bisectors of BC and AC meet CR
 * at P and Q, and K, L are the midpoints of BC and AC. IMO 2007 Problem 4
 * asks why the shaded triangles RPK and RQL always have equal area: with
 * a = BC, b = AC and C the angle at C, each is ab·tan(C/2)/8. Every number
 * below is measured by the core rather than restated from the page.
 *
 * Coordinates are the illustration's 400 x 300 viewBox with y down. The page
 * notes that the companion "Triangles with Equal Area II" page no longer
 * embeds the applet; the manifest's cut-the-knot.org URL was corrected to the
 * verified page that does. See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["equal-areas-imo-2007"].EqualAreas2007Core;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Point = { x: number; y: number };

/** The non-degenerate shape compute() returns (its guard returns only degenerate). */
type Geometry = {
  degenerate: boolean;
  A: Point; B: Point; C: Point; O: Point; radius: number;
  circle: { center: Point; radius: number };
  S: Point; R: Point; K: Point; L: Point; M: Point; P: Point; Q: Point;
  Kp: Point; Lp: Point; Cp: Point; Kh: Point; Lh: Point;
  a: number; b: number; c: number; angleC: number;
  areaRPK: number; areaRQL: number; areaGap: number; trigArea: number;
};
const geometry = (C: Core, s: State): Geometry => C.compute(s) as unknown as Geometry;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Residuals are ~1e-12 board units, so keep their size and sign as text. */
const sig = (v: number): string | null => (Number.isFinite(v) ? v.toExponential(2) : null);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const deg = (radians: number): number => r6((radians * 180) / Math.PI);
const okPoint = (p: Point | null | undefined): p is Point =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = num(o, "x"); y = num(o, "y");
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Omit a corner to use the illustration's opening triangle. */
function triangle(C: Core, args: Json): State {
  const seed = C.start();
  const s: State = {
    ...seed,
    A: readPoint(args.A, "A", seed.A),
    B: readPoint(args.B, "B", seed.B),
    C: readPoint(args.C, "C", seed.C),
    showNames: typeof args.showNames === "boolean" ? args.showNames : seed.showNames,
    details: typeof args.details === "boolean" ? args.details : seed.details,
  };
  for (const name of ["A", "B", "C"] as const) {
    const p = s[name];
    if (p.x < 0 || p.x > C.WIDTH || p.y < 0 || p.y > C.HEIGHT) {
      throw new Error(`corner ${name} is outside the ${C.WIDTH} by ${C.HEIGHT} board`);
    }
  }
  return s;
}

/** Throw unless the three corners make a picture the core can draw. */
function live(C: Core, args: Json): { s: State; g: Geometry } {
  const s = triangle(C, args);
  const g = geometry(C, s);
  const points = [g.O, g.S, g.R, g.K, g.L, g.M, g.P, g.Q];
  const numbers = [g.radius, g.a, g.b, g.c, g.angleC, g.areaRPK, g.areaRQL, g.trigArea];
  if (g.degenerate || !points.every(okPoint) || !numbers.every(Number.isFinite)) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners (each [x, y] or {x, y}) " +
      "that leave room for a circumcenter and for P and Q on the 400 by 300 board",
    );
  }
  return { s, g };
}

/** Everything the core can say about one drawable picture, in tutor units. */
function reading(C: Core, s: State, g: Geometry) {
  const cosHalf = Math.cos(g.angleC / 2);
  const cp = C.dist(g.C, g.P), cq = C.dist(g.C, g.Q);
  const expectedCP = g.a / (2 * cosHalf), expectedCQ = g.b / (2 * cosHalf);
  const cr = C.dist(g.C, g.R);
  const relGap = g.areaGap / Math.max(1, Math.abs(g.areaRPK));
  const formGap = Math.abs(g.areaRPK - g.trigArea);
  const formRelGap = formGap / Math.max(1, Math.abs(g.trigArea));
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    sides: { a_BC: r6(g.a), b_AC: r6(g.b), c_AB: r6(g.c) },
    angleC: { radians: r6(g.angleC), degrees: deg(g.angleC) },
    construction: {
      S_on_AB: pt(g.S), R_on_circle: pt(g.R),
      K_mid_BC: pt(g.K), L_mid_AC: pt(g.L), M_mid_AB: pt(g.M),
      P_on_CR: pt(g.P), Q_on_CR: pt(g.Q), O_center: pt(g.O),
      circleRadius: r6(g.radius), CR: r6(cr),
    },
    lengths: {
      CP: r6(cp), expectedCP: r6(expectedCP), cpError: sig(cp - expectedCP),
      CQ: r6(cq), expectedCQ: r6(expectedCQ), cqError: sig(cq - expectedCQ),
      note: "The right triangles CPK and CQL give CP = BC/(2 cos(C/2)) and CQ = AC/(2 cos(C/2)).",
    },
    areas: {
      RPK: r6(g.areaRPK), RQL: r6(g.areaRQL),
      gap: sig(g.areaGap), relativeGap: sig(relGap),
      equal: relGap < 1e-6,
    },
    closedForm: {
      expression: "a·b·tan(C/2)/8",
      value: r6(g.trigArea),
      errorVsRPK: sig(g.areaRPK - g.trigArea),
      errorVsRQL: sig(g.areaRQL - g.trigArea),
      relativeError: sig(formRelGap),
      matches: formRelGap < 1e-6,
    },
    result: C.result(s),
    note:
      "The bisector from C crosses AB at S and the circumcircle again at R; the perpendicular " +
      "bisectors of BC and AC cross CR at P and Q. Both shaded triangles then have area " +
      "ab·tan(C/2)/8, so Area(RPK) = Area(RQL). The manifest's cut-the-knot.org URL for this " +
      "applet was corrected to the page that actually embeds it; the 'II' companion page no longer does.",
  };
}

/** Validate the optional C sweep used by verify_claim. */
function sweepSamples(args: Json): number {
  const raw = args.samples === undefined || args.samples === null ? 8 : Number(args.samples);
  if (!Number.isInteger(raw) || raw < 1 || raw > 36) {
    throw new Error('"samples" must be a whole number from 1 to 36');
  }
  return raw;
}

export function actions(): GameActions {
  return {
    equal_areas: {
      describe:
        "For a triangle A, B, C (each [x, y] or { x, y } on the illustration's 400 by 300 board, y down), report the angle-bisector construction (S, R, K, L, M, P, Q, O), the lengths CP and CQ with their half-angle formulas, both shaded areas, and the closed form ab·tan(C/2)/8 with their residuals. Omit a corner to use the opening picture; showNames and details reproduce the page's ticks. Refuses a triangle too thin for the core to draw.",
      args: '{ "A": [94.747, 212.5], "B": [308.253, 212.5], "C": [137.5, 41.747] }',
      run: (args) => {
        const C = core();
        const { s, g } = live(C, args);
        return reading(C, s, g);
      },
    },
    verify_claim: {
      describe:
        "Check IMO 2007 Problem 4's claim at the triangle A, B, C (arguments as in equal_areas): Area(RPK) = Area(RQL) = ab·tan(C/2)/8. Optionally drag C around the midpoint of AB through 'samples' equally spaced positions (1 to 36, default 8) using the core's own move(), and report the worst relative gap and closed-form error over all positions drawn. Reports booleans for the equal-area claim and the closed form, with the number of positions the core accepted.",
      args: '{ "A": [94.747, 212.5], "B": [308.253, 212.5], "C": [137.5, 41.747], "samples": 8 }',
      run: (args) => {
        const C = core();
        const { s, g } = live(C, args);
        const samples = sweepSamples(args);
        const base = reading(C, s, g);

        const midAB = { x: (s.A.x + s.B.x) / 2, y: (s.A.y + s.B.y) / 2 };
        const radius = C.dist(s.C, midAB);
        const phase = Math.atan2(s.C.y - midAB.y, s.C.x - midAB.x);
        let worstGap = g.areaGap / Math.max(1, Math.abs(g.areaRPK));
        let worstForm = Math.abs(g.areaRPK - g.trigArea) / Math.max(1, Math.abs(g.trigArea));
        const rows: Json[] = [];
        for (let k = 0; k < samples; k++) {
          const t = phase + (2 * Math.PI * k) / samples;
          const point = { x: midAB.x + radius * Math.cos(t), y: midAB.y + radius * Math.sin(t) };
          const next = C.move(s, { type: "point", name: "C", point });
          if (!next) {
            rows.push({ k, point: pt(point), valid: false, reason: "the core refused this drag" });
            continue;
          }
          const gg = geometry(C, next);
          if (gg.degenerate) {
            rows.push({ k, point: pt(next.C), valid: false, reason: "degenerate picture" });
            continue;
          }
          const gapRel = gg.areaGap / Math.max(1, Math.abs(gg.areaRPK));
          const formRel = Math.abs(gg.areaRPK - gg.trigArea) / Math.max(1, Math.abs(gg.trigArea));
          worstGap = Math.max(worstGap, gapRel);
          worstForm = Math.max(worstForm, formRel);
          rows.push({
            k, point: pt(next.C), valid: true, angleCdegrees: deg(gg.angleC),
            RPK: r6(gg.areaRPK), RQL: r6(gg.areaRQL),
            areaGap: sig(gg.areaGap), relativeGap: sig(gapRel),
            closedFormError: sig(formRel),
          });
        }
        const drawn = rows.filter((row) => row.valid).length;
        const holds = drawn === samples && worstGap < 1e-6 && worstForm < 1e-6;
        return {
          base,
          sweep: {
            point: "C", samples, drawn,
            worstRelativeGap: sig(worstGap),
            worstClosedFormRelativeError: sig(worstForm),
            holds,
            rows,
          },
          note:
            `At the given triangle Area(RPK) = ${base.areas.RPK} and Area(RQL) = ${base.areas.RQL}, ` +
            `both matching ab·tan(C/2)/8 = ${base.closedForm.value}. ` +
            `Dragging C through ${samples} positions keeps the two areas equal and equal to the closed form` +
            (holds ? " at every position drawn." : " within the reported worst residuals; some drags may have been refused."),
        };
      },
    },
  };
}

/** Track.state saves the three draggable corners and two ticks; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equal Areas, IMO 2007 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equal Areas, IMO 2007 position must be an object");
  }
  const C = core();
  const seed = triangle(C, state);
  const moves = Number.isFinite(Number(state.moves)) ? Number(state.moves) : 0;
  const explored = state.explored === true;
  // Carry the saved progress flags into the state the core reads, so result() sees "done".
  const s: State = { ...seed, moves, explored };
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames,
    details: s.details,
    moves,
    explored,
  };
  const g = geometry(C, s);
  const drawable = !g.degenerate &&
    [g.O, g.S, g.R, g.K, g.L, g.M, g.P, g.Q].every(okPoint) &&
    [g.radius, g.a, g.b, g.c, g.angleC, g.areaRPK, g.areaRQL, g.trigArea].every(Number.isFinite);
  if (!drawable) {
    return {
      ...saved,
      degenerate: true,
      reading: null,
      note: "The saved corners are collinear, too close together, or off the board, so there is no circumcenter, no R, P or Q, and no pair of shaded areas to measure.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    result: C.result(s),
    reading: reading(C, s, g),
    note:
      "Track.state saved the three draggable corners, the two ticks, the move count and the explored flag. " +
      "The core rebuilds the bisector from C, the circumcircle, R, P, Q, K and L from that position, then " +
      "measures Area(RPK), Area(RQL) and ab·tan(C/2)/8 there. This is an illustration: finishing it reports 'done'.",
  };
}
