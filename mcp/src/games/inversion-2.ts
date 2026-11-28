/*
 * run_game_logic actions and saved-position reader for Inversion 2.
 *
 * The drawing is Bogomolny's "Inversion with Negative Power" applet.  Every
 * number below comes from its real core (inversion-2/ in the site, copied into
 * src/generated/cores/ at build time): A' is the image of A under inversion in
 * the circle t with power -OR², and the bold circle through C, its antipode C2
 * and A passes through A' as well.  See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["inversion-2"].Inversion2Core;

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type Picture = { O: Point; R: Point; C: Point; A: Point; options: { names: boolean }; explored: boolean };

const round = (n: number) => Math.round(n * 1e9) / 1e9;

/** JSON cannot carry NaN, so degenerate core results are turned into null. */
const safe = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) ? round(n) : null;

const viewPoint = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

const viewCircle = (c: Circle | null | undefined) =>
  c && Number.isFinite(c.r) ? { center: viewPoint(c.c), radius: round(c.r) } : null;

function readPoint(args: Json, key: string, fallback?: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${key}"`);
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`argument "${key}" must be an object with numeric x and y`);
  }
  const p = raw as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/**
 * Build the picture the applet draws.  C is projected back onto t with the
 * core's own restriction, exactly as a drag of O or R does on the page.
 */
function readPicture(args: Json): Picture {
  const C = core();
  const base = C.start({});
  const O = readPoint(args, "O", base.O);
  const R = readPoint(args, "R", base.R);
  const rawC = readPoint(args, "C", base.C);
  return {
    O,
    R,
    C: C.projectOnCircle(O, R, rawC),
    A: readPoint(args, "A", base.A),
    options: { names: args.names === undefined ? base.options.names : !!args.names },
    explored: false,
  };
}

export function actions(): GameActions {
  return {
    negative_power: {
      describe:
        "Given the centre O, a point R on the circle t and a point A, read the image A' the applet draws. It checks the page's signed product OA × OA' = -OR² (the article's unsigned OR² is corrected because O lies between A and A'), that the power of O in the bold circle through C, C2 and A is -OR², and that A' lies on that circle.",
      args: '{ "O": { "x": 279, "y": 150 }, "R": { "x": 200, "y": 150 }, "A": { "x": 324.572, "y": 143.474 } }',
      run: (args) => {
        const C = core();
        const s = readPicture(args);
        const g = C.geometry(s);
        if (!g.w || !g.Aprime || g.k === null) {
          return { degenerate: true, O: s.O, R: s.R, C: s.C, A: s.A, reason: C.describe(s) };
        }
        const or = C.dist(s.O, s.R);
        const oa = C.dist(s.O, s.A);
        const oaPrime = C.dist(s.O, g.Aprime);
        const signedOAPrime = oa * g.k; // k < 0: the signed length points back through O
        const signedProduct = oa * signedOAPrime;
        const power = g.power;
        const onCircleResidual = Math.abs(C.dist(g.w.c, g.Aprime) - g.w.r);
        const fromOrOnly = C.negativeInverse(s.O, s.R, s.A);
        return {
          O: s.O,
          R: s.R,
          C: s.C,
          A: s.A,
          C2: viewPoint(g.C2),
          Aprime: viewPoint(g.Aprime),
          circleT: viewCircle(g.t),
          circleW: viewCircle(g.w),
          lengths: { OR: round(or), OC: round(C.dist(s.O, s.C)), OA: round(oa), OAprime: round(oaPrime) },
          signedLengths: { OA: round(oa), OAprime: round(signedOAPrime), product: round(signedProduct) },
          articleUnsignedProduct: round(oa * oaPrime),
          negativePower: round(-or * or),
          signedProductIsMinusOrSquared:
            Math.abs(signedProduct + or * or) <= 1e-7 * Math.max(1, or * or),
          unsignedProductIsOrSquared:
            Math.abs(oa * oaPrime - or * or) <= 1e-7 * Math.max(1, or * or),
          OSeparatesAFromAprime: C.dot(C.sub(s.A, s.O), C.sub(g.Aprime, s.O)) < 0,
          powerOfOInW: safe(power),
          powerIsMinusOrSquared: power === null ? null
            : Math.abs(power + or * or) <= 1e-6 * Math.max(1, or * or),
          AprimeOnW: onCircleResidual <= 1e-7 * Math.max(1, g.w.r),
          onCircleResidual: round(onCircleResidual),
          negativeInverseFromOr: viewPoint(fromOrOnly),
          coreRuleMatchesDrawnPoint: !!fromOrOnly && C.dist(fromOrOnly, g.Aprime) <= 1e-7 * Math.max(1, or),
          note: `${C.describe(s)} The applet's own factor uses |OC|² rather than |OR|²; C was restricted to t, so the two radii agree.`,
        };
      },
    },

    inversion_plus_reflection: {
      describe:
        "Show that the negative-power image is ordinary inversion in t followed by a half-turn about O: first send A to P = O + OR²(A-O)/|OA|², then reflect P in O. The returned points and residuals compare both steps with the core's drawn A'.",
      args: '{ "O": { "x": 279, "y": 150 }, "R": { "x": 200, "y": 150 }, "A": { "x": 324.572, "y": 143.474 } }',
      run: (args) => {
        const C = core();
        const s = readPicture(args);
        const r = C.dist(s.O, s.R);
        const d = C.dist(s.O, s.A);
        if (d <= C.EPS) throw new Error("A must not coincide with O: it has no inverse point");
        // The two steps use only the core's point arithmetic and radius.
        const ordinary = C.add(s.O, C.mul(C.sub(s.A, s.O), (r * r) / d / d));
        const reflected = C.sub(C.mul(s.O, 2), ordinary);
        const negative = C.negativeInverse(s.O, s.R, s.A);
        const drawn = C.geometry(s).Aprime;
        const tolerance = 1e-7 * Math.max(1, r);
        return {
          O: s.O,
          R: s.R,
          A: s.A,
          OR: round(r),
          OA: round(d),
          ordinaryImageP: viewPoint(ordinary),
          reflectionInO: viewPoint(reflected),
          negativeInverseFromCore: viewPoint(negative),
          drawnAprime: viewPoint(drawn),
          ordinarySignedProduct: round(d * C.dist(s.O, ordinary)),
          afterReflectionSignedProduct: -r * r,
          residuals: {
            reflectionVsDrawn: drawn ? round(C.dist(reflected, drawn)) : null,
            coreRuleVsDrawn: drawn && negative ? round(C.dist(negative, drawn)) : null,
          },
          matchesDrawnAprime: !!drawn && C.dist(reflected, drawn) <= tolerance
            && !!negative && C.dist(negative, drawn) <= tolerance,
          note: "Ordinary inversion puts P on the same ray as A with OA × OP = +OR²; reflecting in O puts A' on the opposite ray, so OA × OA' = -OR². This is the applet's negative power, and the core's negativeInverse gets the same point from O, R and A alone.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Inversion 2 state version ${stateVersion}`);
  const base = C.start({});
  const O = readPoint(state, "O", base.O);
  const R = readPoint(state, "R", base.R);
  const savedC = readPoint(state, "C", base.C);
  const A = readPoint(state, "A", base.A);
  const options = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
  const projectedC = C.projectOnCircle(O, R, savedC);
  const s: Picture = {
    O, R, C: projectedC, A,
    options: { names: options.names === undefined ? base.options.names : !!options.names },
    explored: state.explored === true,
  };
  const g = C.geometry(s);
  const or = C.dist(O, R);
  const oa = C.dist(O, A);
  const signedProduct = g.k === null ? null : oa * (oa * g.k);
  return {
    stateVersion,
    // Saved fields, with the names the page used.
    O, R, C: savedC, A,
    options: s.options,
    explored: s.explored,
    // What the core derives from them.
    circleT: viewCircle(g.t),
    C2: viewPoint(g.C2),
    circleW: viewCircle(g.w),
    Aprime: viewPoint(g.Aprime),
    factorK: safe(g.k),
    powerOfOInW: safe(g.power),
    lengths: { OR: round(or), OC: round(C.dist(O, s.C)), OA: round(oa), OAprime: g.Aprime ? round(C.dist(O, g.Aprime)) : null },
    signedProduct: safe(signedProduct),
    negativePower: round(-or * or),
    signedProductIsMinusOrSquared: signedProduct === null ? null
      : Math.abs(signedProduct + or * or) <= 1e-6 * Math.max(1, or * or),
    OSeparatesAFromAprime: g.Aprime ? C.dot(C.sub(A, O), C.sub(g.Aprime, O)) < 0 : null,
    cOnCircleResidual: round(Math.abs(C.dist(O, savedC) - or)),
    note: `${C.describe(s)} C is re-restricted to t with the core's projectOnCircle before reading; the saved C is echoed above unchanged.`,
  };
}
