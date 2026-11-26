/*
 * run_game_logic actions and saved-position reader for Besteman 2.
 *
 * The real core is besteman-2/besteman-2-core.js, copied into
 * src/generated/cores/ at build time. Bogomolny's second Besteman construction
 * extends AB to C with AC = (N-1)·AB, draws circles centred at A and C with
 * radii AB and (N-1)·AB, and takes their lower intersection D. The internal
 * bisector of angle ADC meets AC at P, so by the angle-bisector theorem
 * AP/PC = AD/CD = 1/(N-1) and AP = AC/N. This is the page's second claim,
 * CD = m·AD ⇒ AP = AC/(m+1), with m = N-1. The first Besteman construction is
 * different: with AC = N·AB/2 its perpendicular-chord argument gives
 * AP = AB/N, one Nth of the original segment rather than of the extension.
 * This illustration has no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["besteman-2"].Besteman2Core;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point | null | undefined) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const deg = (radians: number) => round((radians * 180) / Math.PI, 4);

/** Accept the page's saved { x, y } as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    const x = num({ [key]: v[0] }, key);
    const y = num({ [key]: v[1] }, key);
    return { x, y };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** N is the page's 2..20 spinner; reject rather than silently clamp it. */
function readN(C: Core, args: Json, fallback: number): number {
  const n = num(args, "N", fallback);
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`N must be an integer between ${C.MIN_N} and ${C.MAX_N}, got ${JSON.stringify(args.N)}`);
  }
  return n;
}

/** Rebuild the page's state. Dragging keeps A and B on the same horizontal line. */
function readBoard(args: Json) {
  const C = core();
  const fresh = C.start();
  const width = num(args, "width", fresh.width);
  const height = num(args, "height", fresh.height);
  if (!(width > 0) || !(height > 0)) throw new Error("width and height must be positive");
  let s = C.start({
    width, height,
    N: readN(C, args, fresh.N),
    showNames: args.showNames !== false,
    showHint: args.showHint === true,
  });
  if (args.A !== undefined && args.A !== null) s = C.withPoint(s, "A", readPoint(args, "A", fresh.A));
  if (args.B !== undefined && args.B !== null) {
    const B = readPoint(args, "B", s.B);
    s = C.withPoint(s, "B", { x: B.x, y: s.A.y });
  }
  return s;
}

/** The whole construction, in tutor-friendly units, from the real core. */
function reading(args: Json) {
  const C = core();
  const s = readBoard(args);
  const g = C.construction(s);
  if (!g) throw new Error("A and B coincide, so the two circles cannot be drawn; move B away from A");

  // secondClaim takes m = CD/AD = N-1; firstClaim is the sibling construction.
  const secondStep = C.secondClaim(s.N - 1, g.AC);
  const firstStep = C.firstClaim(s.N, g.AB);
  return {
    N: s.N,
    points: { A: pt(s.A), B: pt(s.B), C: pt(g.C), D: pt(g.D), P: pt(g.P) },
    circles: {
      centreA: pt(s.A), radiusA: round(g.rA),
      centreC: pt(g.C), radiusC: round(g.rC),
    },
    lengths: {
      AB: round(g.AB), AC: round(g.AC), AD: round(g.AD), CD: round(g.CD),
      AP: round(g.AP), PC: round(g.PC), DP: round(C.distance(g.D, g.P)),
    },
    ratios: {
      AP_over_PC: round(g.ratioAP_PC),
      AD_over_CD: round(g.ratioAD_CD),
      expected: round(1 / (s.N - 1)),
      AP_over_AC: round(g.AP / g.AC),
    },
    anglesAtDdegrees: {
      ADP: deg(g.halfA), PDC: deg(g.halfC),
      equal: Math.abs(g.halfA - g.halfC) < 1e-9,
    },
    divisionDots: g.marks.map((m: Point) => pt(m)),
    step: round(g.step),
    formulas: {
      bisector: "AP/PC = AD/CD = 1/(N-1)",
      pageSecond: `CD = ${s.N - 1}·AD, so AP = AC/N = ${round(secondStep)}`,
      firstConstruction: `With AC = N·AB/2 the first construction gives AP = AB/N = ${round(firstStep)}`,
    },
    note:
      `C is ${s.N - 1} steps from A along AB, so AC = ${round(g.AC)} and the circles of radii AB and ` +
      `${s.N - 1}·AB meet at D below the line. The bisector DP cuts AC at P with AP/PC = AD/CD = 1/${s.N - 1}, ` +
      `hence AP = AC/${s.N} = ${round(g.AP)}: the ${s.N} dots divide the whole extended segment AC. ` +
      `The first Besteman construction instead uses a perpendicular chord and similar right triangles to cut ` +
      `the original AB into ${s.N} parts (AP = AB/${s.N} = ${round(firstStep)} here); the two agree only at N = 2.`,
  };
}

/** The page's claims, checked numerically on one diagram. */
function claimCheck(args: Json) {
  const C = core();
  const s = readBoard(args);
  const cl = C.claims(s);
  const names = [
    "nonDegenerate", "bisectorRatio", "pageSecond", "equalParts", "equalAngles", "firstContrast",
  ] as const;
  const failed = names.filter((k) => cl[k] !== true);
  const flags = {} as Record<(typeof names)[number], boolean>;
  for (const k of names) flags[k] = cl[k] === true;
  return {
    N: s.N,
    ...flags,
    allHold: failed.length === 0,
    failed,
    note: !cl.nonDegenerate
      ? "A and B coincide, so there are no two circles to intersect; drag B away from A."
      : failed.length
        ? "Some claim fails on this diagram; move A or B apart and check again."
        : "All the page's claims hold: the angles at D are equal, AP/PC = AD/CD, AP = AC/N, and the N dots are equally spaced. " +
          "firstContrast checks the sibling construction's own formula AP = AB²/(2AC) = AB/N when AC = N·AB/2; it is not a claim about this diagram.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For N parts (an integer from 2 to 20) and handles A and B given as [x, y] or {x, y} in the page's board coordinates (y downward; defaults to the starting diagram), report the extended point C, the lower circle intersection D, the bisector foot P, the two circle radii, the lengths AB, AC, AD, CD, AP and PC, the ratios AP/PC = AD/CD = 1/(N-1), the two equal angles at D in degrees, the N division dots, and how this differs from the first Besteman construction. The page keeps A and B on the same horizontal line.",
      args: '{ "A": [103, 115], "B": [150, 115], "N": 3 }',
      run: (args) => reading(args),
    },
    check_claims: {
      describe:
        "Check the illustration's claims for a diagram with handles A and B and N parts (2 to 20): a non-degenerate construction, equal angles at D, AP/PC = AD/CD, the page's AP = AC/N with CD = (N-1)·AD, N equally spaced dots (the last drawn dot is one step short of C), and the first construction's contrasting formula. Returns a boolean for each, allHold and the names of any that fail.",
      args: '{ "A": [103, 115], "B": [150, 115], "N": 5 }',
      run: (args) => claimCheck(args),
    },
  };
}

/** The saved fields plus what the core reads out of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Besteman 2 state version ${stateVersion}`);
  const s = readBoard(state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B),
    width: s.width, height: s.height,
    N: s.N, showNames: s.showNames, showHint: s.showHint,
    reading: reading(state),
    claims: claimCheck(state),
    note:
      `This is a demo, so there is no win or loss: the player has set N = ${s.N}, with A and B at ` +
      `(${round(s.A.x)}, ${round(s.A.y)}) and (${round(s.B.x)}, ${round(s.B.y)}), and has ${s.showHint ? "shown" : "hidden"} the equal-angle marks.`,
  };
}
