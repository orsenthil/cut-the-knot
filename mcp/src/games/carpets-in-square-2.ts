/*
 * run_game_logic actions and saved-position reader for Carpets In Square 2.
 *
 * The page is an illustration, not a win/lose game: two rectangles EFGH and
 * IFJH overlap inside ABCD. They share the diagonal FH, so their diagonals are
 * equal and have the same midpoint O, which is also the centre of ABCD. The
 * circle centred at O through F cuts AB at E and I; G and J are the reflections
 * of E and I in O. In the normal picture the six red corners total the blue
 * overlap HKFL; in "hint" mode four red triangles total the blue IFGH, which
 * is half of ABCD. The two carpets together cover ABCD exactly. Every number
 * below comes from the real core, copied into src/generated/cores/ at build
 * time. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carpets-in-square-2"].CarpetsInSquare2Core;

type Point = { x: number; y: number };
type State = {
  width: number; height: number; left: number; top: number;
  right: number; bottom: number; fy: number;
  showNames: boolean; hint: boolean; explored: boolean;
};

/* The core rounds nothing; tidy only the floating-point area noise. */
const tidy = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point) => ({ x: tidy(p.x), y: tidy(p.y) });
/** A point can be NaN when the circle misses AB; JSON cannot carry NaN. */
const safePt = (p: Point): Point | null =>
  Number.isFinite(p.x) && Number.isFinite(p.y) ? pt(p) : null;

function readPoint(value: unknown, key: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${key}" must be a point { "x": number, "y": number }`);
  }
  const p = value as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/** The core's opening rectangle, with any explicitly given geometry checked. */
function readState(args: Json): State {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) {
    throw new Error("width and height must be positive numbers");
  }
  const f = num(args, "f", C.F_FRACTION);
  if (f < 0 || f > 1) {
    throw new Error("f must be between 0 and 1: F's fraction of the way from B to C");
  }
  const base = C.start({
    width, height, f,
    showNames: args.showNames !== false,
    hint: args.hint !== false,
  });
  const s: State = {
    width, height,
    left: num(args, "left", base.left),
    top: num(args, "top", base.top),
    right: num(args, "right", base.right),
    bottom: num(args, "bottom", base.bottom),
    fy: num(args, "fy", base.fy),
    showNames: base.showNames,
    hint: base.hint,
    explored: args.explored === true,
  };
  const eps = 1e-9;
  if (!(s.left >= -eps && s.right <= width + eps && s.left < s.right - eps)) {
    throw new Error("left and right must enclose a rectangle inside the board (0 <= left < right <= width)");
  }
  if (!(s.top >= -eps && s.bottom <= height + eps && s.top < s.bottom - eps)) {
    throw new Error("top and bottom must enclose a rectangle inside the board (0 <= top < bottom <= height)");
  }
  if (!(s.fy >= s.top - eps && s.fy <= s.bottom + eps)) {
    throw new Error("fy (F's y coordinate) must lie on the right side BC, between top and bottom");
  }
  return s;
}

/** The whole figure and every claim on the page, phrased for a tutor. */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  const checks = C.claims(g);
  return {
    board: { width: s.width, height: s.height },
    rectangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    centre: pt(g.O),
    sidePoints: { F: pt(g.F), H: pt(g.H) },
    circlePoints: {
      E: safePt(g.E), I: safePt(g.I), G: safePt(g.G), J: safePt(g.J),
      K: safePt(g.K), L: safePt(g.L),
    },
    circle: {
      centre: pt(g.O), radius: tidy(g.radius),
      distances: g.circleDistances.map(tidy), allOnCircle: checks.commonCircle,
    },
    modes: {
      normal: {
        blueShape: "HKFL",
        redTriangles: g.redNormalAreas.map(tidy),
        redTotal: tidy(g.redNormalTotal),
        blueArea: tidy(g.blueNormalArea),
        redEqualsBlue: checks.redEqualsBlueNormal,
      },
      hint: {
        blueShape: "IFGH",
        redTriangles: g.redHintAreas.map(tidy),
        redTotal: tidy(g.redHintTotal),
        blueArea: tidy(g.blueHintArea),
        redEqualsBlue: checks.redEqualsBlueHint,
        blueIsHalfOfABCD: checks.blueIsHalfNormal,
      },
    },
    carpets: {
      EFGH: tidy(g.rectEFGHArea),
      IFJH: tidy(g.rectIFJHArea),
      sum: tidy(g.rectangleSum),
      ABCD: tidy(g.squareArea),
      addUpToABCD: checks.rectanglesAddUp,
    },
    halves: {
      IFGH: tidy(C.size(g.quadIFGH)),
      EFJH: tidy(C.size(g.quadEFJH)),
      halfOfABCD: tidy(g.squareArea / 2),
      IFGHIsHalf: checks.IFGHHalf,
      EFJHIsHalf: checks.EFJHHalf,
    },
    checks,
    status: C.describe(s),
    note: g.valid
      ? "O is the midpoint of both carpets' diagonals and of ABCD. E and I are where the circle through F meets AB, and G and J are their reflections in O. The red pieces equal the blue one in both modes; EFGH + IFJH is exactly ABCD, while IFGH and EFJH are each half of it."
      : "The circle through F no longer reaches AB, so E, I, G, J, K and L cannot be drawn. Move F back along BC or widen the rectangle.",
  };
}

export function actions(): GameActions {
  return {
    figure_and_areas: {
      describe:
        "Build the figure for a rectangle ABCD (default: the applet's centred 4/5 rectangle on a 450 by 400 board) and a point F on BC at fraction f from B to C (default 0.3), then report E, I, G, J, K, L, the circle through E, F, G, I, J, and the areas in both hint modes. Checks that the six red corners equal the blue overlap HKFL, that the four red hint triangles equal the blue IFGH (half of ABCD), that rectangles EFGH and IFJH add to ABCD, and that quadrilaterals IFGH and EFJH each halve it. Optional left, top, right, bottom and fy set the rectangle directly; fy overrides f.",
      args: '{ "width": 450, "height": 400, "f": 0.3 }',
      run: (args) => reading(readState(args)),
    },
    drag_a_or_f: {
      describe:
        "Apply one of the page's drags from the same starting rectangle and read the resulting figure. name is A (bottom-left corner, sliding along AB — past the centre the rectangle mirrors about the fixed O) or F (sliding along BC); point is {x, y} in board units. Optional width, height, left, top, right, bottom, fy and hint set the starting picture. Reports where the rectangle and F ended up, then the same points and area checks.",
      args: '{ "name": "F", "point": { "x": 402, "y": 180 } }',
      run: (args) => {
        const C = core();
        const name = String(args.name ?? "");
        if (name !== "A" && name !== "F") {
          throw new Error('name must be "A" (bottom-left corner) or "F" (point on BC)');
        }
        const point = readPoint(args.point, "point");
        const s = readState(args);
        if (point.x < 0 || point.x > s.width || point.y < 0 || point.y > s.height) {
          throw new Error(`point is outside the ${s.width} by ${s.height} board`);
        }
        const next = C.move(s, { type: "point", name, point });
        if (!next) throw new Error(`the core rejected that ${name} drag`);
        return {
          name, draggedTo: pt(point),
          before: { A: pt({ x: s.left, y: s.bottom }), B: pt({ x: s.right, y: s.bottom }), F: pt({ x: s.right, y: s.fy }) },
          after: { A: pt({ x: next.left, y: next.bottom }), B: pt({ x: next.right, y: next.bottom }), F: pt({ x: next.right, y: next.fy }) },
          reading: reading(next),
          note: name === "A"
            ? "A stays on the bottom side: past the centre the whole rectangle mirrors about O, and inside the diagonal band the core steps A left by 3 units. F and the centre O stay fixed."
            : "F slides along BC; H is its reflection in the fixed centre O, and E, I, G, J and the crossings K, L follow from the circle through F.",
        };
      },
    },
  };
}

/** The saved fields the page wrote with Track.state, plus the core's reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Carpets In Square 2 state version ${stateVersion}`);
  }
  const s = readState(state);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    width: s.width, height: s.height,
    left: s.left, top: s.top, right: s.right, bottom: s.bottom, fy: s.fy,
    showNames: s.showNames, hint: s.hint, explored: s.explored,
    reading: reading(s),
  };
}
