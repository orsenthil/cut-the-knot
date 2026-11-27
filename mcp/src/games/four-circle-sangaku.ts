/*
 * run_game_logic actions and saved-position reader for Four Circle Sangaku.
 *
 * AB is a diameter of a circle centred at O. C is a point on that circle and
 * D is its reflection in AB. The upper circle is the incircle of triangle ABC;
 * the left and right circles sit on the other side of AB, each touching AB and
 * the large circle internally. The sangaku identity is that the incircle's
 * radius is the mean of the other two, r = (rL + rR)/2. The vertical lines
 * through the two outer centres are tangent to the incircle, and their feet
 * S, T on AB together with the foot W of the incircle centre satisfy
 * ST = 2r and SW = TW = r, so W is the midpoint of ST.
 *
 * Every number below is measured on the real core
 * four-circle-sangaku/four-circle-sangaku-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are the page's board units
 * (400 x 260 by default, y down). This is a drawing: there is no win or loss,
 * and Track.state saves only C, its angle, the radius and the two flags.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type State = {
  width: number; height: number; center: Pt; radius: number; angle: number;
  C: Pt; showNames: boolean; showHint: boolean;
};
type Diagram = {
  A: Pt; B: Pt; C: Pt; K: Pt; D: Pt; O: Pt;
  circle: Circle; upper: Circle; right: Circle; left: Circle;
  uPoint: Pt; vPoint: Pt; wPoint: Pt; sPoint: Pt; tPoint: Pt;
  r: number; rR: number; rL: number; d: number;
};
type Core = {
  START_ANGLE: number; TOO_CLOSE: number;
  start(options?: Json): State;
  moveC(s: State, p: Pt): State;
  compute(s: State): Diagram | null;
  position(s: State): Json;
  distance(p: Pt, q: Pt): number;
};

const core = (): Core =>
  cores["four-circle-sangaku"].FourCircleSangakuCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Keep the sign and size of a near-zero residual rather than printing 0. */
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : round(v, 9);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const close = (a: number, b: number, scale = 1): boolean =>
  Math.abs(a - b) <= 1e-7 * Math.max(1, scale);

/** Read a point from the tutor's [x, y] or from the page's { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(v)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** A finite value, with a flag saying whether the page actually saved it. */
function readFinite(v: unknown, fallback: number): [number, boolean] {
  if (v === undefined || v === null) return [fallback, false];
  const n = Number(v);
  return Number.isFinite(n) ? [n, true] : [fallback, false];
}

/** Build a core state: a drag point overrides an angle, as on the page. */
function buildState(C: Core, args: Json): State {
  const seed = C.start();
  const width = num(args, "width", seed.width);
  const height = num(args, "height", seed.height);
  if (!(width >= 3) || !(height >= 3)) {
    throw new Error("width and height must be at least 3 board units so the large circle has a positive radius");
  }
  const angle = num(args, "angle", seed.angle);
  let s = C.start({
    width, height, angle,
    showNames: args.showNames === true,
    showHint: args.showHint === true,
  });
  if (args.C !== undefined && args.C !== null) s = C.moveC(s, readPoint(args.C, "C"));
  return s;
}

/** The one diagram the applet refuses: C within one unit of A. */
function diagramOf(C: Core, s: State): Diagram {
  const g = C.compute(s);
  if (!g) {
    throw new Error(
      "C is within one unit of A, where the applet holds the previous picture; " +
      "choose another angle or drag point.",
    );
  }
  if (![g.r, g.rR, g.rL].every(Number.isFinite) || Math.min(g.r, g.rR, g.rL) <= 0) {
    throw new Error("C is at B and the triangle has collapsed; choose an angle away from the diameter's ends.");
  }
  return g;
}

/** All the measurements a tutor needs, each taken from the real core. */
function reading(C: Core, s: State, g: Diagram) {
  const { r, rR, rL } = g;
  const average = (rR + rL) / 2;
  const leftX = g.left.center.x, rightX = g.right.center.x;
  const incircleX = g.upper.center.x, incircleR = g.upper.radius;
  const leftDistance = Math.abs(leftX - incircleX);
  const rightDistance = Math.abs(rightX - incircleX);
  const S = g.sPoint.x, T = g.tPoint.x, W = g.wPoint.x;
  const ST = T - S, SW = W - S, TW = T - W;
  const scale = Math.max(1, s.radius);
  return {
    board: { width: s.width, height: s.height },
    center: pt(s.center),
    bigCircleRadius: s.radius,
    C: pt(s.C),
    angle: round(s.angle, 9),
    angleDegrees: round(s.angle * 180 / Math.PI, 3),
    A: pt(g.A), B: pt(g.B), K: pt(g.K), D: pt(g.D),
    footOffset: round(g.d), // K.x - O.x
    circles: {
      incircle: { center: pt(g.upper.center), radius: round(r) },
      left: { center: pt(g.left.center), radius: round(rL) },
      right: { center: pt(g.right.center), radius: round(rR) },
    },
    radiusIdentity: {
      statement: "r = (rL + rR) / 2",
      incircle: round(r), left: round(rL), right: round(rR),
      average: round(average),
      residual: sig(r - average),
      holds: close(r, average, scale),
    },
    tangentLines: {
      leftX: round(leftX), rightX: round(rightX),
      distancesFromIncenter: {
        left: round(leftDistance), right: round(rightDistance), radius: round(incircleR),
      },
      touchPoints: { U: pt(g.uPoint), V: pt(g.vPoint) },
      residuals: {
        leftMinusR: sig(leftDistance - r), rightMinusR: sig(rightDistance - r),
        UminusLeftX: sig(g.uPoint.x - leftX), VminusRightX: sig(g.vPoint.x - rightX),
      },
      tangent: close(leftDistance, r, scale) && close(rightDistance, r, scale),
      touchesAtUAndV: close(g.uPoint.x, leftX, scale) && close(g.vPoint.x, rightX, scale),
    },
    base: {
      statement: "ST = 2r, SW = TW = r",
      S: pt(g.sPoint), T: pt(g.tPoint), W: pt(g.wPoint),
      ST: round(ST), SW: round(SW), TW: round(TW), twoR: round(2 * r),
      residuals: {
        STminus2r: sig(ST - 2 * r), SWminusr: sig(SW - r), TWminusr: sig(TW - r),
      },
      holds: close(ST, 2 * r, scale) && close(SW, r, scale) && close(TW, r, scale),
    },
  };
}

export function actions(): GameActions {
  const example = '{ "angle": -1.146304168051372, "width": 400, "height": 260 }';
  return {
    sangaku_radii: {
      describe:
        "Put C at `angle` radians on the large circle and run the real core; optional `width`, `height` set the board, and `C` as [x, y] or { x, y } drags C instead (the core projects the point onto the circle as the page's handle does). Reports A, B, K (the foot of C on AB), D (its reflection) and the three radii: r for the incircle of ABC, rL and rR for the two circles tangent to AB on the far side. Checks the sangaku identity r = (rL + rR)/2: C can move anywhere on the circle, yet the incircle radius stays the average of the outer two.",
      args: example,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = diagramOf(C, s);
        const r = reading(C, s, g);
        return {
          board: r.board, center: r.center, bigCircleRadius: r.bigCircleRadius,
          C: r.C, angle: r.angle, angleDegrees: r.angleDegrees,
          A: r.A, B: r.B, K: r.K, D: r.D, footOffset: r.footOffset,
          circles: r.circles, radiusIdentity: r.radiusIdentity,
          note: `At ${r.angleDegrees} degrees the core gives incircle r = ${r.radiusIdentity.incircle}, left rL = ${r.radiusIdentity.left} and right rR = ${r.radiusIdentity.right}. Their mean is ${r.radiusIdentity.average}, with residual ${r.radiusIdentity.residual}: the three circles change size as C moves, but r always equals (rL + rR)/2.`,
        };
      },
    },
    tangent_lines: {
      describe:
        "For the same diagram (arguments as in sangaku_radii), report the vertical lines through the left and right outer-circle centres, their distance from the incircle centre, and the touch points U, V where they meet the incircle. Also report S, T, W, the feet on the diameter AB under the two outer centres and the incircle centre: the core gives ST = 2r and SW = TW = r, so the incircle is squeezed between two parallel tangents with W exactly midway. Small residuals are floating-point noise.",
      args: '{ "angle": -1.146304168051372 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = diagramOf(C, s);
        const r = reading(C, s, g);
        return {
          C: r.C, angle: r.angle, angleDegrees: r.angleDegrees,
          radiusIdentity: r.radiusIdentity,
          tangentLines: r.tangentLines,
          base: r.base,
          note: r.tangentLines.tangent && r.tangentLines.touchesAtUAndV && r.base.holds
            ? `The line through the left centre (x = ${r.tangentLines.leftX}) and the one through the right centre (x = ${r.tangentLines.rightX}) are each r = ${r.radiusIdentity.incircle} from the incircle centre, touching it at U and V. On AB, ST = ${r.base.ST} = 2r and SW = TW = ${r.base.SW} = r, so W is the midpoint of ST.`
            : "One of the tangent or segment checks failed at this position; see the residuals in `tangentLines` and `base`.",
        };
      },
    },
  };
}

/** Echo Track.state's saved fields and re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Circle Sangaku state version ${stateVersion}`);
  }
  const C = core();
  const seed = C.start();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : {};

  let savedReadable = true;
  let p: Pt | null = null;
  try {
    if (src.C !== undefined && src.C !== null) p = readPoint(src.C, "C");
  } catch {
    savedReadable = false;
  }
  const [angle, angleOk] = readFinite(src.angle, seed.angle);
  const [radius, radiusOk] = readFinite(src.radius, seed.radius);
  savedReadable = savedReadable && angleOk && radiusOk;

  let s: State = C.start({
    angle,
    showNames: src.showNames === true,
    showHint: src.showHint === true,
  });
  if (p) s = { ...s, C: p }; // the saved handle is authoritative for the picture
  const saved = {
    C: pt(p), angle, radius,
    showNames: src.showNames === true, showHint: src.showHint === true,
  };
  const onCircle = close(C.distance(s.C, s.center), s.radius, s.radius);

  let g: Diagram | null = null;
  try {
    g = C.compute(s);
  } catch {
    g = null;
  }
  if (!g || ![g.r, g.rR, g.rL].every(Number.isFinite) || Math.min(g.r, g.rR, g.rL) <= 0) {
    return {
      stateVersion, savedReadable, saved,
      C: saved.C, angle: saved.angle, radius: saved.radius,
      showNames: saved.showNames, showHint: saved.showHint,
      savedRadiusAgreesWithCore: close(radius, s.radius, s.radius),
      CIsOnBigCircle: onCircle,
      valid: false,
      note: !savedReadable
        ? "The saved C, angle or radius could not be read, so the core's opening picture is used; even that diagram cannot be measured here."
        : "The saved C is at a collapsed position (C at A or B), where the applet holds the diagram still, so no three circles can be measured.",
    };
  }

  const r = reading(C, s, g);
  return {
    stateVersion,
    savedReadable,
    // The fields Track.state saved, echoed as written.
    C: saved.C, angle: saved.angle, radius: saved.radius,
    showNames: saved.showNames, showHint: saved.showHint,
    // What the real core says at exactly that saved position.
    savedRadiusAgreesWithCore: close(radius, s.radius, s.radius),
    CIsOnBigCircle: onCircle,
    reading: r,
    note: `Track.state saved C, its angle, the board radius and the two display flags, but not the circles. The core rebuilds them: r = ${r.radiusIdentity.incircle} is the mean of rL = ${r.radiusIdentity.left} and rR = ${r.radiusIdentity.right} (residual ${r.radiusIdentity.residual}). The vertical tangents through the outer centres touch the incircle at U and V, and ST = ${r.base.ST} = 2r with SW = TW = ${r.base.SW}. This is an illustration, so there is no win or loss.`,
  };
}
