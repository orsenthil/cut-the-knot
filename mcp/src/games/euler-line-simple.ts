/*
 * run_game_logic actions and saved-position reader for Euler Line Simple.
 *
 * The real core is euler-line-simple/euler-line-simple-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units in the page's 360 x 240 SVG, with y down.
 *
 * For any non-degenerate triangle the orthocenter H, centroid G and
 * circumcenter O lie on one line (the Euler line) and GH = 2 GO. Nikolin's
 * proof takes the point F opposite C on the circumcircle: because CF is a
 * diameter, AFBH is a parallelogram, so its diagonals AB and FH share the
 * midpoint Mc of AB. CMc is a median both of ABC and of HFC, and O is the
 * midpoint of CF, so the 2:1 median point is the same G in both triangles;
 * hence G lies on HO with GH = 2 GO. The core's residuals measure exactly
 * these facts (and their cyclic versions for vertices A and B).
 *
 * This is NOT the sibling applet EulerCollinearity: that one starts with an
 * arbitrary point P, scales the side midpoints from P and obtains the line
 * GP, which is the Euler line only when P = O. Here the theorem itself is
 * proved from antipodes and parallelograms, with no extra point P.
 *
 * The page also notes an applet copy-paste slip: in its Hint drawing for C
 * it draws A–Ma where the proof needs C–Mc (a leftover from the A case).
 * The port follows the page and draws C–Mc; the core's median facts always
 * use the correct median. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt;
  showAltitudes: boolean; showMedians: boolean; showBisectors: boolean;
  showHint: boolean; showNames: boolean;
  selected: string | null;
  moves: number; explored: boolean;
};
type Geometry = {
  degenerate: boolean;
  A: Pt; B: Pt; C: Pt;
  Ma: Pt; Mb: Pt; Mc: Pt;
  G: Pt; Ha: Pt; Hb: Pt; Hc: Pt; H: Pt | null; O: Pt; r: number;
  D: Pt; E: Pt; F: Pt;
  antipodes: Record<string, Pt>; midpoints: Record<string, Pt>; feet: Record<string, Pt>;
};
type Residuals = {
  altitudePerp: number; HOnAltitudes: number; HOnOtherAltitudes: number;
  antipodeError: number; antipodeOnCircle: number; parallelogram: number;
  diagonalOnMedian: number; centroidTwice: number; medianRatio: number;
  collinear: number; ratioGH2GO: number; circleMean: number;
};
type Core = {
  WIDTH: number; HEIGHT: number;
  NAMES: string[]; OPTION_KEYS: string[];
  ANTIPODE: Record<string, string>; MIDPOINT: Record<string, string>;
  start(options?: Json): Json;
  compute(state: Json): Geometry;
  residuals(state: Json, g: Geometry): Residuals | null;
  move(state: Json, m: Json): Json | null;
  result(state: Json): string | null;
  dist(a: Pt, b: Pt): number;
  sub(a: Pt, b: Pt): Pt;
  cross(a: Pt, b: Pt): number;
  midpoint(a: Pt, b: Pt): Pt;
};

const core = (): Core =>
  cores["euler-line-simple"].EulerLineSimpleCore as unknown as Core;

const TOL = 1e-6;
const NAMES = ["A", "B", "C"] as const;
const OPTIONS = ["showAltitudes", "showMedians", "showBisectors", "showHint", "showNames"] as const;
const HINT_SLIP =
  "Applet slip: in its Hint drawing for C it draws A–Ma where the proof needs C–Mc; the port follows the page and draws C–Mc, and the core's median facts always use the correct median.";
const NOT_THE_SIBLING =
  "This is Euler Line Simple, not EulerCollinearity: the sibling scales the side midpoints from an arbitrary point P and gets the line GP (the Euler line only for P = O); here H, G and O are proved collinear for every triangle.";

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const small = (v: number | null | undefined): boolean =>
  typeof v === "number" && Number.isFinite(v) && v <= TOL;

/** A corner as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(args: Json, key: string, fallback: Pt): Pt {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** The page's five checkboxes, accepted nested under "options" or at top level. */
function readOptions(args: Json): Record<(typeof OPTIONS)[number], boolean> {
  const raw = args.options;
  if (raw !== undefined && raw !== null && (typeof raw !== "object" || Array.isArray(raw))) {
    throw new Error('argument "options" must be an object');
  }
  const o = (raw && typeof raw === "object" ? raw : args) as Json;
  return {
    showAltitudes: readBool(o, "showAltitudes", false),
    showMedians: readBool(o, "showMedians", false),
    showBisectors: readBool(o, "showBisectors", false),
    showHint: readBool(o, "showHint", false),
    showNames: readBool(o, "showNames", true),
  };
}

/** Read a selected vertex, or null for the opening picture. */
function readSelected(args: Json, key: string, fallback: string | null): string | null {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "string" || !NAMES.includes(v as (typeof NAMES)[number])) {
    throw new Error(`argument "${key}" must be "A", "B", "C" or null, got ${JSON.stringify(v)}`);
  }
  return v;
}

/**
 * A real core state: the corner positions are clamped by start(), exactly as
 * the page does, and omitted corners keep the applet's opening positions.
 */
function buildState(C: Core, args: Json, selectedDefault: string | null = null): State {
  const seed = C.start({}) as unknown as State;
  return C.start({
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
    ...readOptions(args),
    selected: readSelected(args, "selected", selectedDefault),
  }) as unknown as State;
}

/** A drawable figure with its residuals, or a helpful error for the model. */
function live(args: Json, selectedDefault: string | null = null) {
  const C = core();
  const s = buildState(C, args, selectedDefault);
  const g = C.compute(s);
  if (g.degenerate || !g.H || !Number.isFinite(g.O.x) || !Number.isFinite(g.O.y)) {
    throw new Error(
      "A, B and C must form a proper, non-collinear triangle on the page's " +
      `${C.WIDTH} x ${C.HEIGHT} board: the core cannot draw its circumcircle, altitudes or Euler line here.`,
    );
  }
  const e = C.residuals(s, g);
  if (!e) throw new Error("the core could not measure this triangle; move the corners apart");
  return { C, s, g, e };
}

/** Every residual, kept as a signed number so its size is visible. */
function residualView(e: Residuals) {
  return {
    altitudePerp: sig(e.altitudePerp),
    HOnAltitudes: sig(e.HOnAltitudes),
    antipodeError: sig(e.antipodeError),
    antipodeOnCircle: sig(e.antipodeOnCircle),
    parallelogram: sig(e.parallelogram),
    diagonalOnMedian: sig(e.diagonalOnMedian),
    centroidTwice: sig(e.centroidTwice),
    medianRatio: sig(e.medianRatio),
    collinear: sig(e.collinear),
    ratioGH2GO: sig(e.ratioGH2GO),
    circleMean: sig(e.circleMean),
  };
}

/** The Euler-line claim, measured rather than assumed. */
function eulerReading(C: Core, g: Geometry, e: Residuals) {
  const O = g.O, G = g.G, H = g.H!;
  const go = C.dist(G, O), gh = C.dist(G, H);
  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    circumcircle: { centre: pt(O), radius: round(g.r) },
    altitudeFeet: { Ha: pt(g.Ha), Hb: pt(g.Hb), Hc: pt(g.Hc) },
    midpoints: { Ma: pt(g.Ma), Mb: pt(g.Mb), Mc: pt(g.Mc) },
    antipodes: { D: pt(g.D), E: pt(g.E), F: pt(g.F) },
    euler: {
      O: pt(O), G: pt(G), H: pt(H),
      GO: round(go), GH: round(gh), OH: round(C.dist(O, H)),
      distanceOfGFromLineOH: sig(e.collinear),
      GHminus2GO: sig(e.ratioGH2GO),
      collinear: small(e.collinear),
      ratioGHequals2GO: small(e.ratioGH2GO),
    },
    residuals: residualView(e),
    tolerance: TOL,
  };
}

/** Nikolin's parallelogram and the shared 2:1 median, for one chosen vertex. */
function proofReading(C: Core, g: Geometry, vertex: string) {
  const corners: Record<string, Pt> = { A: g.A, B: g.B, C: g.C };
  const v = corners[vertex];
  const others = NAMES.filter((n) => n !== vertex);
  const anti = g.antipodes[vertex];
  const mid = g.midpoints[vertex];
  const H = g.H!;
  const shared = C.midpoint(H, anti);
  const centroid = {
    x: (H.x + anti.x + v.x) / 3,
    y: (H.y + anti.y + v.y) / 3,
  };
  const expectedG = {
    x: v.x + (2 / 3) * (mid.x - v.x),
    y: v.y + (2 / 3) * (mid.y - v.y),
  };
  const expectedAnti = { x: 2 * g.O.x - v.x, y: 2 * g.O.y - v.y };
  const cg = C.dist(v, g.G);
  const gm = C.dist(g.G, mid);
  return {
    vertex,
    antipodeName: C.ANTIPODE[vertex],
    midpointName: C.MIDPOINT[vertex],
    antipode: pt(anti),
    midpointOfOppositeSide: pt(mid),
    parallelogram: {
      // The page's proof order for C is A, F, B, H; the others are cyclic.
      corners: [pt(corners[others[0]]), pt(anti), pt(corners[others[1]]), pt(H)],
      diagonals: {
        [`${others[0]}${others[1]}`]: {
          from: pt(corners[others[0]]), to: pt(corners[others[1]]),
          midpoint: pt(C.midpoint(corners[others[0]], corners[others[1]])),
        },
        [`${C.ANTIPODE[vertex]}H`]: { from: pt(anti), to: pt(H), midpoint: pt(shared) },
      },
      sameMidpointError: sig(C.dist(shared, mid)),
    },
    antipodeIs2OMinusVertex: {
      expected: pt(expectedAnti),
      error: sig(C.dist(anti, expectedAnti)),
      onCircumcircleError: sig(Math.abs(C.dist(g.O, anti) - g.r)),
    },
    median: {
      segment: `${vertex}–${C.MIDPOINT[vertex]}`,
      centroidOfHAntiVertex: pt(centroid),
      twoThirdsPointOnMedian: pt(expectedG),
      CG: round(cg), GM: round(gm),
      centroidError: sig(C.dist(centroid, g.G)),
      twoThirdsError: sig(C.dist(expectedG, g.G)),
    },
    checks: {
      diagonalsShareMidpoint: small(C.dist(shared, mid)),
      centroidOfHAntiVertexIsG: small(C.dist(centroid, g.G)),
      GTwoThirdsAlongMedian: small(C.dist(expectedG, g.G)),
      medianRatioCGtoGM: gm > 0 ? round(cg / gm) : null,
    },
  };
}

export function actions(): GameActions {
  return {
    euler_line: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the page's 360 x 240 board, y down; omit any for the opening triangle), run the real core and report the circumcenter O, centroid G, orthocenter H, the altitude feet, the antipodes D,E,F and the Euler-line measurements: GH, GO and the residuals for G on line OH and GH = 2 GO. The five checkbox flags may be given as booleans, top level or under `options`, and `selected` may be A, B, C or null. A collinear or coincident triangle is refused. This is Euler Line Simple, not the sibling EulerCollinearity.",
      args: '{"A":[180.898,48.031],"B":[132.938,174.49],"C":[250.565,105.696],"showHint":true}',
      run: (args) => {
        const { C, s, g, e } = live(args);
        const view = eulerReading(C, g, e);
        return {
          ...view,
          options: {
            showAltitudes: s.showAltitudes, showMedians: s.showMedians,
            showBisectors: s.showBisectors, showHint: s.showHint, showNames: s.showNames,
          },
          selected: s.selected,
          status: C.result(s),
          note:
            "Drop the altitudes to find H, average the corners to find G and meet two perpendicular bisectors to find O. The core measures G's distance from the line OH and the gap GH − 2GO; both are tiny, so H, G and O are collinear on the Euler line with GH twice GO. The proof: take F opposite C on the circumcircle; AFBH is a parallelogram, its diagonals meet at the midpoint Mc of AB, and the medians of ABC and HFC cut CMc in the same 2:1 ratio, so the centroid G of ABC is also that point on HO. " +
            HINT_SLIP + " " + NOT_THE_SIBLING,
        };
      },
    },

    antipode_parallelogram: {
      describe:
        "For the same triangle A, B, C (each [x, y] or { x, y }; defaults as in euler_line), check Nikolin's parallelogram proof for one vertex given by `vertex` (default C, or A/B): the antipode of that vertex on the circumcircle, the parallelogram made by the other two vertices, H and the antipode, the common midpoint of its diagonals on the matching median, and the shared 2:1 centroid point G (CG : GMc = 2 : 1 and GH = 2 GO). Returns the four corners of the parallelogram, both diagonals, residual errors and a boolean per claim. The applet's Hint for C draws A–Ma rather than C–Mc; the core uses the correct median.",
      args: '{"A":[180.898,48.031],"B":[132.938,174.49],"C":[250.565,105.696],"vertex":"C"}',
      run: (args) => {
        const { C, g } = live(args, "C");
        const vertex = readSelected(args, "vertex", "C")!;
        const proof = proofReading(C, g, vertex);
        return {
          ...proof,
          euler: {
            G: pt(g.G), H: pt(g.H), O: pt(g.O),
            GH: round(C.dist(g.G, g.H!)), GO: round(C.dist(g.G, g.O)),
          },
          note:
            `With vertex ${vertex}, the antipode ${proof.antipodeName} = 2O − ${vertex} makes a parallelogram with the other two corners and H because the inscribed angles on the diameter are right angles. Its diagonals share the midpoint ${proof.midpointName} of the opposite side, so ${proof.median.segment} is a median of both ABC and H${proof.antipodeName}${vertex}; O is the midpoint of the diameter, giving the same 2:1 division point G on both medians, hence GH = 2 GO. ` +
            HINT_SLIP + " " + NOT_THE_SIBLING,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Euler Line Simple state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(C, src);
  } catch {
    savedReadable = false;
    s = C.start({}) as unknown as State;
  }
  const g = C.compute(s);
  if (g.degenerate || !g.H || !Number.isFinite(g.O.x) || !Number.isFinite(g.O.y)) {
    return {
      ...src, stateVersion, valid: false,
      note: "The saved corners are collinear, coincident or too close together, so the core cannot draw the circumcircle, altitudes or Euler line. Drag a corner apart and look again.",
    };
  }
  const e = C.residuals(s, g);
  const reading = eulerReading(C, g, e!);
  // Echo the fields the page actually saved, not the core's defaults for the
  // bookkeeping fields that start() does not accept.
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showAltitudes: typeof src.showAltitudes === "boolean" ? src.showAltitudes : s.showAltitudes,
    showMedians: typeof src.showMedians === "boolean" ? src.showMedians : s.showMedians,
    showBisectors: typeof src.showBisectors === "boolean" ? src.showBisectors : s.showBisectors,
    showHint: typeof src.showHint === "boolean" ? src.showHint : s.showHint,
    showNames: typeof src.showNames === "boolean" ? src.showNames : s.showNames,
    selected: src.selected === null || typeof src.selected === "string" ? src.selected : s.selected,
    moves: Number.isFinite(Number(src.moves)) ? Number(src.moves) : s.moves,
    explored: src.explored === true,
  };
  const chosen = s.selected && NAMES.includes(s.selected as (typeof NAMES)[number])
    ? s.selected : "C";
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    euler: reading.euler,
    residuals: reading.residuals,
    tolerance: TOL,
    theoremHolds: reading.euler.collinear && reading.euler.ratioGHequals2GO,
    proofForSelected: proofReading(C, g, chosen),
    note:
      (!savedReadable
        ? "Some saved fields could not be read, so the applet's opening triangle is shown; the core reading below comes from those opening corners. "
        : "Track.state saved the three draggable corners, the five applet switches, the selected corner and the move count; the page does not save derived points. ") +
      `The real core rebuilds O, G, H, the altitude feet, the antipodes and the parallelograms from those corners: here G is ${reading.euler.distanceOfGFromLineOH} units from line OH and GH − 2GO is ${reading.euler.GHminus2GO}, so the Euler-line claim holds to ${TOL}. ` +
      HINT_SLIP + " " + NOT_THE_SIBLING +
      " This is an illustration with no win or loss; the tracker records exploration.",
  };
}
