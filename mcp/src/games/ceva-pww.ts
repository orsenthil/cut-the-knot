/*
 * run_game_logic actions and saved-position reader for Ceva PWW.
 *
 * The real core is ceva-pww/ceva-pww-core.js, copied into src/generated/cores/
 * at build time. It is Bogomolny's proof without words of Ceva's theorem:
 * with E on AC, F on AB and D on BC, the cevians AD, BE, CF meet at K exactly
 * when BD:DC = (AE*FB):(EC*AF). Parallels to BE and CF through A, B, C make
 * the parallelogram A,Q,G,R; its fine grid has (AE+EC)*AF strips along AQ and
 * (AF+FB)*AE along AR, and K sits at step AE*AF along both. Hence
 *
 *     BD/DC = FB*EA / (CE*AF)  =>  (AF/FB)(BD/DC)(CE/EA) = 1.
 *
 * The page credits the grid proof to Professor William A. McWorter Jr.; the
 * drawing and code here are a fresh port. Every number below comes from the
 * real core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ceva-pww"].CevaPwwCore;

type Point = { x: number; y: number };
type Picture = {
  A: Point; B: Point; C: Point;
  ae: number; ec: number; af: number; fb: number;
  grid: boolean; fine: boolean; diagonals: boolean; colors: boolean; cycle: boolean;
};
type Cevian = { foot: Point | null; line: { p: Point; q: Point }; parallel: boolean };
type Figure = {
  A: Point; B: Point; C: Point;
  E: Point | null; F: Point | null; D: Point | null; K: Point;
  G: Point; Q: Point; R: Point;
  cevians: { ad: Cevian; be: Cevian; cf: Cevian };
  wellFormed: boolean;
};
type Ratios = {
  aeEc: number | null; afFb: number | null; bdDc: number | null;
  ceEa: number | null; product: number | null;
};
type Claims = Record<string, boolean>;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const frac = (a: number, b: number): number | null => (b === 0 ? null : maybe(a / b));
const shown = (v: number | null): string => (v === null ? "undefined" : String(v));

/** A corner as the page saves it ({x, y}) or as a short [x, y]. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" is not a finite point`);
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
  const o = raw as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** The panel's four integer counts, each limited to -10 .. 10. */
function readCounts(args: Json): Pick<Picture, "ae" | "ec" | "af" | "fb"> {
  const C = core();
  const counts = { ae: 0, ec: 0, af: 0, fb: 0 };
  for (const key of ["ae", "ec", "af", "fb"] as const) {
    const raw = args[key];
    let value: number;
    if (raw === undefined || raw === null) {
      value = C.DEFAULTS[key];
    } else {
      if (typeof raw !== "number" && !(typeof raw === "string" && raw.trim() !== "")) {
        throw new Error(`argument "${key}" must be an integer count, got ${JSON.stringify(raw)}`);
      }
      value = Number(raw);
    }
    if (!Number.isInteger(value)) {
      throw new Error(`argument "${key}" must be an integer count, got ${JSON.stringify(raw)}`);
    }
    if (value < C.MIN || value > C.MAX) {
      throw new Error(`argument "${key}" must be between ${C.MIN} and ${C.MAX}, the applet's panel limits`);
    }
    counts[key] = value;
  }
  return counts;
}

/** A core state built from optional corners and counts, with a real triangle. */
function readPicture(args: Json): Picture {
  const C = core();
  const seed = C.start() as Picture;
  const points = {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
  };
  const s = C.start({ points, ratios: readCounts(args) }) as Picture;
  if (C.doubleArea(s) <= 1e-7) {
    throw new Error("A, B, C are collinear or too close: the illustration needs a real triangle");
  }
  return s;
}

function cevianReading(name: string, vertex: Point, cev: Cevian) {
  return {
    name,
    fromVertex: pt(vertex),
    foot: pt(cev.foot),
    parallelToOppositeSide: cev.parallel,
    line: { p: pt(cev.line.p), q: pt(cev.line.q) },
  };
}

/** McWorter's grid: the parallelogram, its strip counts and the dissection. */
function gridReading(s: Picture, f: Figure, cl: Claims) {
  const alongAQ = s.ae + s.ec === 0 ? null : s.ae / (s.ae + s.ec);
  const alongAR = s.af + s.fb === 0 ? null : s.af / (s.af + s.fb);
  const KfromGrid = f.wellFormed && alongAQ !== null && alongAR !== null
    ? pt({
        x: f.A.x + alongAQ * (f.Q.x - f.A.x) + alongAR * (f.R.x - f.A.x),
        y: f.A.y + alongAQ * (f.Q.y - f.A.y) + alongAR * (f.R.y - f.A.y),
      })
    : null;
  return {
    parallelogram: { A: pt(f.A), Q: pt(f.Q), G: pt(f.G), R: pt(f.R) },
    strips: {
      onAQ: (s.ae + s.ec) * s.af,
      onAR: (s.af + s.fb) * s.ae,
      KstepOnBoth: s.ae * s.af,
      KfractionAlongAQ: maybe(alongAQ),
      KfractionAlongAR: maybe(alongAR),
    },
    KfromGrid,
    KmatchesGrid: cl.gridKCoordinates,
    dissection: {
      equation: `BD/DC = FB*EA / (CE*AF) = ${s.fb}*${s.ae} / (${s.ec}*${s.af})`,
      BDpieces: s.fb * s.ae,
      DCpieces: s.ec * s.af,
      holds: cl.dissection,
    },
    colouredPieces: { nearA: s.ae * s.af, nearB: s.fb * s.ae, nearC: s.ec * s.af },
  };
}

/** Everything the core measures for one choice of the four counts. */
function reading(s: Picture) {
  const C = core();
  const f = C.figure(s) as Figure;
  const r = C.ratios(s) as Ratios;
  const cl = C.claims(s) as Claims;
  const param = (p: Point | null, X: Point, Y: Point): number | null =>
    p ? maybe(C.paramOn(p, X, Y)) : null;
  const identity = r.product === null
    ? "undefined: a count of 0 makes one of the side ratios divide by zero"
    : `(AF/FB)(BD/DC)(CE/EA) = (${s.af}/${s.fb})((${s.ae}*${s.fb})/(${s.ec}*${s.af}))(${s.ec}/${s.ae}) = ${shown(r.product)}`;
  return {
    triangle: { A: pt(f.A), B: pt(f.B), C: pt(f.C) },
    counts: { AE: s.ae, EC: s.ec, AF: s.af, FB: s.fb },
    feet: {
      E_on_AC: { point: pt(f.E), fractionFromA: param(f.E, f.A, f.C), expected: frac(s.ae, s.ae + s.ec) },
      F_on_AB: { point: pt(f.F), fractionFromA: param(f.F, f.A, f.B), expected: frac(s.af, s.af + s.fb) },
      D_on_BC: {
        point: pt(f.D), fractionFromB: param(f.D, f.B, f.C),
        expected: frac(s.ae * s.fb, s.ae * s.fb + s.ec * s.af),
      },
    },
    cevians: [
      cevianReading("BE", f.B, f.cevians.be),
      cevianReading("CF", f.C, f.cevians.cf),
      cevianReading("AD", f.A, f.cevians.ad),
    ],
    concurrency: { K: pt(f.K), liesOnAllThree: cl.concurrent, feetOnSides: cl.feetOnSides },
    ratios: {
      AF_FB: maybe(r.afFb), BD_DC: maybe(r.bdDc), CE_EA: maybe(r.ceEa), AE_EC: maybe(r.aeEc),
      product: maybe(r.product), identity,
    },
    grid: gridReading(s, f, cl),
    claims: cl,
    allClaimsHold: Object.values(cl).every(Boolean),
  };
}

const CEVA_NOTE =
  "Two counts put E on AC and F on AB; the third foot is chosen as BD:DC = (AE*FB):(EC*AF), which is exactly what makes AD, BE and CF pass through one point K. In McWorter's grid, parallels to BE and CF build the parallelogram A,Q,G,R, cut into equal strips; BD is FB*EA strips and DC is CE*AF strips, so BD/DC = FB*EA/(CE*AF) and (AF/FB)(BD/DC)(CE/EA) = 1. Move the corners and only the shapes change, not the count.";

export function actions(): GameActions {
  return {
    cevian_figure: {
      describe:
        "For the four integer counts AE, EC, AF, FB (each -10 to 10, defaults 2, 3, 3, 2) and optional corners A, B, C as [x, y] or {x, y} (defaults to the page's opening triangle, y downward), report the three cevians BE, CF, AD with their feet on the sides, their common point K and whether it lies on all three, the measured fraction of each foot along its side, the three side ratios AF/FB, BD/DC, CE/EA with their product (AF/FB)(BD/DC)(CE/EA)=1, and every claim of the illustration. A count pair that adds to zero makes its cevian parallel to the opposite side (no foot); a zero denominator leaves that ratio undefined. Out-of-range or non-integer counts and collinear corners are rejected.",
      args: '{ "ae": 2, "ec": 3, "af": 3, "fb": 2, "A": [136, 150], "B": [266, 60], "C": [300, 171] }',
      run: (args) => ({ ...reading(readPicture(args)), note: CEVA_NOTE }),
    },
    grid_dissection: {
      describe:
        "McWorter's proof without words for the same four counts (AE, EC, AF, FB, each -10 to 10, defaults 2, 3, 3, 2; optional corners A, B, C): report the parallelogram A,Q,G,R made by the parallels to BE and CF, the fine grid's (AE+EC)*AF strips along AQ and (AF+FB)*AE along AR, the meeting point K at step AE*AF along both sides, and the dissection BD = FB*EA strips, DC = CE*AF strips. It shows that (AF/FB)(BD/DC)(CE/EA) = (AF/FB)(FB*EA/(CE*AF))(CE/EA) = 1. Positive counts give feet on the sides; counts of 0 leave a ratio undefined.",
      args: '{ "ae": 10, "ec": 1, "af": 1, "fb": 10 }',
      run: (args) => {
        const s = readPicture(args);
        const C = core();
        const f = C.figure(s) as Figure;
        const cl = C.claims(s) as Claims;
        const r = C.ratios(s) as Ratios;
        return {
          triangle: { A: pt(f.A), B: pt(f.B), C: pt(f.C) },
          counts: { AE: s.ae, EC: s.ec, AF: s.af, FB: s.fb },
          grid: gridReading(s, f, cl),
          ratios: {
            AF_FB: maybe(r.afFb), BD_DC: maybe(r.bdDc), CE_EA: maybe(r.ceEa),
            product: maybe(r.product), identity: reading(s).ratios.identity,
          },
          productIsOne: cl.cevaProduct,
          note: CEVA_NOTE,
        };
      },
    },
  };
}

/** The fields Track.state saved on the page, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Ceva PWW state version ${stateVersion}`);
  const C = core();
  const seed = C.start() as Picture;
  const s = C.start({
    points: {
      A: readPoint(state, "A", seed.A),
      B: readPoint(state, "B", seed.B),
      C: readPoint(state, "C", seed.C),
    },
    ratios: readCounts(state),
    grid: state.grid === true,
    fine: state.fine === true,
    diagonals: state.diagonals === true,
    colors: state.colors === true,
    cycle: state.cycle === true,
  }) as Picture;
  if (C.doubleArea(s) <= 1e-7) {
    throw new Error("the saved corners A, B, C do not form a triangle");
  }
  return {
    stateVersion,
    // The saved position, with the page's own field names.
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    ae: s.ae, ec: s.ec, af: s.af, fb: s.fb,
    grid: s.grid, fine: s.fine, diagonals: s.diagonals, colors: s.colors, cycle: s.cycle,
    // What the core adds: feet, concurrent K, ratios, grid and claims.
    reading: reading(s),
    stateIsIllustration: C.result() === null,
    note:
      "Track.state saves the three draggable corners, the four panel counts and the five drawing toggles. The reading recomputes the cevian feet, the common point K, the side ratios and McWorter's parallelogram strips from those same numbers: the toggles change only what is drawn, never the identity (AF/FB)(BD/DC)(CE/EA) = 1.",
  };
}
