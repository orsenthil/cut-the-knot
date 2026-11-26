/*
 * run_game_logic actions and saved-position reader for Archimedes' Angle
 * Trisection. The real core is archi/archi-core.js, copied into
 * src/generated/cores/ at build time. It reproduces the applet's geometry:
 * B on a circle of radius R = 70 about O = (200, 262), C a slider on the
 * horizontal line left of O, and D one radius from C on the ray towards B.
 * When D is on the circle too, angle DCO is one third of angle AOB — but only
 * for the non-degenerate placement C = O - 2R cos(theta / 3). See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["archi"].ArchiCore;

type Point = { x: number; y: number };

const r2 = (v: number): number => Math.round(v * 100) / 100;
const pt = (p: Point | null | undefined): Point | null =>
  p ? { x: r2(p.x), y: r2(p.y) } : null;

const CAVEAT =
  "The applet rounds points to whole pixels and calls D 'on the circle' when |OD - R| < 0.6 px. " +
  "D can also land there by collapsing onto B (CB = R, which needs an angle past 90 degrees): " +
  "that branch passes the same tolerance but angle DCO is then not a third. " +
  "Only the placement with C at distance 2R cos(theta/3) left of O gives a genuine trisection; " +
  "the page draws the green third arc and reports success only for that branch.";

/** Accept both [x, y] and {x, y}, as the page's own saved points are objects. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: num({ x: v[0] }, "x"), y: num({ y: v[1] }, "y") };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** Where the slider must be for a genuine trisection, checked with the core. */
function solvedReading(angleDeg: number) {
  const C = core();
  if (!Number.isFinite(angleDeg) || angleDeg <= 0 || angleDeg >= 180) {
    throw new Error("angleDeg must be a number strictly between 0 and 180");
  }
  const theta = angleDeg * Math.PI / 180;
  const solved = C.solveFor(theta);
  if (!solved) throw new Error(`the core cannot solve angleDeg = ${angleDeg}`);
  const g = C.construct({ B: solved.B, C: solved.C });
  return {
    angleDeg,
    thirdDeg: r2(C.deg(solved.third)),
    radius: g.R,
    OC: r2(2 * g.R * Math.cos(theta / 3)),
    C: pt(solved.C),
    B: pt(solved.B),
    D: pt(g.D),
    angleShownDeg: g.angleDeg,
    angleAtCDeg: r2(C.deg(g.angleAtC)),
    onCircle: g.onCircle,
    trisects: g.trisects,
    collapsed: g.collapsed,
    distanceOD: g.D ? r2(C.dist(g.O, g.D)) : null,
    distanceDB: g.D ? r2(C.dist(g.D, g.B)) : null,
    status: C.describe(g),
    note: CAVEAT,
  };
}

/** Read any drawn position through the core, including the collapsed branch. */
function figureReading(B: Point, Cc: Point) {
  const C = core();
  if (!(Cc.x < C.O.x)) {
    throw new Error(`C.x must be left of O (x = ${C.O.x}), got ${Cc.x}`);
  }
  const g = C.construct(C.start({ B, C: Cc }));
  return {
    B: pt(g.B),
    C: pt(g.C),
    D: pt(g.D),
    A: pt(g.A),
    O: pt(g.O),
    R: g.R,
    angleShownDeg: g.angleDeg,
    angleExactDeg: r2(C.deg(g.angle)),
    angleAtCDeg: r2(C.deg(g.angleAtC)),
    thirdNeededDeg: r2(C.deg(g.angle / 3)),
    onCircle: g.onCircle,
    trisects: g.trisects,
    collapsed: g.collapsed,
    distanceFromCircle: g.D ? r2(C.dist(g.O, g.D) - g.R) : null,
    distanceDB: g.D ? r2(C.dist(g.D, g.B)) : null,
    CxForTrisection: r2(g.O.x - 2 * g.R * Math.cos(g.angle / 3)),
    status: C.describe(g),
    note: CAVEAT,
  };
}

export function actions(): GameActions {
  return {
    slider_for_angle: {
      describe:
        "Given angle AOB in degrees (strictly between 0 and 180), report the exact slider position for Archimedes' trisection: OC = 2R cos(theta/3) with R = 70 and O = (200, 262), so C = (200 - OC, 262). The real core then constructs D and reports angle DCO, whether D lands on the circle, whether it genuinely trisects, and whether the collapsed D = B branch was reached.",
      args: '{ "angleDeg": 120 }',
      run: (args) => solvedReading(num(args, "angleDeg")),
    },
    read_figure: {
      describe:
        "For a position already drawn on the board (400 x 350 pixels, y downward), give B on the circle and C on the line left of O, as {x, y} or [x, y]. Report the whole-degree angle the page displays, D, angle DCO, the third that angle needs, whether D is on the circle, whether it really trisects, whether it has collapsed onto B, and the x for C that would give a true trisection. The collapsed branch passes the applet's tolerance but does not trisect.",
      args: '{ "B": [165, 201.3782217350893], "C": [130, 262] }',
      run: (args) => figureReading(readPoint(args, "B"), readPoint(args, "C")),
    },
  };
}

/** The page's saved fields, plus a fresh reading of the same drawn figure. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  let B: Point | undefined;
  let Cc: Point | undefined;
  try { B = readPoint(state, "B"); } catch { /* no saved B */ }
  try { Cc = readPoint(state, "C"); } catch { /* no saved C */ }
  if (Cc && !(Cc.x < C.O.x)) Cc = undefined; // an impossible slider position
  const g = C.construct(C.start({ B, C: Cc }));

  return {
    stateVersion,
    B: state.B ?? pt(g.B),
    C: state.C ?? pt(g.C),
    D: state.D ?? pt(g.D),
    angleDeg: state.angleDeg ?? g.angleDeg,
    thirdDeg: state.thirdDeg ?? r2(C.deg(g.angleAtC)),
    onCircle: state.onCircle ?? g.onCircle,
    trisects: state.trisects ?? g.trisects,
    reading: {
      B: pt(g.B),
      C: pt(g.C),
      D: pt(g.D),
      A: pt(g.A),
      O: pt(g.O),
      R: g.R,
      angleShownDeg: g.angleDeg,
      angleExactDeg: r2(C.deg(g.angle)),
      angleAtCDeg: r2(C.deg(g.angleAtC)),
      thirdNeededDeg: r2(C.deg(g.angle / 3)),
      OC: r2(C.dist(g.O, g.C)),
      CxForTrisection: r2(g.O.x - 2 * g.R * Math.cos(g.angle / 3)),
      onCircle: g.onCircle,
      trisects: g.trisects,
      collapsed: g.collapsed,
      distanceFromCircle: g.D ? r2(C.dist(g.O, g.D) - g.R) : null,
      distanceDB: g.D ? r2(C.dist(g.D, g.B)) : null,
      matchesSaved: {
        angleDeg: state.angleDeg === g.angleDeg,
        onCircle: state.onCircle === g.onCircle,
        trisects: state.trisects === g.trisects,
      },
      status: C.describe(g),
      note:
        "The page saves C, D and a whole-degree angle; the core rebuilds the figure from B and C. " +
        CAVEAT,
    },
  };
}
