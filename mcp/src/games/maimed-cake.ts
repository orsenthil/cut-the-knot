/*
 * run_game_logic actions and saved-position reader for Maimed Cake.
 *
 * The real core is maimed-cake/maimed-cake-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured from it.
 * Coordinates are board units with y downward. A rectangle ABCD has the
 * corner UZRD missing: Z is the inner corner of the removed rectangle, and U
 * and R are its projections onto AD and CD. Extending BZ meets the right side
 * CD (below the diagonal) or the top side AD (above it) at M. The strip
 * AKLU / KLRC through M has half its area added as the triangle BZQ, so the
 * straight cut BQ halves what is left; sliding B and Z by half that tiny
 * vector gives the parallel cut PQ with BP = ZQ. The printed intermediate
 * claim that BZ halves "KBCMZL" is false off the diagonal, because M can lie
 * inside the removed corner. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Board = { A: Pt; B: Pt; C: Pt; D: Pt; Z: Pt };
type State = Board & {
  xc: number; yc: number; para: boolean;
  showHint: boolean; showNames: boolean; explored: boolean;
};
type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt; Z: Pt; U: Pt; R: Pt; M: Pt; K: Pt; L: Pt; P: Pt; Q: Pt;
  below: boolean; para: boolean;
  piece1: Pt[]; piece2: Pt[]; leftover: Pt[]; cut: Pt[]; cake: Pt[]; removed: Pt[];
  valid: boolean; cakeArea: number; half: number;
  piece1Area: number; piece2Area: number; leftoverArea: number; triangleArea: number;
  approx1: number; approx2: number; printedSplit1: number; printedSplit2: number;
};
interface Core {
  WIDTH: number; HEIGHT: number; INSET: number; PARALLEL: number;
  start(options?: Partial<Pick<State, "para" | "showHint" | "showNames">>): State;
  setOption(s: State, key: string, value: boolean): State;
  movePoint(s: State, name: string, p: Pt): State;
  compute(s: State): Geometry;
  describe(s: State): string;
  result(s: State): null;
  coefficient(b: number, d: number, z: number): number;
  sub(p: Pt, q: Pt): Pt;
  near(a: number, b: number, eps?: number): boolean;
}

const core = (): Core => cores["maimed-cake"].MaimedCakeCore as unknown as Core;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, eps = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const samePt = (a: Pt | null | undefined, b: Pt | null | undefined, eps = 1e-7): boolean =>
  !!a && !!b && Number.isFinite(a.x) && Number.isFinite(b.x) &&
  near(a.x, b.x, eps) && near(a.y, b.y, eps);

/** Accept both the page's { x, y } dots and a tutor's [x, y] dots. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${label}" must be true or false`);
  return raw;
}

function readBoard(raw: Json, C: Core): Board {
  const home = C.start({});
  return {
    A: readPoint(raw.A, "A", home.A),
    B: readPoint(raw.B, "B", home.B),
    C: readPoint(raw.C, "C", home.C),
    D: readPoint(raw.D, "D", home.D),
    Z: readPoint(raw.Z, "Z", home.Z),
  };
}

/** The core needs the coefficients of Z on BD as well as the five dots. */
function geometry(C: Core, board: Board, para: boolean): Geometry {
  return C.compute({
    ...C.start({ para }),
    ...board,
    para,
    xc: C.coefficient(board.B.x, board.D.x, board.Z.x),
    yc: C.coefficient(board.B.y, board.D.y, board.Z.y),
    explored: false,
  });
}

function reflectedZ(C: Core, board: Board): Pt {
  const xc = C.coefficient(board.B.x, board.D.x, board.Z.x);
  const yc = C.coefficient(board.B.y, board.D.y, board.Z.y);
  return {
    x: yc * board.B.x + (1 - yc) * board.D.x,
    y: xc * board.B.y + (1 - xc) * board.D.y,
  };
}

/** The saved derived dots are optional: a degenerate drag can make them NaN. */
function savedPoint(raw: unknown, label: string): Pt | null {
  if (raw === undefined || raw === null) return null;
  try { return pt(readPoint(raw, label)); } catch { return null; }
}

export function actions(): GameActions {
  return {
    equal_cut: {
      describe:
        "For rectangle ABCD with the corner UZRD missing at Z, show both straight cuts that halve the remaining cake: the triangle cut BQ and the parallel cut PQ. Reports the two coloured pieces, which far side BZ meets first, the triangle-versus-strip areas, and checks that each cut is equal-area and that PQ stays parallel to BZ.",
      args:
        '{ "A": {"x":60,"y":55}, "B": {"x":60,"y":245}, "C": {"x":340,"y":245}, "D": {"x":340,"y":55}, "Z": {"x":242,"y":172.8} }',
      run: (args) => {
        const C = core();
        const board = readBoard(args, C);
        const triangle = geometry(C, board, false);
        const parallel = geometry(C, board, true);
        const side = triangle.below ? "CD (right side)" : "AD (top side)";
        const halfOfStrip = (g: Geometry) => near(g.triangleArea, g.leftoverArea / 2, 1e-7);
        return {
          rectangle: { A: pt(board.A), B: pt(board.B), C: pt(board.C), D: pt(board.D) },
          Z: pt(board.Z),
          firstSideOfBZ: side,
          M: pt(triangle.M), K: pt(triangle.K), L: pt(triangle.L),
          cakeArea: r6(triangle.cakeArea),
          half: r6(triangle.half),
          triangleCut: {
            cut: triangle.cut.map(pt),
            pieceAreas: [r6(triangle.piece1Area), r6(triangle.piece2Area)],
            equalHalves: near(triangle.piece1Area, triangle.piece2Area, 1e-7),
            triangleBZQ: r6(triangle.triangleArea),
            leftoverStrip: r6(triangle.leftoverArea),
            triangleIsHalfOfStrip: halfOfStrip(triangle),
          },
          parallelCut: {
            cut: parallel.cut.map(pt),
            pieceAreas: [r6(parallel.piece1Area), r6(parallel.piece2Area)],
            equalHalves: near(parallel.piece1Area, parallel.piece2Area, 1e-7),
            triangleBZQ: r6(parallel.triangleArea),
            leftoverStrip: r6(parallel.leftoverArea),
            triangleToStripRatio: r6(parallel.triangleArea / parallel.leftoverArea),
            triangleIsQuarterOfStrip: near(parallel.triangleArea, parallel.leftoverArea / 4, 1e-7),
            parallelToBZ: samePt(C.sub(parallel.Q, parallel.P), C.sub(board.Z, board.B)),
            BPequalsZQ: samePt(C.sub(parallel.P, board.B), C.sub(parallel.Q, board.Z)),
          },
          note: `BZ first meets ${side}. Triangle BZQ is half the leftover strip in BQ mode and a quarter of it in PQ mode, and either correction splits the ${r6(triangle.cakeArea)} of cake into two equal pieces; ${C.describe({ ...C.start({}), ...board, para: true })}`,
        };
      },
    },
    check_claims: {
      describe:
        "Check the page's geometry claims for one or more positions of Z: whether BZ itself halves the cake, whether triangle BZQ is half the leftover strip, what happens when Z lies on diagonal BD, and whether the printed 'KBCMZL' split is really equal. The default two positions cover both branches, where BZ first meets CD and where it first meets AD.",
      args:
        '{ "positions": [{"x":242,"y":172.8}, {"x":166.4,"y":121.5}] }',
      run: (args) => {
        const C = core();
        const board = readBoard(args, C);
        const raw = args.positions;
        const positions = raw === undefined || raw === null
          ? [board.Z, reflectedZ(C, board)]
          : Array.isArray(raw) && raw.length > 0
            ? raw.map((p, i) => readPoint(p, `positions[${i}]`))
            : (() => { throw new Error('argument "positions" must be a non-empty array of points'); })();
        const cases = positions.map((Z) => {
          const g = geometry(C, { ...board, Z }, false);
          const xc = C.coefficient(board.B.x, board.D.x, Z.x);
          const yc = C.coefficient(board.B.y, board.D.y, Z.y);
          const printedEqual = near(g.printedSplit1, g.printedSplit2, 1e-7);
          return {
            Z: pt(Z),
            branch: g.below ? "BZ first meets CD (right side)" : "BZ first meets AD (top side)",
            valid: g.valid,
            M: pt(g.M),
            realSplit: {
              first: r6(g.approx1),
              second: r6(g.approx2),
              equal: g.below ? near(g.approx1, g.approx2, 1e-7) : null,
              aboveNeedsTriangle: g.below ? null : near(g.approx1 + g.leftoverArea / 2, g.cakeArea / 2, 1e-7),
            },
            printedSplit: {
              KBZL: Number.isFinite(g.printedSplit1) ? r6(g.printedSplit1) : null,
              printedSecond: Number.isFinite(g.printedSplit2) ? r6(g.printedSplit2) : null,
              equal: Number.isFinite(g.printedSplit1) && Number.isFinite(g.printedSplit2) ? printedEqual : null,
            },
            piecesEqual: near(g.piece1Area, g.piece2Area, 1e-7),
            triangleBZQ: r6(g.triangleArea),
            leftoverStrip: r6(g.leftoverArea),
            triangleIsHalfOfStrip: near(g.triangleArea, g.leftoverArea / 2, 1e-7),
            onDiagonal: near(xc, yc, 1e-7),
          };
        });
        const diagZ: Pt = {
          x: xcAt(C, board) * board.B.x + (1 - xcAt(C, board)) * board.D.x,
          y: xcAt(C, board) * board.B.y + (1 - xcAt(C, board)) * board.D.y,
        };
        const diag = geometry(C, { ...board, Z: diagZ }, false);
        return {
          cases,
          diagonalCase: {
            Z: pt(diagZ),
            cutIsExactlyBZ: samePt(diag.P, board.B) && samePt(diag.Q, diagZ),
            piecesEqual: near(diag.piece1Area, diag.piece2Area, 1e-7),
            realSplitEqual: near(diag.approx1, diag.approx2, 1e-7),
          },
          note:
            "Below the diagonal, BZ already splits the real cake part KBCRZL into equal KBZL and BCRZ, while the printed KBCMZL uses M on the line CD, which can sit inside the removed corner; above the diagonal the first approximation needs the triangle. On BD the triangle vanishes and BQ collapses to BZ.",
        };
      },
    },
  };
}

function xcAt(C: Core, board: Board): number {
  return C.coefficient(board.B.x, board.D.x, board.Z.x);
}

/**
 * What the core says about the picture Track.state saved: the saved dots and
 * options echoed back, then the geometry rebuilt from them.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Maimed Cake state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Maimed Cake position must be an object");
  }
  const C = core();
  const board = readBoard(state, C);
  const para = readBool(state.para, "para", true);
  const savedAreas = Array.isArray(state.areas)
    ? state.areas.map((v) => (Number.isFinite(Number(v)) ? r6(Number(v)) : null))
    : null;
  const savedCakeArea = Number.isFinite(Number(state.cakeArea)) ? r6(Number(state.cakeArea)) : null;

  const saved = {
    A: pt(board.A), B: pt(board.B), C: pt(board.C), D: pt(board.D), Z: pt(board.Z),
    U: savedPoint(state.U, "saved U"), R: savedPoint(state.R, "saved R"),
    M: savedPoint(state.M, "saved M"), K: savedPoint(state.K, "saved K"),
    L: savedPoint(state.L, "saved L"), P: savedPoint(state.P, "saved P"),
    Q: savedPoint(state.Q, "saved Q"),
    below: state.below === true,
    para: state.para === true,
    areas: savedAreas,
    cakeArea: savedCakeArea,
    showHint: state.showHint === true,
    showNames: state.showNames === true,
  };

  const g = geometry(C, board, para);
  const reading = {
    branch: g.below ? "BZ first meets CD (right side)" : "BZ first meets AD (top side)",
    side: g.below ? "CD" : "AD",
    valid: g.valid,
    M: pt(g.M), K: pt(g.K), L: pt(g.L), U: pt(g.U), R: pt(g.R),
    P: pt(g.P), Q: pt(g.Q), cut: g.cut.map(pt),
    cakeArea: r6(g.cakeArea),
    half: r6(g.half),
    pieceAreas: [r6(g.piece1Area), r6(g.piece2Area)],
    equalHalves: near(g.piece1Area, g.piece2Area, 1e-7),
    coversCake: near(g.piece1Area + g.piece2Area, g.cakeArea, 1e-7),
    triangleBZQ: r6(g.triangleArea),
    leftoverStrip: r6(g.leftoverArea),
    triangleToStripRatio: r6(g.triangleArea / g.leftoverArea),
    triangleHasExpectedShare: near(g.triangleArea, g.leftoverArea * (g.para ? 0.25 : 0.5), 1e-7),
    parallelToBZ: g.para ? samePt(C.sub(g.Q, g.P), C.sub(board.Z, board.B)) : null,
    printedSplit: {
      KBZL: Number.isFinite(g.printedSplit1) ? r6(g.printedSplit1) : null,
      printedSecond: Number.isFinite(g.printedSplit2) ? r6(g.printedSplit2) : null,
      equal: near(g.printedSplit1, g.printedSplit2, 1e-7),
    },
    description: g.valid ? C.describe({ ...C.start({ para }), ...board, para }) : null,
  };

  return {
    stateVersion,
    ...saved,
    saved,
    savedMatchesCore: {
      U: samePt(saved.U, g.U), R: samePt(saved.R, g.R), M: samePt(saved.M, g.M),
      K: samePt(saved.K, g.K), L: samePt(saved.L, g.L), P: samePt(saved.P, g.P),
      Q: samePt(saved.Q, g.Q),
      below: saved.below === g.below, para: saved.para === g.para,
      areas: savedAreas !== null && savedAreas.length === 2 &&
        near(savedAreas[0] ?? NaN, g.piece1Area, 1e-6) && near(savedAreas[1] ?? NaN, g.piece2Area, 1e-6),
      cakeArea: savedCakeArea !== null && near(savedCakeArea, g.cakeArea, 1e-6),
    },
    reading,
    note:
      "Track.state saved the five visible dots, the derived points and area figures, the branch and cut flags, and the two display toggles. The core rebuilds BZ, the first hit on the far side and both pieces from the corners and Z; the printed KBCMZL split is not the equal one off the diagonal, while the coloured pieces are.",
  };
}
