/*
 * run_game_logic actions and saved-position reader for The Tesseract. The core lives in
 * tesseract/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["tesseract"].TesseractCore;

type Reper = [number, number][];

function puzzleState(fixed: string, moving: string, reper: Reper, fixedReper: Reper) {
  const C = core();
  const f = C.squareIndex(fixed), m = C.squareIndex(moving);
  if (f < 0 || m < 0) throw new Error("squares are named like X01H: letters for free coordinates, 0/1 for fixed ones (order x, y, z, h)");
  return { fixed: f, moving: m, reper, fixedReper, history: [] as number[] };
}

/** Breadth-first: the fewest glides that bring the moving reper home reversed. */
function shortest(state: ReturnType<typeof puzzleState>) {
  const C = core();
  const key = (s: typeof state) => `${s.moving}|${JSON.stringify(s.reper)}`;
  let layer = [state];
  const seen = new Set([key(state)]);
  for (let d = 1; d <= 12; d++) {
    const next: (typeof state)[] = [];
    for (const t of layer) for (let j = 0; j < 8; j++) {
      const u = C.glide(t, j)!;
      if (C.solved(u)) return u.history.slice(1).concat([u.moving]).map((k: number) => C.SQUARES[k].name); // the squares visited, ending at home
      const k = key(u);
      if (!seen.has(k)) { seen.add(k); next.push(u); }
    }
    layer = next;
  }
  return null;
}

export function actions(): GameActions {
  return {
    counts: {
      describe: "The numbers of vertices, edges, squares, cubes, ... of the n-dimensional cube (n = 0..10): the coefficients of (2x + 1)^n, lowest dimension first.",
      args: '{ "n": 4 }',
      run: (args) => {
        const n = Math.round(num(args, "n", 4));
        if (n < 0 || n > 10) throw new Error("n must be 0..10");
        return { n, byDimension: core().faceCounts(n) };
      },
    },
    section: {
      describe: "The cross-section of the tesseract [0,1]^4 by the hyperplane Ax + By + Cz + Dh = E: how many corners and edges the cut solid has, and its corners.",
      args: '{ "A": 1, "B": 1, "C": 1, "D": 1, "E": 2 }',
      run: (args) => {
        const P = { A: num(args, "A"), B: num(args, "B"), C: num(args, "C"), D: num(args, "D"), E: num(args, "E") };
        const s = core().section(P);
        const corners = [...new Set(s.segments.flatMap(([p, q]: number[][]) => [p, q].map((v) => v.map((x) => Math.round(x * 1e6) / 1e6).join(","))))];
        return { corners: corners.length, edges: s.segments.length, cornerList: corners.slice(0, 40) };
      },
    },
    reper: {
      describe: "The reper puzzle: the squares a reper on a given square can glide to, and the shortest trip that brings it back to that square reversed.",
      args: '{ "square": "XY00" }',
      run: (args) => {
        const C = core();
        const name = String(args.square ?? "XY00");
        const i = C.squareIndex(name);
        if (i < 0) throw new Error("square names look like X01H");
        const s = C.startPuzzle({ square: i }) as unknown as ReturnType<typeof puzzleState>;
        return { square: name, neighbours: C.neighbours(i).map((n: { to: number }) => C.SQUARES[n.to].name), shortestReversingTrip: shortest(s) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = puzzleState(String(state.fixed), String(state.moving), state.reper as Reper, state.fixedReper as Reper);
  const o = C.orientation(s);
  return {
    built: state.built === true, angles: state.angles, hyperplane: state.plane,
    puzzle: {
      fixedSquare: String(state.fixed), movingSquare: String(state.moving), path: state.path,
      orientation: o === null ? "not back home yet" : o > 0 ? "same as the fixed reper" : "reversed: solved",
      shortestWayHomeReversed: shortest(s),
    },
  };
}
