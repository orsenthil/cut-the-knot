/*
 * run_game_logic actions and saved-position reader for Ellipse Between Circles.
 *
 * The real core is ellipse-between-circles/ellipse-between-circles-core.js,
 * copied into src/generated/cores/ at build time. Its compute() makes the two
 * given circles from the horizontal diameters AB and DC, then picks the point
 * of the ellipse with those two centres as foci whose long axis is the sum of
 * their radii. The new circle gets the radius that makes it touch the small
 * circle from outside; because its centre is on that ellipse it also touches
 * the large circle from inside. This module only measures that core's own
 * points: the axes of the locus and the two tangency equations. It is a demo,
 * so there is no win or loss, only a saved slider and two handle points.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Point { x: number; y: number; }
interface Circle extends Point { r: number; }
interface Rect { x: number; y: number; w: number; h: number; }
interface State { slider: number; d: Point; c: Point; moves: number; explored: boolean; }
interface Geometry {
  x: number; y: number; r: number; rect: Rect; product: number;
  a: number; h: number; mx: number; sum: number; dx: number; fallback: boolean;
  t: number; probeX: number; big: Circle; small: Circle;
  A: Point; B: Point; D: Point; C: Point; centre: Point;
}
interface EllipseCore {
  W: number; H: number; STAY: number;
  SLIDER_MIN: number; SLIDER_MAX: number; SLIDER_DEFAULT: number;
  start(options?: { slider?: number; d?: Point; c?: Point }): State;
  setSlider(state: State, value: number): State;
  compute(state: State): Geometry;
  status(state: State, g: Geometry): string;
  result(state: State): string | null;
  dist(p: Point, q: Point): number;
}

const core = (): EllipseCore =>
  cores["ellipse-between-circles"].EllipseBetweenCirclesCore as unknown as EllipseCore;

const r6 = (v: number): number => Number(v.toFixed(6));
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const circleView = (c: Circle): Circle => ({ x: r6(c.x), y: r6(c.y), r: r6(c.r) });
const rectView = (b: Rect): Rect => ({
  x: r6(b.x), y: r6(b.y), w: r6(b.w), h: r6(b.h),
});

/** An integer option, checked against the applet's own 0..101 scrollbar. */
function intIn(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = Math.trunc(num(args, key, fallback));
  if (!Number.isFinite(v) || v < lo || v > hi) {
    throw new Error(`"${key}" must be an integer between ${lo} and ${hi}`);
  }
  return v;
}

/** A handle's x-coordinate, given as a number, [x, y] or { x, y } (y is ignored by the core). */
function readHandle(value: unknown, label: string, stay: number): Point | null {
  if (value === undefined || value === null) return null;
  let x: number;
  let y = stay;
  if (typeof value === "number") {
    x = value;
  } else if (Array.isArray(value) && value.length >= 1) {
    x = Number(value[0]);
    if (value.length >= 2 && Number.isFinite(Number(value[1]))) y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x);
    if (o.y !== undefined && Number.isFinite(Number(o.y))) y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be an x-coordinate or a point { x, y }`);
  }
  if (!Number.isFinite(x)) throw new Error(`"${label}" needs a finite x-coordinate`);
  return { x, y };
}

/** A finite point, circle or rectangle from a saved field; null when absent. */
function readPoint(value: unknown, label: string): Point | null {
  if (value === undefined || value === null) return null;
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be a point { x, y } or [x, y]`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite x and y`);
  }
  return { x, y };
}

function readCircle(value: unknown, label: string): Circle | null {
  const p = readPoint(value, label);
  if (!p) return null;
  const r = Number((value as Json).r);
  if (!Number.isFinite(r)) throw new Error(`"${label}" needs a finite radius r`);
  return { ...p, r };
}

function readRect(value: unknown, label: string): Rect | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be a rectangle { x, y, w, h }`);
  }
  const o = value as Json;
  const rect = { x: Number(o.x), y: Number(o.y), w: Number(o.w), h: Number(o.h) };
  if (!Object.values(rect).every(Number.isFinite)) {
    throw new Error(`"${label}" needs finite x, y, w and h`);
  }
  return rect;
}

function readRadius(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('"radius" must be a finite number');
  return n;
}

const TOL = 1e-7;
const holds = (v: number | null): boolean => v !== null && Math.abs(v) < TOL;
const near = (a: number | null | undefined, b: number): boolean =>
  a !== null && a !== undefined && Math.abs(a - b) < 1e-6;

function samePoint(a: Point | null, b: Point): boolean | null {
  return a === null ? null : near(a.x, b.x) && near(a.y, b.y);
}
function sameCircle(a: Circle | null, b: Circle): boolean | null {
  return a === null ? null : samePoint(a, b) === true && near(a.r, b.r);
}
function sameRect(a: Rect | null, b: Rect): boolean | null {
  return a === null ? null :
    near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);
}

function stateFromArgs(args: Json): State {
  const C = core();
  const slider = intIn(args, "slider", C.SLIDER_DEFAULT, C.SLIDER_MIN, C.SLIDER_MAX);
  const d = readHandle(args.d, "d", C.STAY);
  const c = readHandle(args.c, "c", C.STAY);
  return C.start({ slider, ...(d ? { d } : {}), ...(c ? { c } : {}) });
}

/** The locus and the two tangency equations, all measured from the core's picture. */
function reading(C: EllipseCore, g: Geometry) {
  const distBig = C.dist(g.centre, g.big);
  const distSmall = C.dist(g.centre, g.small);
  const insideBig = distBig + g.r - g.big.r;
  const outsideSmall = distSmall - g.r - g.small.r;
  const sumResidual = distBig + distSmall - g.sum;
  const ellipseResidual = g.a > 0 && g.h > 0
    ? ((g.centre.x - g.mx) / g.a) ** 2 + ((g.centre.y - g.big.y) / g.h) ** 2 - 1
    : null;
  return {
    givenCircles: { big: circleView(g.big), small: circleView(g.small) },
    ellipse: {
      foci: [pt(g.big), pt(g.small)],
      centre: { x: r6(g.mx), y: r6(g.big.y) },
      semiMajor: r6(g.a),
      semiMinor: r6(g.h),
      majorAxis: r6(g.sum),
      minorAxis: r6(2 * g.h),
      boundingBox: rectView(g.rect),
      equation: `((x - ${r6(g.mx)})/${r6(g.a)})² + ((y - ${r6(g.big.y)})/${r6(g.h)})² = 1`,
    },
    newCircle: { centre: pt(g.centre), radius: r6(g.r) },
    tangency: {
      insideBig: {
        distance: r6(distBig), bigRadiusMinusRho: r6(g.big.r - g.r),
        residual: r6(insideBig),
      },
      outsideSmall: {
        distance: r6(distSmall), smallRadiusPlusRho: r6(g.small.r + g.r),
        residual: r6(outsideSmall),
      },
      distanceSum: r6(distBig + distSmall),
      majorAxis: r6(g.sum),
      sumResidual: r6(sumResidual),
      allHold: holds(insideBig) && holds(outsideSmall) && holds(sumResidual),
    },
    ellipseResidual: ellipseResidual === null ? null : r6(ellipseResidual),
    centreOnEllipse: holds(ellipseResidual),
    branch: g.fallback ? "applet endpoint fallback" : (g.t > 0 ? "upper half" : "lower half"),
  };
}

export function actions(): GameActions {
  return {
    locus_and_tangency: {
      describe:
        "Place the third circle for a slider value (integer 0–101, default 20) and optional small-circle endpoints d and c (each an x-coordinate or {x,y} point on the applet's 400×250 board; y is fixed by the applet). Reports the ellipse its centre lies on — foci at the two given centres, long axis R+r and short axis 2h where h² = ((R+r)/2)² − (foci separation/2)² — and checks the tangency equations dist(centre,big) = R−ρ and dist(centre,small) = r+ρ.",
      args: '{ "slider": 20, "d": { "x": 15, "y": 230 }, "c": { "x": 263.33333333333337, "y": 230 } }',
      run: (args) => {
        const C = core();
        const s = stateFromArgs(args);
        const g = C.compute(s);
        return {
          slider: s.slider,
          t: r6(g.t),
          probeX: r6(g.probeX),
          handles: { d: pt(s.d), c: pt(s.c) },
          ...reading(C, g),
          status: C.status(s, g),
          note:
            "The new circle sits inside the large one and outside the small one, so its centre P satisfies |PB| = R−ρ and |PS| = r+ρ. Adding cancels ρ and leaves |PB|+|PS| = R+r, the constant sum that makes P an ellipse with foci B and S and long axis R+r. The applet takes the x from the slider, solves that ellipse for y, then sets ρ from the small circle; the same ρ touches the large circle because the point is on the locus.",
        };
      },
    },

    slider_sweep: {
      describe:
        "Sweep the real core through every slider value 0–101 (with the same optional d and c as locus_and_tangency) and check the picture at each one: the centre must stay on the ellipse and the circle tangent to both given circles, including the positions where the applet falls back to an endpoint of the long axis. Reports the worst residuals, the fallback values and a few sample circles.",
      args: '{ "d": { "x": 15, "y": 230 }, "c": { "x": 263.33333333333337, "y": 230 } }',
      run: (args) => {
        const C = core();
        const s0 = stateFromArgs(args);
        const g0 = C.compute(s0);
        let worstTangency = 0;
        let worstEllipse = 0;
        const fallbacks: number[] = [];
        const samples: Json[] = [];
        for (let v = C.SLIDER_MIN; v <= C.SLIDER_MAX; v++) {
          const s = C.setSlider(s0, v);
          const g = C.compute(s);
          const distBig = C.dist(g.centre, g.big);
          const distSmall = C.dist(g.centre, g.small);
          worstTangency = Math.max(
            worstTangency,
            Math.abs(distBig + g.r - g.big.r),
            Math.abs(distSmall - g.r - g.small.r),
            Math.abs(distBig + distSmall - g.sum),
          );
          if (g.a > 0 && g.h > 0) {
            worstEllipse = Math.max(worstEllipse, Math.abs(
              ((g.centre.x - g.mx) / g.a) ** 2 + ((g.centre.y - g.big.y) / g.h) ** 2 - 1,
            ));
          }
          if (g.fallback) fallbacks.push(v);
          if (v % 20 === 0 || v === C.SLIDER_MAX) {
            samples.push({
              slider: v,
              centre: pt(g.centre),
              radius: r6(g.r),
              branch: g.fallback ? "applet endpoint fallback" : (g.t > 0 ? "upper half" : "lower half"),
            });
          }
        }
        return {
          sliderRange: { min: C.SLIDER_MIN, max: C.SLIDER_MAX },
          handles: { d: pt(s0.d), c: pt(s0.c) },
          axes: {
            majorAxis: r6(g0.sum),
            minorAxis: r6(2 * g0.h),
            foci: [pt(g0.big), pt(g0.small)],
          },
          positionsChecked: C.SLIDER_MAX - C.SLIDER_MIN + 1,
          fallbackPositions: fallbacks,
          worstTangencyResidual: r6(worstTangency),
          worstEllipseResidual: r6(worstEllipse),
          allTangent: worstTangency < TOL,
          allCentresOnEllipse: worstEllipse < TOL,
          samples,
          status: C.status(s0, g0),
          note:
            "Every slider value maps to T = v/100 and x = 10 + |T|·380. When that x passes the end of the ellipse the square root stops being real and the applet places the circle at an end of the long axis; the tangency equations still hold there, so the sum of distances to the two centres remains R+r at all 102 settings.",
        };
      },
    },
  };
}

/** Track.state saves the slider, the two handles and the derived picture; echo them and re-read with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Ellipse Between Circles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Ellipse Between Circles position must be an object");
  }
  const C = core();
  try {
    const slider = intIn(state, "slider", C.SLIDER_DEFAULT, C.SLIDER_MIN, C.SLIDER_MAX);
    const savedD = readHandle(state.d, "d", C.STAY);
    const savedC = readHandle(state.c, "c", C.STAY);
    const savedBig = readCircle(state.big, "big");
    const savedSmall = readCircle(state.small, "small");
    const savedCentre = readPoint(state.centre, "centre");
    const savedRadius = readRadius(state.radius);
    const savedRect = readRect(state.ellipse, "ellipse");

    const s = C.start({
      slider,
      ...(savedD ? { d: savedD } : {}),
      ...(savedC ? { c: savedC } : {}),
    });
    const g = C.compute(s);
    const readingHere = reading(C, g);
    return {
      stateVersion,
      valid: true,
      saved: {
        slider,
        d: savedD ? pt(savedD) : null,
        c: savedC ? pt(savedC) : null,
        big: savedBig ? circleView(savedBig) : null,
        small: savedSmall ? circleView(savedSmall) : null,
        centre: savedCentre ? pt(savedCentre) : null,
        radius: savedRadius === null ? null : r6(savedRadius),
        ellipse: savedRect ? rectView(savedRect) : null,
      },
      ...readingHere,
      savedMatchesCore: {
        big: sameCircle(savedBig, g.big),
        small: sameCircle(savedSmall, g.small),
        centre: samePoint(savedCentre, g.centre),
        radius: near(savedRadius, g.r),
        ellipse: sameRect(savedRect, g.rect),
      },
      status: C.status(s, g),
      result: C.result(s),
      note:
        "Track.state saved the slider, the two draggable endpoints and the derived circles, centre, radius and ellipse in the applet's 400×250 board units. The core rebuilds the whole picture from the slider and the two handles, so each saved derived field can be checked against what it actually draws; the new centre lies on the ellipse with foci at the two given centres and long axis R+r.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note:
        "A readable position needs an integer slider from 0 to 101, two finite handle points and finite derived big/small circles, centre, radius and ellipse rectangle.",
    };
  }
}
