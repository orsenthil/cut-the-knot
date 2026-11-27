/*
 * run_game_logic actions and saved-position reader for Carpets In Square.
 *
 * The page is an illustration, not a win/lose game. In a square ABCD, M sits on
 * side AB and N on side BC. The four lines AN, DN, DM and CM cut out a blue
 * quadrilateral DPQR and three red pieces AMP, BMQN and CNR; the Carpets
 * Theorem says the blue area equals the three red areas put together, wherever
 * M and N are. The reason is that triangle ADN and the union of triangles ADM
 * and BCM each cover half the square: remove their common part (triangles ADP
 * and NQR) and the blue carpet is left on one side, the three red carpets on
 * the other. P = AN ∩ DM, Q = AN ∩ CM and R = CM ∩ DN.
 *
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carpets-in-square"].CarpetsInSquareCore;

type Pt = { x: number; y: number };
type State = {
  width: number; height: number; side: number;
  m: number; n: number; showNames: boolean; explored: boolean;
};

const round = (v: number) => Math.round(v * 1e6) / 1e6;
/** The core's |det| < 1 guard can leave NaN; make that an explicit null. */
const val = (v: number): number | null => (Number.isFinite(v) ? round(v) : null);
const pt = (p: Pt): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;

/** Accept [x, y] or { x, y }, as the other geometry readers do. */
function readPoint(v: unknown, key: string): Pt {
  if (Array.isArray(v)) {
    const a = numArray({ [key]: v }, key);
    if (a.length !== 2) throw new Error(`"${key}" must have exactly two numbers, [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }`);
}

/** The page's board (450 by 400 by default) and the centred square on it. */
function readBoard(args: Json) {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) throw new Error("width and height must be positive");
  const maxSide = Math.min(width, height);
  const side = num(args, "side", C.snapSide(width, height));
  if (!(side > 0) || side > maxSide + 1e-9) {
    throw new Error(`side must be positive and at most ${round(maxSide)} on this board`);
  }
  return { width, height, side };
}

/** A point's distance along its side, kept where the page's handle keeps it. */
function alongSide(args: Json, key: string, side: number): number {
  const v = num(args, key, side / 2);
  if (v < -1e-9 || v > side + 1e-9) {
    throw new Error(
      `"${key}" must lie between 0 and ${round(side)} so the point stays on its side`,
    );
  }
  return core().clamp(v, 0, side);
}

function readState(args: Json): State {
  const { width, height, side } = readBoard(args);
  return {
    width, height, side,
    m: alongSide(args, "m", side),
    n: alongSide(args, "n", side),
    showNames: args.showNames === true,
    explored: true,
  };
}

/** The core's whole picture, phrased for a tutor. */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  const cl = C.claims(g);
  // compute() replaces layout's overlap array of triangles with their total
  // area, so the two common-part triangles come from layout itself.
  const l = C.layout(s);
  const sum = g.redAreas.reduce((a: number, b: number) => a + b, 0);
  const overlapADP = C.area(l.overlap[0]);
  const overlapNQR = C.area(l.overlap[1]);
  const identity =
    `blue + common = ${round(g.blueArea + g.overlap)} = ` +
    `triangle ADN = ${round(g.halfADN)}; ` +
    `reds + common = ${round(sum + g.overlap)} = ` +
    `triangles ADM + BCM = ${round(g.halfCarpets)}`;
  return {
    board: { width: s.width, height: s.height },
    square: {
      side: round(g.side),
      area: round(g.squareArea),
      corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    },
    handles: {
      M: pt(g.M), N: pt(g.N),
      MFractionAlongAB: round(s.m / s.side),
      NFractionAlongBC: round(s.n / s.side),
    },
    crossings: {
      P: pt(g.P), Q: pt(g.Q), R: pt(g.R),
      finite: g.finite,
      noDraw: g.noDraw,
    },
    regions: {
      blue_DPQR: val(g.blueArea),
      red_AMP: val(g.redAreas[0]),
      red_BMQN: val(g.redAreas[1]),
      red_CNR: val(g.redAreas[2]),
      redTotal: val(sum),
    },
    equality: {
      equation:
        `${round(g.blueArea)} = ${round(g.redAreas[0])} + ` +
        `${round(g.redAreas[1])} + ${round(g.redAreas[2])} = ${round(sum)}`,
      holds: cl.redEqualsBlue,
      difference: val(g.blueArea - sum),
    },
    halfSquareProof: {
      triangleADN: val(g.halfADN),
      triangleADM: val(C.area(g.halfs[1])),
      triangleBCM: val(C.area(g.halfs[2])),
      twoTrianglesTotal: val(g.halfCarpets),
      halfSquare: val(g.squareArea / 2),
      commonPart: {
        ADP: val(overlapADP), NQR: val(overlapNQR), total: val(g.overlap),
      },
      identity,
      checks: { halvesEqual: cl.halvesEqual, overlapFits: cl.overlapFits },
    },
    checks: cl,
    status: C.describe(s),
    note:
      "Triangle ADN and the union of triangles ADM and BCM each cover half the square. " +
      "Their common part is triangles ADP and NQR; taking it away from each half leaves " +
      "the blue quadrilateral DPQR and the three red pieces AMP, BMQN and CNR, so the " +
      "blue area equals the sum of the reds wherever M and N sit on their sides. " +
      "An |det| < 1 in the applet's intersection routine leaves a crossing missing; " +
      "then finite is false and the areas are null.",
  };
}

export function actions(): GameActions {
  return {
    carpets_areas: {
      describe:
        "For a square of side `side` (default the page's 300 on a 450 by 400 board), with M `m` units down side AB from A and N `n` units along BC from B (both default to the midpoints), report the four regions the real core draws: the blue quadrilateral DPQR and the three red pieces AMP, BMQN and CNR. Check the Carpets Theorem that the blue area equals the three reds added together, and show the two half-square triangles and their overlap that prove it. m and n must lie on their sides, between 0 and side; optional width, height and showNames set the board and reproduce the page's switch.",
      args: '{ "side": 300, "m": 150, "n": 150 }',
      run: (args) => reading(readState(args)),
    },
    slide_point: {
      describe:
        "Slide M along side AB or N along side BC of the page's square to a board point and read the carpets that result. Give `name` ('M' or 'N') and `to` as [x, y] or { x, y } on the board (default 450 by 400); optional side, m and n set the starting picture, both points starting at the midpoints. The core clamps M's y to AB and N's x to BC exactly as the page's handles do; the reply says whether the requested point was already on that side, gives the new distances and all four areas, and checks that blue still equals the three reds. A point with M at A and N at C makes the applet's intersections miss.",
      args: '{ "name": "M", "to": [75, 250], "side": 300 }',
      run: (args) => {
        const C = core();
        const s0 = readState(args);
        const name = String(args.name ?? "M");
        if (name !== "M" && name !== "N") {
          throw new Error('name must be "M" or "N"');
        }
        const to = readPoint(args.to, "to");
        if (to.x < 0 || to.x > s0.width || to.y < 0 || to.y > s0.height) {
          throw new Error(`to must lie inside the ${s0.width} by ${s0.height} board`);
        }
        const g0 = C.layout(s0);
        const onSide =
          name === "M"
            ? Math.abs(to.x - g0.A.x) < 1e-6 &&
              to.y >= g0.A.y - 1e-9 && to.y <= g0.B.y + 1e-9
            : Math.abs(to.y - g0.B.y) < 1e-6 &&
              to.x >= g0.B.x - 1e-9 && to.x <= g0.C.x + 1e-9;
        const s1 = C.move(s0, { type: "point", name, point: to });
        if (!s1) throw new Error(`could not slide ${name} to that point`);
        return {
          slid: name,
          requested: pt(to),
          wasOnSide: onSide,
          before: { m: round(s0.m), n: round(s0.n) },
          after: { m: round(s1.m), n: round(s1.n) },
          reading: reading(s1),
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of that same illustration. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Carpets In Square state version ${stateVersion}`);
  }
  const { width, height, side } = readBoard(state);
  const s: State = {
    width, height, side,
    m: alongSide(state, "m", side),
    n: alongSide(state, "n", side),
    showNames: state.showNames === true,
    explored: state.explored === true,
  };
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    width, height, side, m: s.m, n: s.n,
    showNames: s.showNames,
    explored: s.explored,
    reading: reading(s),
  };
}
