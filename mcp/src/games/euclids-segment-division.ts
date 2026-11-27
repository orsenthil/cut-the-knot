/*
 * run_game_logic actions and saved-position reader for Euclid's Segment Division.
 *
 * The real core is euclids-segment-division/euclids-segment-division-core.js,
 * copied into src/generated/cores/ at build time. On the ray from B through A we
 * step off N equal marks B_i = B + i(A - B), with B_1 = A. Joining B_N to C and
 * drawing through each mark a parallel to B_N C puts the crossing
 * D_i = B + (i/N)(C - B) on BC, because triangle B B_i D_i is similar to
 * triangle B B_N C with scale i/N. If A lies on BC the original applet's
 * determinant vanishes, so the core flags such a picture invalid. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["euclids-segment-division"].EuclidsSegmentDivisionCore;

type Point = { x: number; y: number };

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;

/** Accept the page's { x, y }, a tutor's [x, y], or the opening point. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = num(o, "x"); y = num(o, "y");
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite x and y`);
  }
  return { x, y };
}

/** A state and its construction, both from the real core, with N validated. */
function build(args: Json) {
  const C = core();
  const home = C.start();
  const A = readPoint(args.A, "A", home.A);
  const B = readPoint(args.B, "B", home.B);
  const Cp = readPoint(args.C, "C", home.C);
  const n = num(args, "n", C.DEFAULT_N);
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`"n" must be a whole number from ${C.MIN_N} to ${C.MAX_N}, got ${JSON.stringify(args.n)}`);
  }
  const state = C.start({ A, B, C: Cp, n, names: args.names === true, hint: args.hint === true });
  return { state, g: C.construct(state) };
}

/** The core's construction in tutor-friendly, rounded JSON. */
function constructionReading(g: any) {
  const n: number = g.n;
  const cuts: Point[] = g.cuts;
  return {
    n,
    parts: g.parts,
    points: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    // B_0 = B, B_1 = A, ..., B_N; marks[i] = B + i(A - B).
    marksOnRay: (g.marks as Point[]).map(pt),
    // D_0 = B, D_1, ..., D_{n-1}, D_N = C; cuts[i] = B + (i/n)(C - B).
    crossingsOnBC: cuts.map(pt),
    fractions: Array.from({ length: n - 1 }, (_, i) => ({
      fraction: `${i + 1}/${n}`,
      decimal: r6((i + 1) / n),
      D: pt(cuts[i + 1]),
    })),
    valid: g.valid === true,
  };
}

/** Independently measure the intervals on BC and check the similar-triangle formula. */
function equalParts(g: any) {
  const C = core();
  const cuts: Point[] = g.cuts;
  const n: number = g.n;
  const dist = (p: Point, q: Point): number => Math.hypot(q.x - p.x, q.y - p.y);
  const intervals = cuts.slice(1).map((p, i) => r6(dist(cuts[i], p)));
  const total = dist(g.B, g.C);
  const expected = total / n;
  const equallySpaced = total > 1e-12 && intervals.every((d) => Math.abs(d - expected) < 1e-6);
  const formulaHolds = cuts.slice(1, -1).every((p, i) => {
    const exact = C.pointAtFraction(g.B, g.C, i + 1, n);
    return Math.hypot(p.x - exact.x, p.y - exact.y) < 1e-6;
  });
  return {
    n,
    totalLength: r6(total),
    eachPartLength: r6(expected),
    intervalLengths: intervals,
    equallySpaced,
    formulaHolds,
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "Report Euclid's similar-triangle division of BC into N equal parts for draggable points A, B, C (each [x, y] or { x, y } on the page's 400 x 400 board; omitting them uses the opening picture) and N from 1 to 20, default 3. Returns the stepped marks B_i on the ray from B through A, the crossings D_i on BC with their fractions i/N, and valid=false when A lies on BC, the collinear case where the applet's parallel lines cannot cross.",
      args: '{ "n": 3, "A": [134, 240], "B": [120, 200], "C": [257, 200] }',
      run: (args) => {
        const { g } = build(args);
        const r = constructionReading(g);
        return {
          ...r,
          note: r.valid
            ? `Triangles B B_i D_i and B B_N C are similar with ratio i/N, so D_i = B + (i/N)(C - B): the ${r.parts} crossings cut BC into ${r.n} equal parts.`
            : "A is on the line BC: the marks still step off along the ray, but the parallels lie along BC and the crossings are hidden. Move A off the line to see the division.",
        };
      },
    },
    equal_parts: {
      describe:
        "For the same N and points A, B, C, check independently that the core's crossings divide BC into N equal lengths and that every D_i equals B + (i/N)(C - B). Returns the interval lengths, the expected length |BC|/N and boolean checks; a collinear A on BC is reported as invalid rather than giving a genuine division.",
      args: '{ "n": 4 }',
      run: (args) => {
        const { g } = build(args);
        const check = equalParts(g);
        return {
          ...check,
          valid: g.valid === true,
          note: !g.valid
            ? "A lies on BC, so this is the degenerate case: the original applet divides by zero and there is no genuine construction to check."
            : check.equallySpaced && check.formulaHolds
              ? `All ${check.n} intervals of BC are equal (${check.eachPartLength} each) and every crossing matches B + (i/${check.n})(C - B).`
              : "The crossings do not match the equal-division formula; check the points and N.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Euclid's Segment Division state version ${stateVersion}`);
  }
  const C = core();
  const home = C.start();
  const A = readPoint(state.A, "A", home.A);
  const B = readPoint(state.B, "B", home.B);
  const Cp = readPoint(state.C, "C", home.C);
  const n = num(state, "n", C.DEFAULT_N);
  const rebuilt = C.start({
    A, B, C: Cp, n,
    names: state.names === true, hint: state.hint === true,
  });
  const g = C.construct(rebuilt);
  const saved = {
    A: pt(A), B: pt(B), C: pt(Cp),
    n: rebuilt.n,
    parts: typeof state.parts === "number" ? state.parts : null,
    cuts: Array.isArray(state.cuts) ? (state.cuts as Point[]).map(pt) : null,
    valid: state.valid === true,
    names: state.names === true,
    hint: state.hint === true,
  };
  const reading = constructionReading(g);
  const savedCuts = Array.isArray(state.cuts) ? (state.cuts as Point[]) : null;
  const savedCutsAgree = savedCuts !== null && savedCuts.length === g.cuts.length &&
    savedCuts.every((p: Point, i: number) => {
      const q = g.cuts[i];
      return Number.isFinite(p.x) && Number.isFinite(p.y) &&
        Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
    });
  return {
    stateVersion,
    ...saved,
    reading: {
      ...reading,
      ...equalParts(g),
      savedCutsAgree,
    },
    note: reading.valid
      ? `Rebuilding from the saved points and N reproduces the picture: D_i = B + (i/${rebuilt.n})(C - B) cuts BC into ${rebuilt.n} equal parts.`
      : "The saved A lies on BC, the collinear-degenerate case: the marks exist but the parallel crossings are hidden.",
  };
}
