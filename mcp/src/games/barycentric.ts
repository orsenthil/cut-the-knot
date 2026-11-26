/*
 * run_game_logic actions and saved-position reader for Barycentric.
 *
 * The real core is barycentric/barycentric-core.js, copied into
 * src/generated/cores/ at build time. It follows the applet's Compute():
 * A' is where line AP meets BC, and aa = |P A'| / |A A'| is P's first
 * normalized coordinate (negative when A' lies between A and P), and likewise
 * for B' and C'. The three weights at A, B, C add to 1, their balance point
 *
 *   P = (aa*A + bb*B + cc*C) / (aa + bb + cc)
 *
 * is the dragged point, and in pairs they give how the cevians split each
 * side: BA'/A'C = cc/bb, CB'/B'A = aa/cc, AC'/C'B = bb/aa. The product of
 * those three ratios is 1 (Ceva), and conversely those ratios determine the
 * weights. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["barycentric"].BarycentricCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Position = { A: Point; B: Point; C: Point; P: Point };
type Calc = {
  coords: { aa: number; bb: number; cc: number };
  feet: { Ap: Point | null; Bp: Point | null; Cp: Point | null };
  vertex: string | null;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** A corner may arrive as the page saves it ({x, y}) or as a short [x, y]. */
function pointArg(args: Json, key: string, fallback: Point): Point {
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

function readPosition(C: Core, args: Json): Position {
  const seed = C.start({});
  return {
    A: pointArg(args, "A", seed.A),
    B: pointArg(args, "B", seed.B),
    C: pointArg(args, "C", seed.C),
    P: pointArg(args, "P", seed.P),
  };
}

/** Options come from a top-level action or the page's nested saved options. */
function readOptions(C: Core, args: Json) {
  const raw = (args.options !== undefined && args.options !== null && typeof args.options === "object"
    ? args.options : args) as Json;
  const mode = raw.mode === undefined ? "inherited" : String(raw.mode);
  if (!C.MODES.includes(mode)) {
    throw new Error(`mode must be one of ${C.MODES.join(", ")}, got ${JSON.stringify(raw.mode)}`);
  }
  const digits = Math.round(num(raw, "digits", 2));
  if (digits < C.DIGITS_MIN || digits > C.DIGITS_MAX) {
    throw new Error(`digits must be between ${C.DIGITS_MIN} and ${C.DIGITS_MAX}`);
  }
  return C.options({
    mode, digits,
    showNames: raw.showNames === true,
    showBary: raw.showBary === true,
    showCeva: raw.showCeva === true,
  });
}

/** Everything the core measures at one position, in tutor-friendly units. */
function reading(C: Core, s: Position, opts: ReturnType<Core["options"]>) {
  const calc = C.compute(s) as Calc;
  const { aa, bb, cc } = calc.coords;
  const ratios = C.sideRatios(s, calc as any);
  const shown = C.display(s, calc as any, opts);
  const claims = C.claims(s, calc as any);
  const balance = C.balance(s, [aa, bb, cc]);
  const ok = Number.isFinite(aa + bb + cc) && Boolean(calc.feet.Ap && calc.feet.Bp && calc.feet.Cp);
  return {
    vertexAtP: calc.vertex,
    coords: { alpha: maybe(aa), beta: maybe(bb), gamma: maybe(cc) },
    sum: maybe(aa + bb + cc),
    baryText: shown.baryText,
    balancePoint: pt(balance),
    balanceIsP: ok && Boolean(balance) && C.distance(balance, s.P) < 1e-6,
    feet: { Ap: pt(calc.feet.Ap), Bp: pt(calc.feet.Bp), Cp: pt(calc.feet.Cp) },
    sideRatios: ratios ? {
      BA_ApC: maybe(ratios.BA_ApC),
      CB_BpA: maybe(ratios.CB_BpA),
      AC_CpB: maybe(ratios.AC_CpB),
      cevaProduct: maybe(ratios.product),
    } : null,
    labels: shown.labels,
    claims,
    note: ok
      ? `The weights at A, B, C are (${maybe(aa)}, ${maybe(bb)}, ${maybe(cc)}): they add to ${maybe(aa + bb + cc)}, and their balance point is P. Read in pairs they split the sides as BA'/A'C = cc/bb, CB'/B'A = aa/cc and AC'/C'B = bb/aa, whose product is 1 (Ceva).`
      : "P is within 2 units of a vertex, or a cevian does not reach the far side: the applet short-circuits to a vertex coordinate and has no feet to measure.",
  };
}

export function actions(): GameActions {
  return {
    coordinates: {
      describe:
        "For a picture with corners A, B, C and point P (each {x, y} or [x, y], y downward; omit any point to keep the page's starting one), report P's barycentric coordinates alpha, beta, gamma at A, B, C as the applet computes them from the cevian feet A', B', C', their sum, the drawn coordinate text, the balance point, the three side-ratio identities with Ceva's product, the side-split labels for mode inherited/addTo1/routh, and each claim of the article. digits is the number of decimals shown (1 to 15). Try P at the centroid: [216.67, 154.47] for the default triangle.",
      args: '{ "A": [103, 200], "B": [300, 200], "C": [250, 63.4], "P": [216.7, 154.5], "mode": "inherited", "digits": 3, "showBary": true, "showCeva": true }',
      run: (args) => {
        const C = core();
        const s = readPosition(C, args);
        const opts = readOptions(C, args);
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P) },
          options: opts,
          ...reading(C, s, opts),
        };
      },
    },
    from_ratios: {
      describe:
        "Invert the side-ratio identities: given lambda = BA'/A'C, mu = CB'/B'A and nu = AC'/C'B (finite and nonzero), report Ceva's product lambda*mu*nu and the three equivalent unnormalized coordinate triples [lambda*mu, 1, lambda], [mu, mu*nu, 1] and [1, nu, lambda*nu]. When the product is 1 the triples are proportional and give the same point; with optional corners A, B, C each triple's balance point is reported so this can be checked. For lambda = mu = nu = 1 the triples give the centroid (1, 1, 1).",
      args: '{ "lambda": 2, "mu": 0.5, "nu": 1, "A": [103, 200], "B": [300, 200], "C": [250, 63.4] }',
      run: (args) => {
        const C = core();
        const factor = (k: string): number => {
          const v = num(args, k);
          if (v === 0) throw new Error(`argument "${k}" must be nonzero (it is a side ratio)`);
          return v;
        };
        const lambda = factor("lambda"), mu = factor("mu"), nu = factor("nu");
        const r = C.fromRatios(lambda, mu, nu);
        const s = readPosition(C, args);
        const balances = r.triples.map((w) => pt(C.balance(s, w)));
        const same = balances.every((p) => p && C.distance(p, balances[0]) < 1e-6);
        return {
          ratios: { lambda, mu, nu },
          cevaProduct: round(r.ceva),
          triples: r.triples.map((w) => w.map(round)),
          balancesAt: balances,
          triplesAgree: same,
          note: same
            ? "lambda*mu*nu = 1, so the three triples are proportional: after dividing by their sum they all give the same normalized weights (alpha, beta, gamma) and the same balance point."
            : "lambda*mu*nu is not 1: the three triples are not proportional, so no single point has all three side ratios and the cevians are not concurrent.",
        };
      },
    },
  };
}

/** The page's saved picture, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readPosition(C, state);
  const opts = readOptions(C, state);
  const r = reading(C, s, opts);
  const calc = r.coords;
  const saved = state.coords !== undefined && state.coords !== null && typeof state.coords === "object"
    ? state.coords as Json : {};
  return {
    stateVersion,
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P) },
    options: opts,
    savedCoords: {
      alpha: maybe(num(saved, "aa", calc.alpha === null ? NaN : calc.alpha)),
      beta: maybe(num(saved, "bb", calc.beta === null ? NaN : calc.beta)),
      gamma: maybe(num(saved, "cc", calc.gamma === null ? NaN : calc.gamma)),
    },
    reading: r,
    stateIsIllustration: C.result() === null,
    note:
      "Track.state saves the four dragged points, the panel options and the coordinates drawn beside P. The reading recomputes all of them with the same construction the page uses, so the saved weights can be compared with what the cevians give now.",
  };
}
