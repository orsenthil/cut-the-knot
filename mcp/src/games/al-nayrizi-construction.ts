/*
 * run_game_logic actions and saved-position reader for Al Nayrizi's construction.
 * The core lives in al-nayrizi-construction/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The construction steps off N equal marks from B towards A and N equal marks
 * from C in the opposite direction, then joins the i-th mark from B to the
 * (N + 1 - i)-th mark from C. All those joining lines have the same direction
 * (C - B) - (N + 1)(A - B), so they cross BC at the exact fractions k/(N + 1):
 * N marks give N + 1 equal parts, not the N parts the article's prose claims.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["al-nayrizi-construction"].AlNayriziConstructionCore;

interface Pt { x: number; y: number }
interface Construction {
  A: Pt; B: Pt; C: Pt; n: number; parts: number; dx: number; dy: number;
  marksB: Pt[]; marksC: Pt[]; crossLines: Pt[][]; cuts: Pt[];
}

/** Read a point argument, e.g. { "x": 120, "y": 83 }, with a useful error. */
function point(args: Json, key: string): Pt {
  const v = args[key];
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${key}" must be a point object with numeric x and y`);
  }
  const p = v as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/** The applet's PVNumeric range is 1 to 20 marks. */
function marks(args: Json): number {
  const C = core();
  const n = num(args, "n");
  if (!Number.isInteger(n) || n < C.MIN_MARKS || n > C.MAX_MARKS) {
    throw new Error(`n must be a whole number of marks from ${C.MIN_MARKS} to ${C.MAX_MARKS}`);
  }
  return n;
}

/** To get P equal parts you need P - 1 marks, so P runs from 2 to 21. */
function wantedParts(args: Json): number {
  const C = core();
  const p = num(args, "parts");
  if (!Number.isInteger(p) || p < C.MIN_MARKS + 1 || p > C.MAX_MARKS + 1) {
    throw new Error(`parts must be a whole number from ${C.MIN_MARKS + 1} to ${C.MAX_MARKS + 1} (marks + 1)`);
  }
  return p;
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const out = (p: Pt) => ({ x: round(p.x), y: round(p.y) });
const distance = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

/** Where the infinite line through p and q meets the line through B and C, or null if parallel. */
function meetBC(p: Pt, q: Pt, B: Pt, C: Pt): Pt | null {
  const r = { x: q.x - p.x, y: q.y - p.y };
  const s = { x: C.x - B.x, y: C.y - B.y };
  const det = r.x * s.y - r.y * s.x;
  if (Math.abs(det) < 1e-12) return null;
  const t = ((B.x - p.x) * s.y - (B.y - p.y) * s.x) / det;
  return { x: p.x + t * r.x, y: p.y + t * r.y };
}

/** The exact reading of a construction from the core: fractions, crossings, spacing. */
function read(g: Construction) {
  const C = core();
  const tol = 1e-6 * Math.max(1, distance(g.B, g.C));
  const fractions = C.fractions(g.n) as { num: number; den: number }[];
  const divisionPoints = fractions.map((f, k) => ({
    k,
    fraction: `${f.num}/${f.den}`, // k/(N + 1), written with the construction's denominator
    at: out(g.cuts[k]),
  }));

  // Check the drawn joining lines, not just the formulas: each B_i C_(N+1-i)
  // should cross BC exactly at the k = i division point.
  const crossings = [];
  for (let i = 1; i <= g.n; i++) {
    const [p, q] = g.crossLines[i - 1];
    const hit = meetBC(p, q, g.B, g.C);
    const f = C.fraction(g.n, i) as { num: number; den: number };
    crossings.push({
      line: i,
      joins: `B${i} to C${g.n + 1 - i}`,
      fraction: `${f.num}/${f.den}`,
      crossesBCAt: hit ? out(hit) : null,
      matchesDivisionPoint: hit ? distance(hit, g.cuts[i]) <= tol : null,
    });
  }

  const step = { x: g.cuts[1].x - g.cuts[0].x, y: g.cuts[1].y - g.cuts[0].y };
  let equallySpaced = true;
  for (let k = 1; k < g.cuts.length - 1; k++) {
    if (Math.abs(g.cuts[k + 1].x - g.cuts[k].x - step.x) > tol ||
        Math.abs(g.cuts[k + 1].y - g.cuts[k].y - step.y) > tol) equallySpaced = false;
  }
  const degenerate = crossings.some((c) => c.crossesBCAt === null);

  return {
    marks: g.n,
    parts: g.parts,
    points: { A: out(g.A), B: out(g.B), C: out(g.C) },
    marksOnRayBA: g.marksB.map(out),
    marksOnParallelThroughC: g.marksC.map(out),
    divisionPoints, // k = 0 .. parts, including B and C themselves
    crossings,
    allCrossingsLandOnCuts: crossings.every((c) => c.matchesDivisionPoint === true),
    equallySpaced,
    spacing: { step: out(step), fractionStep: `1/${g.parts}` },
    note: degenerate
      ? "A joining line is parallel to BC (or collapsed), so it has no single crossing; the exact cuts are still at k/(N + 1)."
      : "Every joining line B_i C_(N+1-i) has direction (C - B) - (N + 1)(A - B), independent of i, so they are parallel and cross BC at i/(N + 1). N marks give N + 1 equal parts: the cut-the-knot prose says N parts, but its picture and the construction give N + 1. Moving A changes the marks, never the cuts.",
  };
}

export function actions(): GameActions {
  return {
    crossings: {
      describe: "For N marks (a whole number from 1 to 20, the applet's range) and three points A, B, C on the 400 x 250 board (y down; the page levels B and C), run Al-Nayrizi's construction: the N+1 division points of BC as exact fractions k/(N+1), whether each drawn joining line really crosses at its cut, and whether the cuts are equally spaced.",
      args: '{ "n": 3, "A": { "x": 134, "y": 108 }, "B": { "x": 120, "y": 83 }, "C": { "x": 257, "y": 83 } }',
      run: (args) => {
        const C = core();
        const n = marks(args);
        const A = point(args, "A"), B = point(args, "B"), Cc = point(args, "C");
        return read(C.construct(C.start({ A, B, C: Cc, n })) as Construction);
      },
    },
    divide_into: {
      describe: "Divide BC into P equal parts with the applet's construction: P must be a whole number from 2 to 21, and P - 1 marks are needed. Reports the marks required, the exact fractions k/P and the cut coordinates, and confirms the parts are equal.",
      args: '{ "A": { "x": 134, "y": 108 }, "B": { "x": 120, "y": 83 }, "C": { "x": 257, "y": 83 }, "parts": 7 }',
      run: (args) => {
        const C = core();
        const p = wantedParts(args);
        const A = point(args, "A"), B = point(args, "B"), Cc = point(args, "C");
        const g = C.divideInto(A, B, Cc, p) as Construction | null;
        if (!g) throw new Error(`cannot construct ${p} parts`);
        return { wantedParts: p, marksNeeded: p - 1, ...read(g) };
      },
    },
  };
}

export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Al-Nayrizi construction state version ${stateVersion}`);
  const C = core();
  const n = num(state, "n");
  if (!Number.isInteger(n) || n < C.MIN_MARKS || n > C.MAX_MARKS) {
    throw new Error(`saved n must be a whole number of marks from ${C.MIN_MARKS} to ${C.MAX_MARKS}`);
  }
  const A = point(state, "A"), B = point(state, "B"), Cc = point(state, "C");
  const g = C.construct(C.start({ A, B, C: Cc, n })) as Construction;
  const reading = read(g);

  const tol = 1e-6 * Math.max(1, distance(g.B, g.C));
  const savedCuts = state.cuts;
  const savedCutsMatch = Array.isArray(savedCuts)
    ? savedCuts.length === g.cuts.length && g.cuts.every((p, i) => {
        const s = savedCuts[i] as Json | undefined;
        return !!s && Number.isFinite(Number(s.x)) && Number.isFinite(Number(s.y)) &&
          distance({ x: Number(s.x), y: Number(s.y) }, p) <= tol;
      })
    : null;

  return {
    stateVersion,
    saved: {
      A: state.A, B: state.B, C: state.C, n,
      parts: state.parts ?? g.parts,
      cuts: state.cuts ?? null,
      names: state.names === true,
      hint: state.hint === true,
    },
    reading: { ...reading, savedCutsMatch },
  };
}
