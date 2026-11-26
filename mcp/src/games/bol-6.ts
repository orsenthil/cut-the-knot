/*
 * run_game_logic actions and saved-position reader for BOL6 — Archimedes'
 * Book of Lemmas, Proposition 6 (bol-6/ on the site).
 *
 * AB is the diameter of the big semicircle. C divides it and the semicircles
 * on AC and CB cut out an arbelos. The circle that touches all three arcs has
 * radius rho = r1*r2*(r1+r2)/(r1^2 + r1*r2 + r2^2), with r1 = AC/2 and
 * r2 = CB/2, and its centre sits exactly one diameter, 2*rho, above AB.
 * Dropping its horizontal diameter GH to the baseline at N and P gives
 * AN : NP = NP : PB = k = AC/CB (NP is the mean proportional), so
 * GH = NP and GH/AB = k/(1 + k + k^2) — 6/19 when AC = 3/2 CB.
 *
 * Every number below comes from the real core, bol-6/bol-6-core.js, copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-6"].Bol6Core;

type Point = { x: number; y: number };
type Geometry = ReturnType<ReturnType<typeof core>["geometry"]>;
type Claims = ReturnType<ReturnType<typeof core>["claims"]>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Tool args may use [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const p = value as Json;
    return { x: num(p, "x"), y: num(p, "y") };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

/**
 * Build a real core state. A and B may override the board's baseline; C is
 * given by `ratio` (AC/CB), `t` (AC/AB), an absolute `x`, or the `C` point
 * itself. With none of them, the applet's 3:2 start is used. The core clamps C
 * ten units from each end, as the applet's PointIsEligible does.
 */
function fromArgs(args: Json) {
  const C = core();
  const base = C.start();
  const A = args.A === undefined ? (base.A as Point) : readPoint(args.A, "A");
  const B = args.B === undefined ? (base.B as Point) : readPoint(args.B, "B");
  const L = B.x - A.x;
  if (!(L > 0)) throw new Error("B must lie to the right of A on the baseline");

  let c: Point;
  if (args.C !== undefined && args.C !== null) {
    c = readPoint(args.C, "C");
  } else if (args.ratio !== undefined && args.ratio !== null) {
    const k = num(args, "ratio");
    if (!(k > 0)) throw new Error('"ratio" = AC/CB must be positive');
    c = { x: A.x + (L * k) / (1 + k), y: A.y };
  } else if (args.t !== undefined && args.t !== null) {
    const t = num(args, "t");
    if (!(t > 0 && t < 1)) throw new Error('"t" = AC/AB must be strictly between 0 and 1');
    c = { x: A.x + L * t, y: A.y };
  } else if (args.x !== undefined && args.x !== null) {
    c = { x: num(args, "x"), y: A.y };
  } else {
    c = { x: A.x + (L * 3) / 5, y: A.y }; // the applet's starting 3:2 split
  }

  const seed = C.start({ points: { A, B, C: c } });
  const state = C.withPoint(seed, "C", c); // clamps C onto the baseline interior
  const g = C.geometry(state);
  if (g.degenerate) throw new Error("C must lie between A and B to make an arbelos");
  return { C, state, g: g as Geometry, claims: C.claims(state) as Claims };
}

/** The circle tangent to all three semicircles, read off the core. */
function circleReading(g: Geometry) {
  const r1 = g.R1 as number, r2 = g.R2 as number, R = g.R as number;
  const rho = g.rho as number, k = g.ratio as number, L = g.L as number;
  const main = g.main as { x: number; y: number; r: number };
  const baseY = (g.A as Point).y;
  const formula = (r1 * r2 * (r1 + r2)) / (r1 * r1 + r1 * r2 + r2 * r2);
  const O1 = g.O1 as Point, O2 = g.O2 as Point, O = g.O as Point;
  const dLeft = dist(main, O1), dRight = dist(main, O2), dBig = dist(main, O);
  const Gp = g.G as Point, H = g.H as Point;
  const GH = dist(Gp, H);
  const ghOverAB = GH / L;
  const predicted = k / (1 + k + k * k);
  return {
    ratio: round(k),
    radii: { r1: round(r1), r2: round(r2), bigR: round(R) },
    touchingCircle: {
      radius: round(rho),
      formulaRadius: round(formula),
      matchesFormula: close(rho, formula),
      centre: pt(main),
      centreHeightAboveAB: round(baseY - main.y),
      centreIsTwoRhoAboveAB: close(baseY - main.y, 2 * rho),
      tangencies: {
        distanceToLeftCentre: round(dLeft),
        distanceToRightCentre: round(dRight),
        distanceToBigCentre: round(dBig),
        expected: {
          r1_plus_rho: round(r1 + rho),
          r2_plus_rho: round(r2 + rho),
          R_minus_rho: round(R - rho),
        },
        touchesAllThree:
          close(dLeft, r1 + rho) && close(dRight, r2 + rho) && close(dBig, R - rho),
      },
    },
    diameter: { G: pt(Gp), H: pt(H), GH: round(GH) },
    width: {
      GH_over_AB: round(ghOverAB, 8),
      formula_k_over_1_plus_k_plus_k2: round(predicted, 8),
      matchesFormula: close(ghOverAB, predicted),
      sixNineteenthsWhenThreeToTwo: close(k, 1.5) ? close(ghOverAB, 6 / 19) : null,
    },
  };
}

/** AN, NP and PB as a continued proportion, plus the core's claim checks. */
function proportionReading(g: Geometry, claims: Claims) {
  const k = g.ratio as number, L = g.L as number;
  const A = g.A as Point, B = g.B as Point;
  const N = g.N as Point, P = g.P as Point;
  const AN = N.x - A.x, NP = P.x - N.x, PB = B.x - P.x;
  const GH = dist(g.G as Point, g.H as Point);
  const anOverNp = NP > 0 ? AN / NP : NaN;
  const npOverPb = PB > 0 ? NP / PB : NaN;
  return {
    ratio: round(k),
    baselineParts: { AN: round(AN), NP: round(NP), PB: round(PB) },
    scaledByPB: PB > 0
      ? { BP: 1, PN: round(NP / PB), NA: round(AN / PB) }
      : null,
    expectedScaled: { BP: 1, PN: round(k), NA: round(k * k) },
    continuedProportion: {
      AN_over_NP: Number.isFinite(anOverNp) ? round(anOverNp, 8) : null,
      NP_over_PB: Number.isFinite(npOverPb) ? round(npOverPb, 8) : null,
      bothEqualK: close(anOverNp, k) && close(npOverPb, k),
      NP_squared: round(NP * NP),
      AN_times_PB: round(AN * PB),
      NP_is_mean_proportional: close(NP * NP, AN * PB),
    },
    GH: round(GH),
    NP: round(NP),
    GH_equals_NP: close(GH, NP),
    GH_over_AB: round(GH / L, 8),
    formula_k_over_1_plus_k_plus_k2: round(k / (1 + k + k * k), 8),
    sixNineteenthsWhenThreeToTwo: close(k, 1.5) ? close(GH / L, 6 / 19) : null,
    claims,
  };
}

export function actions(): GameActions {
  return {
    tangent_circle: {
      describe:
        "For a split point C of an arbelos (AB the big diameter, smaller semicircles on AC and CB), give ratio k = AC/CB, or t = AC/AB, or an absolute x on the board; A and B may be given as points to override the board's baseline. Report the circle tangent to all three semicircles: its radius rho = r1*r2*(r1+r2)/(r1^2 + r1*r2 + r2^2) with r1 = AC/2, r2 = CB/2, checked against the core, its centre exactly 2*rho above AB, the three tangency distances (r1+rho, r2+rho, R-rho), and its horizontal diameter GH. GH/AB = k/(1+k+k^2), which is 6/19 when k = 3/2.",
      args: '{ "ratio": 1.5 }',
      run: (args) => {
        const { g } = fromArgs(args);
        const r = circleReading(g);
        return {
          C: pt(g.C as Point),
          ...r,
          note: `At x = ${pt(g.C as Point).x} the split is AC/CB = ${r.ratio}, so r1 = ${r.radii.r1} and r2 = ${r.radii.r2}. The tangent circle has radius rho = ${r.touchingCircle.radius}, its centre is ${r.touchingCircle.centreHeightAboveAB} above AB (= 2*rho), and it touches all three arcs (${r.touchingCircle.tangencies.touchesAllThree}). Its width GH = ${r.diameter.GH} gives GH/AB = ${r.width.GH_over_AB} = ${r.width.formula_k_over_1_plus_k_plus_k2} = k/(1+k+k^2)${r.width.sixNineteenthsWhenThreeToTwo === true ? " = 6/19" : ""}.`,
        };
      },
    },
    continued_proportion: {
      describe:
        "For the same split point C (accepts ratio, t, x and optional A/B as in tangent_circle), drop G and H straight down to the baseline at N and P. Report AN, NP and PB and check that they form a continued proportion AN:NP = NP:PB = k = AC/CB, so BP:PN:NA = 1:k:k^2 and NP^2 = AN*PB. Also check GH = NP and GH/AB = k/(1+k+k^2), and return every claim on the page as checked by the core.",
      args: '{ "t": 0.6 }',
      run: (args) => {
        const { g, claims } = fromArgs(args);
        const r = proportionReading(g, claims);
        const scaled = r.scaledByPB;
        return {
          C: pt(g.C as Point),
          ...r,
          note: `With C at x = ${pt(g.C as Point).x}, AC/CB = ${r.ratio} and the base is cut into AN = ${r.baselineParts.AN}, NP = ${r.baselineParts.NP}, PB = ${r.baselineParts.PB}. Dividing by PB gives ${scaled ? `${scaled.BP} : ${scaled.PN} : ${scaled.NA}` : "no ratio"} against the expected 1 : ${r.expectedScaled.PN} : ${r.expectedScaled.NA}; NP^2 = ${r.continuedProportion.NP_squared} equals AN*PB = ${r.continuedProportion.AN_times_PB}. GH = ${r.GH} equals NP, so GH/AB = ${r.GH_over_AB} = k/(1+k+k^2)${r.sixNineteenthsWhenThreeToTwo === true ? " = 6/19" : ""}.`,
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of the same drawing. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported BOL6 state version ${stateVersion}`);

  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const Cc = readPoint(state.C, "C");
  const seed = C.start({ points: { A, B, C: Cc } });
  const normalized = C.withPoint(seed, "C", Cc);
  const g = C.geometry(normalized) as Geometry;
  if (g.degenerate) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved A, C, B do not make an arbelos: C must lie between A and B on the baseline.",
    };
  }

  const circle = circleReading(g);
  const proportion = proportionReading(g, C.claims(normalized) as Claims);
  const coreA = pt(g.A as Point), coreB = pt(g.B as Point), coreC = pt(g.C as Point);
  const matches = (p: Point, q: Point): boolean =>
    close(p.x, q.x) && close(p.y, q.y);

  return {
    ...state,
    stateVersion,
    valid: true,
    // The fields the page saved with Track.state, with the same names.
    A,
    B,
    C: Cc,
    savedMatchesCore: matches(A, coreA) && matches(B, coreB) && matches(Cc, coreC),
    // What the same core adds about this position.
    core: {
      A: coreA,
      B: coreB,
      C: coreC,
      AB: round(g.L as number),
      AC: round((g.c as number)),
      CB: round((g.L as number) - (g.c as number)),
      ratio: circle.ratio,
      radii: circle.radii,
      touchingCircle: circle.touchingCircle,
      diameter: circle.diameter,
      width: circle.width,
      baselineParts: proportion.baselineParts,
      scaledByPB: proportion.scaledByPB,
      expectedScaled: proportion.expectedScaled,
      continuedProportion: proportion.continuedProportion,
      GH_equals_NP: proportion.GH_equals_NP,
      claims: proportion.claims,
    },
    note: `C is at x = ${coreC.x} on AB, so AC/CB = ${circle.ratio}. The circle touching all three semicircles has radius rho = ${circle.touchingCircle.radius} with centre ${circle.touchingCircle.centre.x}, ${circle.touchingCircle.centre.y} (2*rho above AB); GH = ${circle.diameter.GH} drops to NP = ${proportion.NP}, and AN:NP:PB = ${proportion.baselineParts.AN}:${proportion.baselineParts.NP}:${proportion.baselineParts.PB} are in continued proportion, giving GH/AB = ${circle.width.GH_over_AB}.`,
  };
}
