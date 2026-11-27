/*
 * run_game_logic actions and saved-position reader for Five Incircles in a
 * Square.
 *
 * Four congruent right triangles sit on the sides of a square; their leftover
 * points E, F, G, H form a smaller square. Each triangle has an incircle and
 * the inner square has one too. With a, b the legs and c the hypotenuse of a
 * triangle (F lies on the circle with diameter AB, so AFB is right), the two
 * radii are (a+b-c)/2 and (a-b)/2. Equating them gives c = 2b, hence 30 and 60
 * degree acute angles and a common radius c(sqrt(3)-1)/4.
 *
 * Every number below comes from the game's real core
 * (five-circles-in-square/ in the site), copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["five-circles-in-square"].FiveCirclesInSquareCore;

const degrees = (radians: number) => radians * 180 / Math.PI;
const unit = (v: number) => Math.max(0, Math.min(1, v));
const close = (x: number, y: number, tol = 1e-6) => Math.abs(x - y) < tol;

/** Build a real core state from the (optional) board size and angle of E. */
function board(args: Json) {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) throw new Error("width and height must be positive numbers");
  return C.start({ width, height, angle: num(args, "angle", C.INITIAL_ANGLE) });
}

export function actions(): GameActions {
  return {
    two_radii: {
      describe:
        "For E at `angle` radians, report the right triangle's legs a, b and hypotenuse c from the game's core, then check the two closed forms: a triangle incircle has radius (a+b-c)/2 and the inner square's circle has radius (a-b)/2. F lies on the circle with diameter AB, so AFB is a right angle and c really is the hypotenuse.",
      args: '{ "angle": 0.618, "width": 400, "height": 400 }',
      run: (args) => {
        const C = core();
        const s = board(args);
        const g = C.geometry(s);
        const { a, b, c } = g.sides;
        const triangleRadius = C.radii(s)[0];
        const innerRadius = C.position(s).innerRadius;
        const triangleByFormula = (a + b - c) / 2;
        const innerByFormula = (a - b) / 2;
        return {
          angle: s.angle,
          width: s.width,
          height: s.height,
          sides: { a, b, c },
          rightAngleAtF: close(a * a + b * b, c * c, c * c * 1e-9),
          triangleIncircle: triangleRadius,
          triangleIncircleFormula: triangleByFormula,
          innerSquareCircle: innerRadius,
          innerSquareCircleFormula: innerByFormula,
          formulasHold: close(triangleRadius, triangleByFormula) && close(innerRadius, innerByFormula),
          note: "Both circles have the same radius only when (a+b-c)/2 = (a-b)/2, i.e. c = 2b; otherwise the inner circle is the larger one.",
        };
      },
    },
    equal_configuration: {
      describe:
        "Move E to the equal-radius diagram and show why all five circles match: the two radii are equal exactly when c = 2b, so b/c = 1/2 and the triangle's acute angles are 30 and 60 degrees, with common radius c(sqrt(3)-1)/4. Reports the core's own radii there and the applet's Finished match.",
      args: '{ "width": 400, "height": 400 }',
      run: (args) => {
        const C = core();
        // A negative angle picks the mirrored solution below the centre.
        const equal = C.makeEqual(board(args));
        const g = C.geometry(equal);
        const { b, c } = g.sides;
        const acute = degrees(Math.asin(unit(b / c)));
        const commonByFormula = c * (Math.sqrt(3) - 1) / 4;
        const radii = C.radii(equal);
        return {
          angle: equal.angle,
          angleDegrees: degrees(equal.angle),
          sides: g.sides,
          cOverB: c / b,
          bOverC: b / c,
          acuteDegrees: acute,
          otherDegrees: 90 - acute,
          commonRadiusFormula: commonByFormula,
          radii,
          allFiveMatchFormula: radii.every((r) => close(r, commonByFormula, C.MATCH)),
          finished: C.finished(equal),
          note: "With c = 2b the triangle is a 30-60-90 triangle: a = c*sqrt(3)/2, b = c/2, so (a-b)/2 = c(sqrt(3)-1)/4 is the common radius of all five circles.",
        };
      },
    },
  };
}

/** What the core says about the diagram as the page saved it. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = board(state);
  const p = C.position(s);
  const { a, b, c } = p.sides;
  const triangleByFormula = (a + b - c) / 2;
  const innerByFormula = (a - b) / 2;
  const equal = C.position(C.makeEqual(s));
  const acute = degrees(Math.asin(unit(b / c)));
  return {
    stateVersion,
    // The saved fields, as recorded by the page's Track.state(Core.position(state)).
    width: p.width,
    height: p.height,
    angle: p.angle,
    R: p.R,
    points: p.points,
    sides: p.sides,
    radii: p.radii,
    innerRadius: p.innerRadius,
    finished: p.finished,
    // A fresh reading from the real core, including the two closed forms.
    allFiveRadii: C.radii(s),
    triangleIncircleFormula: triangleByFormula,
    innerSquareCircleFormula: innerByFormula,
    formulasHold: close(p.radii[0], triangleByFormula) && close(p.innerRadius, innerByFormula),
    bOverC: b / c,
    cOverB: c / b,
    acuteDegrees: acute,
    otherDegrees: 90 - acute,
    angleToEquality: C.equalAngle(s),
    commonRadiusAtEquality: equal.innerRadius,
    note: p.finished
      ? `All five circles match at radius ${p.innerRadius.toFixed(2)}; c = ${c.toFixed(2)} is twice b = ${b.toFixed(2)}, so the acute angles are ${acute.toFixed(0)} and ${(90 - acute).toFixed(0)} degrees.`
      : `Triangle circles have radius (a+b-c)/2 = ${triangleByFormula.toFixed(2)} and the inner circle (a-b)/2 = ${innerByFormula.toFixed(2)}. Move E to ${degrees(C.equalAngle(s)).toFixed(0)} degrees to make them all equal.`,
  };
}
