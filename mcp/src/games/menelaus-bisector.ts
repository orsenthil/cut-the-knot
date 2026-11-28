/*
 * run_game_logic actions and saved-position reader for Menelaus Bisector.
 *
 * The real core is menelaus-bisector/menelaus-bisector-core.js, copied verbatim
 * into src/generated/cores/ at build time; every number below is measured from
 * it. At a corner of a triangle, the internal angle bisector cuts the opposite
 * side in the ratio of the two adjacent sides and the external one in its
 * negative: at A the signed ratio is +c/b (internal) or -c/b (external), at B
 * it is +-a/c and at C it is +-b/a, where a = |BC|, b = |CA|, c = |AB|. Their
 * product is (-1)^k for k external picks, so it is +1 (the three lines are
 * concurrent, Ceva) when k is even and -1 (the three feet are collinear,
 * Menelaus) when k is odd. Two quirks of the applet are kept honest here: in
 * an isosceles triangle an external bisector can be parallel to the opposite
 * side, and GeoSDoub.Intersect then returns NaN, dropping that foot and its
 * verdict; and the 2-in/1-out checkbox paints a red triangle through all three
 * *internal* feet, which is not the collinear triple. Coordinates are the
 * page's SVG units, y downward. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Corners = { A: Pt; B: Pt; C: Pt };
type Modes = Record<string, boolean>;
type State = { corners: Corners; modes: Modes };

type Construction = {
  corners: Corners; I: Pt; Ia: Pt; Ib: Pt; Ic: Pt;
  sides: Pt[][]; internal: Pt[][]; external: Pt[][]; intFeet: Pt[]; extFeet: Pt[];
};
type Visible = {
  internalLines: boolean; externalLines: boolean; externalLine: boolean;
  internalTriangle: boolean; centers: Pt[]; feet: Pt[];
};
type Chosen = {
  lines: Pt[][]; feet: Pt[]; point: Pt;
  concurrent: boolean; collinear: boolean; product: number;
};
type Claim = {
  externalAt: number[]; internalCount: number; externalCount: number;
  product: number; concurrent: boolean; collinear: boolean;
  productSaysConcurrent: boolean; productSaysCollinear: boolean;
};

interface Core {
  MODES: string[]; NAMES: string[]; WIDTH: number; HEIGHT: number; INTERSECT_EPS: number;
  dist(p: Pt, q: Pt): number;
  finite(p: Pt): boolean;
  start(options?: { width?: number; height?: number; corners?: Corners; modes?: Modes }): State;
  moveCorner(s: State, name: string, p: Pt): State;
  setModes(s: State, values: Modes): State;
  toggleMode(s: State, mode: string, on?: boolean): State;
  compute(s: State): Construction;
  visible(s: State, c: Construction): Visible;
  subsets(k: number): number[][];
  choices(mode: string): number[][];
  product(s: State, externalAt?: number[]): number;
  chosen(s: State, c: Construction, externalAt: number[]): Chosen;
  checkClaims(s: State): Claim[];
  describe(s: State): string;
  result(): null;
}

const core = (): Core =>
  cores["menelaus-bisector"].MenelausBisectorCore as unknown as Core;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;

/** Accept a page's { x, y } dots and a tutor's [x, y] dots, both validated. */
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

/** Read A/B/C from a JSON object; omitted corners keep the opening picture. */
function readCorners(raw: unknown, C: Core): Corners {
  const home = C.start().corners;
  const j = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Json : {};
  const out = {} as Corners;
  for (const name of C.NAMES) {
    const key = name as keyof Corners;
    out[key] = readPoint(j[name], `corner ${name}`, home[key]);
  }
  return out;
}

/** The four checkboxes: each named key must be a boolean; omitted ones are off. */
function readModes(raw: unknown, C: Core): Modes {
  const modes: Modes = {};
  for (const m of C.MODES) modes[m] = false;
  if (raw === undefined || raw === null) return modes;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('argument "modes" must be an object of checkbox booleans');
  }
  const j = raw as Json;
  for (const m of C.MODES) {
    if (j[m] !== undefined && j[m] !== null) {
      if (typeof j[m] !== "boolean") throw new Error(`argument "modes.${m}" must be true or false`);
      modes[m] = j[m] as boolean;
    }
  }
  return modes;
}

function buildState(C: Core, args: Json): State {
  return {
    corners: readCorners(args, C),
    modes: readModes(args.modes, C),
  };
}

/** Which corners get the external bisector, e.g. [0, 2] means A and C. */
function readExternalAt(raw: unknown): number[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('argument "externalAt" must be an array of corner indices 0, 1, 2');
  const out: number[] = [];
  for (const v of raw) {
    const i = Number(v);
    if (!Number.isInteger(i) || i < 0 || i > 2) {
      throw new Error('argument "externalAt" entries must be one of 0 (A), 1 (B), 2 (C)');
    }
    if (out.includes(i)) throw new Error(`argument "externalAt" repeats corner ${i}`);
    out.push(i);
  }
  return out.sort((a, b) => a - b);
}

/** Everything the core can say about one triangle, shared by both actions and position(). */
function reading(C: Core, pos: State, externalAt?: number[]) {
  const c = C.compute(pos);
  const { A, B, C: Cc } = pos.corners;
  const a = C.dist(B, Cc), b = C.dist(A, Cc), cc = C.dist(A, B);
  const unsigned = { atA_c_over_b: cc / b, atB_a_over_c: a / cc, atC_b_over_a: b / a };
  const claims = C.checkClaims(pos);

  const parity = {
    evenExternalGivesPlusOne: claims.filter((k) => k.externalCount % 2 === 0).every((k) =>
      k.productSaysConcurrent && Math.abs(k.product - 1) < 1e-9),
    oddExternalGivesMinusOne: claims.filter((k) => k.externalCount % 2 === 1).every((k) =>
      k.productSaysCollinear && Math.abs(k.product + 1) < 1e-9),
    verdictsMatchDrawing: claims.every((k) =>
      k.productSaysConcurrent === k.concurrent && k.productSaysCollinear === k.collinear),
    // A foot at infinity (NaN) removes a drawn verdict that the product still predicts.
    drawingExceptions: claims
      .filter((k) => k.productSaysConcurrent !== k.concurrent || k.productSaysCollinear !== k.collinear)
      .map((k) => ({ externalAt: k.externalAt, product: r6(k.product), concurrent: k.concurrent, collinear: k.collinear })),
  };

  const v = C.visible(pos, c);
  const named: Array<[string, Pt]> = [
    ["incenter", c.I], ["excenter opposite A", c.Ia], ["excenter opposite B", c.Ib],
    ["excenter opposite C", c.Ic],
    ["internal foot at A", c.intFeet[0]], ["internal foot at B", c.intFeet[1]],
    ["internal foot at C", c.intFeet[2]],
    ["external foot at A", c.extFeet[0]], ["external foot at B", c.extFeet[1]],
    ["external foot at C", c.extFeet[2]],
  ];
  const nonFinite = named.filter(([, p]) => !C.finite(p)).map(([label]) => label);

  const chosen = externalAt === undefined ? null : C.chosen(pos, c, externalAt);
  const signedRatios = externalAt === undefined ? null : {
    atA: unsigned.atA_c_over_b * (externalAt.includes(0) ? -1 : 1),
    atB: unsigned.atB_a_over_c * (externalAt.includes(1) ? -1 : 1),
    atC: unsigned.atC_b_over_a * (externalAt.includes(2) ? -1 : 1),
  };

  return {
    corners: { A: pt(A), B: pt(B), C: pt(Cc) },
    modes: { ...pos.modes },
    sides: { a_BC: r6(a), b_CA: r6(b), c_AB: r6(cc) },
    unsignedRatios: {
      atA_c_over_b: r6(unsigned.atA_c_over_b),
      atB_a_over_c: r6(unsigned.atB_a_over_c),
      atC_b_over_a: r6(unsigned.atC_b_over_a),
    },
    signedRatios: signedRatios
      ? { atA: r6(signedRatios.atA), atB: r6(signedRatios.atB), atC: r6(signedRatios.atC) }
      : null,
    product: chosen ? r6(chosen.product) : null,
    chosen: chosen
      ? {
          externalAt,
          lines: chosen.lines.map((line) => line.map(pt)),
          feet: chosen.feet.map(pt),
          point: pt(chosen.point),
          concurrent: chosen.concurrent,
          collinear: chosen.collinear,
          product: r6(chosen.product),
        }
      : null,
    claims: claims.map((k) => ({
      externalAt: k.externalAt,
      internalCount: k.internalCount,
      externalCount: k.externalCount,
      product: r6(k.product),
      concurrent: k.concurrent,
      collinear: k.collinear,
      productSaysConcurrent: k.productSaysConcurrent,
      productSaysCollinear: k.productSaysCollinear,
    })),
    parity,
    drawing: {
      internalLines: v.internalLines, externalLines: v.externalLines,
      externalLine: v.externalLine, internalTriangle: v.internalTriangle,
      centers: v.centers.map(pt), feet: v.feet.map(pt), nonFinite,
    },
    description: C.describe(pos),
  };
}

const NOTE_RATIOS =
  "A bisector at A cuts BC in +c/b (internal) or -c/b (external); at B it is +-a/c and at C it is +-b/a. " +
  "The product is (-1)^k for k external picks: +1 means the three lines meet (Ceva/concurrence) for even k, " +
  "-1 means the three feet line up (Menelaus/collinearity) for odd k. This is an illustration, so there is no win or loss.";
const NOTE_QUIRKS =
  "The 2-in/1-out checkbox draws a red triangle through all three internal feet, but the collinear triple in a " +
  "2-internal/1-external choice is two internal feet plus one external foot, so the red triangle is not that triple. " +
  "In an isosceles triangle an external bisector can be parallel to the opposite side: GeoSDoub.Intersect returns NaN " +
  "when its denominator is under one pixel, so that foot (and its drawn verdict) disappears even though the product still predicts it.";

export function actions(): GameActions {
  return {
    angle_bisector_ratios: {
      describe:
        "Measure a triangle from its corners A, B, C (each [x, y] or { x, y } in the page's SVG units, y downward; omitting any keeps the opening picture) and report the side lengths a=|BC|, b=|CA|, c=|AB| with the signed bisector ratios c/b, a/c, b/a — negated at corners listed in externalAt. It returns the product from the real core, the three chosen bisector lines and their feet for that selection, and checkClaims over all eight selections showing the parity rule: an even number of external picks gives product +1 and concurrent lines, an odd number gives product -1 and collinear feet.",
      args: '{ "A": [244, 100], "B": [240, 126.66666666666666], "C": [336, 164], "externalAt": [0, 2] }',
      run: (args) => {
        const C = core();
        const pos = buildState(C, args);
        const externalAt = readExternalAt(args.externalAt);
        const r = reading(C, pos, externalAt);
        const p = C.product(pos, externalAt);
        return {
          ...r,
          productFormula: "(-1)^k, k = number of external picks",
          expectedSign: externalAt.length % 2 === 0 ? "+1 (concurrent)" : "-1 (collinear)",
          note: `${NOTE_RATIOS} Here k = ${externalAt.length}, so the product is ${r6(p)} and the core expects ${externalAt.length % 2 === 0 ? "concurrence" : "collinearity"}.`,
        };
      },
    },

    selection_quirks: {
      describe:
        "Look at one of the applet's four angle-bisector selections: mode is one of I3E0, I2E1, I1E2, I0E3 (default I2E1), with optional corners A, B, C as in angle_bisector_ratios. It reports exactly which lines, centers and feet the core's visible() draws, the core's own status sentence, and any constructed point at infinity (NaN). The default picture is an isosceles triangle with apex A, where the external bisector at A is parallel to BC; together with the 2-in/1-out red triangle this shows both quirks of the applet at once.",
      args: '{ "A": [240, 80], "B": [160, 240], "C": [320, 240], "mode": "I2E1" }',
      run: (args) => {
        const C = core();
        const mode = args.mode === undefined || args.mode === null ? "I2E1" : String(args.mode);
        if (!C.MODES.includes(mode)) {
          throw new Error(`argument "mode" must be one of ${C.MODES.join(", ")}`);
        }
        const modes: Modes = {};
        for (const m of C.MODES) modes[m] = m === mode;
        const pos: State = { corners: readCorners(args, C), modes };
        const r = reading(C, pos);
        return {
          ...r,
          mode,
          redTriangleQuirk: mode === "I2E1",
          intersectionTolerance: C.INTERSECT_EPS,
          note: NOTE_QUIRKS,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Menelaus Bisector state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Menelaus Bisector position must be an object");
  }
  const C = core();
  const pos: State = { corners: readCorners(state.corners, C), modes: readModes(state.modes, C) };

  const r = reading(C, pos);
  return {
    stateVersion,
    corners: r.corners,
    modes: r.modes,
    reading: r,
    note:
      "Track.state saved the three vertices and the four angle-bisector checkboxes. The core rebuilds that exact picture: " +
      `${r.description} It measures a=${r.sides.a_BC}, b=${r.sides.b_CA}, c=${r.sides.c_AB}, and the eight choices follow ` +
      `${r.parity.verdictsMatchDrawing ? "the parity rule with every drawn verdict agreeing" : "the parity rule, except where an NaN foot removes a drawn verdict"}.`,
  };
}
