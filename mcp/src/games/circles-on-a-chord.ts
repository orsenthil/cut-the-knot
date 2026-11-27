/*
 * run_game_logic actions and saved-position reader for Circles On AChord.
 *
 * N equal circles of radius r sit in a row on a chord of a big circle of radius
 * R; a second chord PQ is an internal common tangent to the two end circles.
 * The core lives in circles-on-a-chord/ and is copied into src/generated/cores/
 * at build time. With sin(phi) = 1/(N-1) and d the distance from the big centre
 * to the middle of the row O, the three equivalent readings of the tangent
 * chord are
 *
 *   PQ = 2 sqrt(R^2 - (d cos phi)^2)
 *      = 2 (R + N(N-2) r) / (N-1)
 *      = 2 (R + (N-2) rho) / (N-1),   rho = N r,
 *
 * and for the original Japanese tablet problem (N = 3) this is PQ = R + 3r =
 * R + rho. The problem is Problem 1.3.3 in Fukagawa and Pedoe's Japanese Temple
 * Geometry Problems; J. Marshall Unger observed that the two dotted circles
 * centred at O pass through P and Q. The applet and its interactive version
 * are Alexander Bogomolny's. Every number below comes from the real core; see
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-on-a-chord"].CirclesOnAChordCore;

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };

/** The core builds all of these together; geometry() types them as nullable. */
type Geometry = {
  doDraw: boolean;
  big: Circle;
  O: Point;
  N: number;
  d: number;
  A: Point;
  B: Point;
  P: Point;
  Q: Point;
  chord: number;
  r: number;
  rho: number;
  dots: Circle[];
  tangent: { W: Point };
};

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));

function readPoint(value: unknown, name: string): Point {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const x = Number(o.x), y = Number(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${name}" must be a point {x, y}`);
}

function readCircle(value: unknown, name: string): Circle {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const r = Number(o.r);
    if (Number.isFinite(r)) return { c: readPoint(o.c, `${name}.c`), r };
  }
  throw new Error(`"${name}" must be a circle {c: {x, y}, r}`);
}

/**
 * Build a core state from the arguments. The core draws on a fixed board of
 * RADIUS units, so a requested big radius R scales every length linearly.
 * Give either an O point in board units or a fraction t of R from the centre
 * towards the rim (t = 0.5 is the page's opening picture).
 */
function fromArgs(args: Json) {
  const C = core();
  const N = Math.round(num(args, "N", C.START_N));
  if (!Number.isInteger(N) || N < C.N_MIN || N > C.N_MAX) {
    throw new Error(`"N" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  const R = num(args, "R", C.RADIUS);
  if (!(R > 0)) throw new Error('"R" must be a positive big-circle radius');

  let O: Point;
  if (args.O !== undefined && args.O !== null) {
    O = readPoint(args.O, "O");
    const fromCentre = Math.hypot(O.x - C.CENTER.x, O.y - C.CENTER.y);
    if (fromCentre >= C.RADIUS - 2) {
      throw new Error('"O" must lie strictly inside the big circle');
    }
  } else {
    const t = num(args, "t", 0.5);
    if (!(t >= 0 && t <= 0.97)) {
      throw new Error('"t" must be a fraction of R between 0 and 0.97');
    }
    O = { x: C.CENTER.x, y: C.CENTER.y - t * C.RADIUS };
  }

  const state = C.start({ N, O });
  const g = C.geometry(state) as unknown as Geometry;
  if (!g.doDraw || !Number.isFinite(g.r) || !g.P || !g.Q) {
    throw new Error("no row of circles fits, so there is no tangent chord PQ");
  }
  return { C, state, g, N: g.N as number, R, scale: R / C.RADIUS };
}

/** The chord, its three equivalent formulas and Unger's dotted circles. */
function reading(p: ReturnType<typeof fromArgs>) {
  const { C, g, N, R, scale } = p;
  const r = g.r * scale, rho = g.rho * scale;
  const d = g.d * scale, chord = g.chord * scale;
  // Scale lengths about the board's centre, so the picture stays centred.
  const sp = (q: Point): Point => ({
    x: C.CENTER.x + (q.x - C.CENTER.x) * scale,
    y: C.CENTER.y + (q.y - C.CENTER.y) * scale,
  });
  const P = sp(g.P);
  const Q = sp(g.Q);

  const phi = Math.asin(1 / (N - 1));
  const byAngle = 2 * Math.sqrt(Math.max(0, R * R - (d * Math.cos(phi)) ** 2));
  const byRadii = 2 * (R + N * (N - 2) * r) / (N - 1);
  const byDashed = 2 * (R + (N - 2) * rho) / (N - 1);
  const coreTheorem = (C.theorem(p.state) as number) * scale; // the core's own closed form
  const agree = [byAngle, byRadii, byDashed, coreTheorem].every(
    (v) => Math.abs(v - chord) <= 1e-7 * Math.max(1, Math.abs(chord)),
  );

  const dotRadii = g.dots.map((dot: Circle) => dot.r * scale).sort((a: number, b: number) => a - b);
  const OPQ = [C.dist(g.O, g.P), C.dist(g.O, g.Q)].map((v) => v * scale).sort((a, b) => a - b);
  const dotsHitPQ = dotRadii.every((v: number, i: number) =>
    Math.abs(v - OPQ[i]) <= 1e-7 * Math.max(1, Math.abs(v)),
  );

  return {
    N,
    R: round(R),
    O: { x: round(sp(g.O).x), y: round(sp(g.O).y) },
    big: { c: { x: C.CENTER.x, y: C.CENTER.y }, r: round(R) },
    d: round(d),
    r: round(r),
    rho: round(rho),
    angle: { sin: round(Math.sin(phi), 8), cos: round(Math.cos(phi), 8) },
    P: { x: round(P.x), y: round(P.y) },
    Q: { x: round(Q.x), y: round(Q.y) },
    chord: round(chord),
    formulas: {
      byAngle: round(byAngle),
      byRadii: round(byRadii),
      byDashedRadius: round(byDashed),
      coreTheorem: round(coreTheorem),
    },
    formulasAgree: agree,
    tabletCaseN3: N === 3
      ? { chord: round(chord), R_plus_3r: round(R + 3 * r), R_plus_rho: round(R + rho) }
      : null,
    unger: {
      dottedRadii: dotRadii.map((v: number) => round(v)),
      OP: round(OPQ[0]), OQ: round(OPQ[1]),
      dotsPassThroughPandQ: dotsHitPQ,
    },
  };
}

export function actions(): GameActions {
  return {
    tangent_chord: {
      describe:
        "For N equal circles (3 to 7) on a chord of a big circle of radius R, report the little radius r, the dashed radius rho = N*r and the tangent chord PQ, then check the three equivalent formulas PQ = 2*sqrt(R^2 - (d*cos(phi))^2) with sin(phi)=1/(N-1), PQ = 2(R + N(N-2)r)/(N-1) and PQ = 2(R + (N-2)rho)/(N-1). For N = 3 it also reports the tablet's answer PQ = R + 3r = R + rho. Give N and optionally R (default the core board's radius) and either t, the fraction from the centre to O, or a point O in board units.",
      args: '{ "N": 3, "R": 100, "t": 0.5 }',
      run: (args) => {
        const r = reading(fromArgs(args));
        const t3 = r.tabletCaseN3;
        const tablet = t3
          ? ` For N = 3 the tablet's answer is PQ = R + 3r = ${t3.R_plus_3r} (also R + rho = ${t3.R_plus_rho}).`
          : "";
        return {
          ...r,
          note: `The ${r.N} circles have radius r = ${r.r}, so the dashed radius is rho = ${r.rho}. The chord cut off by the common tangent is PQ = ${r.chord}; the angle, radius and dashed-radius formulas all give ${r.formulas.byRadii}, agreeing with the core.${tablet} This is Problem 1.3.3 of Fukagawa and Pedoe, ported from Bogomolny's applet.`,
        };
      },
    },
    unger_extra_circles: {
      describe:
        "J. Marshall Unger's extra construction for the same picture: the dashed circle of radius rho = N*r and two dotted circles centred at O. Their radii turn out to be OP and OQ, so the dotted circles meet the big circle exactly at P and Q. Give N and optionally R and t (or a point O in board units); returns both sets of radii, their comparison and the dashed-radius chord formula.",
      args: '{ "N": 5, "t": 0.8 }',
      run: (args) => {
        const r = reading(fromArgs(args));
        return {
          N: r.N,
          R: r.R,
          O: r.O,
          rho: r.rho,
          chord: r.chord,
          dashedRadiusFormula: r.formulas.byDashedRadius,
          unger: r.unger,
          note: `With rho = ${r.rho}, the chord PQ = 2(R + (N-2)rho)/(N-1) = ${r.formulas.byDashedRadius} (for N = 3 simply R + rho). The two dotted circles centred at O have radii ${r.unger.dottedRadii.join(" and ")}, which are OP and OQ, so they meet the big circle at P and Q. Unger's observation is explained in Bogomolny's applet of the Fukagawa-Pedoe problem.`,
        };
      },
    },
  };
}

type FieldDiff = { field: string; page: number; core: number; diff: number };

function compareFields(fields: Array<[string, number, number]>): FieldDiff[] {
  return fields.map(([field, page, coreValue]) => ({
    field, page, core: coreValue, diff: round(Math.abs(page - coreValue), 9),
  }));
}

/** The page's saved fields, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles On AChord state version ${stateVersion}`);
  }
  const C = core();
  const N = Math.round(num(state, "N"));
  if (!Number.isInteger(N) || N < C.N_MIN || N > C.N_MAX) {
    throw new Error(`saved "N" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  const O = readPoint(state.O, "O");
  const options = state.options && typeof state.options === "object"
    ? state.options as Record<string, unknown>
    : {};
  const built = C.start({
    N, O,
    names: options.names === true,
    circles: options.circles === true,
    hint: options.hint === true,
    extra: options.extra === true,
  });
  const g = C.geometry(built) as unknown as Geometry;

  const saved = {
    N,
    O,
    radius: num(state, "radius"),
    rho: num(state, "rho"),
    chord: num(state, "chord"),
    big: readCircle(state.big, "big"),
    A: readPoint(state.A, "A"),
    B: readPoint(state.B, "B"),
    P: readPoint(state.P, "P"),
    Q: readPoint(state.Q, "Q"),
    options: {
      names: options.names === true,
      circles: options.circles === true,
      hint: options.hint === true,
      extra: options.extra === true,
    },
  };

  if (!g.doDraw || !Number.isFinite(g.r) || !g.P || !g.Q) {
    return {
      stateVersion,
      ...saved,
      doDraw: false,
      note: "The saved O lies too close to (or outside) the rim, so no chain of circles or tangent chord is drawn.",
    };
  }

  const R = g.big.r;
  const r = g.r, rho = g.rho, d = g.d, chord = g.chord;
  const phi = Math.asin(1 / (N - 1));
  const byAngle = 2 * Math.sqrt(Math.max(0, R * R - (d * Math.cos(phi)) ** 2));
  const byRadii = 2 * (R + N * (N - 2) * r) / (N - 1);
  const byDashed = 2 * (R + (N - 2) * rho) / (N - 1);
  const coreTheorem = C.theorem(built) as number;
  const dotRadii = g.dots.map((dot: Circle) => dot.r).sort((a: number, b: number) => a - b);
  const OPQ = [C.dist(g.O, g.P), C.dist(g.O, g.Q)].sort((a, b) => a - b);
  const dotsHitPQ = dotRadii.every((v: number, i: number) =>
    Math.abs(v - OPQ[i]) <= 1e-7 * Math.max(1, Math.abs(v)),
  );

  const differences = compareFields([
    ["radius", saved.radius, r], ["rho", saved.rho, rho],
    ["chord", saved.chord, chord],
    ["big.r", saved.big.r, g.big.r],
    ["big.c.x", saved.big.c.x, g.big.c.x], ["big.c.y", saved.big.c.y, g.big.c.y],
    ["O.x", saved.O.x, g.O.x], ["O.y", saved.O.y, g.O.y],
    ["A.x", saved.A.x, g.A.x], ["A.y", saved.A.y, g.A.y],
    ["B.x", saved.B.x, g.B.x], ["B.y", saved.B.y, g.B.y],
    ["P.x", saved.P.x, g.P.x], ["P.y", saved.P.y, g.P.y],
    ["Q.x", saved.Q.x, g.Q.x], ["Q.y", saved.Q.y, g.Q.y],
  ]);
  const savedMatchesCore = differences.every(
    (x) => x.diff <= 1e-4 * Math.max(1, Math.abs(x.core)),
  );
  const formulasAgree = [byAngle, byRadii, byDashed, coreTheorem].every(
    (v) => Math.abs(v - chord) <= 1e-7 * Math.max(1, Math.abs(chord)),
  );

  return {
    stateVersion,
    ...saved,
    doDraw: true,
    core: {
      N: g.N,
      O: { x: round(g.O.x), y: round(g.O.y) },
      big: { c: { x: round(g.big.c.x), y: round(g.big.c.y) }, r: round(R) },
      d: round(d),
      r: round(r),
      rho: round(rho),
      chord: round(chord),
      A: { x: round(g.A.x), y: round(g.A.y) },
      B: { x: round(g.B.x), y: round(g.B.y) },
      P: { x: round(g.P.x), y: round(g.P.y) },
      Q: { x: round(g.Q.x), y: round(g.Q.y) },
      tangentPoint: { x: round(g.tangent.W.x), y: round(g.tangent.W.y) },
      formulas: {
        byAngle: round(byAngle),
        byRadii: round(byRadii),
        byDashedRadius: round(byDashed),
        coreTheorem: round(coreTheorem),
      },
      tabletCaseN3: N === 3
        ? { chord: round(chord), R_plus_3r: round(R + 3 * r), R_plus_rho: round(R + rho) }
        : null,
      unger: {
        dottedRadii: dotRadii.map((v: number) => round(v)),
        OP: round(OPQ[0]), OQ: round(OPQ[1]),
        dotsPassThroughPandQ: dotsHitPQ,
      },
    },
    savedMatchesCore,
    differences,
    formulasAgree,
    note: savedMatchesCore
      ? `${N} circles of radius ${round(r)} have dashed radius ${round(rho)}; the tangent chord PQ = ${round(chord)} is given by all three formulas (angle, radii and dashed radius), and for N = 3 by R + 3r = R + rho. ${C.describe(built)}`
      : "The saved numbers do not match the core's geometry for this N and O; the differences are listed in `differences`.",
  };
}
