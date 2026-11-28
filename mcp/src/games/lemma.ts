/*
 * run_game_logic actions and saved-position reader for Lemma, Archimedes'
 * salinon from his Book of Lemmas.
 *
 * The real core is lemma/lemma-core.js (global LemmaCore), copied into
 * src/generated/cores/ at build time. Everything follows from one draggable
 * point D on the half-line AO: the core truncates AD = BE to a whole board
 * pixel, L = (int)(point.x - rect.x), so the picture moves in steps. With
 * L fixed, the salinon (big semicircle on AB plus the one on DE minus the two
 * on AD, BE) has area pi*CF^2/4, the same as the circle on the vertical
 * diameter CF -- Archimedes' Proposition 14, which rests on Euclid II.10,
 * (a+b)^2 + (a-b)^2 = 2(a^2+b^2), with a = EO and b = OA. See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["lemma"].LemmaCore;

type Point = { x: number; y: number };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));

/** Accept the page's { x, y } or a tutor's [x, y]; fall back if absent. */
function readPoint(v: unknown, name: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${name}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = num(o, "x"); y = num(o, "y");
  } else {
    throw new Error(`"${name}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${name}" needs finite x and y`);
  }
  return { x, y };
}

/**
 * The core state from the arguments. Give either an integer pixel length L,
 * a board x for the handle, or the fraction t from O (0) to A (1); L wins over
 * x, which wins over t. t defaults to the applet's opening 0.3.
 */
function stateFromArgs(C: any, args: Json): any {
  if (args.L !== undefined && args.L !== null) {
    const L = num(args, "L");
    if (!Number.isInteger(L) || L < 0 || L > C.HALF) {
      throw new Error(`"L" must be a whole pixel length from 0 to ${C.HALF}, got ${JSON.stringify(args.L)}`);
    }
    return C.start({ t: 1 - L / C.HALF });
  }
  if (args.x !== undefined && args.x !== null) {
    const x = num(args, "x");
    return C.setPointX(C.start({}), x);
  }
  const t = num(args, "t", C.START_T);
  if (!(t >= 0 && t <= 1)) throw new Error(`"t" must be a fraction from 0 to 1, got ${JSON.stringify(args.t)}`);
  return C.start({ t });
}

/** The salinon, its equal circle, and the Euclid II.10 identity behind them. */
function salinonReading(C: any, s: any) {
  const g = C.geometry(s);
  // Euclid II.10 with a = EO and b = OA: (a+b)^2 + (a-b)^2 = EA^2 + AD^2.
  const a: number = g.eo, b: number = g.oa;
  const lhs = (a + b) ** 2 + (a - b) ** 2;
  const rhs = 2 * (a * a + b * b);
  return {
    t: round(g.t),
    L: g.L,
    D: { x: round(g.D.x), y: round(g.D.y) },
    de: round(g.de),
    cf: round(g.cf),
    circleRadius: round(g.circle.radius),
    salinonArea: round(g.salinon),
    circleOnCFArea: round(g.circleArea),
    areasEqual: Math.abs(g.salinon - g.circleArea) <= 1e-6 * Math.max(1, Math.abs(g.circleArea)),
    euclidII10: {
      a: round(a), b: round(b),
      sumAndDifferenceSquares: round(lhs),
      twiceSquaresSum: round(rhs),
      holds: Math.abs(lhs - rhs) <= 1e-6 * Math.max(1, Math.abs(rhs)),
    },
    g,
  };
}

/** Show the applet's whole-pixel truncation of the continuous length AD. */
function pixelReading(C: any, s: any) {
  const g = C.geometry(s);
  const continuous = C.HALF * (1 - g.t); // x - RECT.x before Java's (int) cast
  const L: number = g.L;
  // L = trunc(HALF*(1-t)): the same integer for t just above 1-(L+1)/HALF
  // up to 1-L/HALF, then it jumps by one pixel.
  const tAbove = Math.max(0, 1 - (L + 1) / C.HALF);
  const tUpTo = Math.min(1, 1 - L / C.HALF);
  const mid = (tAbove + tUpTo) / 2;
  const sample = C.geometry(C.start({ t: mid })).L;
  return {
    boardX: round(g.point.x),
    continuousLength: round(continuous),
    truncatedLength: L,
    lostFraction: round(continuous - L),
    pixelBand: { tAbove: round(tAbove), tUpTo: round(tUpTo) },
    sameLengthThroughoutBand: sample === L,
  };
}

export function actions(): GameActions {
  return {
    salinon_and_euclid: {
      describe:
        "Archimedes' Proposition 14 for the salinon, proved by Euclid II.10. Give the handle position as an integer pixel length L, a board x, or the fraction t from O to A (0..1, default 0.3), and report L = AD = BE, DE, CF, the salinon's area and the circle on CF's area. They are equal (pi*CF^2/4); the check also shows (EO+OA)^2 + (EO-OA)^2 = EA^2 + AD^2 = 2(EO^2 + OA^2), which is (a+b)^2+(a-b)^2 = 2(a^2+b^2).",
      args: '{ "t": 0.281818 }',
      run: (args) => {
        const C = core();
        const r = salinonReading(C, stateFromArgs(C, args));
        const e = r.euclidII10;
        return {
          t: r.t, L: r.L, D: r.D, de: r.de, cf: r.cf,
          circleRadius: r.circleRadius,
          salinonArea: r.salinonArea,
          circleOnCFArea: r.circleOnCFArea,
          areasEqual: r.areasEqual,
          euclidII10: e,
          note: `With AD = BE = ${r.L}, DE = ${r.de} and CF = ${r.cf}, the salinon's area ${r.salinonArea} equals the circle on CF's ${r.circleOnCFArea} (both pi*CF^2/4). Taking a = EO = ${e.a} and b = OA = ${e.b}, Euclid II.10 gives (a+b)^2 + (a-b)^2 = EA^2 + AD^2 = ${e.sumAndDifferenceSquares} = 2(a^2+b^2) = ${e.twiceSquaresSum}.`,
        };
      },
    },
    pixel_length: {
      describe:
        "The applet's whole-pixel quirk: AD = BE is Java's (int)(point.x - rect.x), truncated to an integer board pixel, not the continuous distance from A to the handle. Give t (0..1, default 0.3), a board x, or an integer L, and report the continuous length, the truncated integer, the fraction cut off, and the band of t values that produce the same L.",
      args: '{ "t": 0.281818 }',
      run: (args) => {
        const C = core();
        const r = pixelReading(C, stateFromArgs(C, args));
        return {
          ...r,
          note: `The handle sits at board x = ${r.boardX}, so the continuous AD is ${r.continuousLength}, but the applet truncates it to L = ${r.truncatedLength}, throwing away ${r.lostFraction} of a pixel. For every t in (${r.pixelBand.tAbove}, ${r.pixelBand.tUpTo}] the length stays ${r.truncatedLength}; all areas are then exact functions of this integer L, so dragging within one pixel changes nothing.`,
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Lemma state version ${stateVersion}`);

  const t = num(state, "t");
  if (!(t >= 0 && t <= 1)) throw new Error(`saved "t" must be a fraction from 0 to 1, got ${JSON.stringify(state.t)}`);
  const s = C.start({ t });
  const g = C.geometry(s);
  const cp = C.position(s); // the core's rounded summary: the page's saved shape

  const D = readPoint(state.D, "D", cp.D as Point);
  const saved = {
    t: t as number,
    L: num(state, "L"),
    D,
    de: num(state, "de"),
    cf: num(state, "cf"),
    salinon: num(state, "salinon"),
    circleArea: num(state, "circleArea"),
  };
  const fields: Array<[string, number, number]> = [
    ["t", saved.t, cp.t],
    ["L", saved.L, cp.L],
    ["D.x", D.x, cp.D.x],
    ["D.y", D.y, cp.D.y],
    ["de", saved.de, cp.de],
    ["cf", saved.cf, cp.cf],
    ["salinon", saved.salinon, cp.salinon],
    ["circleArea", saved.circleArea, cp.circleArea],
  ];
  const differences = fields.map(([field, page, coreValue]) => ({
    field,
    page,
    core: coreValue,
    diff: round(Math.abs(page - coreValue), 9),
  }));
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );

  const a: number = g.eo, b: number = g.oa;
  const lhs = (a + b) ** 2 + (a - b) ** 2;
  const rhs = 2 * (a * a + b * b);
  return {
    stateVersion,
    ...saved,
    // What the same core adds about this position.
    core: {
      L: cp.L,
      D: { x: cp.D.x, y: cp.D.y },
      de: cp.de,
      cf: cp.cf,
      circleRadius: round(g.circle.radius),
      salinon: cp.salinon,
      circleArea: cp.circleArea,
    },
    savedMatchesCore,
    differences,
    areasEqual: Math.abs(g.salinon - g.circleArea) <= 1e-6 * Math.max(1, Math.abs(g.circleArea)),
    euclidII10Holds: Math.abs(lhs - rhs) <= 1e-6 * Math.max(1, Math.abs(rhs)),
    note: savedMatchesCore
      ? `The saved handle t = ${round(t)} gives AD = BE = ${cp.L} (a whole pixel), DE = ${cp.de} and CF = ${cp.cf}; the salinon and the circle on CF both have area ${cp.salinon}, as Euclid II.10 and Archimedes' Proposition 14 require.`
      : "The saved numbers do not agree with the core's geometry for this t (t is rounded to six decimals, which can cross a pixel boundary); the differences are listed in `differences`.",
  };
}
