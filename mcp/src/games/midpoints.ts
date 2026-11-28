/*
 * run_game_logic actions and saved-position reader for Midpoints.
 *
 * The real core is midpoints/midpoints-core.js, copied into
 * src/generated/cores/ at build time. It transcribes Bogomolny's applet: given
 * midpoint dots O1..On, the starting vertex A is reflected in each dot in
 * turn, A_{k+1} = 2 O_k - A_k. A reflection in a point is x -> 2O - x, so n of
 * them compose to a reflection in the alternating sum
 *
 *     S = O1 - O2 + O3 - ... + (-1)^(n+1) On
 *
 * when n is odd (S is the one fixed point, hence the unique closing start),
 * and to the translation by -2S = 2(O2 - O1 + O4 - O3 + ...) when n is even.
 * An even n closes from every start only when S = 0; for n = 4 that is just
 * O1 + O3 = O2 + O4, the parallelogram condition on the four dots. Every
 * number below is read from the core, never recomputed from scratch. See
 * _shared.ts for the module shape. This is an illustration: no win or loss.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Mode = "place" | "drag";
type State = { points: Point[]; cursor: Point; mode: Mode; explored: boolean };
type Sym =
  | { type: "reflection"; center: Point; S: Point }
  | { type: "translation"; vector: Point; S: Point; identity: boolean };
type Geometry = {
  segments: [Point, Point][];
  vertices: Point[];
  end: Point;
  target: Point;
  finished: boolean;
  n: number;
  symmetry: Sym;
  parity: "odd" | "even";
  fixedPoint: Point | null;
  shift: Point | null;
  predictedTarget: Point;
  targetAgrees: boolean;
  closesExactly: boolean;
  solutions: number | null;
};

interface Core {
  VIEW: { width: number; height: number };
  STEP: number;
  MAX_POINTS: number;
  TOL: number;
  start(options?: { points?: Point[]; cursor?: Point; mode?: string }): State;
  setMode(state: State, mode: Mode): State;
  geometry(state: State): Geometry;
  chain(state: State): { n: number; end: Point; target: Point; finished: boolean; vertices: Point[] };
  symmetry(points: Point[]): Sym;
  describe(state: State): string;
}

const core = (): Core => cores.midpoints.MidpointsCore as unknown as Core;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const maybePt = (p: Point | null | undefined): Point | null => (p ? pt(p) : null);

/** Tool arguments may use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${name}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${name}" must be [x, y]`);
    [x, y] = [Number(value[0]), Number(value[1])];
  } else if (typeof value === "object") {
    const o = value as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${name}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${name}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readPoints(C: Core, value: unknown, name: string): Point[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`"${name}" must be an array of points`);
  if (value.length > C.MAX_POINTS) {
    throw new Error(`"${name}" may hold at most ${C.MAX_POINTS} midpoints (the applet's m_nMax)`);
  }
  return value.map((p, i) => readPoint(p, `${name}[${i}]`));
}

/**
 * A real core state: the dots and cursor snapped to the applet's grid, the
 * mode checked, and the illustration marked explored as any interaction does.
 */
function readState(C: Core, args: Json, defaultMode: Mode = "drag"): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with points, cursor and mode");
  }
  const points = readPoints(C, args.points, "points");
  const cursor = readPoint(args.cursor, "cursor", C.start().cursor);
  const rawMode = args.mode === undefined || args.mode === null ? defaultMode : String(args.mode);
  if (rawMode !== "place" && rawMode !== "drag") {
    throw new Error(`"mode" must be "place" or "drag", got ${JSON.stringify(args.mode)}`);
  }
  return { ...C.start({ points, cursor, mode: rawMode }), explored: true };
}

/** The alternating sum in words, e.g. "O1 - O2 + O3 - O4". */
function alternatingText(n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(i === 0 ? "O1" : `${i % 2 === 0 ? "+" : "-"} O${i + 1}`);
  }
  return parts.join(" ");
}

const howMany = (solutions: number | null): string =>
  solutions === null ? "no polygon yet" : solutions === Infinity
    ? "every start" : solutions === 1 ? "one start" : "no start";

/** Four dots close the chain exactly when the core's even shift S vanishes. */
function parallelogramCheck(C: Core, g: Geometry) {
  const sum = g.symmetry.S;
  const holds = g.symmetry.type === "translation" && g.symmetry.identity;
  return {
    applies: g.n === 4,
    condition: "O1 + O3 = O2 + O4 (the four dots are the vertices of a parallelogram)",
    S: pt(sum),
    holds: g.n === 4 ? holds : null,
    note: g.n !== 4
      ? null
      : `S = O1 - O2 + O3 - O4 = (${round(sum.x)}, ${round(sum.y)}). It is zero exactly when ` +
        "O1 + O3 = O2 + O4, the parallelogram condition on the four dots: "
        + (holds
          ? "here it is zero, so every start closes the 4-gon."
          : "here it is not zero, so no start closes the 4-gon."),
    board: C.VIEW,
  };
}

/** Everything the core says about one collection of midpoints and one cursor. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const sym = g.symmetry;
  const n = g.n;
  const sum = alternatingText(n);
  const composition = sym.type === "reflection"
    ? {
        type: "reflection",
        center: pt(sym.center),
        fixedPoint: maybePt(g.fixedPoint),
        formula: `A_(k+1) = 2 O_k - A_k; ${n} reflections compose to reflection in S = ${sum}, whose fixed point is S.`,
      }
    : {
        type: "translation",
        vector: pt(sym.vector),
        identity: sym.identity,
        formula: `${n} reflections compose to translation by -2S = 2(O2 - O1 + O4 - O3 + ...), with S = ${sum}.`,
      };
  const shiftVec = sym.type === "translation" ? sym.vector : { x: 0, y: 0 };
  const explanation = g.solutions === null
    ? "No dots yet: place midpoints before asking which start closes a polygon."
    : g.solutions === 1
      ? `One start closes the polygon: put the cursor on S = (${round(sym.S.x)}, ${round(sym.S.y)}).`
      : g.solutions === Infinity
        ? "The translation is the identity (S = (0, 0)), so every start closes the polygon."
        : `The translation by (${round(shiftVec.x)}, ${round(shiftVec.y)}) is not zero, so no start closes the polygon.`;

  return {
    board: C.VIEW,
    gridStep: C.STEP,
    closingTolerance: C.TOL,
    n,
    parity: g.parity,
    midpoints: s.points.map(pt),
    cursor: pt(s.cursor),
    alternatingSumS: pt(sym.S),
    alternatingSumText: sum,
    composition,
    closing: {
      howMany: howMany(g.solutions),
      solutionCount: g.solutions === Infinity ? "infinitely many" : g.solutions,
      explanation,
      parallelogram: parallelogramCheck(C, g),
    },
    chain: {
      vertices: g.vertices.map(pt),
      end: pt(g.end),
      target: pt(g.target),
      predictedTarget: pt(g.predictedTarget),
      targetAgrees: g.targetAgrees,
      closesExactly: g.closesExactly,
      finishedWithinTolerance: g.finished,
    },
    isIllustration: true,
    note: C.describe(s) + (n === 0
      ? " With no dots the applet leaves its chain endpoint at (0, 0), so the red ring sits halfway to the corner; there is no polygon yet."
      : ""),
  };
}

const COMPOSITION_ARGS =
  '{ "points": [[100, 100], [200, 100], [150, 200]], "cursor": [150, 150] }';
const CLOSING_ARGS =
  '{ "points": [[100, 100], [200, 100], [200, 200], [100, 200]], "cursor": [150, 150] }';

export function actions(): GameActions {
  return {
    composition: {
      describe:
        "Reflect the cursor in each midpoint dot in turn (A_(k+1) = 2 O_k - A_k), using the real core, and report the whole construction. The alternating sum S = O1 - O2 + O3 - ... + On decides everything: for odd n the reflections compose to one reflection in S, whose fixed point S is the unique starting vertex that closes the polygon; for even n they compose to the translation by -2S = 2(O2 - O1 + O4 - O3 + ...), which is the identity when S = 0 (every start closes) and otherwise never closes. For four dots S = 0 is O1 + O3 = O2 + O4, the parallelogram condition. Also reports the chain from the given cursor, its endpoint and the red target ring. Points and cursor may be [x, y] or { x, y } in the page's 400 by 350 board (y downward) and snap to the applet's 2-unit grid; mode may be place or drag.",
      args: COMPOSITION_ARGS,
      run: (args) => {
        const C = core();
        return reading(C, readState(C, args));
      },
    },

    closing_start: {
      describe:
        "Find where the first vertex must go for the reflected chain to close into a polygon, then test that start with the real core. With odd n there is exactly one start, the fixed point S of the reflection; with even n and S = 0 every start works, and with even n and S != 0 none does. Pass cursor to test a particular start, or omit it to test the core's answer. Reports the tested endpoint, whether it closes exactly and within the applet's 3-unit tolerance, the even shift, and for four dots the parallelogram check O1 + O3 = O2 + O4. Points and cursor may be [x, y] or { x, y } in board units.",
      args: CLOSING_ARGS,
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const g = C.geometry(s);
        const candidate: Point = g.solutions === null || g.parity === "even"
          ? { ...s.cursor }
          : { ...(g.fixedPoint ?? s.cursor) };
        const testedState: State = { ...s, cursor: candidate };
        const t = C.geometry(testedState);
        return {
          n: g.n,
          parity: g.parity,
          alternatingSumS: pt(g.symmetry.S),
          closingStart: pt(candidate),
          howMany: howMany(g.solutions),
          exists: g.solutions !== null && g.solutions > 0,
          shift: maybePt(g.shift),
          test: {
            cursor: pt(candidate),
            end: pt(t.end),
            target: pt(t.target),
            closesExactly: t.closesExactly,
            finishedWithinTolerance: t.finished,
            tolerance: C.TOL,
          },
          parallelogram: parallelogramCheck(C, t),
          isIllustration: true,
          note:
            `The core's chain from (${round(candidate.x)}, ${round(candidate.y)}) ends at ` +
            `(${round(t.end.x)}, ${round(t.end.y)}), so it ` +
            (t.closesExactly ? "closes exactly" : "does not close")
            + `; the red ring is at (${round(t.target.x)}, ${round(t.target.y)}). ` + C.describe(testedState),
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Midpoints state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Midpoints position must be an object");
  }
  const C = core();
  const s = readState(C, state, "place");
  const g = C.geometry(s);
  const r = reading(C, s);
  const savedTarget = state.target === undefined || state.target === null
    ? null : readPoint(state.target, "target");

  return {
    ...state,
    stateVersion,
    saved: {
      points: state.points ?? [],
      cursor: state.cursor ?? null,
      mode: state.mode ?? null,
      n: state.n ?? null,
      parity: state.parity ?? null,
      target: state.target ?? null,
      finished: state.finished ?? null,
    },
    matchesSaved: {
      n: state.n === undefined ? null : Number(state.n) === g.n,
      parity: state.parity === undefined ? null : state.parity === g.parity,
      target: savedTarget === null
        ? null : savedTarget.x === g.target.x && savedTarget.y === g.target.y,
      finished: state.finished === undefined ? null : state.finished === g.finished,
    },
    reading: r,
    note:
      "Track.state saved the dots, the cursor, the place/drag mode, the dot count, the parity, " +
      "the red ring's centre and whether the chain closes. The core rebuilds the reflected chain " +
      "and the composition from the dots: " + r.closing.explanation + " " + r.note,
  };
}
