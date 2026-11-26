/*
 * run_game_logic actions and saved-position reader for Angle On Diameter.
 *
 * The real core is angle-on-diameter/angle-on-diameter-core.js, copied into
 * src/generated/cores/ at build time. It holds the whole geometry: AB is a
 * diameter with centre O and radius R, and P is restricted to the circle. Its
 * geometry() gives the seven angles of the old applet's chase; every number
 * below is read from that core. Thales' theorem (∠APB = 90°), the inscribed vs
 * central angle relation, the isosceles-triangle chase and the converse are
 * all checked against those numbers rather than asserted. See _shared.ts for
 * the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-on-diameter"].AngleOnDiameterCore;

type Point = { x: number; y: number };
type Geometry = {
  circle: { c: Point; r: number };
  A: Point; B: Point; O: Point; P: Point; radius: number;
  angles: Record<string, number>;
  corner: number; centralSum: number;
};

const near = (a: number, b: number, tol = 1e-8) => Math.abs(a - b) <= tol;
const round = (v: number) => Math.round(v * 1e4) / 1e4;
const deg = (radians: number) => Math.round(radians * 180000 / Math.PI) / 1000;
const xy = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

/** Accept [x, y] or { x, y }; the page saves objects, JSON args are arrays. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must have finite numeric x and y`);
  }
  return { x, y };
}

/** Either an explicit point, a mathematical angle in degrees, or core start. */
function readP(args: Json, C: ReturnType<typeof core>): Point | null {
  const hasP = args.P !== undefined && args.P !== null;
  const hasDegrees = args.degrees !== undefined && args.degrees !== null;
  if (hasP && hasDegrees) throw new Error('give either "P" or "degrees", not both');
  if (hasP) return readPoint(args.P, "P");
  if (hasDegrees) {
    // The core's pointOnCircle draws (cx + r cos t, cy - r sin t): screen y
    // points down, so "degrees" is the usual mathematical angle from OB.
    return C.pointOnCircle(C.CIRCLE, num(args, "degrees") / C.DEG);
  }
  return null;
}

function readOptions(args: Json, C: ReturnType<typeof core>) {
  let mode = "plain";
  if (args.mode !== undefined && args.mode !== null) {
    if (typeof args.mode !== "string" || C.MODES.indexOf(args.mode) < 0) {
      throw new Error(`argument "mode" must be one of ${C.MODES.join(", ")}`);
    }
    mode = args.mode as string;
  }
  let names = true;
  if (args.names !== undefined && args.names !== null) {
    if (typeof args.names !== "boolean") throw new Error('argument "names" must be true or false');
    names = args.names as boolean;
  }
  return { names, mode };
}

/** The three readings of one picture: Thales, the arc relation, the chase. */
function reading(g: Geometry) {
  const a = g.angles;
  const right = near(a.APB, Math.PI / 2);
  return {
    rightAngleAtP: {
      angleDegrees: deg(a.APB),
      angleRadians: round(a.APB),
      dotProductOfLegs: round(g.corner),
      isRight: right,
      note: "The dot product of PA and PB is zero exactly when they are perpendicular, which is the square mark at P.",
    },
    centralAndInscribed: {
      centralAOPDegrees: deg(a.AOP),
      centralBOPDegrees: deg(a.BOP),
      centralSumDegrees: deg(g.centralSum),
      straightCentralAngleAOBDegrees: 180,
      inscribedAPBDegrees: deg(a.APB),
      halfTheArcDegrees: 90,
      holds: near(g.centralSum, Math.PI) && right,
      note: "O lies on the diameter AB, so ∠AOP + ∠BOP = 180°. P sees that opposite semicircle at half the central angle: ∠APB = 180°/2 = 90°.",
    },
    isoscelesChase: {
      triangleAOP: {
        OAPDegrees: deg(a.OAP), APODegrees: deg(a.APO),
        equalBaseAngles: near(a.OAP, a.APO),
      },
      triangleBOP: {
        OBPDegrees: deg(a.OBP), BPODegrees: deg(a.BPO),
        equalBaseAngles: near(a.OBP, a.BPO),
      },
      splitAtP: {
        APODegrees: deg(a.APO), BPODegrees: deg(a.BPO),
        sumDegrees: deg(a.APO + a.BPO),
        equalsAPB: near(a.APO + a.BPO, a.APB),
      },
      baseAnglesSumDegrees: deg(a.OAP + a.OBP),
      givesRightAngle: near(a.APO + a.BPO, Math.PI / 2),
      note: "OA = OB = OP = R, so AOP and BOP are isosceles. The equal base angles at P add to 90°, and OP splits ∠APB into exactly those two angles.",
    },
  };
}

export function actions(): GameActions {
  return {
    at_point: {
      describe:
        "Place P on the circle with diameter AB (either give P as [x, y] or {x, y}, or give its mathematical angle in degrees from OB; with neither, use the applet's opening point). Report the right angle at P, the central/inscribed angle relation, the isosceles angle chase and the status line the applet shows. The point is projected onto the circle just as the applet's RestrictToCircle does.",
      args: '{ "degrees": 67.5, "mode": "hint" }',
      run: (args) => {
        const C = core();
        const p = readP(args, C);
        const options = readOptions(args, C);
        let s = C.start(options);
        if (p) s = C.move(s, p);
        const g = C.geometry(s) as Geometry;
        return {
          P: xy(g.P), A: xy(g.A), B: xy(g.B), O: xy(g.O),
          circle: { c: xy(g.circle.c), r: g.circle.r },
          mode: s.options.mode,
          status: C.describe(s),
          ...reading(g),
        };
      },
    },
    converse: {
      describe:
        "For any point P (not necessarily on the circle), measure ∠APB with the core's angle function and test the converse of Thales' theorem: the angle is right exactly when P lies on the circle with centre O, the midpoint of AB, and radius |AB|/2. Give P as [x, y] or {x, y} in the board's 400 x 300 coordinates, y downward. Points A and B themselves are degenerate and flagged as such.",
      args: '{ "P": [200, 50] }',
      run: (args) => {
        const C = core();
        const P = readPoint(args.P, "P");
        const s = C.start({});
        const g = C.geometry(s) as Geometry;
        const angle = C.angle(P, g.A, g.B) as number;
        const distance = C.dist(P, C.CENTER) as number;
        const degenerate = C.dist(P, g.A) < 1e-7 || C.dist(P, g.B) < 1e-7;
        const isRight = near(angle, Math.PI / 2);
        const onCircle = near(distance, C.RADIUS, 1e-7);
        return {
          P: xy(P), A: xy(g.A), B: xy(g.B), O: xy(g.O),
          radius: C.RADIUS,
          angleAPBDegrees: deg(angle),
          isRight,
          distanceFromO: round(distance),
          onCircleWithDiameterAB: onCircle,
          degenerate,
          converseHolds: degenerate ? null : isRight === onCircle,
          note: degenerate
            ? "At A or B the angle ∠APB is not defined, so the test does not apply."
            : isRight
              ? `∠APB = ${deg(angle)}°, so P lies on the circle with centre O = (${C.CENTER.x}, ${C.CENTER.y}) and radius ${C.RADIUS}: AB is the hypotenuse of a right triangle and its midpoint is the circumcentre.`
              : `∠APB = ${deg(angle)}°, not a right angle; P is ${round(Math.abs(distance - C.RADIUS))} units away from that circle, so AB is not a diameter of its circumcircle.`,
        };
      },
    },
  };
}

/** The page's saved illustration, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const savedOptions = state.options && typeof state.options === "object"
    ? state.options as Json : {};
  let s = C.start({
    names: savedOptions.names === undefined ? true : savedOptions.names === true,
    mode: typeof savedOptions.mode === "string" && C.MODES.indexOf(savedOptions.mode) >= 0
      ? savedOptions.mode : "plain",
  });
  if (state.P !== undefined && state.P !== null) {
    try { s = C.move(s, readPoint(state.P, "P")); } catch { /* no usable saved P */ }
  }
  const g = C.geometry(s) as Geometry;

  // Compare the angle numbers the page saved with the ones the core recomputes.
  const saved = state.angles && typeof state.angles === "object"
    ? state.angles as Json : null;
  let maxAngleDifference: number | null = null;
  let savedMatchesCore: boolean | null = null;
  if (saved) {
    let worst = 0, count = 0;
    for (const key of Object.keys(g.angles)) {
      const v = saved[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        worst = Math.max(worst, Math.abs(v - g.angles[key]));
        count++;
      }
    }
    if (count) {
      maxAngleDifference = Number(worst.toExponential(2));
      savedMatchesCore = worst < 1e-6;
    }
  }

  return {
    stateVersion,
    P: xy(g.P), A: xy(g.A), B: xy(g.B), O: xy(g.O),
    circle: { c: xy(g.circle.c), r: g.circle.r },
    options: { names: s.options.names, mode: s.options.mode },
    savedAngles: saved
      ? Object.fromEntries(Object.entries(saved)
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => [k, Number((v as number).toFixed(6))]))
      : null,
    anglesDegrees: Object.fromEntries(Object.keys(g.angles).map((k) => [k, deg(g.angles[k])])),
    maxAngleDifference,
    savedMatchesCore,
    status: C.describe(s),
    reading: reading(g),
    note: "The player has placed P on the circle; ∠APB is still 90°. The saved angles are checked against the angles the core computes for the saved point.",
  };
}
