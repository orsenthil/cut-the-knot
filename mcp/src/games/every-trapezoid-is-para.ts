/*
 * run_game_logic actions and saved-position reader for "Every Trapezoid Is Para".
 *
 * The core (every-trapezoid-is-para/ in the site, copied into
 * src/generated/cores/ at build time) transcribes the applet's Compute():
 * the extensions E and F, the crossings G and H, the bases a = AD and
 * b = BC, and the three diagonal pieces x = AG, y = GH, z = CH. The page's
 * "proof" divides by z - x to force a = b, but z - x is always 0; the true
 * conclusion is x = z. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["every-trapezoid-is-para"].EveryTrapezoidIsParaCore;

type Point = { x: number; y: number };

/* The core's compute() builds its full result with Object.assign, which the
 * JS inference narrows to the early-return shape; describe the valid reading. */
type Geometry = {
  valid: boolean;
  A: Point; B: Point; C: Point; D: Point;
  E: Point; F: Point; G: Point; H: Point;
  a: number; b: number; AC: number; BF: number;
  tG: number; tH: number;
  x: number; y: number; z: number; signedY: number;
  paraAFBC: number[]; paraACED: number[];
  ratioCGAG: number; ratioAHCH: number;
  predictedX: number; predictedZ: number;
  eq1: number; eq2: number; eq1Signed: number; eq2Signed: number;
  fX: number; fZ: number;
  pictured: boolean; parallelogram: boolean;
};

/** A corner must be a point with two finite coordinates. */
function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must be a point with numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** Four corners from the arguments, defaulting to the applet's starting shape. */
function readCorners(args: Json) {
  const start = core().start({});
  return {
    A: args.A ? readPoint(args.A, "A") : start.A,
    B: args.B ? readPoint(args.B, "B") : start.B,
    C: args.C ? readPoint(args.C, "C") : start.C,
    D: args.D ? readPoint(args.D, "D") : start.D,
  };
}

/** Refuse shapes too small for the applet's own length and intersection guards. */
function computeOrThrow(corners: ReturnType<typeof readCorners>) {
  const g = core().compute(corners) as Geometry;
  if (!g.valid) {
    throw new Error("degenerate trapezoid: keep AD and AB at least 2 units long and the crossings finite");
  }
  return g;
}

/* A readable trapezoid with unequal bases, in the same board units the core uses. */
const EXAMPLE_CORNERS =
  '{ "A": {"x":150,"y":75}, "B": {"x":115,"y":135}, "C": {"x":245,"y":135}, "D": {"x":205,"y":75} }';

export function actions(): GameActions {
  return {
    segments: {
      describe:
        "For a trapezoid ABCD with AD parallel to BC, report the base lengths a = AD and b = BC, the three pieces of the diagonal x = AG, y = GH, z = CH, and the true conclusion AG = CH (x = z) even when the bases are unequal.",
      args: EXAMPLE_CORNERS,
      run: (args) => {
        const corners = readCorners(args);
        const g = computeOrThrow(corners);
        return {
          a: g.a, b: g.b,
          x: g.x, y: g.y, z: g.z,
          AC: g.AC, E: g.E, F: g.F, G: g.G, H: g.H,
          tG: g.tG, tH: g.tH,
          xEqualsZ: Math.abs(g.x - g.z) < 1e-6,
          basesEqual: g.parallelogram,
          pictured: g.pictured,
          ratioCGAG: g.ratioCGAG, ratioAHCH: g.ratioAHCH,
          predictedX: g.predictedX, predictedZ: g.predictedZ,
          paraAFBC: g.paraAFBC, paraACED: g.paraACED,
          note: g.parallelogram
            ? `This trapezoid happens to have equal bases (a = b = ${g.a}), and AG = CH = ${g.x}.`
            : `The bases are different (AD = ${g.a}, BC = ${g.b}), yet AG = CH = ${g.x}: the diagonal is cut into equal end pieces, not the bases.`,
        };
      },
    },
    false_proof: {
      describe:
        "Check the two similar-triangle equations x = (a/b)(y + z) and z = (a/b)(x + y), then show the false proof's last step: subtracting gives z - x = -(a/b)(z - x), and dividing by z - x would force a = b. Show that z - x is actually 0 (so the division is by zero) and that f(w) = w^2 + wy gives f(x) = f(z).",
      args: EXAMPLE_CORNERS,
      run: (args) => {
        const corners = readCorners(args);
        const g = computeOrThrow(corners);
        const aOverB = g.a / g.b;
        return {
          a: g.a, b: g.b, aOverB,
          x: g.x, y: g.y, z: g.z, signedY: g.signedY,
          eq1RHS: g.eq1, eq2RHS: g.eq2,
          eq1Holds: Math.abs(g.x - g.eq1) < 1e-6,
          eq2Holds: Math.abs(g.z - g.eq2) < 1e-6,
          signedEq1RHS: g.eq1Signed, signedEq2RHS: g.eq2Signed,
          signedEq1Holds: Math.abs(g.x - g.eq1Signed) < 1e-6,
          signedEq2Holds: Math.abs(g.z - g.eq2Signed) < 1e-6,
          zMinusX: g.z - g.x,
          dividingByZero: Math.abs(g.z - g.x) < 1e-6,
          fX: g.fX, fZ: g.fZ, fEqual: Math.abs(g.fX - g.fZ) < 1e-6,
          note:
            "Both proportions hold, and f(x) = f(z). Subtracting them yields z - x = -(a/b)(z - x); cancelling z - x would require it to be nonzero, but AG and CH are always equal, so that cancellation is division by zero. The honest conclusion is x = z, not a = b.",
        };
      },
    },
  };
}

/** What the core says about the picture the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported every-trapezoid-is-para state version ${stateVersion}`);
  }
  const C = core();
  const corners = readCorners(state);
  const saved = {
    stateVersion,
    A: corners.A, B: corners.B, C: corners.C, D: corners.D,
    E: state.E ?? null, F: state.F ?? null,
    G: state.G ?? null, H: state.H ?? null,
    a: state.a ?? null, b: state.b ?? null,
    x: state.x ?? null, z: state.z ?? null,
    showNames: state.showNames === true,
    showStatement: state.showStatement === true,
    showPremise: state.showPremise === true,
    showHint: state.showHint === true,
  };

  const g = C.compute(corners) as Geometry;
  if (!g.valid) {
    return {
      ...saved,
      valid: false,
      note: "The saved corners are too close together for the applet's construction; drag them apart on the page.",
    };
  }

  return {
    ...saved,
    valid: true,
    aCore: g.a, bCore: g.b,
    xCore: g.x, yCore: g.y, zCore: g.z,
    signedY: g.signedY,
    xEqualsZ: Math.abs(g.x - g.z) < 1e-6,
    basesEqual: g.parallelogram,
    pictured: g.pictured,
    eq1Holds: Math.abs(g.x - g.eq1) < 1e-6,
    eq2Holds: Math.abs(g.z - g.eq2) < 1e-6,
    fEqual: Math.abs(g.fX - g.fZ) < 1e-6,
    ratioCGAG: g.ratioCGAG, ratioAHCH: g.ratioAHCH,
    result: C.result(),
    note: C.describe({ ...corners, explored: state.explored === true }),
  };
}
