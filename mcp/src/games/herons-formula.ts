/*
 * run_game_logic actions and saved-position reader for Heron's Formula: a Proof
 * (Bogomolny's HeronsFormula applet).
 *
 * Drag the three corners of triangle ABC. The incircle touches the sides at
 * three points, cutting the triangle into six small right triangles of height
 * r (the inradius). The tangent lengths from the corners are x = s-a,
 * y = s-b, z = s-c, so s = x+y+z. Laid side by side the six pieces form a
 * rectangle r high and x+y+z = s wide, giving S = r(x+y+z) = rs; while
 * halving the corner angles gives alpha+beta+gamma = 90 degrees and
 * xyz = r^2(x+y+z) = r^2 s, the same as
 * cot alpha + cot beta + cot gamma = cot alpha cot beta cot gamma. Together
 * these prove Heron's S^2 = s(s-a)(s-b)(s-c) = sxyz.
 *
 * Every number below comes from the real core in
 * herons-formula/herons-formula-core.js, copied into src/generated/cores/ at
 * build time. Coordinates are board units of the applet's 600 x 450 view, y
 * down. This is an illustration, so there is no win or loss. See _shared.ts
 * for the game-module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Sides = { a: number; b: number; c: number };
type State = { A: Pt; B: Pt; C: Pt; showNames: boolean; width: number; height: number };
type RightDiagram = { LU: Pt; LD: Pt; RD: Pt; RU: Pt; UM: Pt; RM: Pt };
type Strip = { top: Pt[]; bottom: Pt[] };
type Configuration = {
  ok: boolean;
  A: Pt; B: Pt; C: Pt; I: Pt; Ia: Pt; Ib: Pt; Ic: Pt;
  r: number; x: number; y: number; z: number; s: number;
  xyz: number; rightWidth: number; scale: number;
  center: Pt; right: RightDiagram; strip: Strip;
  sides: Sides; area: number;
};
type Claims = {
  heron: boolean; semiperimeter: boolean; tangentLengths: boolean;
  areaFromInradius: boolean; identity: boolean; cotangent: boolean;
  halfAngles: boolean; cotangentAngles: boolean;
  feetOnSides: boolean; dissectionArea: boolean; rightDivision: boolean;
};
type Core = {
  APPLET: { width: number; height: number; margin: number; header: number; degenerate: number };
  start(options?: Partial<State>): State;
  sides(s: State): Sides;
  area(s: State): number;
  configuration(s: State): Configuration;
  claims(s: State): Claims;
  computeAngle(p: Pt, q: Pt, r: Pt): number;
  withPoint(s: State, name: string, p: Pt): State;
  withOption(s: State, name: string, value: boolean): State;
  result(s: State): null;
};

const core = (): Core =>
  cores["herons-formula"].HeronsFormulaCore as unknown as Core;

const CLAIM_KEYS = [
  "heron", "semiperimeter", "tangentLengths", "areaFromInradius", "identity",
  "cotangent", "halfAngles", "cotangentAngles", "feetOnSides",
  "dissectionArea", "rightDivision",
] as const;

const SCOPE =
  "This is the HeronsFormula illustration: there is nothing to win or lose, so the core's result() is always null.";

/** Core numbers as plain JSON numbers, rounded or null when not finite. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const num6 = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const deg = (radians: number): number | null => num6(radians * 180 / Math.PI);

/** Accept both the tutor's [x, y] and the page's saved { x, y } points. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional board size; the applet opens on 600 x 450. */
function readBoard(args: Json): { width?: number; height?: number } {
  const out: { width?: number; height?: number } = {};
  for (const key of ["width", "height"] as const) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`argument "${key}" must be a positive number, got ${JSON.stringify(v)}`);
    }
    out[key] = n;
  }
  return out;
}

/** Start at the applet's opening picture, then move the corners that are given. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C points and optional width/height");
  }
  let s = C.start(readBoard(args));
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name));
    }
  }
  if (args.showNames !== undefined) s = C.withOption(s, "showNames", args.showNames === true);
  return s;
}

/** Rebuild the fields Track.state saved, without applying the page's drag clamp. */
function savedState(C: Core, state: Json): State {
  const positive = (v: unknown): number | undefined =>
    v !== undefined && v !== null && Number.isFinite(Number(v)) && Number(v) > 0
      ? Number(v) : undefined;
  let s = C.start({ width: positive(state.width), height: positive(state.height) });
  for (const name of ["A", "B", "C"] as const) {
    if (state[name] !== undefined && state[name] !== null) {
      s = C.withPoint(s, name, readPoint(state[name], `saved ${name}`));
    }
  }
  if (state.showNames !== undefined) s = C.withOption(s, "showNames", state.showNames === true);
  return s;
}

type Reading = ReturnType<typeof reading>;

/** One call to configuration() and claims(), plus residuals recomputed with core helpers. */
function reading(C: Core, s: State, g: Configuration, cl: Claims) {
  const { a, b, c } = g.sides;
  const alpha = C.computeAngle(s.A, s.B, s.C) / 2;
  const beta = C.computeAngle(s.B, s.C, s.A) / 2;
  const gamma = C.computeAngle(s.C, s.A, s.B) / 2;
  const cotLen = [g.x / g.r, g.y / g.r, g.z / g.r];
  const cotAngle = [alpha, beta, gamma].map((t) => 1 / Math.tan(t));
  const heronS2 = g.s * (g.s - a) * (g.s - b) * (g.s - c);
  const stripWide = g.strip.bottom[3].x - g.strip.top[0].x;
  const stripHigh = g.strip.bottom[0].y - g.strip.top[0].y;
  const failedClaims = CLAIM_KEYS.filter((k) => cl[k] !== true);

  return {
    drawingPossible: g.ok,
    board: { width: s.width, height: s.height },
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { BC_a: num6(a), CA_b: num6(b), AB_c: num6(c) },
    semiperimeter: num6(g.s),
    tangentLengths: {
      x_eq_s_minus_a: num6(g.x), y_eq_s_minus_b: num6(g.y), z_eq_s_minus_c: num6(g.z),
      x_plus_y_plus_z: num6(g.x + g.y + g.z),
    },
    incircle: { center: pt(g.I), inradius: num6(g.r) },
    touchPoints: { onBC: pt(g.Ia), onCA: pt(g.Ib), onAB: pt(g.Ic) },
    area: {
      measuredS: num6(g.area),
      S_squared: num6(g.area * g.area),
      heron_s_s_a_s_b_s_c: num6(heronS2),
      s_times_xyz: num6(g.s * g.xyz),
      r_times_s: num6(g.r * g.s),
      strip_width: num6(stripWide), strip_height: num6(stripHigh),
      strip_area: num6(stripWide * stripHigh),
    },
    product: {
      xyz: num6(g.xyz),
      r_squared_times_s: num6(g.r * g.r * g.s),
      r_times_x_plus_y_plus_z: num6(g.r * (g.x + g.y + g.z)),
    },
    halfAnglesDegrees: {
      alpha: deg(alpha), beta: deg(beta), gamma: deg(gamma),
      sum: deg(alpha + beta + gamma),
    },
    cotangentsFromLengths: {
      alpha_x_over_r: num6(cotLen[0]),
      beta_y_over_r: num6(cotLen[1]),
      gamma_z_over_r: num6(cotLen[2]),
    },
    residuals: {
      S2_minus_heron: sig(g.area * g.area - heronS2),
      S_minus_rs: sig(g.area - g.r * g.s),
      xyz_minus_r2s: sig(g.xyz - g.r * g.r * g.s),
      stripArea_minus_S: sig(stripWide * stripHigh - g.area),
      halfAngleSum_minus_90deg: sig((alpha + beta + gamma) * 180 / Math.PI - 90),
      cotSum_minus_product_fromLengths: sig(
        (cotLen[0] + cotLen[1] + cotLen[2]) - cotLen[0] * cotLen[1] * cotLen[2]),
      cotSum_minus_product_fromAngles: sig(
        (cotAngle[0] + cotAngle[1] + cotAngle[2]) - cotAngle[0] * cotAngle[1] * cotAngle[2]),
    },
    claims: cl,
    failedClaims,
    allPageClaimsHold: failedClaims.length === 0,
    result: C.result(s),
  };
}

/** Require a triangle the applet's Compute() can draw. */
function live(C: Core, args: Json): { s: State; g: Configuration; cl: Claims } {
  const s = buildState(C, args);
  const g = C.configuration(s);
  if (!g.ok) {
    throw new Error(
      "A, B and C must form a proper, non-flat triangle that the applet can draw " +
      "(the core's Compute() refuses a flat or degenerate one); move a corner and try again",
    );
  }
  return { s, g, cl: C.claims(s) };
}

function heronNote(r: Reading): string {
  return (
    `Sides a=BC=${r.sides.BC_a}, b=CA=${r.sides.CA_b}, c=AB=${r.sides.AB_c}; ` +
    `s=(a+b+c)/2=${r.semiperimeter} and the tangent lengths are x=s-a=${r.tangentLengths.x_eq_s_minus_a}, ` +
    `y=s-b=${r.tangentLengths.y_eq_s_minus_b}, z=s-c=${r.tangentLengths.z_eq_s_minus_c}, ` +
    `so x+y+z=${r.tangentLengths.x_plus_y_plus_z}=s. ` +
    `Measured straight from the corners S=${r.area.measuredS}, S²=${r.area.S_squared}; ` +
    `Heron's s(s-a)(s-b)(s-c)=${r.area.heron_s_s_a_s_b_s_c} and sxyz=${r.area.s_times_xyz}, ` +
    `and S=rs=${r.area.r_times_s} with inradius r=${r.incircle.inradius}. ` +
    `The residuals S²-Heron and S-rs are ${r.residuals.S2_minus_heron} and ${r.residuals.S_minus_rs}. ` + SCOPE
  );
}

function identityNote(r: Reading): string {
  return (
    `The six incircle triangles all have height r=${r.incircle.inradius}; laid side by side they form a rectangle ` +
    `${r.area.strip_width} by ${r.area.strip_height}, area ${r.area.strip_area}, so S=r(x+y+z)=rs. ` +
    `Here xyz=${r.product.xyz} and r²(x+y+z)=r²s=${r.product.r_squared_times_s}. ` +
    `Halving the corner angles gives alpha=${r.halfAnglesDegrees.alpha}°, beta=${r.halfAnglesDegrees.beta}°, ` +
    `gamma=${r.halfAnglesDegrees.gamma}°, summing to ${r.halfAnglesDegrees.sum}°, so the cotangent identity ` +
    `cot alpha+cot beta+cot gamma=cot alpha cot beta cot gamma holds ` +
    `(residuals from lengths ${r.residuals.cotSum_minus_product_fromLengths}, ` +
    `from angles ${r.residuals.cotSum_minus_product_fromAngles}); that identity is exactly xyz=r²s. ` +
    `Together with S=rs it gives S²=sxyz. ` + SCOPE
  );
}

/** The live fixture's three corners on the 600 x 450 board, rounded for the example. */
const FIXTURE_ARGS = '{ "A": [132.73, 113.05], "B": [58.79, 309.76], "C": [241.77, 202.75] }';

export function actions(): GameActions {
  return {
    heron_area: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } on the applet's 600 x 450 board, y down; omit a corner for the opening picture, and width/height may be overridden), run the real core and report the side lengths a=BC, b=CA, c=AB, the semiperimeter s=(a+b+c)/2, the tangent lengths x=s-a, y=s-b, z=s-c, the inradius r, the area S measured straight from the coordinates, and Heron's S²=s(s-a)(s-b)(s-c)=sxyz compared with S=rs. Also lists every claim verdict; refuses a flat or degenerate triangle the applet cannot draw.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const { s, g, cl } = live(C, args);
        const r = reading(C, s, g, cl);
        return { ...r, note: heronNote(r) };
      },
    },

    product_identity: {
      describe:
        "Check the two rearrangements on the same triangle (arguments as in heron_area): the six incircle triangles have height r and form a rectangle x+y+z=s wide, so S=rs; and splitting the corner angles in half gives alpha+beta+gamma=90° and xyz=r²(x+y+z)=r²s, equivalent to cot alpha+cot beta+cot gamma=cot alpha cot beta cot gamma. Reports the rectangle's area, the two cotangent residuals, the half-angle sum and every claim verdict from the core.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const { s, g, cl } = live(C, args);
        const r = reading(C, s, g, cl);
        return {
          triangle: r.triangle,
          board: r.board,
          tangentLengths: r.tangentLengths,
          incircle: r.incircle,
          area: r.area,
          product: r.product,
          halfAnglesDegrees: r.halfAnglesDegrees,
          cotangentsFromLengths: r.cotangentsFromLengths,
          residuals: r.residuals,
          claims: cl,
          failedClaims: r.failedClaims,
          allPageClaimsHold: r.allPageClaimsHold,
          result: r.result,
          note: identityNote(r),
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Heron's Formula state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Heron's Formula position must be an object");
  }

  const optPoint = (raw: unknown, label: string): Pt | null => {
    try { return pt(readPoint(raw, label)); } catch { return null; }
  };
  const saved = {
    A: optPoint(state.A, "saved A"),
    B: optPoint(state.B, "saved B"),
    C: optPoint(state.C, "saved C"),
    showNames: state.showNames === true,
    width: state.width,
    height: state.height,
  };

  try {
    const C = core();
    const s = savedState(C, state);
    const g = C.configuration(s);
    if (!g.ok) {
      return {
        ...state,
        stateVersion,
        saved,
        drawingPossible: false,
        result: C.result(s),
        note:
          "Track.state saved the three draggable corners A, B, C, the Show names flag and the board size. " +
          "Here the corners are flat or degenerate, so the applet's Compute() would draw nothing and there is no construction to measure.",
      };
    }
    const cl = C.claims(s);
    const r = reading(C, s, g, cl);
    return {
      ...state,
      stateVersion,
      saved,
      drawingPossible: true,
      reading: r,
      result: C.result(s),
      note:
        "Track.state saved only the three corners the player drags, the Show names checkbox and the board size (no derived points); " +
        "the core rebuilds the incenter, the incircle and its touch points, the tangent lengths x=s-a, y=s-b, z=s-c and the area. " +
        heronNote(r) + " " + identityNote(r),
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      saved,
      reading: null,
      note: `The saved position cannot be measured by the core: ${(err as Error).message}`,
    };
  }
}
