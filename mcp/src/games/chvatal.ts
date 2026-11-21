/*
 * run_game_logic actions and saved-position reader for Chvatal's art gallery
 * theorem. Answers come from the game's real core (chvatal/chvatal-core.js),
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape.
 *
 * The core mirrors the applet: diagonal validation, Fisk's three-colouring of
 * a triangulation, and the least colour class used as guards. The theorem says
 * floor(n/3) guards always suffice, and little else needs saying.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["chvatal"].ChvatalCore;

type Diagonal = { a: number; b: number };

function asNum(x: unknown, label: string): number {
  const n = Number(x);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number`);
  return n;
}

/** Diagonals may arrive as {a,b} objects or as [a,b] pairs. */
function readDiags(v: unknown): Diagonal[] {
  if (!Array.isArray(v)) return [];
  return v.map((d) => {
    if (Array.isArray(d)) return { a: asNum(d[0], "diagonal[0]"), b: asNum(d[1], "diagonal[1]") };
    const o = d as Json;
    return { a: num(o, "a"), b: num(o, "b") };
  });
}

function readInts(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

/** A fan from vertex 0: the n-3 diagonals {0,k}, k = 2..n-2. */
function fanDiagonals(n: number): Diagonal[] {
  const out: Diagonal[] = [];
  for (let k = 2; k <= n - 2; k++) out.push({ a: 0, b: k });
  return out;
}

/** Triangulate and reduce the result to the theorem's quantities. */
function analyze(C: any, n: number, diagonals: Diagonal[]) {
  const base = C.start({ n });
  const a = C.triangulate(n, base.points, diagonals);
  const triangles: number[][] = a.triangles;
  const guards: number[] = a.guards;
  const guardSet = new Set<number>(guards);
  const bound = C.floorThird(n);
  return {
    n,
    diagonalsPlaced: diagonals.length,
    diagonalsNeeded: C.neededDiagonals(n),
    triangles: triangles.length,
    complete: a.complete,
    colorCounts: { color0: a.counts[0], color1: a.counts[1], color2: a.counts[2] },
    leastColor: a.leastColor,
    guards,
    guardCount: a.guardCount,
    bound,
    withinBound: a.guardCount <= bound,
    everyTriangleGuarded: triangles.every((t) => t.some((v) => guardSet.has(v))),
    allDiagonalsLegal: diagonals.every(
      (d) => C.validateDiagonal(base, d.a, d.b) === null,
    ),
  };
}

export function actions(): GameActions {
  return {
    triangulation: {
      describe:
        "Analyze a triangulation of an n-gon: diagonals needed (n-3) and triangles (n-2), the three colour-class sizes from Fisk's colouring, the least class used as guards, and the floor(n/3) bound. Diagonals default to a fan.",
      args: '{ "n": 6 }',
      run: (args) => {
        const C = core();
        const n = C.clampN(num(args, "n", C.N_DEFAULT));
        const given = readDiags(args.diagonals);
        const diagonals = given.length ? given : fanDiagonals(n);
        const a = analyze(C, n, diagonals);
        return {
          ...a,
          usedFan: given.length === 0,
          note: `An ${n}-gon is cut into ${a.triangles} triangles with ${a.diagonalsNeeded} diagonals. The three colour classes have sizes ${a.colorCounts.color0}, ${a.colorCounts.color1} and ${a.colorCounts.color2}; the smallest (colour ${a.leastColor}, ${a.guardCount} vertices) guards every triangle and never exceeds floor(${n}/3) = ${a.bound}.`,
        };
      },
    },
    guard_coverage: {
      describe:
        "For a triangulation, list each triangle's vertices, colours and whether it holds a guard from the least colour class, and show the pigeonhole arithmetic 3 x (least class) <= n.",
      args: '{ "n": 9 }',
      run: (args) => {
        const C = core();
        const n = C.clampN(num(args, "n", C.N_DEFAULT));
        const given = readDiags(args.diagonals);
        const diagonals = given.length ? given : fanDiagonals(n);
        const base = C.start({ n });
        const a = C.triangulate(n, base.points, diagonals);
        const guardSet = new Set<number>(a.guards);
        const triangles = a.triangles.map((t: number[], i: number) => ({
          index: i,
          vertices: t,
          colors: t.map((v) => a.colors[v]),
          guarded: t.some((v) => guardSet.has(v)),
        }));
        const least = a.guardCount;
        return {
          n,
          colorCounts: { color0: a.counts[0], color1: a.counts[1], color2: a.counts[2] },
          leastColor: a.leastColor,
          guards: a.guards,
          triangles,
          allGuarded: triangles.every((t: { guarded: boolean }) => t.guarded),
          pigeonhole: {
            leastClassSize: least,
            threeTimesLeast: 3 * least,
            n,
            holds: 3 * least <= n,
          },
          note: `Every triangle has one corner of each colour, so the ${least} vertices of the least colour (${a.guards.join(", ")}) appear once in every triangle and see the whole polygon. Because the three colours partition the ${n} vertices, 3 x ${least} = ${3 * least} <= ${n}, i.e. at most floor(${n}/3) = ${C.floorThird(n)} guards.`,
        };
      },
    },
    bound_sweep: {
      describe:
        "Sweep several corner counts and confirm that the three-colouring guard set never exceeds floor(n/3) and guards every triangle, using fans on the applet's default polygons.",
      args: '{ "n": [4, 5, 6, 7, 8, 9, 10, 11, 12] }',
      run: (args) => {
        const C = core();
        const raw: unknown[] = Array.isArray(args.n)
          ? args.n
          : [4, 5, 6, 7, 8, 9, 10, 11, 12];
        const rows = raw.map((value) => {
          const n = C.clampN(asNum(value, "n"));
          const a = analyze(C, n, fanDiagonals(n));
          return {
            n,
            diagonals: a.diagonalsNeeded,
            triangles: a.triangles,
            colorCounts: a.colorCounts,
            guards: a.guardCount,
            bound: a.bound,
            withinBound: a.withinBound,
            allGuarded: a.everyTriangleGuarded,
          };
        });
        const allHold = rows.every((r) => r.withinBound && r.allGuarded);
        return {
          rows,
          allHold,
          note: allHold
            ? "For every size checked, the least colour class is at most floor(n/3) and meets every triangle — Chvatal's bound, proved by Fisk's colouring."
            : "At least one size broke the bound; check that the supplied diagonals really form a triangulation.",
        };
      },
    },
  };
}

/** What the core says about the polygon currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const n = C.clampN(num(state, "n", C.N_DEFAULT));
  const diagonals = readDiags(state.diagonals);
  const finished = state.finished === true;
  const a = analyze(C, n, diagonals);

  // The page saves the marked corners from its own (possibly rearranged)
  // polygon, so prefer those over the regenerated default-polygon set.
  const saved = readInts(state.guards);
  const guards = saved.length ? saved : a.guards;
  const guardCount = guards.length;
  const bound = C.floorThird(n);

  return {
    n,
    mode: typeof state.mode === "string" ? state.mode : "draw",
    diagonalsPlaced: a.diagonalsPlaced,
    diagonalsNeeded: a.diagonalsNeeded,
    remaining: Math.max(0, a.diagonalsNeeded - a.diagonalsPlaced),
    triangles: a.triangles,
    complete: a.complete,
    finished,
    colorCounts: a.colorCounts,
    leastColor: a.leastColor,
    guards,
    guardCount,
    bound,
    withinBound: guardCount <= bound,
    everyTriangleGuarded: a.everyTriangleGuarded,
    message: typeof state.message === "string" ? state.message : null,
    note: a.complete
      ? `The ${n}-gon is fully triangulated into ${a.triangles} triangles. The three colour classes have sizes ${a.colorCounts.color0}, ${a.colorCounts.color1}, ${a.colorCounts.color2}; the ${guardCount} corners of the least class (${guards.join(", ")}) see every triangle and stay within floor(${n}/3) = ${bound}.`
      : `${a.diagonalsPlaced} of ${a.diagonalsNeeded} diagonals are placed; ${Math.max(0, a.diagonalsNeeded - a.diagonalsPlaced)} more are needed before the three-colouring can pick the guard corners.`,
  };
}
