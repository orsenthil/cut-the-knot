/*
 * run_game_logic actions and saved-position reader for Given Common Chord
 * (Bogomolny's GivenCommonChord applet, after Yaglom, Geometric
 * Transformations I, problem 7(a)).
 *
 * Two circles meet at P and Q. A horizontal segment of length a sits at the
 * top of the board. We want a line through P whose other crossings with the
 * circles, M1 and M2, are exactly a apart. The perpendicular feet from the two
 * centres onto that line bisect PM1 and PM2, so the feet are a/2 apart;
 * translating that little segment to start at O1 puts its far end at a point T
 * on the circle with diameter O1O2 and a/2 from O1. Each such T gives one line
 * through P parallel to O1T: two Ts mean two lines, one (a tangency) means one,
 * none means no solution.
 *
 * The applet keeps a as an integer and draws the auxiliary circle with radius
 * floor(a/2), so an odd a cuts a chord of a-1 rather than a. The real core
 * keeps that quirk; every number below comes from it, copied at build time
 * from given-common-chord/given-common-chord-core.js into src/generated/cores/.
 * Coordinates are board units of the 640 x 460 board, y down. See _shared.ts
 * for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleInfo = { x: number; y: number; r: number };
type Line = { p: Pt; q: Pt };
type State = {
  A: Pt; B: Pt; C1: Pt; R1: Pt; C3: Pt; R3: Pt;
  L: number; whichLine: number; showHint: boolean; showNames: boolean;
  moves: number; explored: boolean;
};
type Geometry = {
  L: number; half: number; r1: number; r2: number; d: number;
  c1: CircleInfo | null; c2: CircleInfo | null;
  cOO: CircleInfo | null; cL: CircleInfo | null;
  P: Pt | null; Q: Pt | null; T: Pt[]; lines: Line[];
  M: (Pt | null)[]; N: (Pt | null)[]; feet: (Pt | null)[];
  chord1: number; chord2: number;
  solutionCount: number; noDraw: boolean; noSolution: boolean; degenerate: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; MARGIN: number; ROW: number;
  MIN_LENGTH: number; MIN_RADIUS: number; HANDLES: string[];
  start(o?: { whichLine?: number; showHint?: boolean; showNames?: boolean }): State;
  movePoint(s: State, name: string, p: Pt): State;
  setWhichLine(s: State, n: number): State;
  setOption(s: State, key: string, value: boolean): State;
  compute(s: State): Geometry;
  describe(s: State): string;
  dist(p: Pt, q: Pt): number;
  result(): null;
};
const core = (): Core =>
  cores["given-common-chord"].GivenCommonChordCore as unknown as Core;

const HANDLES = ["A", "B", "C1", "R1", "C3", "R3"] as const;
type Handle = (typeof HANDLES)[number];

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON cannot carry NaN/Infinity; print non-finite core values as null. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (v: Pt | null | undefined): Pt | null =>
  v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: r6(v.x), y: r6(v.y) } : null;
const circ = (v: CircleInfo | null) =>
  v ? { center: { x: r6(v.x), y: r6(v.y) }, radius: r6(v.r) } : null;
const gap = (C: Core, a: Pt | null, b: Pt | null): number | null =>
  a && b ? cnt(C.dist(a, b)) : null;

/** Tutor points may be [x, y]; saved Track.state points are { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readOptions(args: Json) {
  const raw = args.whichLine === undefined || args.whichLine === null ? 0 : Number(args.whichLine);
  if (!Number.isInteger(raw) || raw < 0 || raw > 2) {
    throw new Error('"whichLine" must be 0 (first line), 1 (second line) or 2 (show both)');
  }
  for (const key of ["showHint", "showNames"] as const) {
    const v = args[key];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      throw new Error(`"${key}" must be true or false`);
    }
  }
  return { whichLine: raw, showHint: args.showHint === true, showNames: args.showNames === true };
}

/** Start at the applet's opening picture, then drag any supplied handle. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const o = readOptions(args);
  let s = C.start({ whichLine: o.whichLine, showHint: o.showHint, showNames: o.showNames });
  for (const name of HANDLES) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.movePoint(s, name, readPoint(v, name));
  }
  return s;
}

/** Rebuild a core position from the six handles Track.state saved. */
function savedState(C: Core, state: Json): State {
  let s = C.start();
  for (const name of HANDLES) {
    const v = state[name];
    if (v !== undefined && v !== null) s = C.movePoint(s, name, readPoint(v, `saved ${name}`));
  }
  const line = state.whichLine === undefined || state.whichLine === null ? 0 : Number(state.whichLine);
  if (Number.isInteger(line) && line >= 0 && line <= 2) s = C.setWhichLine(s, line);
  s = C.setOption(s, "showHint", state.showHint === true);
  s = C.setOption(s, "showNames", state.showNames === true);
  return s;
}

/** Is the drawn line through P really parallel to the radius O1 -> T? */
function parallelCheck(line: Line | undefined, t: Pt, O1: Pt) {
  if (!line) return null;
  const vx = line.q.x - line.p.x, vy = line.q.y - line.p.y;
  const wx = O1.x - t.x, wy = O1.y - t.y;
  const cross = vx * wy - vy * wx;
  const scale = Math.hypot(vx, vy) * Math.hypot(wx, wy);
  return { cross: r6(cross), parallel: Math.abs(cross) <= 1e-6 * Math.max(1, scale) };
}

/** Everything the real core can say about one picture. */
function reading(C: Core, s: State) {
  const g = C.compute(s);
  const recipeChord = 2 * g.half;
  const countText = g.noDraw
    ? "no drawing (the segment or a radius is too short)"
    : g.noSolution
      ? "none"
      : g.solutionCount === 1 ? "one" : "two";
  const chosen = g.solutionCount === 1 ? g.chord1 : s.whichLine === 1 ? g.chord2 : g.chord1;

  /* The feet under O1 and O2 are the midpoints of PM1 and PM2 on the selected
     line, so their separation should be half the chord. Check it on the core's
     own points rather than assuming it. */
  let feetCheck: {
    foot1MidpointError: number | null; foot2MidpointError: number | null;
    feetSeparation: number | null; equalsHalf: boolean | null;
  } | null = null;
  if ((s.whichLine === 0 || s.whichLine === 1) && g.P && g.feet[0] && g.feet[1]) {
    const cuts = s.whichLine === 0 ? g.M : g.N;
    const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const m1 = cuts[0] ? mid(g.P, cuts[0]) : null;
    const m2 = cuts[1] ? mid(g.P, cuts[1]) : null;
    feetCheck = {
      foot1MidpointError: gap(C, g.feet[0], m1),
      foot2MidpointError: gap(C, g.feet[1], m2),
      feetSeparation: gap(C, g.feet[0], g.feet[1]),
      equalsHalf: Math.abs((gap(C, g.feet[0], g.feet[1]) ?? NaN) - g.half) < 1e-4,
    };
  }

  return {
    valid: !g.noDraw && !g.noSolution && !g.degenerate,
    reason: g.noDraw
      ? "The segment is under 2 units or a radius is under 2 units."
      : g.noSolution
        ? (!g.P
          ? "The two circles do not meet, so there is no common chord through P."
          : "Half the length reaches past the other centre, or the auxiliary circles do not meet: no line works.")
        : null,
    handles: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    options: { whichLine: s.whichLine, showHint: s.showHint, showNames: s.showNames },
    length: s.L,
    half: g.half,
    recipeChord: cnt(recipeChord),
    chordEqualsA: Math.abs(recipeChord - s.L) < 1e-6,
    oddLengthCaveat: s.L % 2 === 1
      ? `a = ${s.L} is odd, so the applet's floor(a/2) = ${g.half} makes the cut chord ${r6(recipeChord)} = a - 1, not a.`
      : null,
    circles: {
      first: { center: pt(s.C1), radius: cnt(g.r1) },
      second: { center: pt(s.C3), radius: cnt(g.r2) },
      centreDistance: cnt(g.d),
      onDiameterO1O2: circ(g.cOO),
      aboutO1RadiusHalf: circ(g.cL),
    },
    intersections: { P: pt(g.P), Q: pt(g.Q) },
    lines: {
      count: g.solutionCount,
      countText,
      candidatesT: g.T.map(pt),
      recipe: g.T.map((t, i) => ({
        T: pt(t),
        radiusO1T: cnt(C.dist(s.C1, t)),
        directionO1fromT: { x: r6(s.C1.x - t.x), y: r6(s.C1.y - t.y) },
        throughPto: pt(g.lines[i] && g.lines[i].q),
        parallelToO1T: parallelCheck(g.lines[i], t, s.C1),
      })),
      cuts: [
        { line: 1, M1: pt(g.M[0]), M2: pt(g.M[1]), chord: cnt(g.chord1) },
        { line: 2, M1: pt(g.N[0]), M2: pt(g.N[1]), chord: cnt(g.chord2) },
      ],
      feetForSelectedLine: g.feet.map(pt),
      feetCheck,
    },
    selected: { whichLine: s.whichLine, chord: cnt(chosen) },
    status: C.describe(s),
    result: C.result(),
    note:
      `The perpendicular feet from O1 and O2 onto a solution line bisect PM1 and PM2, so the feet are ${r6(g.half)} apart; ` +
      "moving that little segment to start at O1 gives a point T on the circle with diameter O1O2 at that same distance from O1, and the line through P parallel to O1T is the answer. " +
      (g.noSolution || g.noDraw
        ? "This picture has no such line; move the centres or resize the segment."
        : `${countText} line${g.solutionCount === 1 ? "" : "s"} through P cut${g.solutionCount === 1 ? "s" : ""} a ${r6(recipeChord)} unit chord.`) +
      (s.L % 2 === 1
        ? ` The odd length matters: the applet draws the auxiliary circle with radius floor(${s.L}/2) = ${g.half}, so the chord it cuts is ${r6(recipeChord)}, one unit short of a.`
        : " With an even length the auxiliary radius a/2 is exact, so the cut chord equals a.") +
      " This is a drawing, so there is no win or loss.",
  };
}

function readLengths(C: Core, value: unknown): number[] {
  if (value === undefined || value === null) return [256, 257, 258, 259, 260];
  if (!Array.isArray(value)) throw new Error('"lengths" must be an array of whole numbers');
  if (value.length < 1 || value.length > 24) {
    throw new Error('"lengths" must contain between 1 and 24 numbers');
  }
  const max = C.WIDTH - C.MARGIN - C.WIDTH / 2;
  return value.map((v, i) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < C.MIN_LENGTH || n > max) {
      throw new Error(`lengths[${i}] must be a whole number from ${C.MIN_LENGTH} to ${max}, got ${JSON.stringify(v)}`);
    }
    return n;
  });
}

export function actions(): GameActions {
  return {
    common_chord: {
      describe:
        "Build the construction from the six draggable points A, B (the length segment), C1/R1 and C3/R3 (the two circles), each [x, y] or { x, y } on the 640 x 460 board; omit any to keep the applet's opening picture. 'whichLine' is 0 or 1 for one candidate, 2 to show both, and showHint/showNames are optional booleans. Report the length a, floor(a/2), the number of lines through P that work (two, one or none), the points T on the circle with diameter O1O2, the line through P parallel to O1T, the chord each line cuts, the feet that bisect PM1 and PM2, and the odd-a floor caveat (an odd a cuts a-1, not a).",
      args: '{"A":[322,57.5],"B":[580,57.5],"C1":[228,322],"R1":[78,322],"C3":[384,322],"R3":[504,322],"whichLine":0,"showHint":true}',
      run: (args) => {
        const C = core();
        return reading(C, buildState(C, args));
      },
    },

    length_sweep: {
      describe:
        "Hold the two circles fixed and slide B along the top row for each whole-number length in 'lengths' (2 to 306; defaults to [256, 257, 258, 259, 260]). For each a the real core reports how many lines through P work (two, one or none) and the chord a line parallel to O1T actually cuts: 2*floor(a/2), so an even a cuts exactly a while an odd a cuts a-1. The optional C1/R1/C3/R3 points and whichLine/showHint flags are read exactly as in common_chord.",
      args: '{"lengths":[256,257,258,259,260],"whichLine":0}',
      run: (args) => {
        const C = core();
        const lengths = readLengths(C, args.lengths);
        const o = readOptions(args);
        let base = C.start({ whichLine: o.whichLine, showHint: o.showHint, showNames: o.showNames });
        for (const name of ["C1", "R1", "C3", "R3"] as const) {
          const v = args[name];
          if (v !== undefined && v !== null) base = C.movePoint(base, name, readPoint(v, name));
        }
        const A = base.A;
        const rows = lengths.map((a) => {
          const s = C.movePoint(base, "B", { x: A.x + a, y: C.ROW });
          const g = C.compute(s);
          return {
            requestedLength: a,
            appliedLength: s.L,
            half: g.half,
            recipeChord: cnt(2 * g.half),
            lines: g.solutionCount,
            chord1: cnt(g.chord1),
            chord2: cnt(g.chord2),
            cutsExactlyA: Math.abs(2 * g.half - a) < 1e-6,
            status: C.describe(s),
          };
        });
        const even = rows.filter((row) => row.requestedLength % 2 === 0);
        const odd = rows.filter((row) => row.requestedLength % 2 === 1);
        return {
          from: pt(A),
          rows,
          summary: {
            evenCutA: even.length > 0 && even.every((row) => row.cutsExactlyA),
            oddCutAminusOne: odd.length > 0 && odd.every((row) =>
              Math.abs((row.recipeChord ?? NaN) - (row.requestedLength - 1)) < 1e-6),
            lineCounts: Array.from(new Set(rows.map((row) => row.lines))).sort(),
          },
          note:
            "The auxiliary circle has radius floor(a/2), so the chord cut by the line through P parallel to O1T is 2*floor(a/2): an even a is cut exactly, an odd a comes out one unit short. " +
            "Two points T mean two working lines, a single (tangent) point one line, and no points none; here the line counts are listed for each length. " +
            "If B would leave the board, the core clamps it and appliedLength reports the length actually used.",
        };
      },
    },
  };
}

/** Echo every field Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Given Common Chord state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Given Common Chord position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const g = C.compute(s);
  const analysis = reading(C, s);
  const scalar = (key: string, saved: unknown, value: number): {
    saved: unknown; core: number | null; equal: boolean;
  } => {
    const n = Number(saved);
    return {
      saved,
      core: cnt(value),
      equal: Number.isFinite(n) && Math.abs(n - value) < 1e-4,
    };
  };
  const pointPair = (label: string, saved: unknown, value: Pt | null) => {
    const p = saved === undefined || saved === null ? null : readPoint(saved, `saved ${label}`);
    return { saved: pt(p), core: pt(value), distance: gap(C, p, value) };
  };
  const savedList = (label: string, saved: unknown): (Pt | null)[] => {
    if (!Array.isArray(saved)) return [null, null];
    return [0, 1].map((i) =>
      saved[i] === undefined || saved[i] === null ? null : readPoint(saved[i], `saved ${label}[${i}]`));
  };
  const listPair = (label: string, saved: unknown, value: (Pt | null)[]) => {
    const from = savedList(label, saved);
    return from.map((p, i) => ({ saved: pt(p), core: pt(value[i]), distance: gap(C, p, value[i] ?? null) }));
  };

  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: analysis.valid,
    core: analysis,
    savedVsCore: {
      length: scalar("L", state.L, s.L),
      whichLine: scalar("whichLine", state.whichLine, s.whichLine),
      solutionCount: scalar("solutionCount", state.solutionCount, g.solutionCount),
      chord1: scalar("chord1", state.chord1, g.chord1),
      chord2: scalar("chord2", state.chord2, g.chord2),
      noSolution: {
        saved: state.noSolution === true,
        core: g.noSolution,
        equal: state.noSolution === true === g.noSolution,
      },
      P: pointPair("P", state.P, g.P),
      Q: pointPair("Q", state.Q, g.Q),
      T: listPair("T", state.T, g.T),
      M: listPair("M", state.M, g.M),
      N: listPair("N", state.N, g.N),
    },
    note:
      "Track.state saved the six handles A, B, C1, R1, C3, R3, the length a, the selected line and the two display flags, together with the derived crossings P and Q, the two T points, the crossings M and N, the chord lengths, the solution count and the no-solution flag, all in board units. " +
      "The real core rebuilds the two circles, the auxiliary circle of radius floor(a/2) on the circle with diameter O1O2 and the lines through P parallel to O1T from those handles, and savedVsCore measures how close the saved derived fields are. " +
      "The page does not save the move count or whether the drawing was explored, so those are rebuilt from the start picture. " +
      "The odd-a quirk means an odd saved length cuts a chord of a-1.",
  };
}
