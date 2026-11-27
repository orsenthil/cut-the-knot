/*
 * run_game_logic actions and saved-position reader for Glad Construction.
 *
 * The real core is glad-construction/glad-construction-core.js, copied into
 * src/generated/cores/ at build time; every number below comes from it. The
 * other diagonal DB crosses AC at its midpoint E0; the parallel to BC through
 * E0 lands at P0, the midpoint of AB. Then the line D P0 crosses AC at E1, one
 * third along, and projects to P1, one third of AB, and so on: for k = 0..N-2
 * the crossing E_k and its mark P_k sit at the same fraction 1/(k+2). The last
 * mark is 1/N of AB, so the side is cut into N equal parts however the
 * parallelogram is slanted. The page also mentions a variation that alternates
 * which side holds the previous mark and gives Fibonacci fractions; this
 * applet always draws from corner D, so its marks are the unit fractions
 * 1/2, 1/3, ..., 1/N and the Fibonacci aside does not apply. See _shared.ts
 * for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["glad-construction"].GladConstructionCore;

type Point = { x: number; y: number };

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const close = (x: number, y: number, tol = 1e-5): boolean =>
  Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tol;

/** Accept the page's { x, y }, a tutor's [x, y], or the opening corner. */
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

/** N is a whole number of parts in the applet's own 2..20 range. */
function parts(raw: unknown, fallback: number): number {
  const C = core();
  const n = Number(raw === undefined || raw === null ? fallback : raw);
  if (!Number.isInteger(n) || n < C.MIN_PARTS || n > C.MAX_PARTS) {
    throw new Error(`"n" must be a whole number from ${C.MIN_PARTS} to ${C.MAX_PARTS}, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** The step number in the lemma, 1..MAX_PARTS-1 (P at 1/n of AB). */
function lemmaN(raw: unknown): number {
  const C = core();
  const n = Number(raw === undefined || raw === null ? 2 : raw);
  if (!Number.isInteger(n) || n < 1 || n > C.MAX_PARTS - 1) {
    throw new Error(`"n" must be a whole number from 1 to ${C.MAX_PARTS - 1}, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** A validated state from the real core, with its corners snapped to the applet's parallelogram. */
function startFrom(args: Json, n: number) {
  const C = core();
  const home = C.start();
  return C.start({
    A: readPoint(args.A, "A", home.A),
    B: readPoint(args.B, "B", home.B),
    C: readPoint(args.C, "C", home.C),
    D: readPoint(args.D, "D", home.D),
    n, names: args.names === true,
  });
}

/** The crossing on AC and matching mark on AB at each unit fraction, from the core. */
function steps(g: any) {
  const Es: Point[] = g.Es, Ps: Point[] = g.Ps;
  return Es.map((E, k) => ({
    k,
    fraction: `1/${k + 2}`,
    decimal: r6(1 / (k + 2)),
    crossingOnAC: pt(E),
    markOnAB: pt(Ps[k]),
  }));
}

/** True, false, or null when the page did not save this array. */
function agrees(saved: unknown, expected: Point[]): boolean | null {
  if (!Array.isArray(saved)) return null;
  const list = saved as Point[];
  if (list.length !== expected.length) return false;
  return list.every((p, i) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    return Math.hypot(p.x - expected[i].x, p.y - expected[i].y) < 1e-5;
  });
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "The GLaD construction for a parallelogram with draggable corners A, B, C, D (each [x, y] or { x, y } on the page's 400 x 250 board; omitted corners use the opening picture) and N parts, a whole number from 2 to 20 (default 3). Reports the crossings on diagonal AC with their matching marks on AB at 1/2, 1/3, ..., 1/N, the last mark at 1/N, and the core's similar-triangle, projection and last-part checks; the Fibonacci variation does not apply because this applet always draws from corner D.",
      args: '{ "n": 4, "A": [60, 215] }',
      run: (args) => {
        const C = core();
        const state = startFrom(args, parts(args.n, C.DEFAULT_PARTS));
        const g = C.construct(state);
        const cl = C.claims(state);
        const list = steps(g);
        return {
          n: g.n,
          parts: g.parts,
          names: g.names,
          corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
          crossingsAndMarks: list,
          lastMark: { fraction: `1/${g.n}`, position: pt(g.Ps[g.Ps.length - 1]) },
          checks: { lemma: cl.lemma, projection: cl.projection, lastPart: cl.lastPart },
          fibonacciAside: {
            applies: false,
            note:
              "The page's Fibonacci variation alternates which side holds the previous mark. " +
              "This applet always uses corner D, so its marks are the unit fractions 1/2, 1/3, ..., 1/N.",
          },
          note:
            `Each crossing E_k and its parallel projection P_k land at the same 1/(k+2) of AC and AB, so the final mark cuts off exactly 1/${g.n} of AB. ` +
            "Drag the corners: only the shape changes, never these fractions.",
        };
      },
    },
    lemma: {
      describe:
        "One step of the similar-triangle lemma behind the construction: with P at 1/n of AB and Q where DP meets AC, the triangles give QC/AQ = n and (n+1)·AQ = AC (the page states the left-side twin as n·AP = AD with Q = BP ∩ AC). The parallel to BC through Q projects back to AB at 1/(n+1); `n` is a whole number from 1 to 19 and optional corners use the opening picture.",
      args: '{ "n": 3 }',
      run: (args) => {
        const C = core();
        const n = lemmaN(args.n);
        const state = startFrom(args, C.DEFAULT_PARTS);
        const A: Point = state.A, B: Point = state.B, Cc: Point = state.C, D: Point = state.D;
        const P: Point = C.pointAtFraction(A, B, 1, n);
        const Q: Point | null = C.lineIntersection(P, D, A, Cc);
        if (!Q) {
          throw new Error("line DP and diagonal AC do not meet at a distinct point for these corners");
        }
        const aq = { x: Q.x - A.x, y: Q.y - A.y };
        const ac = { x: Cc.x - A.x, y: Cc.y - A.y };
        const t = (aq.x * ac.x + aq.y * ac.y) / (ac.x * ac.x + ac.y * ac.y);
        const parallel: Point = C.parallelPoint(Q, B, Cc);
        const foot: Point | null = C.lineIntersection(A, B, Q, parallel);
        const wanted: Point = C.pointAtFraction(A, B, 1, n + 1);
        const projectionHolds = Boolean(foot) &&
          Math.hypot(foot!.x - wanted.x, foot!.y - wanted.y) < 1e-5;
        const lemmaHolds = close((n + 1) * aq.x, ac.x) && close((n + 1) * aq.y, ac.y) &&
          close((1 - t) / t, n);
        return {
          n,
          corners: { A: pt(A), B: pt(B), C: pt(Cc), D: pt(D) },
          P: pt(P),
          Q: pt(Q),
          AQoverAC: r6(t),
          QCoverAQ: r6((1 - t) / t),
          projectedFoot: pt(foot),
          footFraction: `1/${n + 1}`,
          lemmaHolds,
          projectionHolds,
          note: lemmaHolds && projectionHolds
            ? `QC/AQ = ${n} = n and (${n + 1})·AQ = AC; the parallel to BC lands at 1/${n + 1} of AB.`
            : "The measured ratios do not match; check the corners and the step number.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading from the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Glad Construction state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Glad Construction position must be an object");
  }
  const C = core();
  const stateN = parts(state.n, C.DEFAULT_PARTS);
  const rebuilt = startFrom(state, stateN);
  const g = C.construct(rebuilt);
  const cl = C.claims(rebuilt);
  const saved = {
    A: pt(rebuilt.A), B: pt(rebuilt.B), C: pt(rebuilt.C), D: pt(rebuilt.D),
    n: rebuilt.n, names: rebuilt.names,
    crossingCount: Array.isArray(state.crossings) ? (state.crossings as unknown[]).length : null,
    markCount: Array.isArray(state.marks) ? (state.marks as unknown[]).length : null,
  };
  return {
    ...state,
    stateVersion,
    saved,
    reading: {
      n: g.n,
      parts: g.parts,
      steps: steps(g),
      lastMark: { fraction: `1/${g.n}`, position: pt(g.Ps[g.Ps.length - 1]) },
      checks: { lemma: cl.lemma, projection: cl.projection, lastPart: cl.lastPart },
      savedCrossingsAgree: agrees(state.crossings, g.Es),
      savedMarksAgree: agrees(state.marks, g.Ps),
      fibonacciAsideApplies: false,
    },
    note:
      "Track.state saved the four corners, N, the names switch and the core's crossings on AC and marks on AB. " +
      `The real core rebuilds the parallelogram and recomputes the 1/2, ..., 1/${g.n} crossings and marks: ` +
      "the last one is exactly 1/N of AB. This applet always draws from corner D, so the Fibonacci variation mentioned on the page does not apply.",
  };
}
