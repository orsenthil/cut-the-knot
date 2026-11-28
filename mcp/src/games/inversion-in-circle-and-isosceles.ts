/*
 * run_game_logic actions and saved-position reader for Inversion in a Circle
 * and an Isosceles Triangle.
 *
 * Circle S has diameter AC, B lies on AC, G has diameter AB, and E is the
 * upper point of S on the perpendicular bisector of BC (so BE = CE). The
 * small circle W tucked into the gap between S, G and BE has centre Q; the
 * Sangaku claim is QB perpendicular to AC. The real core
 * (inversion-in-circle-and-isosceles/, copied into src/generated/cores/ at
 * build time) computes W from t = |AB|/(2R):
 *
 *   drop = 2R·(t/(1+t))·√(2(1−t)),   r = 2R·t(1−t)/(1+t),   Q = (B.x, B.y − drop).
 *
 * It also inverts the whole picture in the circle centred at B with radius
 * R/1.5 (positive power), where S' has centre L and radius R', G' is a line
 * through A', and W' has centre V and radius r'. With U = G' ∩ BE', the
 * Pythagorean chain LV² = LB² + BV² = (R'−A'B)² + BU² = (R'+r')² proves W'
 * touches S'. This is the positive-power proof: the sibling game
 * inversion-in-circle-and-isosceles-2 inverts with negative power −AB·BC and
 * uses Feuerbach's theorem instead. Every number below comes from the core;
 * see _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

// The generated core is plain JavaScript; its image objects are unions of a
// circle and a line shape, so use its values through a small any-typed façade
// (as in apollonian-circle.ts) while validating every incoming argument here.
const core = () =>
  cores["inversion-in-circle-and-isosceles"].InversionInCircleAndIsoscelesCore as any;

type Point = { x: number; y: number };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
/** Tiny tangency residuals are kept in scientific notation instead of 0. */
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** Accept the page's {x, y} and the tutor's [x, y] alike. */
function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${name}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${name}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = num(o, "x");
    y = num(o, "y");
  } else {
    throw new Error(`"${name}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${name}" needs finite x and y`);
  return { x, y };
}

/** The page's one parameter: B's fraction along AC, validated before clamping. */
function stateFromT(C: any, args: Json) {
  const t = num(args, "t", C.START_T);
  if (!(t >= C.MIN_T && t <= C.MAX_T)) {
    throw new Error(`"t" must lie between ${round(C.MIN_T)} and ${round(C.MAX_T)}`);
  }
  return C.start({ t });
}

/** An inverted object is a circle or a line; keep just the drawing data. */
function image(o: any) {
  if (!o) return null;
  return o.kind === "line"
    ? { kind: "line", a: pt(o.a), b: pt(o.b) }
    : { kind: "circle", center: pt(o.center), radius: round(o.radius) };
}

/** Unrounded core reading shared by both actions and the position reader. */
function reading(C: any, s: any) {
  const g = C.geometry(s);
  const m = C.measurements(s);
  const v = C.inversion(s);
  const B: Point = g.B;
  const L: Point = v.bigImage.center;   // S'
  const Rp: number = v.bigImage.radius;
  const Vi: Point = v.smallImage.center; // W'
  const rp: number = v.smallImage.radius;
  const LB = C.dist(L, B), BV = C.dist(B, Vi), LV = C.dist(L, Vi);
  const BU = C.dist(B, v.U), ApB = C.dist(v.Ap, B);
  // The page's chain, checked term by term rather than only at the end.
  const chain = {
    LV_squared: round(LV * LV),
    LB_squared_plus_BV_squared: round(LB * LB + BV * BV),
    RminusAprimeB_squared_plus_BU_squared: round((Rp - ApB) ** 2 + BU * BU),
    Rprime_plus_rprime_squared: round((Rp + rp) ** 2),
    residuals: {
      rightAngleAtB: sig(LV * LV - (LB * LB + BV * BV)),
      LB_equals_RminusAprimeB: sig(LB - Math.abs(Rp - ApB)),
      BV_equals_BU: sig(BV - BU),
      WprimeTouchesSprime: sig(LV - (Rp + rp)),
    },
  };
  const tol = 1e-6 * Math.max(1, g.R);
  const claims = {
    QB_perpendicular_AC: near(m.offset, 0, tol),
    W_touches_S: near(m.sGap, 0, tol),
    W_touches_G: near(m.gGap, 0, tol),
    W_touches_BE: near(m.lineGap, 0, tol),
    isosceles_BCE: near(m.eGap, 0, tol),
    rightAngleAtB: near(LV * LV, LB * LB + BV * BV, tol * Math.max(1, LV)),
    BV_equals_BU: near(BV, BU, tol),
    Wprime_touches_Sprime: near(LV, Rp + rp, tol),
  };
  const formulas = {
    u: round(g.u),
    radiusFromU: round(g.R * (1 - g.u * g.u) / (3 + g.u)),
    radius: round(g.radius),
    heightSquared: round(g.drop * g.drop),
    r_times_r_plus_AB: round(g.radius * (g.radius + g.a)),
    radiusResidual: sig(g.radius - g.R * (1 - g.u * g.u) / (3 + g.u)),
    heightResidual: sig(g.drop * g.drop - g.radius * (g.radius + g.a)),
  };
  return { g, m, v, B, L, Rp, Vi, rp, LB, BV, LV, BU, ApB, chain, claims, formulas, tol };
}

/** Tutor-friendly, JSON-safe view of one reading. */
function view(r: ReturnType<typeof reading>) {
  const { g, m, v, B, L, Rp, Vi, rp, chain, claims, formulas } = r;
  return {
    t: round(g.t),
    R: round(g.R),
    points: {
      A: pt(g.A), B: pt(B), C: pt(g.C), O: pt(g.O), E: pt(g.E),
      P: pt(g.mid.center), Q: pt(g.small.center),
    },
    smallCircle: { center: pt(g.small.center), radius: round(g.radius), height: round(g.drop) },
    inversionCircle: { center: pt(B), radius: round(v.rho), power: round(v.rho * v.rho) },
    images: {
      Ap: pt(v.Ap), Cp: pt(v.Cp), Ep: pt(v.Ep), U: pt(v.U), V: pt(Vi), L: pt(L),
      Sprime: image(v.bigImage),   // centre L, radius R'
      Gprime: image(v.midImage),   // the line through A'
      Wprime: image(v.smallImage), // centre V, radius r'
      BEprime: image(v.beImage),
      CEprime: image(v.ceImage),
      Rprime: round(Rp), rprime: round(rp),
    },
    measurements: {
      offset: sig(m.offset),
      toS: round(m.toS), sGap: sig(m.sGap),
      toG: round(m.toG), gGap: sig(m.gGap),
      distanceToBE: round(m.lineDist), lineGap: sig(m.lineGap),
      BE: round(m.be), CE: round(m.ce), eGap: sig(m.eGap),
    },
    closedForms: formulas,
    claims,
    pythagoreanChain: chain,
  };
}

export function actions(): GameActions {
  return {
    sangaku_claim: {
      describe:
        "For a parameter t (B's fraction along AC, between the core's limits), report the Sangaku picture: A, B, C, O, E, the centre P of G, the small circle W with centre Q, and the closed forms r = R(1−u²)/(3+u) and height² = r(r+AB). Check the claim QB perpendicular to AC by the horizontal offset Q.x − B.x, check that W touches S, G and the side BE by their three tangency gaps, and check BE = CE. Every check comes with its residual. This is the positive-power proof; the sibling game inversion-in-circle-and-isosceles-2 proves the same claim with a negative power −AB·BC.",
      args: '{ "t": 0.61 }',
      run: (args) => {
        const C = core();
        const r = reading(C, stateFromT(C, args));
        return {
          ...view(r),
          note:
            "Q has exactly the same x as B, so QB is perpendicular to the diameter AC, " +
            "and the three tangency gaps are zero at the core's precision. E lies on the " +
            "perpendicular bisector of BC, so BCE is isosceles. The sibling applet instead " +
            "uses inversion with negative power −AB·BC and Feuerbach's theorem.",
        };
      },
    },
    positive_power_proof: {
      describe:
        "Invert the picture in the circle centred at B with radius R/1.5 (positive power (R/1.5)²): report S' (centre L, radius R'), G' (the line through A'), W' (centre V, radius r'), the side images and the image points A', C', E', U, V, L. Then check the five-step proof: U = G' ∩ BE', BV = BU, LB = R' − A'B, the right angle at B, and the chain LV² = LB² + BV² = (R'−A'B)² + BU² = (R'+r')², which makes W' touch S' and hence W touch S. Each equality is returned with a residual.",
      args: '{ "t": 0.61 }',
      run: (args) => {
        const C = core();
        const r = reading(C, stateFromT(C, args));
        return {
          t: round(r.g.t),
          inversionCircle: view(r).inversionCircle,
          images: view(r).images,
          lengths: {
            LB: round(r.LB), BV: round(r.BV), BU: round(r.BU), LV: round(r.LV),
            AprimeB: round(r.ApB), Rprime: round(r.Rp), rprime: round(r.rp),
          },
          pythagoreanChain: r.chain,
          checks: r.claims,
          note:
            "Inversion at B keeps angles and tangency. G passes through B, so G' is the " +
            "line through A' where U lies; the isosceles picture gives BV = BU and " +
            "LB = R' − A'B, with a right angle at B. Pythagoras then gives " +
            "LV² = LB² + BV² = (R'−A'B)² + BU² = (R'+r')², so W' touches S' and W touches S. " +
            "The sibling game inversion-in-circle-and-isosceles-2 uses a negative power instead.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Inversion in a Circle and an Isosceles Triangle state version ${stateVersion}`);
  }
  const C = core();
  const t = num(state, "t");
  if (!(t >= C.MIN_T && t <= C.MAX_T)) {
    throw new Error(`saved "t" must lie between ${round(C.MIN_T)} and ${round(C.MAX_T)}`);
  }
  const s = C.start({ t });
  const recomputed = C.position(s);
  const savedB = readPoint(state.B, "B", recomputed.B);
  const savedQ = readPoint(state.Q, "Q", recomputed.Q);
  const savedRadius = num(state, "radius", recomputed.radius);
  const savedOffset = num(state, "offset", recomputed.offset);
  const r = reading(C, s);
  const matchesCore = {
    t: near(t, recomputed.t, 1e-6),
    B: near(C.dist(savedB, recomputed.B), 0, 1e-6),
    Q: near(C.dist(savedQ, recomputed.Q), 0, 1e-6),
    radius: near(savedRadius, recomputed.radius, 1e-6),
    offset: near(savedOffset, recomputed.offset, 1e-6),
  };
  return {
    stateVersion,
    t: recomputed.t,
    B: pt(savedB), Q: pt(savedQ),
    radius: round(savedRadius), offset: round(savedOffset),
    matchesCore,
    reading: view(r),
    note: Object.values(matchesCore).every(Boolean)
      ? `The saved position matches the core at t = ${recomputed.t}: QB is perpendicular to AC (offset 0), W touches S, G and BE, and the positive-power Pythagorean chain holds.`
      : "Some saved fields differ from the core's recomputation at this t; the core-based reading below is authoritative.",
  };
}
