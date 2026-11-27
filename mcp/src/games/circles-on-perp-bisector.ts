/*
 * run_game_logic actions and saved-position reader for Circles On Perp Bisector.
 *
 * ABC is a triangle, M is the midpoint of BC and O slides on the perpendicular
 * bisector of BC, so the circle (O) through B and C has radius R = OB = OC.
 * The two circles (I) and (P) touch both rays AB and AC: their centres lie on
 * the angle bisector at A and the applet's OneOnBisector quadratic picks the
 * root nearer A. S and T are where the lines OI and OP meet (O); ST is the
 * line of tangencies, which is not one of the common internal tangents of
 * (I) and (P). The chord the two sides cut off on any circle through B and C
 * is antiparallel to BC (BC reflected in the angle bisector at A).
 *
 * Unger's theorem, as the page states it: with (I) the *incircle* of ABC, a
 * circle through B and C tangent internally to (I) and externally to (P)
 * exists if and only if one common internal tangent of (I) and (P) is
 * parallel to BC; the other such tangent is then antiparallel to BC. The core
 * (circles-on-perp-bisector/circles-on-perp-bisector-core.js, copied into
 * src/generated/cores/ at build time) supplies every number below. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-on-perp-bisector"].CirclesOnPerpBisectorCore as any;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const circ = (c: any): Json | null =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: xy(c), radius: r6(c.r) }
    : null;
const degOf = (dir: Point): number => r4(Math.atan2(dir.y, dir.x) * 180 / Math.PI);
/** The smaller angle between a tangent direction and a reference direction. */
const gapDeg = (cross: number): number => r6(Math.asin(Math.min(1, Math.abs(cross))) * 180 / Math.PI);

/** Accept the page's {x,y} points and the tutor's [x,y] arguments alike. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** Validate any points supplied and let the core build the page's real state. */
function readBoard(args: Json) {
  const C = core();
  const home = C.start({});
  const points: Json = {};
  for (const name of ["A", "B", "C", "O"]) {
    points[name] = readPoint(args[name], name, home[name]);
  }
  return C.start({
    ...points,
    showNames: args.showNames !== false,
    showTangents: args.showTangents === true,
    showHint: args.showHint === true,
  });
}

/** A point k units along the perpendicular bisector of B and C. */
function bisectorAt(B: Point, Cpt: Point, k: number): Point {
  const C = core();
  const M = C.midpoint(B, Cpt);
  const dir = C.unit(C.sub(C.perpPoint(M, B, Cpt), M));
  return { x: M.x + dir.x * k, y: M.y + dir.y * k };
}

/**
 * The O positions on the perpendicular bisector where the circle through B and
 * C is internally tangent to the incircle: |OI| + rI = OB. The bracketed root
 * is found by bisection, exactly as the port's logic test does.
 */
function coaxalRoots(inc: Circle, B: Point, Cpt: Point): number[] {
  const C = core();
  const f = (k: number): number => {
    const O = bisectorAt(B, Cpt, k);
    return C.dist(O, inc) + inc.r - C.dist(O, B);
  };
  const span = C.W + C.H;
  const step = 0.5;
  const roots: number[] = [];
  let prev = f(-span);
  for (let k = -span + step; k <= span; k += step) {
    const cur = f(k);
    if (prev * cur < 0) {
      let lo = k - step, hi = k;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2;
        if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
      }
      roots.push((lo + hi) / 2);
    }
    prev = cur;
  }
  return roots;
}

/** Smallest residual of a circle (P) against the coaxal circles from roots. */
function coaxalGap(roots: number[], B: Point, Cpt: Point, P: Circle): number {
  const C = core();
  let best = Infinity;
  for (const k of roots) {
    const O = bisectorAt(B, Cpt, k);
    best = Math.min(best, Math.abs(C.dist(O, P) - P.r - C.dist(O, B)));
  }
  return best;
}

/** The two common internal tangents, with their angles and the two tests. */
function tangentView(g: any) {
  const C = core();
  const bc = C.sub(g.C, g.B);
  return g.tangents.map((t: any) => {
    const crossBC = C.parallelCross(t, bc);
    return {
      onI: xy(t.a),
      onP: xy(t.b),
      direction: xy(t.dir),
      angleDeg: degOf(t.dir),
      crossWithBC: r6(crossBC),
      angleToBCDeg: gapDeg(crossBC),
      crossWithAntiparallel: r6(C.parallelCross(t, g.antiparallel)),
    };
  });
}

/** Find the exact configuration where (I) is the incircle, if one exists. */
function exactConfiguration(A: Point, B: Point, Cpt: Point) {
  const C = core();
  const inc = C.incircle(A, B, Cpt);
  const roots = coaxalRoots(inc, B, Cpt);
  let best: { inc: Circle; roots: number[]; O: Point; g: any; gap: number } | null = null;
  for (const k of roots) {
    const O = bisectorAt(B, Cpt, k);
    const g = C.geometry(C.start({ A, B, C: Cpt, O }));
    if (!g.valid || !g.P || !g.footOnBC) continue;
    const gap = C.dist(g.I, inc) + Math.abs(g.I.r - inc.r);
    if (!best || gap < best.gap) best = { inc, roots, O, g, gap };
  }
  return best;
}

export function actions(): GameActions {
  return {
    configuration: {
      describe:
        "For a triangle ABC and a point O on the perpendicular bisector of BC (each as [x,y] or {x,y} on the page's 360 x 240 board), report the circle (O) through B and C, its true incircle, the two circles (I) and (P) tangent to AB and AC, the touch points S and T, the line of tangencies ST and both common internal tangents of (I) and (P) with their angles. It says whether I is the incircle, whether a tangent is parallel to BC, whether the other is antiparallel to BC (BC reflected in the angle bisector at A), whether the chord cut on (O) by AB and AC is antiparallel, and whether a circle through B and C tangent to the incircle internally and (P) externally exists — Unger's iff. Omitted points default to the applet's opening position and O is snapped onto the bisector, as the page does.",
      args: '{ "A": [222.7991, 23.9165], "B": [100, 160], "C": [260, 160], "O": [180, 190] }',
      run: (args) => {
        const C = core();
        const s = readBoard(args);
        const g = C.geometry(s);
        if (!g.valid) {
          return {
            valid: false,
            note:
              "The angle at A has no usable bisector (the points are collinear or too close together), so neither auxiliary circle can be built. Move A, B or C to make a triangle.",
          };
        }
        const inc = C.incircle(g.A, g.B, g.C);
        const incCentreGap = C.dist(g.I, inc);
        const incRadiusGap = Math.abs(g.I.r - inc.r);
        const isIncircle = incCentreGap < 1e-3 && incRadiusGap < 1e-3;
        const nearIncircle = incCentreGap < 2 && incRadiusGap < 2;
        const bc = C.sub(g.C, g.B);
        const tangents = tangentView(g);
        const parallelCrosses = tangents.map((t: Json) => Number(t.crossWithBC));
        const antiCrosses = tangents.map((t: Json) => Number(t.crossWithAntiparallel));
        const minParallel = Math.min(...parallelCrosses);
        const minAnti = Math.min(...antiCrosses);
        const parallelToBC = minParallel < 1e-6;
        const antiparallelToBC = minAnti < 1e-6;
        const roots = coaxalRoots(inc, g.B, g.C);
        const gap = coaxalGap(roots, g.B, g.C, g.P);
        const coaxalCircleExists = gap < 1e-5;
        const stCross = g.stLine && g.tangents.length === 2
          ? Math.min(...g.tangents.map((t: any) => C.parallelCross(g.stLine, t.dir)))
          : null;
        const chordCross = g.chord ? C.parallelCross(g.chord, g.antiparallel) : null;
        const incircleNote = isIncircle
          ? "(I) coincides with the incircle, so this is Unger's configuration."
          : nearIncircle
            ? "(I) is close to, but not exactly, the incircle — the applet's opening picture is such an approximation."
            : "(I) is not the incircle, so Unger's 'if and only if' does not apply to this picture; the page only claims a parallel tangent 'at least when (I) is close to the incircle'.";
        const tangentNote = g.tangents.length !== 2
          ? "The two auxiliary circles overlap, so they have no common internal tangent to test against BC."
          : parallelToBC
            ? `One common internal tangent is parallel to BC (gap ${r6(minParallel)}, ${gapDeg(minParallel)}°); the other is ${antiparallelToBC ? "antiparallel to BC" : `off the antiparallel direction by ${gapDeg(minAnti)}°`}.`
            : `Neither common internal tangent is parallel to BC (closest gap ${r6(minParallel)}, ${gapDeg(minParallel)}°); the chord AB and AC cut on (O) is antiparallel to BC (gap ${chordCross === null ? "unknown" : r6(chordCross)}).`;
        return {
          valid: true,
          points: {
            A: xy(g.A), B: xy(g.B), C: xy(g.C), O: xy(g.O), M: xy(g.M),
          },
          circleThroughBC: circ(g.circle),
          incircle: circ(inc),
          incircleCentreGap: r6(incCentreGap),
          incircleRadiusGap: r6(incRadiusGap),
          isIncircle,
          nearIncircle,
          circles: { I: circ(g.I), P: circ(g.P) },
          PExternalGapToO: r6(Math.abs(C.dist(g.O, g.P) - g.P.r - g.circle.r)),
          touchPoints: { S: xy(g.S), T: xy(g.T) },
          lineOfTangencies: g.stLine
            ? { a: xy(g.stLine.a), b: xy(g.stLine.b), direction: xy(g.stLine.dir) }
            : null,
          lineOfTangenciesIsNotATangent: stCross === null ? null : stCross > 1e-6,
          commonInternalTangents: tangents,
          parallelTangentToBC: parallelToBC,
          antiparallelTangentToBC: antiparallelToBC,
          antiparallelDirection: xy(g.antiparallel),
          antiparallelAngleDeg: degOf(g.antiparallel),
          bcAngleDeg: degOf(bc),
          chordOnO: g.chord
            ? { a: xy(g.chord.a), b: xy(g.chord.b), direction: xy(g.chord.dir) }
            : null,
          chordIsAntiparallel: chordCross === null ? null : chordCross < 1e-6,
          OIsFarSideOfBC: g.farSide,
          coaxalCircleExists,
          coaxalCircleGap: r6(gap),
          note:
            `${incircleNote} ${tangentNote} Unger's iff (tested by unger_iff) says that with (I) the incircle a circle through B and C tangent to (I) internally and (P) externally exists exactly when one common internal tangent is parallel to BC; the existence test against the true incircle here says ${coaxalCircleExists ? "yes" : "no"}.`,
        };
      },
    },

    unger_iff: {
      describe:
        "Check Unger's 'if and only if' with (I) fixed at the incircle of ABC: first find the O on the perpendicular bisector that makes the constructed (I) the incircle, then slide a second circle (P) along the angle bisector at A over a small range. For each position report whether one common internal tangent of the incircle and (P) is parallel to BC and whether a circle through B and C tangent internally to the incircle and externally to (P) exists; they agree at every position. At the exact position the other tangent is antiparallel to BC (BC reflected in the angle bisector). Optional 'count' (default 57) and 'step' (default 0.04) set the sweep.",
      args: '{ "A": [222.7991, 23.9165], "B": [100, 160], "C": [260, 160], "count": 57, "step": 0.04 }',
      run: (args) => {
        const C = core();
        const s = readBoard(args);
        const A: Point = { x: s.A.x, y: s.A.y };
        const B: Point = { x: s.B.x, y: s.B.y };
        const Cpt: Point = { x: s.C.x, y: s.C.y };
        if (C.dist(B, Cpt) < 1 || C.dist(A, B) < 1 || C.dist(A, Cpt) < 1) {
          throw new Error("A, B and C must be distinct points making a triangle");
        }
        const count = Math.max(3, Math.min(201, Math.round(num(args, "count", 57))));
        const step = num(args, "step", 0.04);
        if (!(step > 0) || step > 10) throw new Error('"step" must be a positive number no larger than 10');
        const exact = exactConfiguration(A, B, Cpt);
        if (!exact) {
          return {
            valid: false,
            note: "No circle through B and C is tangent internally to the incircle for this triangle, so Unger's configuration cannot be reached from it.",
          };
        }
        const { inc, roots, O, g } = exact;
        const anti = g.antiparallel;
        const u = C.unit(C.sub(g.footOnBC, A));
        const s0 = C.dist(g.P, A);
        const sinHalf = Math.sin(g.half);
        const samples: Json[] = [];
        let total = 0, agreements = 0, parallelCases = 0, existsCases = 0;
        for (let j = 0; j < count; j++) {
          const offset = j - (count - 1) / 2;
          const at = s0 + offset * step;
          if (!(at > 0)) continue;
          const P: Circle = {
            x: A.x + u.x * at,
            y: A.y + u.y * at,
            r: at * sinHalf,
          };
          if (!(P.r > 0)) continue;
          const tang = C.internalTangents(inc, P);
          if (tang.length !== 2) continue;
          const parallelCross = Math.min(...tang.map((line: any) => C.parallelCross(line, C.sub(Cpt, B))));
          const antiCross = Math.min(...tang.map((line: any) => C.parallelCross(line, anti)));
          const gap = coaxalGap(roots, B, Cpt, P);
          const parallel = parallelCross < 1e-6;
          const antiparallel = antiCross < 1e-6;
          const exists = gap < 1e-5;
          total++;
          if (parallel) parallelCases++;
          if (exists) existsCases++;
          if (parallel === exists) agreements++;
          samples.push({
            offset: r6(offset),
            P: { center: xy(P), radius: r6(P.r) },
            parallelToBC: parallel,
            antiparallelToBC: antiparallel,
            closestParallelCross: r6(parallelCross),
            angleToBCDeg: gapDeg(parallelCross),
            coaxalCircleExists: exists,
            coaxalCircleGap: r6(gap),
          });
        }
        return {
          valid: true,
          triangle: { A: xy(A), B: xy(B), C: xy(Cpt) },
          incircle: circ(inc),
          exact: {
            O: xy(O),
            P: circ(g.P),
            IIsIncircle: C.dist(g.I, inc) < 1e-3 && Math.abs(g.I.r - inc.r) < 1e-3,
            incircleCentreGap: r6(C.dist(g.I, inc)),
            parallelToBC: g.tangentParallel,
            antiparallelToBC: g.tangentAntiparallel,
            antiparallelAngleDeg: degOf(anti),
            otherTangentAngleDeg: g.tangents
              .filter((line: any) => C.parallelCross(line, C.sub(Cpt, B)) >= 1e-6)
              .map((line: any) => degOf(line.dir)),
          },
          samples,
          total,
          agreements,
          allAgree: total > 0 && agreements === total,
          parallelCases,
          coaxalCircleCases: existsCases,
          note:
            `With (I) held at the incircle, the core swept (P) along the angle bisector at A over ${total} positions. ` +
            `A circle through B and C tangent to (I) internally and (P) externally exists at ${existsCases} of them, and one common internal tangent is parallel to BC at ${parallelCases}; the two agree at ${agreements}/${total}. ` +
            `At the exact position the other common internal tangent is antiparallel to BC (BC reflected in the angle bisector at A), as Unger's corollary says.`,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles On Perp Bisector state version ${stateVersion}`);
  }
  const C = core();
  const source = state ?? ({} as Json);
  if (source !== null && typeof source !== "object") {
    throw new Error("the saved position must be an object of points");
  }
  const s = C.start(source);
  const saved: Json = {
    A: xy(readPoint(source.A, "A", s.A)),
    B: xy(readPoint(source.B, "B", s.B)),
    C: xy(readPoint(source.C, "C", s.C)),
    O: xy(readPoint(source.O, "O", s.O)),
    showNames: source.showNames !== false,
    showTangents: source.showTangents === true,
    showHint: source.showHint === true,
    moves: Number.isFinite(Number(source.moves)) ? Number(source.moves) : s.moves,
    toggles: Number.isFinite(Number(source.toggles)) ? Number(source.toggles) : s.toggles,
  };
  const g = C.geometry(s);
  if (!g.valid) {
    return {
      stateVersion,
      saved,
      valid: false,
      explored: C.result(s) === "done",
      note: "The saved points do not make a triangle with a usable angle bisector, so no auxiliary circles are drawn.",
    };
  }
  const inc = C.incircle(g.A, g.B, g.C);
  const incGap = C.dist(g.I, inc);
  const rGap = Math.abs(g.I.r - inc.r);
  const crosses = g.tangents.map((t: any) => C.parallelCross(t, C.sub(g.C, g.B)));
  const minCross = crosses.length ? Math.min(...crosses) : null;
  const chordCross = g.chord ? C.parallelCross(g.chord, g.antiparallel) : null;
  return {
    stateVersion,
    saved,
    valid: true,
    explored: C.result(s) === "done",
    circleThroughBC: circ(g.circle),
    incircle: circ(inc),
    IIsIncircle: incGap < 1e-3 && rGap < 1e-3,
    incircleCentreGap: r6(incGap),
    circles: { I: circ(g.I), P: circ(g.P) },
    touchPoints: { S: xy(g.S), T: xy(g.T) },
    lineOfTangencies: g.stLine
      ? { a: xy(g.stLine.a), b: xy(g.stLine.b), direction: xy(g.stLine.dir) }
      : null,
    commonInternalTangents: tangentView(g),
    parallelTangentToBC: minCross !== null && minCross < 1e-6,
    closestAngleToBCDeg: minCross === null ? null : gapDeg(minCross),
    antiparallelTangentToBC: g.tangentAntiparallel,
    antiparallelDirection: xy(g.antiparallel),
    chordOnO: g.chord
      ? { a: xy(g.chord.a), b: xy(g.chord.b), direction: xy(g.chord.dir) }
      : null,
    chordIsAntiparallel: chordCross === null ? null : chordCross < 1e-6,
    OIsFarSideOfBC: g.farSide,
    note:
      `The saved circle (O) through B and C has radius ${r6(g.circle.r)}. ` +
      (incGap < 1e-3 && rGap < 1e-3
        ? "(I) is the incircle; "
        : `(I) is ${r4(incGap)} units from the incircle's centre and its radius differs by ${r4(rGap)}; `) +
      (minCross === null
        ? "the auxiliary circles overlap, so there is no common internal tangent to test."
        : `there are two common internal tangents of (I) and (P), the nearer to BC is ${gapDeg(minCross)}° away${minCross < 1e-6 ? " — parallel, the case in Unger's iff" : ""}.`),
  };
}
