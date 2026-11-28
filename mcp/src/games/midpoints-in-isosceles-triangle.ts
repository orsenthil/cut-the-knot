/*
 * run_game_logic actions and saved-position reader for Midpoints In Isosceles Triangle.
 *
 * In the isosceles triangle ABC (AB = AC), M is the midpoint of BC, H the foot
 * of the perpendicular from M to AB, and D the midpoint of MH; L is the foot
 * from C to AB and K is where AD meets CH. The page claims AD ⟂ CH. The real
 * core (midpoints-in-isosceles-triangle/, copied into src/generated/cores/ at
 * build time) transcribes the applet's Compute: projection onto an infinite
 * line, line intersection and the half-height midpoint construction, including
 * its numerical cut-offs (sqDist(a, p) < 0.1 and |det| < 1).
 *
 * The picture gives away the proof: projection preserves midpoints, so H is
 * the midpoint of BL; triangles BLC and MHA are similar and a quarter turn
 * apart, with BL/MH = LC/HA = BC/AM, and AD and CH are their corresponding
 * medians, hence perpendicular. The old page's third pair, CH ⟂ AM, is a slip:
 * the true pair is BC ⟂ AM. Every number below comes from the core; see
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["midpoints-in-isosceles-triangle"].MidpointsInIsoscelesTriangleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type State = { A: Point; B: Point; C: Point };

/** The applet's own two numerical cut-offs, exposed below with the current residuals. */
const NEAREST_SQ = 0.1; // sqDist(a, p) < 0.1 returns p instead of projecting
const INTERSECT_DET = 1; // |det| < 1 makes the intersection NaN (parallel lines)

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
/** The smaller angle between two rays, from the cosine the core measures. */
const deg = (cosine: number): number | null =>
  Number.isFinite(cosine) ? round((Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI, 3) : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

function cosineBetween(p: Point, q: Point, r: Point, s: Point): number {
  const u = { x: q.x - p.x, y: q.y - p.y };
  const v = { x: s.x - r.x, y: s.y - r.y };
  const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
  if (nu < 1e-12 || nv < 1e-12) return NaN;
  return (u.x * v.x + u.y * v.y) / (nu * nv);
}

/** Tool arguments may use [x, y]; the page saves { x, y }. */
function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing argument "${name}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${name}" must be [x, y] or { "x": ..., "y": ... }`);
    [x, y] = [Number(value[0]), Number(value[1])];
  } else if (typeof value === "object") {
    const o = value as Json;
    x = num(o, "x");
    y = num(o, "y");
  } else {
    throw new Error(`argument "${name}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${name}" needs finite x and y`);
  return { x, y };
}

/**
 * The core's opening triangle, with each supplied corner applied as one of the
 * page's drags: A keeps its x, and dragging B or C mirrors the other across
 * that vertical line at the same height, so AB = AC always. If both base
 * corners are given, C's drag is last and B takes the mirrored position.
 */
function readState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of corners and optional board dimensions");
  }
  const width = num(args, "width", 400); // the core's start() defaults
  const height = num(args, "height", 300);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  let s = C.start({ width, height });
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.withPoint(s, name, readPoint(raw, name));
  }
  return s;
}

/** Unrounded core geometry, shared by both actions and the position reader. */
type Reading = ReturnType<typeof reading>;

function reading(C: Core, s: State) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const midBC = C.midpoint(m.B, m.C);
  const midBL = C.midpoint(m.B, m.L);
  const midMH = C.midpoint(m.M, m.H);
  const gaps = {
    M_to_midBC: C.dist(m.M, midBC),
    H_to_midBL: C.dist(m.H, midBL),
    D_to_midMH: C.dist(m.D, midMH),
  };
  // Repeat the line equations of the core's intersect(A, D, C, H) to show
  // what its |det| < 1 cut-off is measuring for this picture.
  const a1 = m.A.y - m.D.y, b1 = m.D.x - m.A.x;
  const a2 = m.C.y - m.H.y, b2 = m.H.x - m.C.x;
  const det = a1 * b2 - a2 * b1;
  const sqA_M = (m.M.x - m.A.x) ** 2 + (m.M.y - m.A.y) ** 2;
  const sqA_C = (m.C.x - m.A.x) ** 2 + (m.C.y - m.A.y) ** 2;
  const cutoff = {
    nearestPoint: {
      squaredDistance: NEAREST_SQ,
      distance: round(Math.sqrt(NEAREST_SQ)),
      M_from_A_squared: sig(sqA_M),
      C_from_A_squared: sig(sqA_C),
      H_tookShortcut: sqA_M < NEAREST_SQ,
      L_tookShortcut: sqA_C < NEAREST_SQ,
    },
    intersect: {
      absDeterminant: INTERSECT_DET,
      determinant: sig(det),
      parallelByCutoff: Math.abs(det) < INTERSECT_DET,
      K_isNaN: !Number.isFinite(m.K.x) || !Number.isFinite(m.K.y),
    },
  };
  const r1 = m.lengths.MH > 0 ? m.lengths.BL / m.lengths.MH : NaN;
  const r2 = m.lengths.HA > 0 ? m.lengths.LC / m.lengths.HA : NaN;
  const r3 = m.lengths.AM > 0 ? m.lengths.BC / m.lengths.AM : NaN;
  return {
    s, m, cl, midBC, midBL, midMH, gaps, det, cutoff,
    ratios: { BL_over_MH: r1, LC_over_HA: r2, BC_over_AM: r3 },
    result: C.result(),
  };
}

/** A JSON-safe, tutor-facing view of one measured configuration. */
function view(r: Reading) {
  const { m, cl, gaps, ratios, cutoff } = r;
  return {
    triangle: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    constructed: {
      M: pt(m.M), H: pt(m.H), D: pt(m.D),
      L: pt(m.L), K: pt(m.K), N: pt(m.N), label: pt(m.label),
    },
    lengths: {
      AB: round(m.lengths.AB), AC: round(m.lengths.AC), BC: round(m.lengths.BC),
      AM: round(m.lengths.AM), MH: round(m.lengths.MH),
      BL: round(m.lengths.BL), LC: round(m.lengths.LC), HA: round(m.lengths.HA),
      AD: round(m.lengths.AD), CH: round(m.lengths.CH),
    },
    midpoints: {
      M_midpointOfBC: pt(r.midBC), H_midpointOfBL: pt(r.midBL), D_midpointOfMH: pt(r.midMH),
      gaps: { M: sig(gaps.M_to_midBC), H: sig(gaps.H_to_midBL), D: sig(gaps.D_to_midMH) },
      D_halvesMH: cl.DmidMH === true,
    },
    equalRatios: {
      BL_over_MH: round(ratios.BL_over_MH),
      LC_over_HA: round(ratios.LC_over_HA),
      BC_over_AM: round(ratios.BC_over_AM),
      equal: near(ratios.BL_over_MH, ratios.LC_over_HA, 1e-6)
        && near(ratios.LC_over_HA, ratios.BC_over_AM, 1e-6),
    },
    anglesDegrees: {
      AD_to_CH: deg(m.cosADCH), atK: deg(m.cosK),
      CL_to_AH: deg(m.cosCLAH), BL_to_MH: deg(m.cosBLMH),
      CH_to_AM: deg(m.cosCHAM), BC_to_AM: deg(m.cosBCAM),
    },
    cosines: {
      AD_CH: sig(m.cosADCH), K: sig(m.cosK),
      CL_AH: sig(m.cosCLAH), BL_MH: sig(m.cosBLMH),
      CH_AM: sig(m.cosCHAM), BC_AM: sig(m.cosBCAM),
    },
    claims: { ...cl },
    appletCutoffs: cutoff,
    degenerate: m.degenerate,
    scale: round(m.scale),
    doubleArea: round(m.doubleArea),
    isIllustration: true,
    result: r.result,
  };
}

const EXAMPLE_ARGS = '{ "A": [200, 100], "B": [100, 200], "C": [300, 200] }';

export function actions(): GameActions {
  return {
    construct: {
      describe:
        "Construct the illustration for a triangle A, B, C (each [x, y] or {x, y}): with the real core find M on BC, H the foot from M to AB, D the midpoint of MH, L the foot from C to AB and K where AD meets CH; report the lengths, the equal ratios BL/MH = LC/HA = BC/AM, the angles at K and between AD and CH, and the applet's 0.1 and 1.0 numerical cut-offs. Giving a corner drags it as the page does (A keeps its x, a dragged B or C mirrors the other, so AB = AC; with both base corners given, C's drag wins), and the notes explain why H halves BL, why D halves MH, and why the page's CH ⟂ AM line is a slip.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const r = reading(C, readState(C, args));
        const v = view(r);
        return {
          ...v,
          note: r.m.degenerate
            ? "These corners make a flat or collapsed triangle, or push the lines past one of the applet's cut-offs (projection within 0.316 units of A, or |det| < 1), so the core reports no valid construction. Move the apex away from the base and try again."
            : `M is the midpoint of BC at (${v.constructed.M?.x}, ${v.constructed.M?.y}), H the foot from M to AB at (${v.constructed.H?.x}, ${v.constructed.H?.y}), and D halves MH at (${v.constructed.D?.x}, ${v.constructed.D?.y}), the same point the core's midpoint gives (gap ${v.midpoints.gaps.D} units). Projection preserves midpoints, so H also halves BL; triangles BLC and MHA are similar a quarter turn apart with ratios ${v.equalRatios.BL_over_MH}, ${v.equalRatios.LC_over_HA} and ${v.equalRatios.BC_over_AM}, and their medians AD and CH meet at ${v.anglesDegrees.AD_to_CH}° at K. The old page also lists CH ⟂ AM, but here that angle is ${v.anglesDegrees.CH_to_AM}°, so that pair is a slip — the true pair is BC ⟂ AM at ${v.anglesDegrees.BC_to_AM}°. This is an illustration, so there is no win or loss.`,
        };
      },
    },

    check_claims: {
      describe:
        "Check every claim the illustration makes at a triangle A, B, C with the real core: AB = AC, M mid BC, MH ⟂ AB, D mid MH, H mid BL, AD ⟂ CH with the right angle at K, the three equal side ratios of the similar triangles BLC and MHA, the median facts, the true pair BC ⟂ AM, and the page's false CH ⟂ AM claim. Each check returns a pass/fail and a cosine or length residual, plus a degeneracy flag and the failed true claims; corners, drags and validation are as in construct.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const r = reading(C, readState(C, args));
        const { cl, m } = r;
        const checks = {
          isosceles: { holds: cl.isosceles, residual: sig(m.lengths.AB - m.lengths.AC) },
          MmidBC: { holds: cl.MmidBC, residual: sig(r.gaps.M_to_midBC) },
          MHperpAB: { holds: cl.MHperpAB, residual: sig(cosineBetween(m.M, m.H, m.A, m.B)) },
          DmidMH: { holds: cl.DmidMH, residual: sig(r.gaps.D_to_midMH) },
          ADperpCH: { holds: cl.ADperpCH, residual: sig(m.cosADCH) },
          rightAngleAtK: { holds: cl.rightAngleAtK, residual: sig(m.cosK) },
          HmidBL: { holds: cl.HmidBL, residual: sig(r.gaps.H_to_midBL) },
          CLperpAH: { holds: cl.CLperpAH, residual: sig(m.cosCLAH) },
          BLperpMH: { holds: cl.BLperpMH, residual: sig(m.cosBLMH) },
          BCperpAM: { holds: cl.BCperpAM, residual: sig(m.cosBCAM) },
          similarBLC_MHA: {
            holds: cl.similarBLC_MHA,
            residual: sig(Math.max(
              Math.abs(r.ratios.BL_over_MH - r.ratios.LC_over_HA),
              Math.abs(r.ratios.LC_over_HA - r.ratios.BC_over_AM),
            )),
          },
          medians: { holds: cl.medians, residual: sig(Math.max(r.gaps.H_to_midBL, r.gaps.D_to_midMH)) },
          pageCHperpAM: { holds: cl.pageCHperpAM, residual: sig(m.cosCHAM), expected: false },
        };
        const failed = Object.entries(checks)
          .filter(([name, check]) => name !== "pageCHperpAM" && !check.holds)
          .map(([name]) => name);
        return {
          triangle: view(r).triangle,
          degenerate: m.degenerate,
          validInstance: !m.degenerate,
          claims: checks,
          allTrueClaimsHold: !m.degenerate && failed.length === 0,
          failedTrueClaims: failed,
          pageClaimIsSlip: cl.pageCHperpAM !== true,
          note: m.degenerate
            ? "A flat or collapsed triangle gives the core no construction, so every claim is reported false rather than guessed."
            : failed.length
              ? `Failed: ${failed.join(", ")}. The page keeps the triangle isosceles by mirroring a dragged base corner about A's vertical line, so a genuine non-flat picture should pass all twelve true claims and fail only the page's CH ⟂ AM slip.`
              : "All twelve genuine claims hold at the core's 1e-7 tolerance, with cosines and midpoint gaps near zero. The one false row is the page's own CH ⟂ AM sentence: CH is not a side of BLC, and the true perpendicular pair is BC ⟂ AM. This is a demonstration with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Midpoints In Isosceles Triangle state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Midpoints In Isosceles Triangle position must be an object");
  }
  const C = core();
  const s = {
    A: readPoint(state.A, "A"),
    B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"),
  };
  const r = reading(C, s);
  const v = view(r);
  return {
    stateVersion,
    A: v.triangle.A, B: v.triangle.B, C: v.triangle.C,
    reading: v,
    ADperpCH: r.cl.ADperpCH,
    rightAngleAtK: r.cl.rightAngleAtK,
    pageCHperpAM: r.cl.pageCHperpAM,
    degenerate: r.m.degenerate,
    note: r.m.degenerate
      ? "Track.state saved the three corners the player drags, but here they are flat or collapsed: the core draws no construction, so AD ⟂ CH cannot be checked."
      : `Track.state saved the three corners A, B and C. The core rebuilds M, H, D, L and K from them: D halves MH, H halves BL, the ratios BL/MH, LC/HA and BC/AM agree, and AD is perpendicular to CH at the saved position. The page's CH ⟂ AM sentence remains false (${v.anglesDegrees.CH_to_AM}° here); the true pair is BC ⟂ AM. This is an illustration, so there is no win or loss.`,
  };
}
