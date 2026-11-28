/*
 * run_game_logic actions and saved-position reader for Hinged Pythagoras 3.
 *
 * The real core is hinged-pythagoras-3/hinged-pythagoras-3-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are applet canvas pixels with y down. The page saves exactly the
 * core's state, { a, angle }, with Track.state(state) in render().
 *
 * This is Proof #2 (applet HingedPythagoras3): a staircase of an a-square next
 * to a b-square is copied twice. The left copy shows two right triangles with
 * legs a, b inside the two squares; the right copy swings two congruent
 * triangles about hinges, one clockwise and one anticlockwise. At the 90°
 * stop (the scrollbar declares 95 but Java's 5-unit thumb caps it at 90) the
 * fixed cut lines and the free triangle edges close into a tilted square of
 * side c, so the unchanged areas give a² + b² = c². This is a different
 * dissection from HingedPythagoras (Proof #9, four triangles) and
 * HingedPythagoras2 (Proof #10, (a−b)² + 2ab). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type HingeState = { a: number; angle: number };
type Limits = {
  declaredMin: number; declaredMax: number; visibleAmount: number;
  minAngle: number; maxAngle: number; rightAngle: number;
};
type Layout = {
  side: number; dx: number; dy: number; shift: number; a: number; b: number;
  L: Point[]; R: Point[]; M: Point;
};
type Identity = {
  a: number; b: number; c: number; a2: number; b2: number; c2: number;
  side2: number; triangles2: number; holds: boolean;
};
type Pieces = {
  g: Layout; M: Point; MR: Point; hingeLow: Point; hingeHigh: Point;
  leftTriangles: Point[][]; dashed: Point[]; rightTriangles: Point[][];
  spans: Point[][]; apex: Point; cSquare: Point[];
};
type Core = {
  LIMITS: Limits;
  initial(width?: number, height?: number): {
    side: number; dx: number; dy: number; shift: number; mx: number; a: number; b: number;
  };
  start(): HingeState;
  setHinge(s: HingeState, x: number, width?: number, height?: number): HingeState;
  setAngle(s: HingeState, degrees: number): HingeState;
  identity(s: HingeState, width?: number, height?: number): Identity;
  formed(s: HingeState): boolean;
  pieces(s: HingeState, width?: number, height?: number): Pieces;
};

const core = (): Core =>
  cores["hinged-pythagoras-3"].HingedPythagoras3Core as unknown as Core;

/** `a` is the hinge's pixel offset from the left bottom corner, 0..side. */
function readHinge(C: Core, args: Json): number {
  const side = C.initial().side;
  const a = num(args, "a");
  if (!Number.isInteger(a) || a < 0 || a > side) {
    throw new Error(`"a" must be an integer from 0 to ${side} (the square's side), got ${JSON.stringify(args.a)}`);
  }
  return a;
}

/** The scrollbar carries whole degrees, clamped to the core's 0..90 range. */
function readAngle(C: Core, args: Json): number {
  const { minAngle, maxAngle } = C.LIMITS;
  const angle = num(args, "angle");
  if (!Number.isInteger(angle) || angle < minAngle || angle > maxAngle) {
    throw new Error(`"angle" must be an integer from ${minAngle} to ${maxAngle}, got ${JSON.stringify(args.angle)}`);
  }
  return angle;
}

/** Opening picture, drag M to `a`, then turn the slider: all through the core. */
function hingeState(C: Core, a: number, angle: number): HingeState {
  const dx = C.initial().dx;
  return C.setAngle(C.setHinge(C.start(), dx + a), angle);
}

/** A compact, honest reading of the dissection at one state. */
function reading(C: Core, s: HingeState) {
  const id = C.identity(s);
  const formed = C.formed(s);
  const p = C.pieces(s);
  return {
    state: { a: s.a, angle: s.angle },
    squareSide: p.g.side,
    legs: { a: id.a, b: id.b },
    hinges: {
      M: p.M, leftCorner: p.g.L[0], rightCorner: p.g.L[1],
      lowHinge: p.hingeLow, highHinge: p.hingeHigh,
      movingCorner: p.MR, meetingPoint: p.apex,
    },
    leftTriangles: p.leftTriangles,
    rightTriangles: p.rightTriangles,
    fixedCuts: p.spans,
    identity: {
      formula: "a² + b² = c²",
      a2: id.a2,
      b2: id.b2,
      c2: id.c2,
      c: id.c,
      bigSquare: { area: id.side2, twoTriangles: id.triangles2, remainder: id.side2 - id.triangles2 },
      holds: id.holds,
    },
    quarterTurn: {
      formed,
      stopDegrees: C.LIMITS.maxAngle,
      tiltedSquare: formed
        ? { side: id.c, area: id.c2, vertices: p.cSquare }
        : null,
    },
  };
}

export function actions(): GameActions {
  return {
    proof2_at_angle: {
      describe:
        "Proof #2 (applet HingedPythagoras3): give `a`, the hinge M's pixel offset from the left bottom corner (integer 0..200, the square's side), and `angle` in whole degrees 0..90. Reports from the real core the two right triangles on the left, the two congruent triangles swung on the right, the fixed cut lines, and the arithmetic a² + b² = c²; the tilted c-square appears only at the 90° stop, where the scrollbar is capped despite being declared 0..95. This is Proof #2 — not HingedPythagoras's four-triangle Proof #9 or HingedPythagoras2's (a−b)² + 2ab Proof #10.",
      args: '{ "a": 51, "angle": 90 }',
      run: (args) => {
        const C = core();
        const a = readHinge(C, args);
        const angle = readAngle(C, args);
        const r = reading(C, hingeState(C, a, angle));
        return {
          ...r,
          note: r.quarterTurn.formed
            ? `At the ${angle}° stop the two fixed cut lines and the free edges of the swung triangles are the four sides of a tilted square of side c = ${r.identity.c.toFixed(3)}. Nothing stretched, so its area c² = ${r.identity.c2} is exactly the two left squares' a² + b² = ${r.identity.a2} + ${r.identity.b2} = ${r.identity.c2}.`
            : angle === C.LIMITS.minAngle
              ? `At rest the two right triangles sit inside the a- and b-squares on the left, while the right copy shows them unturned; already a² + b² = ${r.identity.a2} + ${r.identity.b2} = ${r.identity.c2} = c². Turn to ${C.LIMITS.maxAngle}° to see the tilted c-square close up.`
              : `At ${angle}° the two right triangles have only swung about their hinges: their shapes and areas are unchanged, so a² + b² = ${r.identity.a2} + ${r.identity.b2} = ${r.identity.c2} = c² already holds. Turn to ${C.LIMITS.maxAngle}° to see the tilted c-square close up.`,
        };
      },
    },
    angle_sweep: {
      describe:
        "Sweep the real core through every whole turn from 0 to 90 for a hinge `a` (integer 0..side) and report where a² + b² = c² holds, where c² stays constant, and exactly when the tilted c-square forms. Swinging rigid triangles cannot change areas, so the identity holds at every angle; only the 90-degree stop closes the four cut and free edges into a square of side c. The applet's scrollbar is declared 0..95 but its 5-unit thumb caps the value at 90.",
      args: '{ "a": 51 }',
      run: (args) => {
        const C = core();
        const a = readHinge(C, args);
        const rows: Array<{
          angle: number; a: number; b: number; c2: number;
          holds: boolean; tiltedSquare: boolean;
        }> = [];
        for (let angle = C.LIMITS.minAngle; angle <= C.LIMITS.maxAngle; angle++) {
          // Drive the slider with the real core rather than trusting the args.
          const s = hingeState(C, a, angle);
          const id = C.identity(s);
          rows.push({
            angle: s.angle, a: id.a, b: id.b, c2: id.c2,
            holds: id.holds, tiltedSquare: C.formed(s),
          });
        }
        const first = rows[0];
        const formedAt = rows.filter((r) => r.tiltedSquare).map((r) => r.angle);
        const sampleAngles = [C.LIMITS.minAngle, 45, 89, C.LIMITS.rightAngle, C.LIMITS.maxAngle];
        return {
          a,
          b: first.b,
          squareSide: C.initial().side,
          anglesChecked: rows.length,
          c2: first.c2,
          identityHoldsAtEveryAngle: rows.every((r) => r.holds),
          c2ConstantAtEveryAngle: rows.every((r) => r.c2 === first.c2),
          tiltedSquareAt: formedAt,
          scrollbar: {
            declaredMax: C.LIMITS.declaredMax,
            visibleAmount: C.LIMITS.visibleAmount,
            effectiveMax: C.LIMITS.maxAngle,
          },
          sample: rows.filter((r) => sampleAngles.includes(r.angle)),
          note: `Across all ${rows.length} angles (0..${C.LIMITS.maxAngle}) with a = ${a}, b = ${first.b}, a² + b² = ${first.a ** 2} + ${first.b ** 2} = ${first.c2} = c² holds and c² never changes; the tilted c-square closes only at ${formedAt.join(", ") || "no angle"}.`,
        };
      },
    },
  };
}

/** Echo the { a, angle } fields Track.state saved, plus the core's reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Pythagoras 3 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hinged Pythagoras 3 position must be an object");
  }
  const C = core();
  const a = readHinge(C, state);
  const angle = readAngle(C, state);
  const r = reading(C, hingeState(C, a, angle));
  return {
    stateVersion,
    // The saved fields, echoed unchanged.
    a,
    angle,
    // The core's reading of that picture.
    reading: {
      legs: r.legs,
      squareSide: r.squareSide,
      hinges: r.hinges,
      identity: r.identity,
      quarterTurn: r.quarterTurn,
    },
    readout:
      `a = ${r.legs.a}, b = ${r.legs.b}  ·  a² + b² = ${r.identity.a2} + ${r.identity.b2} = ${r.identity.c2} = c²`,
    note: r.quarterTurn.formed
      ? "The saved picture is at the quarter-turn stop: the fixed cuts and the free edges of the swung triangles make a tilted square of side c, whose area is a² + b²."
      : angle === C.LIMITS.minAngle
        ? `The saved picture is at rest (0°): the two right triangles sit inside the a- and b-squares on the left and are unturned on the right, yet c² = ${r.identity.c2} = ${r.identity.a2} + ${r.identity.b2} already holds. Turn to ${C.LIMITS.maxAngle}° to see the tilted c-square.`
        : `The saved picture is turned ${angle}°; the hinged triangles have moved but kept their shape, so c² = ${r.identity.c2} = ${r.identity.a2} + ${r.identity.b2} already holds. Turn to ${C.LIMITS.maxAngle}° to see the tilted c-square.`,
  };
}
