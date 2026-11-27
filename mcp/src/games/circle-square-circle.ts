/*
 * run_game_logic actions and saved-position reader for Circle Square Circle.
 *
 * The illustration joins two pictures, both drawn by the real core
 * (circle-square-circle/circle-square-circle-core.js, copied into
 * src/generated/cores/ at build time):
 *
 *   - The applet's turning square B is inscribed in circle C of radius R at
 *     every angle. The distance from the common centre to each side of B is
 *     R/sqrt(2), so the inner circle C2 has that radius and exactly half the
 *     area of C, whatever the slider says.
 *   - The page's Gothic cupola has a unique fit: with a big square of side S,
 *     the small square has side x = 3S/5 and the circle on it has radius
 *     r = 39S/320. That is where the corner and tangency errors both vanish.
 *
 * Every number below comes from the core; see _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-square-circle"].CircleSquareCircleCore;

type Point = { x: number; y: number };

const round = (v: number, digits = 8): number => Number(v.toFixed(digits));
const close = (a: number, b: number, tol = 1e-9): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

/** A missing or non-numeric saved value has no comparison to offer. */
const maybeNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The scroll bar runs from 0 to 50 degrees in the applet. */
function readAngle(args: Json, key = "angle"): number {
  const C = core();
  const angle = num(args, key, C.ANGLE_DEFAULT);
  if (!Number.isInteger(angle) || angle < C.ANGLE_MIN || angle > C.ANGLE_MAX) {
    throw new Error(`${key} must be a whole number from ${C.ANGLE_MIN} to ${C.ANGLE_MAX}`);
  }
  return angle;
}

function readSide(args: Json, key = "side"): number {
  const side = num(args, key, 200);
  if (!(side > 0)) throw new Error(`${key} must be positive`);
  return side;
}

export function actions(): GameActions {
  return {
    turning_square: {
      describe:
        "For a radius R and a scroll-bar angle (0 to 50 degrees), describe the turning square B inscribed in circle C: its four corners, its side length, the distance from the centre to each of its sides, and the inner circle C2. Report R/sqrt(2) as the inner radius, checked against the core's apothem, and the inner-to-outer area ratio 1/2. Both hold at every angle.",
      args: '{ "R": 86, "angle": 45 }',
      run: (args) => {
        const C = core();
        const angle = readAngle(args);
        const R = num(args, "R");
        if (!(R > 0)) throw new Error("R must be positive");
        // Keep the applet's centre and angle, but set the radius exactly.
        const s = { ...C.appletStart({ angle }), R: R };
        const circles = C.appletCircles(s);
        const B = C.appletB(s);
        const inner = circles.inner.radius;
        const formula = s.R / Math.sqrt(2);
        const apothem = C.apothem(s);
        const clearances = B.map((p: Point, i: number) =>
          C.distanceToLine(circles.inner.center, p, B[(i + 1) % 4]));
        const cornerRadii = B.map((p: Point) => C.distance(circles.inner.center, p));
        const sideB = dist(B[0], B[1]);
        return {
          R: s.R,
          angleDegrees: angle,
          outerRadius: round(circles.outer.radius),
          innerRadius: round(inner),
          radiusFormula: "R / sqrt(2)",
          radiusMatchesFormula: close(inner, formula),
          apothem: round(apothem),
          apothemMatchesFormula: close(apothem, formula),
          outerArea: round(Math.PI * s.R * s.R),
          innerArea: round(Math.PI * inner * inner),
          innerAreaOverOuterArea: round(inner * inner / (s.R * s.R)),
          sideOfB: round(sideB),
          sideMatchesRSqrt2: close(sideB, s.R * Math.SQRT2),
          cornerDistanceFromCentre: cornerRadii.map((d: number) => round(d)),
          cornersOnOuterCircle: cornerRadii.every((d: number) => close(d, s.R)),
          distanceCentreToSides: clearances.map((d: number) => round(d)),
          sidesTouchInnerCircle: clearances.every((d: number) => close(d, inner)),
          corners: B.map(pt),
          note: `With R = ${s.R} at ${angle} degrees, B still has corners R = ${round(s.R)} from O, so it is a square inscribed in C. Each side of B is ${round(clearances[0])} from O, exactly the inner radius R/sqrt(2) = ${round(inner)}. That is why C2 has half of C's area (${round(inner * inner / (s.R * s.R))}), independent of the angle.`,
        };
      },
    },
    cupola_fit: {
      describe:
        "For a Gothic cupola with a big square of side S (default 200), report the page's exact fit: the small square is x = 3S/5 and the circle on it has radius r = 39S/320. If x or r are supplied, measure how far the saved drawing is from that fit (corner and tangency errors) and compare r with the radius that makes the circle touch both quarter circles at that x.",
      args: '{ "side": 200 }',
      run: (args) => {
        const C = core();
        const side = readSide(args);
        const exact = C.fit(side);
        const x = args.x === undefined ? exact.x : num(args, "x");
        const r = args.r === undefined ? exact.r : num(args, "r");
        if (!(x >= 0 && x <= side)) throw new Error("x must be between 0 and side");
        if (!(r >= 0 && r <= side)) throw new Error("r must be between 0 and side");
        const s = C.cupolaStart({ side: side, x: x, r: r });
        const err = C.cupolaErrors(s);
        const p = C.cupolaPoints(s);
        const tangentRadius = C.radiusFor(side, s.x);
        const fits = close(err.corner, 0) && close(err.tangent, 0);
        return {
          side: s.side,
          exactFit: {
            x: round(exact.x), r: round(exact.r),
            xOverS: round(exact.x / s.side), rOverS: round(exact.r / s.side),
          },
          current: { x: round(s.x), r: round(s.r) },
          cornerError: round(err.corner),
          tangentError: round(err.tangent),
          cornerOnLeftQuarterCircle: close(err.corner, 0),
          circleTangentToQuarterCircle: close(err.tangent, 0),
          isExactFit: fits,
          tangentRadiusForThisX: round(tangentRadius),
          matchesRadiusFormula: close(tangentRadius, exact.r),
          G: pt(p.G),
          O: pt(p.O),
          note: fits
            ? `For S = ${s.side} the small square is x = ${round(exact.x)} = 3S/5 and the circle has radius r = ${round(exact.r)} = 39S/320. Both the corner and the tangency error are 0.`
            : `For S = ${s.side} the exact fit would be x = ${round(exact.x)} = 3S/5 and r = ${round(exact.r)} = 39S/320. At x = ${round(s.x)} the drawing misses by ${round(err.corner)} at the corner and ${round(err.tangent)} at the tangency; a circle touching both quarter circles there would need radius ${round(tangentRadius)}.`,
        };
      },
    },
  };
}

/** The two boards the page saved with Track.state, read by the same core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circle Square Circle state version ${stateVersion}`);
  }
  const savedCupola = state.cupola;
  const savedApplet = state.applet;
  if (!savedCupola || typeof savedCupola !== "object" ||
      !savedApplet || typeof savedApplet !== "object") {
    throw new Error("state must have cupola and applet objects");
  }
  const cupola = savedCupola as Json;
  const applet = savedApplet as Json;

  const side = readSide(cupola);
  const x = num(cupola, "x");
  const r = num(cupola, "r");
  if (!(x >= 0 && x <= side)) throw new Error("cupola.x must be between 0 and cupola.side");
  if (!(r >= 0 && r <= side)) throw new Error("cupola.r must be between 0 and cupola.side");
  const cu = C.cupolaStart({
    left: num(cupola, "left"), baseY: num(cupola, "baseY"),
    side: side, x: x, r: r,
  });

  const R = num(applet, "R");
  if (!(R > 0)) throw new Error("applet.R must be positive");
  const ap = {
    ...C.appletStart({}),
    cx: num(applet, "cx"), cy: num(applet, "cy"),
    R: R, angle: readAngle(applet),
  };

  const exact = C.fit(cu.side);
  const err = C.cupolaErrors(cu);
  const cp = C.cupolaPoints(cu);
  const fits = close(err.corner, 0) && close(err.tangent, 0);
  const tangentRadius = C.radiusFor(cu.side, cu.x);
  const savedErr = cupola.error && typeof cupola.error === "object"
    ? cupola.error as Json : null;
  const savedCorner = savedErr ? maybeNum(savedErr.corner) : null;
  const savedTangent = savedErr ? maybeNum(savedErr.tangent) : null;

  const circles = C.appletCircles(ap);
  const B = C.appletB(ap);
  const inner = circles.inner.radius;
  const clearances = B.map((p: Point, i: number) =>
    C.distanceToLine(circles.inner.center, p, B[(i + 1) % 4]));

  return {
    ...state,
    stateVersion,
    valid: true,
    // Every saved field is kept; the rest is what the core adds about it.
    cupola: {
      ...cupola,
      exactFit: {
        x: round(exact.x), r: round(exact.r),
        xOverS: round(exact.x / cu.side), rOverS: round(exact.r / cu.side),
      },
      atExactFit: fits,
      cornerErrorFromCore: round(err.corner),
      tangentErrorFromCore: round(err.tangent),
      savedErrorsMatchCore: savedCorner === null || savedTangent === null
        ? null
        : close(savedCorner, err.corner, 1e-6) && close(savedTangent, err.tangent, 1e-6),
      tangentRadiusForThisX: round(tangentRadius),
      matchesRadiusFormula: close(tangentRadius, exact.r),
      G: pt(cp.G),
      O: pt(cp.O),
    },
    applet: {
      ...applet,
      innerRadius: round(inner),
      radiusFormula: "R / sqrt(2)",
      innerRadiusMatchesFormula: close(inner, ap.R / Math.SQRT2),
      apothem: round(C.apothem(ap)),
      innerAreaOverOuterArea: round(inner * inner / (ap.R * ap.R)),
      distanceCentreToSides: clearances.map((d: number) => round(d)),
      sidesTouchInnerCircle: clearances.every((d: number) => close(d, inner)),
      corners: B.map(pt),
    },
    note: fits
      ? `The cupola is an exact fit: with S = ${cu.side}, x = ${cu.x} = 3S/5 and r = ${cu.r} = 39S/320, so both errors are 0. On the other board, R = ${ap.R} at ${ap.angle} degrees gives an inner radius ${round(inner)} = R/sqrt(2), whose area is half of C's; every side of B touches it.`
      : `The cupola is not fitted yet: at S = ${cu.side}, x = ${cu.x} and r = ${cu.r} the corner error is ${round(err.corner)} and the tangency error is ${round(err.tangent)}. The fit is x = ${round(exact.x)} = 3S/5 and r = ${round(exact.r)} = 39S/320. On the other board, R = ${ap.R} at ${ap.angle} degrees gives an inner radius ${round(inner)} = R/sqrt(2) with half the outer area, and every side of B touches it.`,
  };
}
