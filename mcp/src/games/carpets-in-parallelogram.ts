/*
 * run_game_logic actions and saved-position reader for Carpets In Parallelogram.
 *
 * The page is an illustration, not a win/lose game. P sits on BC, Q on CD and
 * R on AD of parallelogram ABCD; the lines AQ, BR, AP, PR and BQ cut out four
 * red pieces, an orange triangle ABW and a blue pentagon STUVW. The applet's
 * conclusion is that the painted red area minus the blue area is always half
 * the parallelogram. With the hint on, two pink triangles RST and PUV are
 * drawn and pink + blue + pink = orange, which is the key to that conclusion.
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carpets-in-parallelogram"].CarpetsInParallelogramCore;

type Point = { x: number; y: number };
type Picture = {
  A: Point; B: Point; C: Point; D: Point;
  coefP: number; coefQ: number; coefR: number;
  showHint: boolean; showNames: boolean; explored: boolean;
};

/* The core does no rounding: tidy printed values and compare residuals with
 * a tolerance scaled to the parallelogram's area. */
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point) => ({ x: r6(p.x), y: r6(p.y) });
const n6 = (v: number) => (Number.isFinite(v) ? r6(v) : null);
const close = (a: number, b: number, scale: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(scale));
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-6;

function readPoint(v: unknown, key: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${key}" must be [x, y] or {x, y}`);
    const x = num({ x: v[0] }, "x"), y = num({ y: v[1] }, "y");
    return { x, y };
  }
  if (!v || typeof v !== "object") throw new Error(`"${key}" must be [x, y] or {x, y}`);
  const o = v as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

function savedPoint(v: unknown): Point | null {
  try {
    return readPoint(v, "point");
  } catch {
    return null;
  }
}

/** A side point is a point in board units, or a coefficient from the first
 * corner (0) to the second (1). The core's projectCoef and at place it. */
function readSide(v: unknown, key: string, from: Point, to: Point, fallback: number, Core: any): number {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) {
    const t = Number(v);
    if (!Number.isFinite(t) || t < 0 || t > 1) {
      throw new Error(`${key} as a coefficient must be a number from 0 to 1`);
    }
    return t;
  }
  const p = readPoint(v, key);
  const t = Core.projectCoef(p, from, to);
  if (Core.dist(p, Core.at(from, to, t)) > 1e-3) {
    throw new Error(`${key} must lie on the side from (${r6(from.x)}, ${r6(from.y)}) to (${r6(to.x)}, ${r6(to.y)})`);
  }
  return t;
}

function readPicture(args: Json, hintDefault = false): Picture {
  const Core = core();
  const start = Core.start();
  const A = args.A === undefined ? start.A : readPoint(args.A, "A");
  const B = args.B === undefined ? start.B : readPoint(args.B, "B");
  const Cc = args.C === undefined ? start.C : readPoint(args.C, "C");
  const D = args.D === undefined ? start.D : readPoint(args.D, "D");

  if (!eq(Cc.x - D.x, B.x - A.x) || !eq(Cc.y - D.y, B.y - A.y)) {
    throw new Error("A, B, C, D must be a parallelogram: C - D must equal B - A");
  }
  if (Math.abs(Core.cross(A, B, D)) <= 1) {
    throw new Error("the parallelogram has collapsed: its two sides must not be parallel");
  }
  for (const [name, p] of [["A", A], ["B", B], ["C", Cc], ["D", D]] as const) {
    if (p.x < Core.MARGIN - 1e-6 || p.x > Core.WIDTH - Core.MARGIN + 1e-6 ||
        p.y < Core.MARGIN - 1e-6 || p.y > Core.HEIGHT - Core.MARGIN + 1e-6) {
      throw new Error(`${name} is outside the ${Core.WIDTH} by ${Core.HEIGHT} board (margin ${Core.MARGIN})`);
    }
  }

  return {
    A, B, C: Cc, D,
    coefP: readSide(args.P, "P", B, Cc, start.coefP, Core),
    coefQ: readSide(args.Q, "Q", Cc, D, start.coefQ, Core),
    coefR: readSide(args.R, "R", A, D, start.coefR, Core),
    showHint: args.showHint === undefined ? hintDefault : args.showHint === true,
    showNames: args.showNames === true,
    explored: true,
  };
}

/** The core's picture, phrased for a tutor. */
function reading(s: Picture) {
  const Core = core();
  const g = Core.compute(s);
  const scale = Math.max(1, g.para);
  const halfHolds = g.finite && close(g.difference, g.half, scale);
  const hintHolds = g.finite && close(g.carpet, 0, scale);
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    sidePoints: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R) },
    coefficients: { P: r6(s.coefP), Q: r6(s.coefQ), R: r6(s.coefR) },
    intersections: {
      S: g.finite ? pt(g.S) : null, T: g.finite ? pt(g.T) : null,
      U: g.finite ? pt(g.U) : null, V: g.finite ? pt(g.V) : null,
      W: g.finite ? pt(g.W) : null,
    },
    noDraw: g.noDraw,
    redPieces: {
      ASR: n6(g.redA), RTQD: n6(g.redD), CPUQ: n6(g.redC),
      BPV: n6(g.redB), ABW: n6(g.orange),
    },
    red: n6(g.red), blue: n6(g.blue),
    parallelogramArea: n6(g.para),
    areaCheck: {
      equation: "red - blue = Area(ABCD) / 2",
      redMinusBlue: n6(g.difference),
      halfOfParallelogram: n6(g.half),
      residual: n6(g.leftover),
      holds: halfHolds,
    },
    hintCheck: {
      equation: "Area(RST) + blue + Area(PUV) = Area(ABW)",
      left: n6(g.pinkR + g.blue + g.pinkP),
      right: n6(g.orange),
      residual: n6(g.carpet),
      holds: hintHolds,
    },
    note: g.noDraw
      ? "Two of the lines are nearly parallel here, so the applet hides the carpet; the parallelogram is still shown."
      : "Move P, Q or R and the four red pieces and the blue pentagon all change, but red minus blue stays half the parallelogram. Turn on the hint to see the two pink triangles that explain why.",
    status: Core.describe(s),
  };
}

export function actions(): GameActions {
  return {
    carpet_areas: {
      describe:
        "For a parallelogram ABCD and the three points P on BC, Q on CD and R on AD, report the four red pieces, the orange triangle ABW, the blue pentagon, the parallelogram's area and the check that painted red minus blue is exactly half the parallelogram. Give A, B, C, D as [x, y] or {x, y} in the page's 400 by 300 board (defaults to the opening picture); give P, Q, R as points on their sides or as coefficients from 0 to 1 along those sides (defaults to the opening coefficients). Points off their side, a collapsed or non-parallelogram ABCD and points outside the board are rejected.",
      args: '{ "A": { "x": 84, "y": 240 }, "B": { "x": 240, "y": 240 }, "C": { "x": 320, "y": 60 }, "D": { "x": 164, "y": 60 }, "P": { "x": 296, "y": 114 }, "Q": { "x": 242, "y": 60 }, "R": { "x": 132, "y": 132 } }',
      run: (args) => {
        const s = readPicture(args);
        return reading(s);
      },
    },
    hint_identity: {
      describe:
        "Turn on the page's hint for the same picture and check the two equalities in its proof: pink triangles RST + blue + pink PUV = orange triangle ABW, and the two big triangles ADQ and BCQ together make half the box, so (bigRed - pinkR - pinkP + orange) - blue = half the parallelogram. Here bigRed is Area(ADQ) + Area(BCQ), not the painted red reported by carpet_areas. Takes the same A, B, C, D and P, Q, R as carpet_areas, with the same side/coefficient forms and validation; showHint defaults to true.",
      args: '{ "A": { "x": 84, "y": 240 }, "B": { "x": 240, "y": 240 }, "C": { "x": 320, "y": 60 }, "D": { "x": 164, "y": 60 }, "P": 0.7, "Q": 0.5, "R": 0.6, "showHint": true }',
      run: (args) => {
        const Core = core();
        const s = readPicture(args, true);
        const g = Core.compute(s);
        const scale = Math.max(1, g.para);
        const substituted = g.bigRed - g.pinkR - g.pinkP + g.orange - g.blue;
        return {
          showHint: s.showHint,
          intersections: {
            S: g.finite ? pt(g.S) : null, T: g.finite ? pt(g.T) : null,
            U: g.finite ? pt(g.U) : null, V: g.finite ? pt(g.V) : null,
            W: g.finite ? pt(g.W) : null,
          },
          pinkTriangles: { RST: n6(g.pinkR), PUV: n6(g.pinkP) },
          bluePentagon: n6(g.blue), orangeABW: n6(g.orange),
          carpetIdentity: {
            equation: "Area(RST) + blue + Area(PUV) = Area(ABW)",
            left: n6(g.pinkR + g.blue + g.pinkP),
            right: n6(g.orange),
            residual: n6(g.carpet),
            holds: g.finite && close(g.carpet, 0, scale),
          },
          halfIdentity: {
            equation: "(Area(ADQ) + Area(BCQ) - Area(RST) - Area(PUV) + Area(ABW)) - blue = Area(ABCD) / 2",
            bigRed: n6(g.bigRed),
            left: n6(substituted),
            right: n6(g.half),
            residual: n6(substituted - g.half),
            holds: g.finite && close(substituted, g.half, scale),
            coreResidual: n6(g.leftover),
          },
          note: "The two big triangles ADQ and BCQ together cover half the box. The hint shows that the orange triangle equals the blue pentagon plus the two pink triangles, so removing the pink pieces from the big triangles and adding the orange one leaves painted red; take away the blue pentagon and half the box is left, wherever the three points are dragged.",
          status: Core.describe(s),
        };
      },
    },
  };
}

/** The page's saved illustration, rebuilt and read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Carpets In Parallelogram state version ${stateVersion}`);
  }
  const Core = core();
  const start = Core.start();
  const A = readPoint(state.A === undefined ? start.A : state.A, "A");
  const B = readPoint(state.B === undefined ? start.B : state.B, "B");
  const Cc = readPoint(state.C === undefined ? start.C : state.C, "C");
  const D = readPoint(state.D === undefined ? start.D : state.D, "D");

  /* The saved coefficients go with the saved points; derive them from the
   * points when an older record did not write them out. */
  const savedP = savedPoint(state.P), savedQ = savedPoint(state.Q), savedR = savedPoint(state.R);
  const readCoef = (v: unknown, key: string, fallback: number) => {
    const t = num({ [key]: v }, key, fallback);
    if (t < -1e-9 || t > 1 + 1e-9) throw new Error(`saved ${key} must be between 0 and 1`);
    return Math.max(0, Math.min(1, t));
  };
  const s: Picture = {
    A, B, C: Cc, D,
    coefP: readCoef(state.coefP, "coefP", savedP ? Core.projectCoef(savedP, B, Cc) : start.coefP),
    coefQ: readCoef(state.coefQ, "coefQ", savedQ ? Core.projectCoef(savedQ, Cc, D) : start.coefQ),
    coefR: readCoef(state.coefR, "coefR", savedR ? Core.projectCoef(savedR, A, D) : start.coefR),
    showHint: state.showHint === true,
    showNames: false,
    explored: true,
  };
  const g = Core.compute(s);
  const scale = Math.max(1, g.para, Math.abs(num(state, "red", g.red)));
  const r = reading(s);
  const samePoint = (p: Point | null, q: Point | null) =>
    p === null || q === null ? p === q : Core.dist(p, q) <= 1e-3;
  const computed = {
    S: g.finite ? pt(g.S) : null, T: g.finite ? pt(g.T) : null,
    U: g.finite ? pt(g.U) : null, V: g.finite ? pt(g.V) : null,
    W: g.finite ? pt(g.W) : null,
  };
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    P: savedP ? pt(savedP) : null, Q: savedQ ? pt(savedQ) : null, R: savedR ? pt(savedR) : null,
    S: savedPoint(state.S), T: savedPoint(state.T), U: savedPoint(state.U),
    V: savedPoint(state.V), W: savedPoint(state.W),
    coefP: s.coefP, coefQ: s.coefQ, coefR: s.coefR,
    red: num(state, "red", g.red), blue: num(state, "blue", g.blue),
    difference: num(state, "difference", g.difference), half: num(state, "half", g.half),
    showHint: s.showHint, noDraw: state.noDraw === true,
    reading: {
      ...r,
      matchesSaved: {
        red: close(num(state, "red", g.red), g.red, scale),
        blue: close(num(state, "blue", g.blue), g.blue, scale),
        difference: close(num(state, "difference", g.difference), g.difference, scale),
        half: close(num(state, "half", g.half), g.half, scale),
        noDraw: state.noDraw === undefined || state.noDraw === g.noDraw,
        intersections: {
          S: samePoint(savedPoint(state.S), computed.S),
          T: samePoint(savedPoint(state.T), computed.T),
          U: samePoint(savedPoint(state.U), computed.U),
          V: samePoint(savedPoint(state.V), computed.V),
          W: samePoint(savedPoint(state.W), computed.W),
        },
      },
    },
  };
}
