/*
 * run_game_logic actions and saved-position reader for Altitude Mirror 2.
 *
 * The core lives in altitude-mirror-2/ and is copied into src/generated/cores/
 * at build time. Every point and measurement below comes from that core, so
 * the tutor cannot drift from the drawing on the page. See _shared.ts for the
 * module shape.
 *
 * The picture: AB is a diameter of a circle, C and D are handles on its upper
 * arc (C on the left, D on the right). E = AD n BC, F is the foot of the
 * perpendicular from E to AB, and E' is E reflected in AB. Reflecting C and D
 * gives C', D'; in the hexagon A D C' B C D' the three Pascal points are E,
 * F and E', so they are collinear. Symmetry also makes FC and FD mirror
 * images, hence EF bisects angle CFD, each half being |c - d| / 2.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["altitude-mirror-2"].AltitudeMirror2Core;

type Point = { x: number; y: number };
type Board = { cx: number; cy: number; r: number };

/* The generated core is plain JS, so TypeScript infers optional or nullable
 * fields from its early-return branches. These are the shapes on the valid
 * path that the checks below establish at run time. */
type CoreState = { c: number; d: number; names: boolean; hint: boolean; statement: boolean };
type CoreGeometry = {
  valid: true; A: Point; B: Point; C: Point; D: Point; Cp: Point; Dp: Point;
  E: Point; F: Point; Ep: Point; Fp: Point | null; E2: Point | null; S: Point | null;
};
type CoreClaims = {
  valid: true; angleCFE: number; angleEFD: number; angleCFD: number; halfAngle: number;
  pascalCross: number; fpGap: number; e2Gap: number; acb: number; adb: number;
  altitudeA: number; altitudeB: number; altitudeS: number; sameVertical: number;
};

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const deg = (radians: number): number => round((radians * 180) / Math.PI, 4);
const distance = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const pt = (p: Point | null | undefined) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** The circle centre and radius: the page's board unless overridden. */
function board(args: Json): Board {
  const b = core().BOARD;
  const out = { cx: num(args, "cx", b.cx), cy: num(args, "cy", b.cy), r: num(args, "radius", b.r) };
  if (!(out.r > 0)) throw new Error(`radius must be positive, got ${out.r}`);
  return out;
}

/** A handle angle in radians, checked against the arc the page allows. */
function arcAngle(args: Json, key: string, which: "C" | "D"): number {
  const C = core();
  const v = num(args, key);
  const clamped = C.clampAngle(which, v);
  if (clamped === null) throw new Error(`${key} must be a finite angle in radians`);
  if (Math.abs(clamped - v) > 1e-12) {
    const lo = which === "C" ? C.C_MIN : C.D_MIN;
    const hi = which === "C" ? C.C_MAX : C.D_MAX;
    throw new Error(`${key} must lie in [${round(lo, 4)}, ${round(hi, 4)}] radians for handle ${which}`);
  }
  return v;
}

/** Read a saved or supplied state and rebuild the whole construction. */
function read(args: Json) {
  const C = core();
  const b = board(args);
  const c = arcAngle(args, "c", "C");
  const d = arcAngle(args, "d", "D");
  const s = C.start({ c, d, names: args.names !== false, hint: args.hint === true, statement: args.statement === true }) as unknown as CoreState;
  const g = C.geometry(s, b) as unknown as CoreGeometry;
  const m = C.claims(s, b) as unknown as CoreClaims;
  return { s, b, g, m };
}

/** What the core says about one drawing: the named points and every claim. */
function reading(args: Json) {
  const { s, b, g, m } = read(args);
  if (!g.valid || !m.valid) throw new Error("the construction is degenerate: C and D must be distinct and off AB");

  /* Normalise the Pascal cross product by the two lengths, so the number is
   * the sine of the angle between EF and EE' rather than an area that grows
   * with the circle. */
  const denom = distance(g.E, g.F) * (g.E2 ? distance(g.E2, g.F) : 0);
  const pascalSine = denom ? Math.abs(m.pascalCross) / denom : Math.abs(m.pascalCross);
  const collinear = pascalSine < 1e-9 && m.fpGap < 1e-6 && m.e2Gap < 1e-6 && Math.abs(m.sameVertical) < 1e-6;
  const equalHalves = Math.abs(m.angleCFE - m.angleEFD) < 1e-8
    && Math.abs(m.angleCFE - m.halfAngle) < 1e-8
    && Math.abs(m.angleCFD - Math.abs(s.c - s.d)) < 1e-8;
  const scale = b.r * b.r;
  const rightAngles = Math.abs(m.acb) < 1e-6 * scale && Math.abs(m.adb) < 1e-6 * scale;
  const orthocenter = Math.abs(m.altitudeA) < 1e-6 * scale && Math.abs(m.altitudeB) < 1e-6 * scale
    && Math.abs(m.altitudeS) < 1e-8 && Math.abs(m.sameVertical) < 1e-6;

  const E = pt(g.E), F = pt(g.F), Ep = pt(g.Ep);
  return {
    valid: true,
    circle: { cx: b.cx, cy: b.cy, radius: b.r, A: pt(g.A), B: pt(g.B) },
    c: round(s.c),
    d: round(s.d),
    cDegrees: deg(s.c),
    dDegrees: deg(s.d),
    C: pt(g.C),
    D: pt(g.D),
    Cp: pt(g.Cp),
    Dp: pt(g.Dp),
    E,
    F,
    Ep,
    S: pt(g.S),
    otherPascalPoints: { Fp: pt(g.Fp), E2: pt(g.E2) },
    pascal: {
      hexagon: "A D C' B C D'",
      collinear,
      cross: round(m.pascalCross, 9),
      sineOfAngleEF_EEp: round(pascalSine, 12),
      F_is_DCprime_n_CDprime: m.fpGap < 1e-6,
      Ep_is_CprimeB_n_DprimeA: m.e2Gap < 1e-6,
      gapFpF: round(m.fpGap, 9),
      gapE2Ep: round(m.e2Gap, 9),
      xGapSF: round(m.sameVertical, 9),
    },
    angle: {
      CFD: deg(m.angleCFD),
      CFE: deg(m.angleCFE),
      EFD: deg(m.angleEFD),
      eachHalf: deg(m.halfAngle),
      eachHalfRadians: round(m.halfAngle),
      equalHalves,
      halfIsArcDifference: Math.abs(m.halfAngle - Math.abs(s.c - s.d) / 2) < 1e-12,
    },
    rightAngles: { acb: round(m.acb, 9), adb: round(m.adb, 9), bothRight: rightAngles },
    orthocenter: { altitudeA: round(m.altitudeA, 9), altitudeB: round(m.altitudeB, 9), altitudeS: round(m.altitudeS, 9), E_is_orthocenter_of_ABS: orthocenter },
    note: `E = AD n BC is (${E!.x}, ${E!.y}); its foot on the diameter, F, is (${F!.x}, ${F!.y}); E' is (${Ep!.x}, ${Ep!.y}). ${collinear ? "E, F and E' lie on one straight line, the Pascal line of A D C' B C D'." : "E, F and E' do not line up."} ${equalHalves ? `EF bisects angle CFD into two equal angles of ${deg(m.halfAngle)}° = |C - D| / 2.` : "The two halves are not equal."}`,
  };
}

/** Validated pairs for the sweep: the applet's two arcs, or caller-supplied pairs. */
function pairs(args: Json): Array<[number, number]> {
  if (args.pairs === undefined) {
    const C = core();
    const out: Array<[number, number]> = [];
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        out.push([
          C.C_MIN + (C.C_MAX - C.C_MIN) * u,
          C.D_MIN + (C.D_MAX - C.D_MIN) * v,
        ]);
      }
    }
    return out;
  }
  if (!Array.isArray(args.pairs)) throw new Error("pairs must be an array of [c, d] angle pairs");
  if (args.pairs.length > 200) throw new Error("pairs may hold at most 200 positions");
  return args.pairs.map((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`pairs[${i}] must be [c, d]`);
    const p = numArray({ pair }, "pair");
    const c = arcAngle({ c: p[0] }, "c", "C");
    const d = arcAngle({ d: p[1] }, "d", "D");
    return [c, d] as [number, number];
  });
}

export function actions(): GameActions {
  return {
    construction: {
      describe: "For a circle with diameter AB (centre (200, 125) and radius 88 by default; override with cx, cy and radius) and handles C on the left arc and D on the right arc at angles c and d in radians: report E = AD and BC's crossing, F the foot of the perpendicular from E to AB, and E' the reflection of E in AB. Also report the Pascal collinearity of E, F, E' in the hexagon A D C' B C D', and the two equal halves of angle CFD, each |c - d| / 2.",
      args: '{ "c": 2.526304952767475, "d": 0.5890486225480862 }',
      run: (args) => reading(args),
    },
    sweep: {
      describe: "Check the two claims over several drawings at once: on a 5 by 5 grid of allowed C and D angles, or on pairs supplied as [[c, d], ...] (radians, at most 200), report whether E, F, E' stay collinear and whether EF always bisects angle CFD, with the worst errors and a few examples.",
      args: '{ "pairs": [[2.7, 0.3], [2.2, 1.1], [1.8, 0.7]] }',
      run: (args) => {
        const all = pairs(args);
        let worstSine = 0, worstHalfGap = 0, worstHalfVsArc = 0, worstGap = 0;
        const examples: unknown[] = [];
        for (const [c, d] of all) {
          const r = reading({ c, d, cx: args.cx, cy: args.cy, radius: args.radius });
          worstSine = Math.max(worstSine, r.pascal.sineOfAngleEF_EEp);
          worstHalfGap = Math.max(worstHalfGap, Math.abs(r.angle.CFE - r.angle.EFD));
          worstHalfVsArc = Math.max(worstHalfVsArc, Math.abs(r.angle.CFE - r.angle.eachHalf));
          worstGap = Math.max(worstGap, r.pascal.gapFpF, r.pascal.gapE2Ep);
          if (examples.length < 3) {
            examples.push({ c: r.c, d: r.d, E: r.E, F: r.F, Ep: r.Ep, halves: [r.angle.CFE, r.angle.EFD], collinear: r.pascal.collinear });
          }
        }
        const collinear = worstSine < 1e-9 && worstGap < 1e-6;
        const bisected = worstHalfGap < 1e-4 && worstHalfVsArc < 1e-4;
        return {
          positions: all.length,
          allPascalCollinear: collinear,
          allAnglesBisected: bisected,
          worstPascalSine: round(worstSine, 12),
          worstPascalGap: round(worstGap, 9),
          worstHalfGapDegrees: round(worstHalfGap, 8),
          worstHalfVsArcDifferenceDegrees: round(worstHalfVsArc, 8),
          examples,
          note: collinear && bisected
            ? `Across ${all.length} positions, E, F and E' stay on one line and EF splits angle CFD into equal halves (each |C - D| / 2).`
            : "At least one position breaks a claim; check the worst errors above.",
        };
      },
    },
  };
}

/** The page's saved fields plus what the core reads from them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Altitude Mirror 2 state version ${stateVersion}`);
  const C = core();
  const c = arcAngle(state, "c", "C");
  const d = arcAngle(state, "d", "D");
  const r = reading({
    c, d,
    names: state.names !== false,
    hint: state.hint === true,
    statement: state.statement === true,
  });
  return {
    c: r.c,
    d: r.d,
    cDegrees: r.cDegrees,
    dDegrees: r.dDegrees,
    names: state.names !== false,
    hint: state.hint === true,
    statement: state.statement === true,
    E: r.E,
    F: r.F,
    Ep: r.Ep,
    C: r.C,
    D: r.D,
    angle: r.angle,
    pascal: r.pascal,
    note: r.note,
    context: `This is a demo, so it has no win or loss. The player's drawing has C and D at ${r.cDegrees}° and ${r.dDegrees}°; ${r.angle.equalHalves ? `both halves of angle CFD are ${r.angle.eachHalf}°` : "the angle halves differ"}.`,
  };
}
