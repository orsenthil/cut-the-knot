/*
 * run_game_logic actions and saved-position reader for Brahmagupta 2.
 * Every number below comes from the real core,
 * brahmagupta-2/brahmagupta-2-core.js, copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * The construction: A, B, C, D lie on one circle with centre O. P, Q, R, S are
 * the midpoints of AB, BC, CD, DA. From each midpoint drop a perpendicular to
 * the opposite side (a "maltitude"). The Varignon midlines PR and QS meet at
 * K = (A + B + C + D) / 4, the anticenter T is O reflected in K, so
 *
 *     T = 2K - O = (A + B + C + D) / 2 - O,
 *
 * and all four maltitudes pass through T. Since OK = KT and PK = KR, triangles
 * OKR and TKP match, giving PT parallel to OR; OR is perpendicular to the
 * chord CD, hence PT is the maltitude through P. The other three are the same.
 *
 * This is the *second* Brahmagupta theorem: unlike the first, it needs no
 * perpendicular diagonals. When AC and BD are perpendicular the diagonal
 * crossing is exactly T, so the first theorem's four bisections reappear as a
 * special case; otherwise the crossing is another point and the first theorem
 * says nothing, while the four maltitudes still concur. The diagonalCase()
 * helper reports both situations.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["brahmagupta-2"].Brahmagupta2Core;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Figure = ReturnType<Core["figure"]>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const residual = (v: number): number | null => (Number.isFinite(v) ? round(v) : null);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept [x, y] or { "x": ..., "y": ... }, falling back to the reset corner. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: numField(o, "x", key), y: numField(o, "y", key) };
  }
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** A finite number from a nested point object, with a helpful error message. */
function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`argument "${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/**
 * A core state from either four angles on the circle (radians, y down) or
 * four corners; the page's 400 x 250 board is the default.
 */
function readState(C: Core, args: Json): State {
  const width = num(args, "width", C.APPLET.width);
  const height = num(args, "height", C.APPLET.height);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('arguments "width" and "height" must be positive board sizes');
  }
  const home = C.start({ width, height });
  const names = ["A", "B", "C", "D"] as const;
  const hasCorners = names.some((name) => args[name] !== undefined && args[name] !== null);
  const rawAngles = args.angles;
  if (rawAngles !== undefined && rawAngles !== null) {
    if (hasCorners) throw new Error('give either "angles" or corners A-D, not both');
    if (!Array.isArray(rawAngles) || rawAngles.length !== 4) {
      throw new Error('argument "angles" must be an array of four numbers (radians)');
    }
    const angles = rawAngles.map((v, i) => {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error(`angles[${i}] must be a number, got ${JSON.stringify(v)}`);
      return n;
    });
    let s = home;
    names.forEach((name, i) => { s = C.withAngle(s, name, angles[i]); });
    return s as State;
  }
  return {
    width, height,
    A: readPoint(args, "A", home.A),
    B: readPoint(args, "B", home.B),
    C: readPoint(args, "C", home.C),
    D: readPoint(args, "D", home.D),
  } as State;
}

function figureFor(C: Core, args: Json): { s: State; f: Figure } {
  const s = readState(C, args);
  const f = C.figure(s);
  if (!C.finite(f.T) || !C.finite(f.K)) {
    throw new Error(
      "those corners make parallel lines, so the maltitudes have no meeting point. " +
      "Give four distinct corners on one circle and try again.",
    );
  }
  return { s, f };
}

/**
 * Compare the diagonal crossing with the anticenter. This is the one place the
 * first theorem's condition matters: the crossing is T only when AC ⟂ BD.
 */
function diagonalCase(C: Core, s: State, f: Figure) {
  const ac = C.sub(s.C, s.A);
  const bd = C.sub(s.D, s.B);
  const dot = C.dot(ac, bd);
  const lengths = Math.hypot(ac.x, ac.y) * Math.hypot(bd.x, bd.y);
  const cosine = lengths > 0 ? dot / lengths : NaN;
  const crossing = C.meet(s.A, s.C, s.B, s.D);
  const gap = C.finite(crossing) ? C.distance(crossing, f.T) : NaN;
  const perpendicular = Number.isFinite(cosine) && Math.abs(cosine) < 1e-9;
  const tolerance = 1e-5 * Math.max(1, f.r);
  return {
    perpendicular,
    dotProduct: round(dot),
    cosine: round(cosine),
    crossing: pt(crossing),
    crossingGapToT: round(gap),
    firstTheoremCrossingIsT: perpendicular && Number.isFinite(gap) && gap < tolerance,
  };
}

/** Tutor-friendly reading of one drawing, in the page's 400 x 250 board units. */
function reading(C: Core, s: State, f: Figure) {
  const cl = C.claims(s);
  const tolerance = 1e-5 * Math.max(1, f.r);
  const radialMiss = Math.max(...[s.A, s.B, s.C, s.D].map((p) => Math.abs(C.distance(p, f.O) - f.r)));
  return {
    circle: { center: pt(f.O), radius: round(f.r) },
    corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
    cyclic: { biggestRadialMiss: round(radialMiss), allCornersOnCircle: radialMiss < tolerance },
    sideMidpoints: { P_AB: pt(f.P), Q_BC: pt(f.Q), R_CD: pt(f.R), S_DA: pt(f.S) },
    oppositeSideFeet: { E_on_CD: pt(f.E), F_on_AD: pt(f.F), G_on_AB: pt(f.G), H_on_BC: pt(f.H) },
    varignonPointK: {
      fromMidlines: pt(f.K),
      fromCornerFormula: pt(C.centroid(s)),
      gap: residual(cl.centroidGap),
    },
    anticenterT: {
      fromMaltitudes: pt(f.T),
      fromCornerFormula: pt(C.anticenter(s)),
      gap: residual(cl.anticenterGap),
    },
    halfway: {
      midpointOfOAndT: pt(C.mid(f.O, f.T)),
      matchesK: residual(cl.midpointGap),
    },
    maltitudes: f.maltitudes.map((m) => ({
      name: m.name,
      fromMidpoint: pt(m.through),
      footOnOppositeSide: pt(m.foot),
      oppositeSide: [pt(m.side[0]), pt(m.side[1])],
    })),
    concurrence: {
      biggestDistanceFromT: residual(cl.maltitudeMiss),
      biggestPerpendicularResidual: residual(cl.perpendicularResidual),
      allFourMeetAtT: cl.maltitudeMiss < tolerance && cl.perpendicularResidual < tolerance,
    },
    diagonals: diagonalCase(C, s, f),
    tolerance: round(tolerance),
    note:
      "K = (A + B + C + D)/4 is where the Varignon midlines PR and QS meet. " +
      "T = 2K - O = (A + B + C + D)/2 - O lies on the line OK with K halfway between O and T. " +
      "All four maltitudes pass through T; no condition on the diagonals is needed.",
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For four corners A, B, C, D of a cyclic quadrilateral (as [x, y] points, or as four angles in radians on the page's circle), report the circumcentre O and radius, the side midpoints P, Q, R, S, the feet of the four maltitudes on the opposite sides, the Varignon point K = (A+B+C+D)/4 where PR and QS meet, and the anticenter T = 2K-O where the maltitudes meet. Also report the midpoint of O and T, the largest distance of T from any maltitude, and whether the diagonals are perpendicular and their crossing equals T. Omit the corners to use the reset picture.",
      args: '{ "angles": [-2, 0.4, 1.2, 0.2] }',
      run: (args) => {
        const C = core();
        const { s, f } = figureFor(C, args);
        return reading(C, s, f);
      },
    },
    check_claims: {
      describe:
        "Measure every claim on the illustration's page for a cyclic quadrilateral: the four maltitudes concur at T and are perpendicular to the opposite sides, T is the anticenter (A+B+C+D)/2 - O, K is the centroid (A+B+C+D)/4 and the midpoint of both O-T and the Varignon midlines, UT is perpendicular to SQ where U = AD ∩ BC, and T is the midpoint of the reflections of O in AB and CD. Returns each residual, the drawing's tolerance, the failed claims, and how this differs from the first Brahmagupta theorem: when the diagonals are perpendicular their crossing is T, but the four maltitudes concur whether or not that condition holds.",
      args: '{ "angles": [-2, 0.4, 1.2, 1.9415926535897932] }',
      run: (args) => {
        const C = core();
        const { s, f } = figureFor(C, args);
        const cl = C.claims(s);
        const tolerance = 1e-5 * Math.max(1, f.r);
        const checks: Record<string, number> = {
          maltitudesConcurrentAtT: cl.maltitudeMiss,
          maltitudesPerpendicularToOppositeSides: cl.perpendicularResidual,
          TIsAnticenter: cl.anticenterGap,
          KIsCentroid: cl.centroidGap,
          KMidpointOfOTAndVarignonMidlines: cl.midpointGap,
          problem1_UTperpendicularSQ: cl.problem1,
          problem2_TMidpointOfReflectedO: cl.problem2,
        };
        const residuals: Record<string, number | null> = {};
        for (const [name, value] of Object.entries(checks)) residuals[name] = residual(value);
        const failed = Object.keys(checks).filter((name) => !(checks[name] < tolerance));
        const diags = diagonalCase(C, s, f);
        return {
          points: { O: pt(f.O), K: pt(f.K), T: pt(f.T) },
          residuals,
          tolerance: round(tolerance),
          failed,
          allHold: failed.length === 0,
          diagonals: diags,
          note:
            "The second theorem needs only a cyclic quadrilateral: the four maltitudes meet at T = 2K - O. " +
            (diags.perpendicular
              ? "Here the diagonals are perpendicular, the first theorem's case: their crossing is T, so its four perpendiculars bisect the opposite sides too."
              : "Here the diagonals are not perpendicular, so their crossing is a different point and the first theorem does not apply; the four maltitudes still meet at T."),
        };
      },
    },
  };
}

/** The page's saved board and corners, plus a fresh core reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const here = readState(C, state);
  const corners = { A: pt(here.A), B: pt(here.B), C: pt(here.C), D: pt(here.D) };
  const f = C.figure(here);
  if (!C.finite(f.T) || !C.finite(f.K)) {
    return {
      stateVersion,
      board: { width: here.width, height: here.height },
      corners,
      reading: null,
      note: "The saved corners make parallel lines, so the maltitudes have no single meeting point. Move a corner to see the drawing.",
    };
  }
  return {
    stateVersion,
    board: { width: here.width, height: here.height },
    corners,
    reading: reading(C, here, f),
    note:
      "The page shows the four maltitudes through T = 2K - O. " +
      "K = (A + B + C + D)/4 is the midpoint of O and T and of both Varignon midlines; " +
      "the concurrence holds for every cyclic quadrilateral, with or without perpendicular diagonals.",
  };
}
