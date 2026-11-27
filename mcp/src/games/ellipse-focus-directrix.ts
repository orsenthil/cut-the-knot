/*
 * run_game_logic actions and saved-position reader for Focus and Directrix of
 * Ellipse.
 *
 * The real core is ellipse-focus-directrix/ellipse-focus-directrix-core.js,
 * copied into src/generated/cores/ at build time. It keeps the four rectangle
 * corners and the eccentric angle of P, then computes the two foci, the chosen
 * focus/directrix pair and the little measuring triangle: for a point P on the
 * ellipse the ratio PF / PD equals the eccentricity c/a, which is below 1.
 * Every number below is measured by that core, not looked up. This is the ratio
 * picture; the sibling EllipseFocal instead shows the constant sum PF + PF'.
 * See _shared.ts for the module shape. Coordinates are board units in the
 * applet's 400 x 300 canvas, y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["ellipse-focus-directrix"].EllipseFocusDirectrixCore;

type Pt = { x: number; y: number };
const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const pt = (p: any): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Tool points may be [x, y]; saved Track.state points are { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readPoints(v: unknown, count: number, label: string): Pt[] {
  if (!Array.isArray(v) || v.length !== count) {
    throw new Error(`"${label}" must be exactly ${count} points`);
  }
  return v.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** A short, capped list of eccentric angles at which to measure P. */
function readAngles(v: unknown): number[] {
  if (v === undefined || v === null) return [0.4, 1.3, 2.2, 3.1, 4.0, 5.5];
  if (!Array.isArray(v)) throw new Error('"angles" must be an array of numbers');
  if (v.length === 0 || v.length > 24) throw new Error('"angles" must have between 1 and 24 entries');
  return v.map((x, i) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error(`angles[${i}] is not a number`);
    return n;
  });
}

type Built = { C: any; state: any; a: number; b: number; e: number };

/**
 * A real core position from tool arguments. Corners default to the applet's
 * opening rectangle; P may be fixed by an eccentric angle or by a point that
 * the core projects onto the curve. A near-circle is rejected because the
 * applet itself stops recomputing its focus and directrix there.
 */
function build(args: Json): Built {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0 && height > 0)) throw new Error('"width" and "height" must be positive');
  const margin = num(args, "margin", C.MARGIN);
  let s: any = C.start({ width, height, margin });
  if (args.corners !== undefined && args.corners !== null) {
    s = Object.assign({}, s, { corners: readPoints(args.corners, 4, "corners") });
  }
  if (args.angle !== undefined && args.angle !== null && args.point !== undefined && args.point !== null) {
    throw new Error('give "angle" or "point", not both');
  }
  if (args.point !== undefined && args.point !== null) {
    s = C.setPoint(s, readPoint(args.point, "point"));
  } else if (args.angle !== undefined && args.angle !== null) {
    s = Object.assign({}, s, { theta: num(args, "angle") });
  }
  const h = C.halfAxes(s);
  const a = Math.abs(h.a), b = Math.abs(h.b);
  if (!(a > 0 && b > 0)) {
    throw new Error('"corners" must span a non-degenerate ellipse (both half-axes positive)');
  }
  if (Math.abs(2 * a - 2 * b) < C.EARLY_RETURN) {
    throw new Error('"corners" are almost a circle: the applet stops recomputing focus and directrix when |2a − 2b| < 1 pixel');
  }
  const big = Math.max(a, b), small = Math.min(a, b);
  const e = Math.sqrt(big * big - small * small) / big;
  return { C, state: s, a, b, e };
}

/** The core's Compute() reading for the current P, as plain data. */
function measured(C: any, s: any) {
  const r = C.compute(s);
  if (!r) return null;
  return {
    orientation: r.orientation as string,
    P: pt(r.P), focus: pt(r.focus), foci: (r.foci as any[]).map(pt), foot: pt(r.foot),
    directrix: [pt(r.directrix[0]), pt(r.directrix[1])],
    PF: round(r.focusDist), PD: round(r.directDist), ratio: round(r.ratio, 6),
    eccentricity: round(r.eccentricity, 6),
    c: round(r.c), halfMajor: round(r.halfMajor), halfMinor: round(r.halfMinor), leg: round(r.leg),
  };
}

/** The two focus/directrix pairs, with the axis-to-directrix right angle checked. */
function pairRows(C: any, state: any) {
  const center = state.center as Pt;
  return (C.pairs(state) as any[]).map((p, i) => {
    const axis = { x: p.focus.x - center.x, y: p.focus.y - center.y };
    const dir = { x: p.directrix[1].x - p.directrix[0].x, y: p.directrix[1].y - p.directrix[0].y };
    const dot = axis.x * dir.x + axis.y * dir.y;
    const centerToLine = C.dist(center, C.nearestOnLine(center, p.directrix[0], p.directrix[1]));
    return {
      pair: i + 1,
      focus: pt(p.focus),
      directrix: [pt(p.directrix[0]), pt(p.directrix[1])],
      eccentricity: round(p.e, 6),
      focalAxisDirection: { x: round(axis.x), y: round(axis.y) },
      directrixDirection: { x: round(dir.x), y: round(dir.y) },
      axisDotDirectrix: round(dot, 6),
      perpendicular: Math.abs(dot) < 1e-9,
      focusInsideDirectrix: C.dist(p.focus, center) < centerToLine,
    };
  });
}

export function actions(): GameActions {
  return {
    ratio_and_eccentricity: {
      describe:
        "Build the ellipse from four rectangle corners (or the opening rectangle) and drop P's perpendicular to the matching directrix; `angles` (1–24 eccentric angles) slides P around the curve. At every sampled point the core should give PF / PD equal to the eccentricity c/a, which is less than 1; it also reports PF + PF' = 2a to show that this is the ratio picture, unlike the sibling EllipseFocal's constant-sum picture.",
      args: '{ "angles": [0.4, 1.3, 2.2, 3.1, 4.0, 5.5] }',
      run: (args) => {
        const { C, state, a, b, e } = build(args);
        const angles = readAngles(args.angles);
        const atStart = measured(C, state);
        const focalSum = 2 * Math.max(a, b);
        const samples = angles.map((angle) => {
          const r = C.compute(Object.assign({}, state, { theta: angle }));
          if (!r) return { angle: round(angle, 6), PF: null, PD: null, ratio: null };
          const sum = (C.foci(state) as any[]).reduce((acc, f) => acc + C.dist(f, r.P), 0);
          return {
            angle: round(angle, 6), P: pt(r.P),
            PF: round(r.focusDist), PD: round(r.directDist), ratio: round(r.ratio, 6),
            eccentricity: round(r.eccentricity, 6), focalSum: round(sum),
          };
        });
        const usable = samples.filter((s) => s.ratio !== null);
        const ratioHolds = usable.length === samples.length &&
          usable.every((s) => Math.abs((s.ratio as number) - e) < 1e-5);
        const sumHolds = usable.length > 0 && usable.every((s) =>
          Math.abs((s.focalSum as number) - focalSum) < 1e-3);
        return {
          ...(atStart ?? {}),
          halfAxes: { a: round(a), b: round(b) },
          majorAxis: a >= b ? "horizontal" : "vertical",
          eccentricity: round(e, 6),
          eccentricityBelowOne: e < 1,
          constantFocalSum: round(focalSum),
          samples,
          ratioConstantAcrossPoints: ratioHolds,
          focalSumConstantAcrossPoints: sumHolds,
          note:
            "For every sampled P the red length PF divided by the grey length PD is the same number, the eccentricity e = c/a < 1: that is the focus/directrix definition of this ellipse. The two focal distances also add to 2a at each point, the property shown instead by the sibling EllipseFocal — both statements describe the same curve, but this applet draws the ratio.",
        };
      },
    },

    two_focus_directrix_pairs: {
      describe:
        "Report both focus/directrix pairs of the same ellipse: each focus, its matching directrix line and their common eccentricity below 1. The focal axis runs through the two foci; the dot product of its direction with each directrix's direction is checked to be zero, so both directrices meet it at right angles.",
      args: '{ "corners": [[105, 200], [295, 200], [295, 100], [105, 100]] }',
      run: (args) => {
        const { C, state, e } = build(args);
        const pairs = pairRows(C, state);
        if (pairs.length === 0) throw new Error("the ellipse has no focus/directrix pair (its foci coincide)");
        return {
          center: pt(state.center),
          pairs,
          count: pairs.length,
          commonEccentricity: round(e, 6),
          bothEccentricitiesBelowOne: pairs.every((p) => p.eccentricity < 1),
          sameEccentricity: pairs.length > 0 &&
            pairs.every((p) => Math.abs(p.eccentricity - pairs[0].eccentricity) < 1e-9),
          focalAxisPerpendicularToBothDirectrices: pairs.every((p) => p.perpendicular),
          note:
            "An ellipse has two foci and two directrices, one line matching each focus, and both pairs share the same eccentricity e = c/a < 1. The focal axis joins the foci, and each directrix is perpendicular to that axis, so its whole line stands at a right angle to the line through the foci.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh reading of that picture by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Ellipse Focus and Directrix state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Ellipse Focus and Directrix position must be an object");
  }
  const C = core();
  const saved = {
    width: state.width, height: state.height, margin: state.margin,
    center: pt(state.center),
    corners: Array.isArray(state.corners) ? state.corners.map((p: unknown) => pt(p)) : null,
    theta: state.theta,
    showOther: state.showOther === true,
  };
  let here: any;
  try {
    const width = num(state, "width", C.WIDTH);
    const height = num(state, "height", C.HEIGHT);
    if (!(width > 0 && height > 0)) throw new Error('"width" and "height" must be positive');
    const margin = num(state, "margin", C.MARGIN);
    const center = readPoint(state.center, "center");
    const corners = readPoints(state.corners, 4, "corners");
    const theta = num(state, "theta", C.start({}).theta);
    here = { width, height, margin, center, corners, theta, showOther: state.showOther === true };
  } catch (err) {
    return {
      stateVersion, valid: false, saved,
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs a centre, four rectangle corners and a point angle in the applet's 400 by 300 board units.",
    };
  }
  const r = measured(C, here);
  const pairs = pairRows(C, here);
  return {
    stateVersion, valid: true, saved,
    ...(r ?? {}),
    reading: r,
    P: r ? r.P : pt(C.pointAt(here)),
    pairs,
    eccentricityBelowOne: pairs.length > 0 ? pairs.every((p) => p.eccentricity < 1) : null,
    focalAxisPerpendicularToBothDirectrices: pairs.length === 2 ? pairs.every((p) => p.perpendicular) : null,
    status: C.describe(here, C.compute(here)),
    note: r
      ? "Track.state saved the four rectangle corners, the centre, the board size and the eccentric angle of P; the core rebuilds P on the ellipse and measures PF, PD and their ratio, which equals the eccentricity below 1. The two focus/directrix pairs and their right angles come from the same saved picture."
      : "The saved rectangle is almost a circle, so the applet's Compute() stops early and keeps its last picture; the core still places P on the ellipse from the saved corners and angle.",
  };
}
