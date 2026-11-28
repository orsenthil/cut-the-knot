/*
 * run_game_logic actions and saved-position reader for Hinged Pythagoras.
 *
 * The real core is hinged-pythagoras/hinged-pythagoras-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are applet canvas pixels with y down. The page saves exactly the
 * core's state, { side, a, angle }, with Track.state(state).
 *
 * This is Proof #9: two equal squares cut into the same four right triangles
 * with legs a and b. On the left they leave a tilted square of area c²; on the
 * right two pieces turn on hinges and at 90° leave squares of areas a² and b².
 * Subtracting the four triangles from both equal squares gives
 * c² = (a+b)² - 2ab = a² + b². HingedPythagoras2 (Proof #10) and
 * HingedPythagoras3 (Proof #2) use different dissections; the arithmetic here
 * is only about this four-triangle hinge. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type HingeState = { side: number; a: number; angle: number };
type Identity = {
  a: number; b: number; c: number; a2: number; b2: number;
  c2: number; s2: number; triangles2: number; holds: boolean;
};
type Guide = { x1: number; x2: number; y: number; bandLeft: number; bandRight: number };
type Core = {
  LIMITS: { minAngle: number; maxAngle: number; rightAngleDegrees: number };
  identity(s: HingeState): Identity;
  formed(s: HingeState): boolean;
  guide(s: HingeState): Guide | null;
  setAngle(s: HingeState, degrees: number): HingeState;
};

const core = (): Core =>
  cores["hinged-pythagoras"].HingedPythagorasCore as unknown as Core;

/** The two leg lengths: a and b split the square's side. */
function readSquare(args: Json): { side: number; a: number } {
  const side = num(args, "side");
  if (!Number.isInteger(side) || side < 2) {
    throw new Error(`"side" must be an integer >= 2, got ${JSON.stringify(args.side)}`);
  }
  const a = num(args, "a");
  if (!Number.isInteger(a) || a < 0 || a > side) {
    throw new Error(`"a" must be an integer from 0 to side (${side}), got ${JSON.stringify(args.a)}`);
  }
  return { side, a };
}

/** The scrollbar is the core's own whole-degree range, 0 to 95. */
function readAngle(args: Json): number {
  const { minAngle, maxAngle } = core().LIMITS;
  const angle = num(args, "angle");
  if (!Number.isInteger(angle) || angle < minAngle || angle > maxAngle) {
    throw new Error(`"angle" must be an integer from ${minAngle} to ${maxAngle}, got ${JSON.stringify(args.angle)}`);
  }
  return angle;
}

/** A compact, honest reading of the dissection at one state. */
function reading(C: Core, s: HingeState) {
  const id = C.identity(s);
  const formed = C.formed(s);
  const guide = C.guide(s);
  return {
    side: s.side,
    a: id.a,
    b: id.b,
    angle: s.angle,
    tiltedSquare: { side: id.c, area: id.c2 },
    bigSquareArea: id.s2,
    fourTrianglesArea: id.triangles2,
    a2: id.a2,
    b2: id.b2,
    c2: id.c2,
    holds: id.holds,
    legSquaresFormed: formed,
    guideLine: guide,
  };
}

export function actions(): GameActions {
  return {
    proof_at_angle: {
      describe:
        "For a square of side `side` cut at hinge `a` and turned `angle` degrees, report the four-triangle dissection's arithmetic from the real core: the tilted square has area c² = (a+b)² - 2ab = a² + b² at every angle, while squares of sides a and b appear only at 90°. This is Proof #9's four-triangle hinge, not HingedPythagoras2's Proof #10 or HingedPythagoras3's Proof #2.",
      args: '{ "side": 200, "a": 149, "angle": 90 }',
      run: (args) => {
        const C = core();
        const s: HingeState = { ...readSquare(args), angle: readAngle(args) };
        const r = reading(C, s);
        return {
          ...r,
          identity: {
            formula: "c² = (a+b)² - 2ab = a² + b²",
            c2: r.c2,
            fromBigSquare: r.bigSquareArea - r.fourTrianglesArea,
            a2PlusB2: r.a2 + r.b2,
            holds: r.holds,
          },
          note: r.legSquaresFormed
            ? `At ${s.angle}° the two hinged triangles swing clear: the open spaces are squares of sides a = ${r.a} and b = ${r.b}, whose areas ${r.a2} + ${r.b2} = ${r.c2} equal the tilted square on the left.`
            : `At ${s.angle}° the pieces have only moved, not changed shape: subtracting the same four triangles from both equal squares still leaves c² = ${r.c2} = ${r.a2} + ${r.b2}. Turn the hinge to 90° to see the two leg squares.`,
        };
      },
    },
    angle_sweep: {
      describe:
        "Run the real core at every whole angle 0 to 95 for a square of side `side` cut at hinge `a`, and report which angles keep c² = a² + b², when the alignment guide appears, and when the two leg squares form. Rotating rigid pieces cannot change areas, so the identity holds at all angles; only at 90° do the spaces become squares of sides a and b.",
      args: '{ "side": 200, "a": 149 }',
      run: (args) => {
        const C = core();
        const { side, a } = readSquare(args);
        const rows: Array<{ angle: number; c2: number; holds: boolean; legSquaresFormed: boolean; guideShown: boolean }> = [];
        for (let angle = C.LIMITS.minAngle; angle <= C.LIMITS.maxAngle; angle++) {
          // Drive the scrollbar with the real core rather than trusting the args.
          const s = C.setAngle({ side, a, angle: C.LIMITS.minAngle }, angle);
          const r = reading(C, s);
          rows.push({
            angle: s.angle,
            c2: r.c2,
            holds: r.holds,
            legSquaresFormed: r.legSquaresFormed,
            guideShown: r.guideLine !== null,
          });
        }
        const sampleAngles = [C.LIMITS.minAngle, 45, 89, C.LIMITS.rightAngleDegrees, C.LIMITS.maxAngle];
        return {
          side,
          a,
          b: side - a,
          anglesChecked: rows.length,
          tiltedSquareArea: rows[0].c2,
          identityHoldsAtEveryAngle: rows.every((r) => r.holds),
          c2ConstantAtEveryAngle: rows.every((r) => r.c2 === rows[0].c2),
          legSquaresFormedAt: rows.filter((r) => r.legSquaresFormed).map((r) => r.angle),
          guideShownFrom: rows.find((r) => r.guideShown)?.angle ?? null,
          sample: rows.filter((r) => sampleAngles.includes(r.angle)),
          note: `The identity c² = (a+b)² - 2ab = a² + b² holds at all ${rows.length} angles with c² = ${rows[0].c2}; the leg squares form only at ${C.LIMITS.rightAngleDegrees}°, while the alignment guide appears from ${rows.find((r) => r.guideShown)?.angle ?? "no angle"} on.`,
        };
      },
    },
  };
}

/** What the core says about the { side, a, angle } state the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Pythagoras state version ${stateVersion}`);
  }
  const C = core();
  const square = readSquare(state);
  const angle = readAngle(state);
  const r = reading(C, { ...square, angle });
  return {
    stateVersion,
    // The saved fields, echoed unchanged.
    side: r.side,
    a: r.a,
    angle: r.angle,
    // The core's reading of that position.
    b: r.b,
    c: Math.sqrt(r.c2),
    a2: r.a2,
    b2: r.b2,
    c2: r.c2,
    bigSquareArea: r.bigSquareArea,
    fourTrianglesArea: r.fourTrianglesArea,
    tiltedSquareArea: r.tiltedSquare.area,
    holds: r.holds,
    identity: "c² = (a+b)² - 2ab = a² + b²",
    legSquaresFormed: r.legSquaresFormed,
    formed: r.legSquaresFormed,
    guideLine: r.guideLine,
    readout: `a = ${r.a}, b = ${r.b}  ·  a² + b² = ${r.a2} + ${r.b2} = ${r.c2} = c²`,
    note: r.legSquaresFormed
      ? "At 90° the two leg squares are on show: their areas add up to the tilted square on the left."
      : `The hinge is at ${r.angle}°, so the two leg squares have not appeared yet; c² = ${r.c2} = ${r.a2} + ${r.b2} is the same at every angle.`,
  };
}
