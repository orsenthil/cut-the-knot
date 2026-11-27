/*
 * run_game_logic actions and saved-position reader for Common Tangent Sangaku.
 *
 * Two circles sit inside an angle with vertex C, each touching both sides; the
 * small circle is centred at Q on the segment CO that joins C to the big
 * circle's centre O. Write d = CO and t = CQ/d (the applet's `coef`). The core
 * puts Q at that ratio, sets the big radius R = OQ = d(1 − t), and gives the
 * small circle radius R·CQ/d = d·t·(1 − t). The chord MN of the big circle
 * perpendicular to OC comes from the circle centred at C orthogonal to (O),
 * of radius sqrt(d² − R²); M and N are where the big circle touches the two
 * sides. The sangaku says that any two of
 *   (1) M,N are the points of tangency with the sides,
 *   (2) the small circle is tangent to the chord MN,
 *   (3) the small circle's centre lies on the big circle
 * force the third. Equivalently the vertex angle at C satisfies
 * sin(angle/2) = R/d = 1 − t, so specifying the angle and d fixes t.
 *
 * Every number below comes from the game's real core
 * (common-tangent-sangaku/common-tangent-sangaku-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * Coordinates are board units (y down); the angle is in degrees.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["common-tangent-sangaku"].CommonTangentSangakuCore;

type Point = { x: number; y: number };
type State = ReturnType<ReturnType<typeof core>["start"]>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
/** Keep small residuals visible instead of rounding them to zero. */
const sig = (v: number): number => Number(v.toExponential(2));
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const deg = (radians: number): number => round((radians * 180) / Math.PI, 4);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Tool arguments accept [x, y] or { x, y }; saved positions use { x, y }. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite x and y`);
    return { x, y };
  }
  if (!value || typeof value !== "object") throw new Error(`"${label}" must be [x, y] or {x, y}`);
  const o = value as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** Place C at the left margin and O exactly `distance` board units to its right. */
function place(distance: number, coef: number): State {
  const C = core();
  const margin = 12; // the core's own clamp margin in movePoint
  const height = Math.max(C.HEIGHT, 4 * margin + 20);
  const width = Math.max(C.WIDTH, distance + 4 * margin);
  let s = C.start({ width: width, height: height, coef: coef }) as State;
  s = C.movePoint(s, "C", { x: margin, y: height / 2 }) as State;
  s = C.movePoint(s, "O", { x: margin + distance, y: height / 2 }) as State;
  return s;
}

/** The core's picture at one position, with the page's rules measured on it. */
function reading(s: State) {
  const C = core();
  const rad = C.radii(s);
  const g = C.geometry(s);
  const cond = C.conditions(s);
  const t = s.coef;
  const d = rad.d, R = rad.R, r = rad.r;
  const ruleSmall = d * t * (1 - t);
  const ruleBig = d * (1 - t);
  const cq = C.distance(s.C, s.Q);
  const sinHalf = d > 0 ? Math.min(1, R / d) : NaN;
  return {
    coef: round(t, 9),
    canDraw: C.canDraw(s),
    distanceCO: round(d),
    CQ: round(cq),
    OQ: round(R),
    circles: {
      big: { center: pt(s.O), radius: round(R) },
      small: { center: pt(s.Q), radius: round(r) },
    },
    radiusRule: {
      expression: "r = d·t·(1−t) = CQ·OQ/CO",
      value: round(ruleSmall, 9),
      measured: round(r, 9),
      residual: sig(r - ruleSmall),
      holds: close(r, ruleSmall),
    },
    bigRadiusRule: {
      expression: "R = d·(1−t) = OQ",
      value: round(ruleBig, 9),
      residual: sig(R - ruleBig),
      holds: close(R, ruleBig),
    },
    angleAtC: {
      halfDegrees: Number.isFinite(sinHalf) ? deg(Math.asin(sinHalf)) : null,
      fullDegrees: Number.isFinite(sinHalf) ? deg(2 * Math.asin(sinHalf)) : null,
      expression: "sin(angle/2) = R/d = 1 − t",
    },
    chord: g
      ? { M: pt(g.M), N: pt(g.N), P: pt(g.P), orthogonalRadius: round(g.rAux) }
      : null,
    conditions: cond,
    allThreeHold: cond
      ? cond.tangencyPoints && cond.tangentToChord && cond.onBigCircle
      : false,
  };
}

export function actions(): GameActions {
  return {
    sangaku_from_angle: {
      describe:
        "Place two circles inside an angle of `angle` degrees at vertex C with the big centre O `distance` board units away, then run the real core to report both circles, t = 1 − sin(angle/2), the radius rule r = d·t·(1−t) with R = d·(1−t) = OQ, the chord MN, and the core's three tangency conditions (M,N touch the sides, MN touches the small circle, Q lies on the big circle). `angle` must lie strictly between 0 and 180 degrees and distance·(1 − sin(angle/2)) must be at least 2, the core's minimum CQ.",
      args: '{ "angle": 60, "distance": 120 }',
      run: (args) => {
        const C = core();
        const angle = num(args, "angle", 60);
        if (!(angle > 0 && angle < 180)) {
          throw new Error('"angle" must be strictly between 0 and 180 degrees');
        }
        const distance = num(args, "distance", 120);
        if (!(distance > 0)) throw new Error('"distance" must be a positive length');
        const t = 1 - Math.sin((angle * Math.PI) / 360);
        if (distance * t < C.MIN_CQ) {
          throw new Error(
            `"distance"·(1 − sin(angle/2)) = ${round(distance * t)} is below the core's minimum CQ of ${C.MIN_CQ}`,
          );
        }
        const m = reading(place(distance, t));
        const angleCheck = m.angleAtC.fullDegrees;
        return {
          angleDegrees: angle,
          distance: round(distance),
          ...m,
          angleCheck: {
            expression: "angle = 2·arcsin(1 − t) = 2·arcsin(R/d)",
            requestedDegrees: angle,
            measuredDegrees: angleCheck,
            residual: angleCheck === null ? null : sig(angleCheck - angle),
            holds: angleCheck !== null && close(angleCheck, angle, 1e-5),
          },
          note: `A ${angle}° angle fixes sin(angle/2) = ${round(1 - t, 6)}, so t = CQ/CO = ${m.coef} and, with CO = ${round(distance)}, the big circle has radius R = d(1−t) = ${m.circles.big.radius} and the small one r = d·t·(1−t) = ${m.circles.small.radius}. ${m.allThreeHold ? "All three conditions hold together in this one construction: M,N are the tangency points, MN touches the small circle, and Q lies on the big circle." : "The core did not draw a valid diagram here, so the three conditions could not be measured."}`,
        };
      },
    },

    sweep_ratio: {
      describe:
        "At a fixed distance d = CO, slide Q along CO through `coefs` (ratios t = CQ/CO, each strictly between 0 and 1 with d·t at least 2) and use the real core to report both circles, the radius rule r = d·t·(1−t), and the three tangency conditions at each sample; a bad ratio is rejected with an error. At every valid t all three conditions hold together, illustrating the sangaku claim that any two of them imply the third.",
      args: '{ "distance": 120, "coefs": [0.2, 0.35, 0.5, 0.65, 0.8] }',
      run: (args) => {
        const C = core();
        const distance = num(args, "distance", 120);
        if (!(distance > 0)) throw new Error('"distance" must be a positive length');
        const raw = args.coefs === undefined || args.coefs === null
          ? [0.2, 0.35, 0.5, 0.65, 0.8]
          : args.coefs;
        if (!Array.isArray(raw) || raw.length === 0) {
          throw new Error('"coefs" must be a non-empty array of ratios in (0, 1)');
        }
        if (raw.length > 40) throw new Error('"coefs" is too long (at most 40)');
        const samples = raw.map((v, i) => {
          const t = num({ coef: v }, "coef");
          if (!(t > 0 && t < 1)) throw new Error(`coefs[${i}] must be strictly between 0 and 1`);
          if (distance * t < C.MIN_CQ) {
            throw new Error(
              `coefs[${i}] gives CQ = ${round(distance * t)} < ${C.MIN_CQ}; the core will not draw`,
            );
          }
          const m = reading(place(distance, t));
          return {
            coef: m.coef,
            angleDegrees: m.angleAtC.fullDegrees,
            bigRadius: m.circles.big.radius,
            smallRadius: m.circles.small.radius,
            radiusRuleHolds: m.radiusRule.holds,
            conditions: m.conditions,
            allThreeHold: m.allThreeHold,
          };
        });
        return {
          distance: round(distance),
          samples: samples,
          allValid: samples.every((s) => s.radiusRuleHolds && s.allThreeHold),
          note: `Sliding Q from C towards O changes the vertex angle and both radii, but r = d·t·(1−t) and all three tangency conditions hold at every sampled t. The largest small circle occurs at t = 0.5, where r = d/4 and R = d/2.`,
        };
      },
    },
  };
}

/** Core-derived reading of the fields Track.state saved on the page. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Common Tangent Sangaku state version ${stateVersion}`);
  }
  const C = core();
  const saved = { ...state, stateVersion };
  let s: State;
  try {
    const coef = num(state, "coef");
    if (!(coef >= 0 && coef <= 1)) throw new Error('"coef" must lie between 0 and 1');
    s = {
      ...(C.start({ coef: coef }) as State),
      C: readPoint(state.C, "C"),
      O: readPoint(state.O, "O"),
      Q: readPoint(state.Q, "Q"),
    };
  } catch (err) {
    return {
      ...saved,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs C, O, Q points and a coef between 0 and 1.",
    };
  }

  const m = reading(s);
  const g = C.geometry(s);
  const savedNumber = (key: string): number | null => {
    const v = state[key];
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const savedPoint = (key: string): Point | null => {
    try { return readPoint(state[key], key); } catch { return null; }
  };

  const differences: Array<{ field: string; page: number | null; core: number | null; diff: number | null }> = [];
  const addNumber = (field: string, page: number | null, actual: number | null): void => {
    differences.push({
      field,
      page,
      core: actual === null ? null : round(actual),
      diff: page !== null && actual !== null ? round(Math.abs(page - actual), 9) : null,
    });
  };
  addNumber("radiusO", savedNumber("radiusO"), g ? g.R : null);
  addNumber("radiusQ", savedNumber("radiusQ"), g ? g.r : null);
  differences.push({
    field: "coef",
    page: savedNumber("coef"),
    core: round(s.coef, 9),
    diff: null,
  });

  const pointChecks = (["M", "N"] as const).map((key) => {
    const page = savedPoint(key);
    const actual = g ? g[key] : null;
    return {
      field: key,
      page: pt(page),
      core: pt(actual),
      matches: page !== null && actual !== null &&
        close(page.x, actual.x, 1e-4) && close(page.y, actual.y, 1e-4),
    };
  });

  const savedMatchesCore =
    differences.every((d) => d.page === null || (d.core !== null && close(d.page, d.core, 1e-4))) &&
    pointChecks.every((p) => p.page === null || p.matches);

  return {
    ...saved,
    valid: true,
    core: m,
    savedMatchesCore: savedMatchesCore,
    differences: differences,
    savedPointsMatchCore: pointChecks,
    note: m.canDraw && g
      ? `The saved points give CO = ${m.distanceCO}, CQ = ${m.CQ}, so t = ${m.coef}, R = d(1−t) = ${m.circles.big.radius} and r = d·t·(1−t) = ${m.circles.small.radius}, at a vertex angle of ${m.angleAtC.fullDegrees}°. ${m.allThreeHold ? "All three tangency conditions hold here." : "The core did not confirm all three tangency conditions."} ${savedMatchesCore ? "The saved radii and chord points agree with this construction." : "Some saved numbers differ from a fresh run of the core; see `differences` and `savedPointsMatchCore`."}`
      : "The saved configuration is too close or opens too wide, so the core draws no diagram and the tangency conditions cannot be measured.",
  };
}
