/*
 * run_game_logic actions and saved-position reader for Arbelos PWW, a proof
 * without words of Archimedes' Proposition 4.
 *
 * The core lives in arbelos-pww/ and is copied into src/generated/cores/ at
 * build time. A point N splits AB into AN = a and NB = b; the upright at N
 * meets the big semicircle at P (above) and D (below), and its half-length
 * h = sqrt(a*b) is the geometric mean of the two parts. The shoemaker's knife
 * has area pi*a*b/4, exactly the area of the circle on diameter h. The page's
 * proof applies Euclid's semicircle form of the Pythagorean theorem to three
 * right triangles: ADB (big), AND (blue) and BND (red); the three equalities
 * cancel the two sloping semicircles to give the claim. Every number below
 * comes from the real core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arbelos-pww"].ArbelosPwwCore;

type Geometry = ReturnType<ReturnType<typeof core>["geometry"]>;
type Point = { x: number; y: number };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const close = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

interface Setup {
  t: number;
  diameter: number;
  scale: number;
  g: Geometry;
}

/**
 * Build a core state from the arguments. Give either the split fraction t
 * (with an optional AB diameter, defaulting to the board's AB) or the two
 * parts a = AN and b = NB; lengths are scaled linearly and areas quadratically.
 */
function fromArgs(args: Json): Setup {
  const C = core();
  let t: number;
  let diameter: number;
  const hasA = args.a !== undefined && args.a !== null;
  const hasB = args.b !== undefined && args.b !== null;
  if (hasA !== hasB) throw new Error('give both "a" and "b", or give "t"');
  if (hasA && hasB) {
    const a = num(args, "a");
    const b = num(args, "b");
    if (!(a > 0) || !(b > 0)) throw new Error('"a" and "b" must be positive lengths AN and NB');
    t = a / (a + b);
    diameter = a + b;
  } else {
    t = num(args, "t", C.START_T);
    if (!(t >= 0 && t <= 1)) throw new Error('"t" must be a fraction of AB between 0 and 1');
    diameter = num(args, "diameter", C.SIDE);
    if (!(diameter > 0)) throw new Error('"diameter" must be positive');
  }
  const g = C.geometry(C.start({ t }));
  return { t: g.t, diameter, scale: diameter / C.SIDE, g };
}

/** h = sqrt(AN*NB) and the equal areas of the knife and the circle on h. */
function splitReading(d: Setup) {
  const { g, scale } = d;
  const len = (v: number) => round(v * scale);
  const area = (v: number) => round(v * scale * scale);
  const a = len(g.a);
  const b = len(g.b);
  const arbelos = area(g.arbelosArea);
  const circle = area(g.circleArea);
  return {
    t: round(g.t),
    AB: round(d.diameter),
    AN: a,
    NB: b,
    upright_h: len(g.h),
    isGeometricMean: close(g.h, Math.sqrt(g.a * g.b)),
    circleOnHRadius: len(g.circle.radius),
    arbelosArea: arbelos,
    circleOnHArea: circle,
    formulaPiABover4: round(Math.PI * a * b / 4),
    equalAreas: close(g.arbelosArea, g.circleArea),
  };
}

export function actions(): GameActions {
  return {
    split_point: {
      describe:
        "For a split point N on AB, give t as a fraction of AB (with an optional AB diameter) or give the two parts a = AN and b = NB. Report the upright h = sqrt(AN*NB), the arbelos area pi*AN*NB/4, and the circle on diameter h whose area matches the knife exactly (Archimedes' Proposition 4).",
      args: '{ "t": 0.3125, "diameter": 340 }',
      run: (args) => {
        const r = splitReading(fromArgs(args));
        return {
          ...r,
          note: `N splits AB into AN = ${r.AN} and NB = ${r.NB}. The upright h = sqrt(AN*NB) = ${r.upright_h}, so the circle on it has radius ${r.circleOnHRadius} and area ${r.circleOnHArea}. The arbelos is pi*AN*NB/4 = ${r.arbelosArea}; the two areas are equal.`,
        };
      },
    },
    pythagorean_proof: {
      describe:
        "The proof without words for the same split point (t or a and b): check the three semicircle Pythagorean equalities the picture draws - big on triangle ADB, blue on AND, red on BND - then show that cancelling the two sloping semicircles leaves semicircle(AB) - semicircle(AN) - semicircle(NB) = two semicircles on the upright, i.e. the arbelos equals the circle on h, both pi*a*b/4.",
      args: '{ "a": 106, "b": 234 }',
      run: (args) => {
        const d = fromArgs(args);
        const { g, scale } = d;
        const area = (v: number) => round(v * scale * scale);
        const semi = {
          AB: area(g.semiBig),
          AD: area(g.semiAD),
          BD: area(g.semiBD),
          AN: area(g.semiAN),
          BN: area(g.semiBN),
          ND: area(g.semiND),
        };
        const big = close(g.semiBig, g.semiAD + g.semiBD);
        const blue = close(g.semiAD, g.semiAN + g.semiND);
        const red = close(g.semiBD, g.semiBN + g.semiND);
        const cancellation = close(g.semiBig - g.semiAN - g.semiBN, 2 * g.semiND);
        const arbelos = area(g.arbelosArea);
        const circle = area(g.circleArea);
        return {
          ...splitReading(d),
          semicircleAreas: semi,
          bigEquality: { holds: big, written: "semicircle(AB) = semicircle(AD) + semicircle(BD)" },
          blueEquality: { holds: blue, written: "semicircle(AD) = semicircle(AN) + semicircle(ND)" },
          redEquality: { holds: red, written: "semicircle(BD) = semicircle(BN) + semicircle(ND)" },
          cancellation,
          twoHalvesOnUpright: area(2 * g.semiND),
          arbelosEqualsCircle: close(g.arbelosArea, g.circleArea),
          note: `The semicircle Pythagorean equality holds three times: big (${semi.AB} = ${semi.AD} + ${semi.BD}), blue (${semi.AD} = ${semi.AN} + ${semi.ND}) and red (${semi.BD} = ${semi.BN} + ${semi.ND}). Cancelling the two sloping semicircles leaves semicircle(AB) - semicircle(AN) - semicircle(BN) = ${area(2 * g.semiND)}, a whole circle on the upright: the arbelos ${arbelos} equals the circle ${circle}, both pi*a*b/4.`,
        };
      },
    },
  };
}

function readPoint(value: unknown, name: string): Point {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const x = Number(o.x);
    const y = Number(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${name}" must be a point {x, y}`);
}

/** The page's saved fields, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Arbelos PWW state version ${stateVersion}`);

  const t = num(state, "t");
  const g = C.geometry(C.start({ t }));
  const cp = C.position(C.start({ t })); // the core's rounded summary: the page's saved shape

  const saved = {
    t,
    N: readPoint(state.N, "N"),
    P: readPoint(state.P, "P"),
    D: readPoint(state.D, "D"),
    a: num(state, "a"),
    b: num(state, "b"),
    h: num(state, "h"),
    AD: num(state, "AD"),
    BD: num(state, "BD"),
    blueStartDeg: num(state, "blueStartDeg"),
    redStartDeg: num(state, "redStartDeg"),
    arbelosArea: num(state, "arbelosArea"),
    circleArea: num(state, "circleArea"),
  };

  const numbers: Array<[string, number, number]> = [
    ["t", saved.t, cp.t],
    ["a", saved.a, cp.a],
    ["b", saved.b, cp.b],
    ["h", saved.h, cp.h],
    ["AD", saved.AD, cp.AD],
    ["BD", saved.BD, cp.BD],
    ["arbelosArea", saved.arbelosArea, cp.arbelosArea],
    ["circleArea", saved.circleArea, cp.circleArea],
  ];
  const points: Array<[string, Point, Point]> = [
    ["N", saved.N, cp.N],
    ["P", saved.P, cp.P],
    ["D", saved.D, cp.D],
  ];
  const differences = [
    ...numbers.map(([field, page, coreValue]) => ({
      field, page, core: coreValue, diff: round(Math.abs(page - coreValue), 9),
    })),
    ...points.flatMap(([field, page, coreValue]) => [
      { field: `${field}.x`, page: page.x, core: coreValue.x, diff: round(Math.abs(page.x - coreValue.x), 9) },
      { field: `${field}.y`, page: page.y, core: coreValue.y, diff: round(Math.abs(page.y - coreValue.y), 9) },
    ]),
  ];
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );

  return {
    stateVersion,
    // The fields the page saved with Track.state, with the same names.
    ...saved,
    // What the same core adds about this position.
    core: {
      R: round(g.R),
      centre: pt(g.centre),
      leftCentre: pt(g.leftCentre),
      rightCentre: pt(g.rightCentre),
      circle: { centre: pt(g.circle.centre), radius: round(g.circle.radius) },
      semiBig: round(g.semiBig),
      semiAD: round(g.semiAD),
      semiBD: round(g.semiBD),
      semiAN: round(g.semiAN),
      semiBN: round(g.semiBN),
      semiND: round(g.semiND),
      lowerCircleArea: round(g.lowerCircleArea),
    },
    savedMatchesCore,
    differences,
    isGeometricMean: close(g.h, Math.sqrt(g.a * g.b)),
    equalAreas: close(g.arbelosArea, g.circleArea),
    proofEqualities: {
      big: close(g.semiBig, g.semiAD + g.semiBD),
      blue: close(g.semiAD, g.semiAN + g.semiND),
      red: close(g.semiBD, g.semiBN + g.semiND),
    },
    note: savedMatchesCore
      ? `N is ${round(g.t)} of the way from A to B, so AN = ${round(g.a)} and NB = ${round(g.b)}. The upright h = sqrt(AN*NB) = ${round(g.h)} makes the circle on it have area ${round(g.circleArea)}, equal to the arbelos ${round(g.arbelosArea)} (pi*a*b/4); the big, blue and red semicircle Pythagorean equalities all hold, and cancelling them proves it.`
      : "The saved numbers do not agree with the core's geometry for this t; the differences are listed in `differences`.",
  };
}
