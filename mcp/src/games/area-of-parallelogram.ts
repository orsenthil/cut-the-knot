/*
 * run_game_logic actions and saved-position reader for Area of a Parallelogram.
 *
 * The page is an illustration: ABCD keeps AD and BC horizontal, drops the
 * perpendiculars AF and DG onto the line BC, and shows how moving the blue
 * triangle ABF to DCG turns the slanted box into the rectangle AFGD. When a
 * foot falls outside the base (the page's "Figure 2") a pink overlap has to
 * be subtracted. Every number below comes from the game's real core, copied
 * into src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["area-of-parallelogram"].AreaOfParallelogramCore;

type Point = { x: number; y: number };

/* The core rounds nothing: clean up only the signed-area residuals, which
 * are zero up to floating point noise. */
const tidy = (v: number) => Math.round(v * 1e9) / 1e9;
const nearZero = (v: number, scale: number) => Math.abs(v) <= 1e-7 * Math.max(1, scale);

function savedPoint(v: unknown): Point | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const p = v as Json;
  const x = Number(p.x), y = Number(p.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function readPoint(args: Json, key: string): Point {
  const p = savedPoint(args[key]);
  if (!p) throw new Error(`argument "${key}" must be a point { "x": number, "y": number }`);
  return p;
}

/* The four corners are in the illustration's 400 by 300 board units, with a
 * 14-unit margin. AD and BC are horizontal and equally long, or the core's
 * feet and intersections do not describe the page's figure at all. */
function readCorners(args: Json): { A: Point; B: Point; C: Point; D: Point } {
  const A = readPoint(args, "A"), B = readPoint(args, "B");
  const C = readPoint(args, "C"), D = readPoint(args, "D");
  const C0 = core();
  const eps = 1e-6;
  if (Math.abs(A.y - D.y) > eps || Math.abs(B.y - C.y) > eps) {
    throw new Error("A and D must share the top y and B and C the bottom y: the page keeps AD and BC horizontal");
  }
  if (Math.abs((D.x - A.x) - (C.x - B.x)) > eps) {
    throw new Error("the top side AD and the bottom side BC must be equally long: the corners must form a parallelogram");
  }
  if (Math.abs(D.x - A.x) < 1e-6 || Math.abs(B.y - A.y) < 1e-6) {
    throw new Error("the base and the height must both be nonzero");
  }
  for (const [name, p] of [["A", A], ["B", B], ["C", C], ["D", D]] as const) {
    if (p.x < C0.MARGIN - eps || p.x > C0.WIDTH - C0.MARGIN + eps ||
        p.y < C0.MARGIN - eps || p.y > C0.HEIGHT - C0.MARGIN + eps) {
      throw new Error(`${name} is outside the ${C0.WIDTH} by ${C0.HEIGHT} board (margin ${C0.MARGIN})`);
    }
  }
  return { A, B, C, D };
}

function readState(args: Json) {
  return {
    ...readCorners(args),
    showCut: args.showCut !== false,
    showNames: args.showNames === true,
    explored: true,
  };
}

/* The three equalities the article writes down. Each residual is the core's
 * signed-area check; zero means the written equality is exact. */
function identities(g: ReturnType<ReturnType<typeof core>["compute"]>) {
  const scale = Math.max(1, g.area);
  return {
    cutAndPaste: {
      equation: "Area(ABCD) = Area(ABF) + Area(AFCD) = Area(DCG) + Area(AFCD) = Area(AFGD)",
      residual: tidy(g.id1),
      holds: nearZero(g.id1, scale),
    },
    subtractPink: {
      equation: "Area(ABCD) = Area(AKD) + Area(ABF) - Area(CFK)",
      residual: tidy(g.id2),
      holds: nearZero(g.id2, scale),
    },
    reflectedSubtractPink: {
      equation: "Area(ABCD) = Area(BLG) - Area(DLA) - Area(DCG)",
      residual: tidy(g.id2b),
      holds: nearZero(g.id2b, scale),
    },
    trapezoidMinusBlue: {
      equation: "Area(ABCD) = Area(BGDA) - Area(DCG)",
      residual: tidy(g.id3),
      holds: nearZero(g.id3, scale),
    },
  };
}

export function actions(): GameActions {
  return {
    area_and_cut_and_paste: {
      describe:
        "For the four corners A, B, C, D of the horizontal-sided parallelogram (board units), check area = base times height, the congruent blue triangles ABF and DCG, and the rectangle AFGD made by moving one blue triangle across. Also reports the two Figure 2 corrections that subtract a pink overlap when a foot falls outside the base.",
      args: '{ "A": { "x": 110, "y": 70 }, "B": { "x": 70, "y": 230 }, "C": { "x": 230, "y": 230 }, "D": { "x": 270, "y": 70 } }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const g = C.compute(s);
        const blueEqual = Math.abs(g.cyan1 - g.cyan2) <= 1e-7 * Math.max(1, g.area);
        const ids = identities(g);
        return {
          corners: { A: s.A, B: s.B, C: s.C, D: s.D },
          base: g.base,
          height: g.height,
          baseTimesHeight: g.base * g.height,
          shoelaceArea: g.area,
          areaMatchesBaseTimesHeight: nearZero(g.area - g.base * g.height, g.area),
          feet: { F: g.F, G: g.G },
          blueTriangles: { ABF: g.cyan1, DCG: g.cyan2, congruent: blueEqual },
          rectangleAFGD: {
            width: g.rectWidth,
            height: g.height,
            area: g.rectArea,
            sameAreaAsParallelogram: nearZero(g.rectArea - g.area, g.area),
          },
          figure: g.figure,
          pinkOverlap: { CFK: g.pink1, BLG: g.pink2 },
          identities: {
            cutAndPaste: ids.cutAndPaste,
            subtractPink: ids.subtractPink,
            reflectedSubtractPink: ids.reflectedSubtractPink,
          },
          note:
            g.figure === 2
              ? "Figure 2: a foot is outside the base, so the simple cut-and-paste sum needs the pink overlap subtracted; base times height still gives the area."
              : "Figure 1: the blue triangle moves across with no overlap, so the parallelogram and the rectangle have the same area.",
          status: C.describe(s),
        };
      },
    },
    trapezoid_and_triangle_half: {
      describe:
        "For the same four corners, check the article's trapezoid version of the area (trapezoid BGDA minus the blue triangle DCG) and its corollary: either diagonal cuts the parallelogram into two triangles of area base times height divided by 2.",
      args: '{ "A": { "x": 240, "y": 70 }, "B": { "x": 70, "y": 230 }, "C": { "x": 150, "y": 230 }, "D": { "x": 320, "y": 70 } }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const g = C.compute(s);
        const trapezoid = Math.abs(C.signed([g.B, g.G, g.D, g.A]));
        const halvesEqual =
          nearZero(g.diagonal1 - g.area / 2, g.area) && nearZero(g.diagonal2 - g.area / 2, g.area);
        return {
          corners: { A: s.A, B: s.B, C: s.C, D: s.D },
          figure: g.figure,
          area: g.area,
          trapezoidBGDA: trapezoid,
          blueTriangleDCG: g.cyan2,
          trapezoidMinusBlue: trapezoid - g.cyan2,
          trapezoidCheck: identities(g).trapezoidMinusBlue,
          triangleCorollary: {
            equation: "Area of triangle ABD = Area of triangle ACD = base * height / 2",
            baseTimesHeightOverTwo: (g.base * g.height) / 2,
            triangleABD: g.diagonal1,
            triangleACD: g.diagonal2,
            holds: halvesEqual,
          },
          status: C.describe(s),
        };
      },
    },
  };
}

/** The page's saved illustration, rebuilt and read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Area Of Parallelogram state version ${stateVersion}`);
  }
  const C = core();
  const s = {
    A: readPoint(state, "A"), B: readPoint(state, "B"),
    C: readPoint(state, "C"), D: readPoint(state, "D"),
    showCut: state.showCut === true,
    showNames: state.showNames === true,
    explored: state.explored === true,
  };
  const g = C.compute(s);
  const area = num(state, "area", g.area);
  const base = num(state, "base", g.base);
  const height = num(state, "height", g.height);
  const ids = identities(g);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    A: s.A, B: s.B, C: s.C, D: s.D,
    F: savedPoint(state.F), G: savedPoint(state.G),
    K: savedPoint(state.K), L: savedPoint(state.L),
    base, height, area,
    figure: num(state, "figure", g.figure),
    showCut: s.showCut,
    reading: {
      baseTimesHeight: g.base * g.height,
      shoelaceArea: g.area,
      matchesSavedArea: nearZero(g.area - area, Math.max(g.area, area)),
      feet: { F: g.F, G: g.G },
      blueTriangles: { ABF: g.cyan1, DCG: g.cyan2, congruent: nearZero(g.cyan1 - g.cyan2, g.area) },
      pinkOverlap: { CFK: g.pink1, BLG: g.pink2 },
      rectangleAFGD: { width: g.rectWidth, height: g.height, area: g.rectArea },
      identities: ids,
      triangleHalves: { ABD: g.diagonal1, ACD: g.diagonal2, halfOfArea: g.area / 2 },
      status: C.describe(s),
    },
  };
}
