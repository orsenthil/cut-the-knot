/*
 * run_game_logic actions and saved-position reader for Asia Pacific Kite.
 *
 * ABCD is a rhombus made of two equilateral triangles (the angle at B is 60°).
 * A line through D meets AB at E and BC at F; M = CE ∩ AF and N is the second
 * meeting point of the circumcircles (AEM) and (CFM). As the line turns, M
 * stays on the circumcircle of ABC: CA² = CM·CE = AM·AF is the power of C
 * and of A, which makes AC tangent to both small circles. An inscribed-angle
 * chase puts E, N and F in a straight line, so N lies on the line through D.
 *
 * Every number below comes from the real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["asia-pacific-kite"].AsiaPacificKiteCore;
type Point = { x: number; y: number };

/** The core is plain JS; use it through a loose type, as the other geometry readers do. */
type C = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const round = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1e6) / 1e6;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x) as number, y: round(p.y) as number } : null;
const circ = (c: { x: number; y: number; r: number } | null): { center: Point; radius: number } | null =>
  c ? { center: pt(c) as Point, radius: round(c.r) as number } : null;

/** Accept [x, y] (tool calls) as well as { x, y } (the page's saved state). */
function readPoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} needs finite x and y`);
  return { x, y };
}

function pointField(o: Json, key: string, fallback: Point, label: string): Point {
  const v = o[key];
  return v === undefined || v === null ? fallback : readPoint(v, label);
}

function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The board is the page's 400 x 300 SVG viewBox; keep it large enough to draw. */
function boardSize(o: Json, key: string, fallback: number): number {
  if (o[key] === undefined || o[key] === null) return fallback;
  const v = num(o, key);
  if (!(v >= 100 && v <= 4000)) throw new Error(`argument "${key}" must be between 100 and 4000`);
  return v;
}

/**
 * One line through D, specified exactly one way:
 *   coefE  the core's parameter of E on AB (1 at A, 0 at B, > 1 past A, < 0 past B)
 *   E      a point to project onto AB, as when the page's handle E is dragged
 *   F      a point to project onto BC, as when the page's handle F is dragged
 */
function readLine(K: C, args: Json) {
  const width = boardSize(args, "width", 400);
  const height = boardSize(args, "height", 300);
  let s = K.start({ width, height });
  const E = pointOrNull(args, "E");
  const F = pointOrNull(args, "F");
  const hasCoef = args.coefE !== undefined && args.coefE !== null;
  const given = Number(Boolean(E)) + Number(Boolean(F)) + Number(hasCoef);
  if (given !== 1) {
    throw new Error("give exactly one of coefE, E or F to fix the line through D");
  }
  if (hasCoef) {
    const t = num(args, "coefE");
    if (!(Math.abs(t) <= 50)) {
      throw new Error('argument "coefE" must be between -50 and 50 (1 at A, 0 at B)');
    }
    s = { ...s, E: K.pointOnLine(s.A, s.B, t), coefE: t };
    s = K.computeF(s); // intersect DE with BC, exactly as the applet does
  } else if (E) {
    s = K.withPoint(s, "E", E); // projects onto AB, then recomputes F
  } else if (F) {
    s = K.withPoint(s, "F", F);
  }
  return s;
}

function pointOrNull(o: Json, key: string): Point | null {
  const v = o[key];
  return v === undefined || v === null ? null : readPoint(v, `argument "${key}"`);
}

/** Rebuild the core state the page saved with Track.state. */
function readSaved(K: C, state: Json) {
  const width = boardSize(state, "width", 400);
  const height = boardSize(state, "height", 300);
  const fresh = K.start({ width, height });
  const A = pointField(state, "A", fresh.A, "state.A");
  const B = pointField(state, "B", fresh.B, "state.B");
  const Cc = pointField(state, "C", fresh.C, "state.C");
  const D = pointField(state, "D", fresh.D, "state.D");
  const E = pointField(state, "E", fresh.E, "state.E");
  const F = pointField(state, "F", fresh.F, "state.F");
  return {
    width, height, A, B, C: Cc, D, E, F,
    coefE: finiteNumber(state.coefE) ?? K.lineParam(A, B, E),
    coefF: finiteNumber(state.coefF) ?? K.lineParam(B, Cc, F),
  };
}

/** Measured geometry and identities, all computed by the core. */
function reading(K: C, s: any) {
  const g = K.geometry(s);
  const cl = K.claims(s);
  const M = K.finite(g.M) ? g.M : null;
  const N = K.finite(g.N) ? g.N : null;
  const E = K.finite(s.E) ? s.E : null;
  const F = K.finite(s.F) ? s.F : null;
  const ca2 = K.dist(s.C, s.A) ** 2;
  const cmce = M && E ? K.dist(M, s.C) * K.dist(E, s.C) : null;
  const amaf = M && F ? K.dist(M, s.A) * K.dist(F, s.A) : null;
  const mOnCircle = M && g.circleABC ? K.dist(M, g.circleABC) - g.circleABC.r : null;
  const tanA = g.circleAEM ? K.distToLine(g.circleAEM, s.A, s.C) - g.circleAEM.r : null;
  const tanC = g.circleCFM ? K.distToLine(g.circleCFM, s.A, s.C) - g.circleCFM.r : null;
  const nOnEF = N && E && F ? K.distToLine(N, E, F) : null;
  const dOnEF = E && F ? K.distToLine(s.D, E, F) : null;
  const angleAMC = M ? K.angleAt(M, s.A, s.C) : null;
  const exterior = K.isExterior(s) === true;
  return {
    points: { E: pt(E), F: pt(F), M: pt(M), N: pt(N) },
    circles: { ABC: circ(g.circleABC), AEM: circ(g.circleAEM), CFM: circ(g.circleCFM) },
    powers: {
      CA_squared: round(ca2),
      CM_times_CE: round(cmce),
      AM_times_AF: round(amaf),
      errors: { atC: round(cmce === null ? null : cmce - ca2), atA: round(amaf === null ? null : amaf - ca2) },
      holds: { atC: cl.powerC === true, atA: cl.powerA === true },
    },
    tangency: {
      circleAEM_touches_AC_at_A: cl.tangentA === true,
      circleCFM_touches_AC_at_C: cl.tangentC === true,
      distanceMinusRadius: { AEM: round(tanA), CFM: round(tanC) },
    },
    MOnCircumcircleOfABC: {
      holds: cl.MOnCircle === true,
      distanceMinusRadius: round(mOnCircle),
      angleAMCDegrees: round(angleAMC),
    },
    secondCircleIntersection: {
      N: pt(N),
      distanceFromM: round(M && N ? K.dist(M, N) : null),
      distanceFromLineEF: round(nOnEF),
      D_distanceFromLineEF: round(dOnEF),
      onEF: cl.NOnEF === true,
    },
    rhombus: cl.rhombus === true,
    angleAtBIs60: cl.angleABC === true,
    exteriorArc: cl.exteriorArc === true,
    configuration: exterior
      ? "E past A and F past C: M is on the 120° arc AC away from B"
      : "E or F elsewhere on its line: M is on the other, 60° arc (or the picture is degenerate)",
    note:
      "M = CE ∩ AF. The power of C in (AEM) is CM·CE = CA², so AC touches that circle at A; the power of A in (CFM) is AM·AF = CA², so AC touches it at C. N is the other intersection of those two circles, and it lies on the line E-D-F.",
  };
}

export function actions(): GameActions {
  return {
    line_through_D: {
      describe:
        "Turn the line through D that meets AB at E and BC at F: give coefE (the core's parameter of E on AB, 1 at A, 0 at B, above 1 past A, below 0 past B), or give a point E or F to drag to. Reports E, F, M = CE ∩ AF, the circumcircle of ABC, N = the second intersection of circles (AEM) and (CFM), the measured identities CA² = CM·CE = AM·AF, the two tangencies of AC, angle AMC (120° on the exterior arc, 60° on the other), and the distances showing that M is on the circle and that D, E, N, F are collinear. width and height default to the page's 400 by 300 viewBox.",
      args: '{ "coefE": 1.8 }',
      run: (args) => {
        const K = core();
        return reading(K, readLine(K, args));
      },
    },
    check_claims: {
      describe:
        "For the same line through D, report each claim on the page as a boolean: the four equal sides, the 60° angle at B, M on the circumcircle of ABC, N on EF, CA² = CM·CE, CA² = AM·AF, AC tangent to (AEM) and to (CFM), and angle AMC equal to 60° or 120°. Failed invariant claims are named; exteriorArc is descriptive (it says which arc M is on, so it is false in the 60° configuration without being a failure). Also reports whether the page's Check the claims button would light up.",
      args: '{ "coefE": 1.8 }',
      run: (args) => {
        const K = core();
        const s = readLine(K, args);
        const cl = K.claims(s);
        const names = [
          "rhombus", "angleABC", "MOnCircle", "NOnEF", "powerC", "powerA",
          "tangentA", "tangentC", "angleAMC",
        ] as const;
        const failed = names.filter((name) => cl[name] !== true);
        return {
          rhombus: cl.rhombus === true,
          angleABC: cl.angleABC === true,
          MOnCircle: cl.MOnCircle === true,
          NOnEF: cl.NOnEF === true,
          powerC: cl.powerC === true,
          powerA: cl.powerA === true,
          tangentA: cl.tangentA === true,
          tangentC: cl.tangentC === true,
          angleAMC: cl.angleAMC === true,
          exteriorArc: cl.exteriorArc === true,
          allInvariantsHold: failed.length === 0,
          failed,
          checkedLikeThePage: Boolean(K.finite(K.geometry(s).M)) && cl.rhombus === true &&
            cl.MOnCircle === true && cl.NOnEF === true,
          note: cl.exteriorArc === true
            ? "All the invariant claims hold and M is on the 120° arc AC away from B, the olympiad configuration."
            : "The invariant claims describe the whole circle; with E and F elsewhere M is on the other arc, where angle AMC is 60° instead of 120°.",
        };
      },
    },
  };
}

/** The saved kite and line, with a fresh reading from the same core. */
export function position(state: Json, stateVersion: number): unknown {
  const K = core();
  const s = readSaved(K, state);
  return {
    stateVersion,
    board: { width: s.width, height: s.height },
    corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
    line: {
      E: pt(s.E), F: pt(s.F),
      coefE: round(s.coefE), coefF: round(s.coefF),
      exterior: K.isExterior(s) === true,
    },
    reading: reading(K, s),
    note:
      "This is the kite and line saved by the page. The corners fix the two equilateral triangles; the reading recomputes M, N and the circle through A, B and C with the core the page itself uses.",
  };
}
