/*
 * run_game_logic actions and saved-position reader for Crowded Chair.
 *
 * A triangle ABC carries three outward squares: ABDE, ACGF and BCKH. The
 * applet's two crossings are U = CE ∩ BF and V = CD ∩ AK; both lie on the
 * circle through A, B, D and E (the circle on the diameter(s) of square ABDE).
 * Because C, E, U and C, D, V are two secants of that circle from the same
 * point C, CE·CU = CD·CV. The page's prose swaps the two crossing labels, so
 * that swapped identity is reported separately and does not hold.
 *
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["crowded-chair"].CrowdedChairCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };

const r3 = (v: number) => Math.round(v * 1e3) / 1e3;
const pt = (p: Point): Point => ({ x: r3(p.x), y: r3(p.y) });
/** Residuals are tiny; keep their size instead of rounding them to zero. */
const sig = (v: number) => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const deg = (radians: number) => r3(radians * 180 / Math.PI);
const TOL = 1e-6;

/** A corner may arrive as the page saves it ({x,y}) or as a short [x,y] pair. */
function parsePoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" must have finite numeric x and y`);
  }
  return { x, y };
}

function pointArg(args: Json, key: string, fallback: Point): Point {
  return args[key] === undefined || args[key] === null ? fallback : parsePoint(args[key], key);
}

function savedPoint(v: unknown): Point | null {
  try { return pt(parsePoint(v, "point")); } catch { return null; }
}

/**
 * The real core's opening state with validated corners. Give A and B and C is
 * rebuilt from angleA just as ComputeC does in the applet; an explicit C wins.
 */
function readState(Core: Core, args: Json) {
  const seed = Core.start({});
  const A = pointArg(args, "A", seed.A);
  const B = pointArg(args, "B", seed.B);
  const angleA = num(args, "angleA", Core.START_ANGLE);
  const Cc = args.C === undefined || args.C === null
    ? Core.computeC(A, B, angleA)
    : pointArg(args, "C", seed.C);
  if (!Core.finite(Cc)) {
    throw new Error("angleA does not give a usable C from those corners");
  }
  if (Core.dist(A, B) < 1e-9 || Core.dist(B, Cc) < 1e-9 || Core.dist(Cc, A) < 1e-9) {
    throw new Error("A, B and C must be three different points");
  }
  if (Math.abs(Core.cross(Core.sub(B, A), Core.sub(Cc, A))) < 1e-9) {
    throw new Error("A, B and C must not lie on one line");
  }
  return { ...seed, A, B, C: Cc, angleA };
}

function geometry(args: Json) {
  const Core = core();
  const s = readState(Core, args);
  const g = Core.compute(s) as any;
  if (!g || g.degenerate) {
    throw new Error("A, B and C must be three distinct, non-collinear points on the 440 x 360 board");
  }
  return { Core, s, g };
}

const circleInfo = (c: any) => (c ? { center: pt(c.center), radius: r3(c.radius) } : null);

/** The core's own relative residuals for every claim on the page. */
function claims(Core: Core, s: any, g: any) {
  const q = Core.residuals(s, g);
  if (!q) return null;
  const gap = (p: Point) => Math.abs(Core.dist(g.circle.center, p) - g.circle.radius) / g.circle.radius;
  const appletClaims = [q.perpAKCD, q.perpCEBF, q.rightAtU, q.rightAtV, q.onCircle, q.squareCentre];
  return {
    AK_perp_CD: sig(q.perpAKCD),
    CE_perp_BF: sig(q.perpCEBF),
    rightAngleAtU_AD_vs_BE: sig(q.rightAtU),
    rightAngleAtV_AD_vs_BE: sig(q.rightAtV),
    sixPointsOnCircle: sig(q.onCircle),
    circleIsTheSquareABDE: sig(q.squareCentre),
    UDistanceFromCircle: sig(gap(g.U)),
    VDistanceFromCircle: sig(gap(g.V)),
    allHold: appletClaims.every((v: number) => v < TOL),
  };
}

/** The construction and the circle membership of the two crossings. */
function reading(Core: Core, s: any, g: any) {
  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    angleA: { radians: sig(s.angleA), degrees: deg(s.angleA) },
    squares: {
      ABDE: { A: pt(g.A), B: pt(g.B), D: pt(g.D), E: pt(g.E) },
      ACGF: { A: pt(g.A), C: pt(g.C), G: pt(g.G), F: pt(g.F) },
      BCKH: { B: pt(g.B), C: pt(g.C), K: pt(g.K), H: pt(g.H) },
    },
    crossings: {
      U: { point: pt(g.U), lines: "CE and BF", onCircle: Math.abs(Core.dist(g.circle.center, g.U) - g.circle.radius) < TOL * g.circle.radius },
      V: { point: pt(g.V), lines: "CD and AK", onCircle: Math.abs(Core.dist(g.circle.center, g.V) - g.circle.radius) < TOL * g.circle.radius },
    },
    circle: { ...circleInfo(g.circle), through: "E, D and U — the circle through A, B, D and E, which also passes through V" },
    claims: claims(Core, s, g),
  };
}

/** The secant products, with the applet's labels and the page's swapped ones. */
function secants(Core: Core, s: any, g: any) {
  const q = Core.residuals(s, g);
  if (!q) throw new Error("the core could not measure a non-degenerate chair");
  const CE = Core.dist(g.C, g.E), CU = Core.dist(g.C, g.U);
  const CD = Core.dist(g.C, g.D), CV = Core.dist(g.C, g.V);
  return {
    lengths: { CE: r3(CE), CU: r3(CU), CD: r3(CD), CV: r3(CV) },
    appletLabels: {
      note: "U lies on CE and V on CD, as the applet labels them.",
      CE_times_CU: r3(CE * CU),
      CD_times_CV: r3(CD * CV),
      equal: q.secants < TOL,
      residual: sig(q.secants),
    },
    pageLabels: {
      note: "The page's sentence swaps the crossings; with that labelling the products are not equal.",
      CE_times_CV: r3(CE * CV),
      CD_times_CU: r3(CD * CU),
      equal: q.secantsPageLabels < TOL,
      residual: sig(q.secantsPageLabels),
    },
    why: "AD and BE are diameters of the circle through A, B, D and E, so the angles at V and U are right angles, putting both crossings on that circle. C then has the same power along the two secants C-E-U and C-D-V.",
  };
}

export function actions(): GameActions {
  return {
    chair: {
      describe:
        "For a triangle ABC (give A and B as [x, y] or {x, y}; C is rebuilt from angleA in radians, default 30°, unless you give C explicitly), erect the three outward squares and report the circle through E, D and U together with the crossings U = CE∩BF and V = CD∩AK. It checks AK⊥CD, CE⊥BF, the right angles at U and V, and that A, B, D, E, U, V all lie on that circle, using the core's relative residuals.",
      args: '{ "A": [88, 187], "B": [198, 187] }',
      run: (args) => {
        const { Core, s, g } = geometry(args);
        return {
          ...reading(Core, s, g),
          note: "U = CE∩BF and V = CD∩AK both sit on the circle through E and D (the circle on square ABDE), while AK⊥CD and CE⊥BF. Residuals near zero mean each claim holds.",
        };
      },
    },
    secants: {
      describe:
        "For the same chair, report CE, CU, CD and CV and test the secant identity CE·CU = CD·CV using the applet's labels (U on CE, V on CD). The page's sentence swaps the two crossings; those swapped products are reported too and do not match.",
      args: '{ "A": [198, 187], "B": [91, 187], "C": [251.5, 279.66] }',
      run: (args) => {
        const { Core, s, g } = geometry(args);
        return {
          triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
          crossings: { U: pt(g.U), V: pt(g.V) },
          ...secants(Core, s, g),
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const Core = core();
  const seed = Core.start({});
  const rawAngle = Number(state.angleA);
  const saved = {
    stateVersion,
    A: savedPoint(state.A), B: savedPoint(state.B), C: savedPoint(state.C),
    angleA: Number.isFinite(rawAngle) ? rawAngle : null,
    showNames: state.showNames === true,
    showStatement: state.showStatement === true,
    showHint: state.showHint === true,
    moves: Math.round(num(state, "moves", 0)),
    explored: state.explored === true,
  };
  let s: any, g: any;
  try {
    s = readState(Core, state);
    g = Core.compute(s) as any;
  } catch {
    g = null;
  }
  if (!g || g.degenerate) {
    return {
      ...saved,
      degenerate: true,
      result: Core.result({ ...seed, explored: saved.explored }) === "done" ? "done" : null,
      note: "The saved corners are too close together, collinear, or incomplete, so there is no chair to measure. Move a corner apart on the page.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    ...reading(Core, s, g),
    secants: secants(Core, s, g),
    result: Core.result({ ...s, moves: saved.moves, explored: saved.explored }),
    note: "The saved chair is rebuilt with the same squares, crossings and circle the page draws; the residuals check the claims and the secant products are measured from the circle.",
  };
}
