/*
 * run_game_logic actions and saved-position reader for Huygens Pyth.
 *
 * The real core is huygens-pyth/huygens-pyth-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are applet canvas pixels of the 500 x 450 view, y down. The page
 * saves exactly the core's state, { A, B, C, angleA (radians), showNames,
 * showHint }, with Track.state(state).
 *
 * The figure is Huygens' 1657 "Bride's Chair" strip proof. On right triangle
 * ABC (right angle at C), GA is extended to P with AP = AG = AC and BD to N
 * with BN = BD = BC. Triangle ABP is half the square on AC, while ANB and the
 * congruent triangle KPS are half the square on BC. Since strip ABML is a
 * parallelogram on the same base and parallels as ABP, Euclid I.41 makes it
 * twice ABP = AC²; likewise KMLS = 2·KPS = BC². The two strips fill the square
 * on AB, so AC² + BC² = AB².
 *
 * Two lines of the original page slip: it writes AP = AD = AC (D is on the
 * other square; the letter should be G), and it writes ∠KPS where the angle
 * equal to ∠ABN is ∠KSP. The page also calls the strips rectangles, although
 * after AB is turned they are parallelograms — exactly what I.41 covers.
 * This is a demo, so there is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  A: Point; B: Point; C: Point;
  angleA: number; showNames: boolean; showHint: boolean;
};
type Lengths = {
  AC: number; BC: number; AB: number; AP: number; AG: number; AD: number;
  BN: number; BD: number; AS: number; PS: number; KS: number;
};
type Angles = { BAC: number; ABC: number; ASP: number; KSP: number; ABN: number; KPS: number };
type Areas = {
  ABP: number; ANB: number; KPS: number; ABC: number;
  ABML: number; KMLS: number; squareAC: number; squareBC: number; squareAB: number;
};
type Stats = {
  A: Point; B: Point; C: Point;
  Ap: Point; Aq: Point; Bp: Point; Bq: Point; Cp: Point; Cq: Point;
  P: Point; N: Point; L: Point; M: Point;
  lengths: Lengths; angles: Angles; areas: Areas; rightAngleDot: number;
};
interface Core {
  WIDTH: number; HEIGHT: number; ANGLE_START: number; OPTION_KEYS: string[];
  angle(p: Point, q: Point, r: Point): number;
  dist(p: Point, q: Point): number;
  orientation(a: Point, b: Point, c: Point): number;
  start(options?: Json): State;
  stats(s: State): Stats;
  computeC(a: Point, b: Point, angleA: number): Point;
}

const core = (): Core => cores["huygens-pyth"].HuygensPythCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const n6 = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const deg = (v: number): number | null => (Number.isFinite(v) ? r6(v * 180 / Math.PI) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const finitePoint = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

/** A board point as [x, y] or { x, y }, with an optional default. */
function readPoint(raw: unknown, label: string, fallback?: Point): Point {
  if ((raw === undefined || raw === null) && fallback) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** Degrees strictly inside (0, 90): at 0 or 90 the constructed C collapses. */
function readAngleDeg(args: Json, key: string, fallback: number): number {
  const v = num(args, key, fallback);
  if (v < 1 || v > 89) {
    throw new Error(`argument "${key}" must be a number of degrees from 1 to 89, got ${JSON.stringify(args[key])}`);
  }
  return v;
}

const makeState = (A: Point, B: Point, C: Point, angleA: number): State => ({
  A, B, C, angleA, showNames: false, showHint: false,
});

/**
 * A real core state: the opening figure when no corners are supplied, three
 * supplied corners, or C rebuilt with the core from A, B and angleDeg.
 */
function readProofState(C: Core, args: Json): { s: State; source: string } {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional A, B, C points and angleDeg");
  }
  const seed = C.start();
  const given = (key: string) => args[key] !== undefined && args[key] !== null;
  if (!given("A") && !given("B") && !given("C")) {
    return { s: seed, source: "opening figure from core.start()" };
  }
  const angleDeg = readAngleDeg(args, "angleDeg", 30);
  const angleA = angleDeg * Math.PI / 180;
  const A = readPoint(args.A, "A", seed.A);
  const B = readPoint(args.B, "B", seed.B);
  if (given("C")) {
    const C3 = readPoint(args.C, "C");
    return {
      s: makeState(A, B, C3, C.angle(A, B, C3)),
      source: "supplied corners A, B, C",
    };
  }
  const C3 = C.computeC(A, B, angleA);
  if (!finitePoint(C3)) {
    throw new Error(`the core could not construct C at angleDeg = ${angleDeg}`);
  }
  return {
    s: makeState(A, B, C3, angleA),
    source: `C rebuilt by the core from A, B at angleDeg = ${angleDeg}`,
  };
}

/** The whole proof reading of one state, measured by the real core. */
function proofReading(C: Core, s: State) {
  const g = C.stats(s);
  const L = g.lengths, A = g.angles, R = g.areas;
  const halfAC = R.squareAC / 2, halfBC = R.squareBC / 2;
  const proper = C.dist(g.A, g.C) > 1e-9 && C.dist(g.B, g.C) > 1e-9;
  return {
    triangle: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C),
      angleAStoredDeg: deg(s.angleA),
      angleAtADeg: deg(A.BAC), angleAtBDeg: deg(A.ABC),
      rightAngleDot: n6(g.rightAngleDot),
      rightAngleAtC: proper && near(g.rightAngleDot, 0),
      orientation: C.orientation(g.A, g.B, g.C),
    },
    sides: { AC: n6(L.AC), BC: n6(L.BC), AB: n6(L.AB) },
    extensions: {
      AP: n6(L.AP), AG: n6(L.AG), AC: n6(L.AC),
      apEqualsAgEqualsAc: near(L.AP, L.AG) && near(L.AG, L.AC),
      BN: n6(L.BN), BD: n6(L.BD), BC: n6(L.BC),
      bnEqualsBdEqualsBc: near(L.BN, L.BD) && near(L.BD, L.BC),
      AD: n6(L.AD), adEqualsAc: near(L.AD, L.AC),
    },
    congruentTriangles: {
      AS: n6(L.AS), AB: n6(L.AB), KS: n6(L.KS),
      asAndKsEqualAb: near(L.AS, L.AB) && near(L.KS, L.AB),
      PS: n6(L.PS), BC: n6(L.BC), psEqualsBc: near(L.PS, L.BC),
      ASPDeg: deg(A.ASP), ABCDeg: deg(A.ABC), aspEqualsAbc: near(A.ASP, A.ABC),
      KSPDeg: deg(A.KSP), ABNDeg: deg(A.ABN), kspEqualsAbn: near(A.KSP, A.ABN),
      KPSDeg: deg(A.KPS), kpsEqualsAbn: near(A.KPS, A.ABN),
    },
    halfAreaTriangles: {
      ABP: n6(R.ABP), halfSquareAC: n6(halfAC), abpHalvesSquareAC: near(R.ABP, halfAC),
      ANB: n6(R.ANB), KPS: n6(R.KPS), halfSquareBC: n6(halfBC),
      anbHalvesSquareBC: near(R.ANB, halfBC), kpsHalvesSquareBC: near(R.KPS, halfBC),
      anbEqualsKps: near(R.ANB, R.KPS),
    },
    strips: {
      ABML: n6(R.ABML), squareAC: n6(R.squareAC), abmlIsSquareAC: near(R.ABML, R.squareAC),
      KMLS: n6(R.KMLS), squareBC: n6(R.squareBC), kmlsIsSquareBC: near(R.KMLS, R.squareBC),
      total: n6(R.ABML + R.KMLS), squareAB: n6(R.squareAB),
      fillSquareAB: near(R.ABML + R.KMLS, R.squareAB),
    },
    pythagorean: {
      AC2: n6(R.squareAC), BC2: n6(R.squareBC), AB2: n6(R.squareAB),
      sum: n6(R.squareAC + R.squareBC), holds: near(R.squareAC + R.squareBC, R.squareAB),
    },
    construction: {
      G: pt(g.Cp), D: pt(g.Cq), K: pt(g.Ap), S: pt(g.Bp),
      P: pt(g.P), N: pt(g.N), L: pt(g.L), M: pt(g.M),
    },
  };
}

/** The three corrections to the wording of the original applet page. */
const SLIPS = {
  adNotAc:
    "The original writes AP = AD = AC: D is the far corner of the square on BC, so AD is not AC. The extension on the square over AC is AP = AG = AC (G = Cp).",
  kspNotKps:
    "The original writes ∠KPS for the angle equal to ∠ABN; the equal angle is ∠KSP, at S in triangle KPS (congruent to ANB).",
  stripsAreParallelograms:
    "The original calls ABML and KMLS rectangles. After AB is turned they are slanted parallelograms, which is just what Euclid I.41 covers.",
};

export function actions(): GameActions {
  return {
    strip_proof: {
      describe:
        "For right triangle ABC and the squares on its three sides, report Huygens' Bride's-Chair strip proof from the real core: AP = AG = AC and BN = BD = BC, triangle ABP is half the square on AC while ANB and the congruent KPS are half the square on BC, and Euclid I.41 makes strips ABML = AC² and KMLS = BC² fill AB². Optional A, B, C are [x, y] or { x, y } board points (omit all three for the opening figure; give A and B alone to rebuild C at angleDeg, 1–89°); the report flags the page's AD-for-AG and ∠KPS-for-∠KSP slips.",
      args: '{ "A": [333.33333333333337, 236.84210526315792], "B": [171.66666666666666, 236.84210526315792], "C": [292.9166666666667, 166.83838512391577] }',
      run: (args) => {
        const C = core();
        const { s, source } = readProofState(C, args);
        const r = proofReading(C, s);
        return {
          source,
          ...r,
          slips: SLIPS,
          note:
            `AP = AG = AC = ${r.sides.AC} and BN = BD = BC = ${r.sides.BC}; ` +
            `ABP = ${r.halfAreaTriangles.ABP} = AC²/2, ANB = KPS = ${r.halfAreaTriangles.KPS} = BC²/2. ` +
            `Euclid I.41 doubles them into strips ABML = ${r.strips.ABML} = AC² and KMLS = ${r.strips.KMLS} = BC², ` +
            `which sum to ${r.strips.total} = AB² = ${r.strips.squareAB}: ` +
            `AC² + BC² = AB² holds here = ${r.pythagorean.holds}. ` +
            `The page's AD = AC and ∠KPS wording slips are flagged above; this is a demo, with no win or loss.`,
        };
      },
    },
    angle_sweep: {
      describe:
        "Rebuild C with the real core at each angleDeg from `from` to `to` in steps of `step` (default 5 to 85 by 10) and report that AC² + BC² = AB², the strips fill the square on AB, and the extension and half-area equalities hold at every angle. Optional A and B are [x, y] or { x, y } board points defaulting to the opening corners; all angles must lie in 1–89° so the right triangle does not collapse.",
      args: '{ "from": 5, "to": 85, "step": 10 }',
      run: (args) => {
        const C = core();
        const seed = C.start();
        const A = readPoint(args.A, "A", seed.A);
        const B = readPoint(args.B, "B", seed.B);
        const from = readAngleDeg(args, "from", 5);
        const to = readAngleDeg(args, "to", 85);
        if (from > to) throw new Error(`"from" (${from}) must not exceed "to" (${to})`);
        const step = num(args, "step", 10);
        if (!Number.isInteger(step) || step < 1 || step > 88) {
          throw new Error(`"step" must be a whole number of degrees from 1 to 88, got ${JSON.stringify(args.step)}`);
        }
        const rows: Json[] = [];
        for (let d = from; d <= to; d += step) {
          const angleA = d * Math.PI / 180;
          const C3 = C.computeC(A, B, angleA);
          if (!finitePoint(C3)) throw new Error(`the core could not construct C at ${d}°`);
          const g = C.stats(makeState(A, B, C3, angleA));
          const L = g.lengths, R = g.areas;
          rows.push({
            angleDeg: d,
            AC2: n6(R.squareAC), BC2: n6(R.squareBC), AB2: n6(R.squareAB),
            rightAngleDot: n6(g.rightAngleDot),
            pythHolds: near(R.squareAC + R.squareBC, R.squareAB),
            stripsFill: near(R.ABML, R.squareAC) && near(R.KMLS, R.squareBC) &&
              near(R.ABML + R.KMLS, R.squareAB),
            halvesMatch: near(R.ABP, R.squareAC / 2) &&
              near(R.ANB, R.squareBC / 2) && near(R.KPS, R.squareBC / 2) &&
              near(R.ANB, R.KPS),
            extensionsMatch: near(L.AP, L.AG) && near(L.AG, L.AC) &&
              near(L.BN, L.BD) && near(L.BD, L.BC),
          });
        }
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          A: pt(A), B: pt(B),
          anglesChecked: rows.length,
          pythHoldsAtEveryAngle: rows.every((r) => r.pythHolds === true),
          stripsFillAtEveryAngle: rows.every((r) => r.stripsFill === true),
          halvesMatchAtEveryAngle: rows.every((r) => r.halvesMatch === true),
          extensionsMatchAtEveryAngle: rows.every((r) => r.extensionsMatch === true),
          samples: rows,
          note:
            `At all ${rows.length} angles the right-angle dot product is 0, so C stays on the circle over AB. ` +
            `The core keeps AC² + BC² = AB², ABML = AC² and KMLS = BC², and AP = AG = AC, BN = BD = BC at every one: ` +
            `moving the corner changes the lengths, not Euclid I.41's area argument. ` +
            `This is a demo, so there is no win or loss.`,
        };
      },
    },
  };
}

/** Echo the picture saved with Track.state and re-measure it with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Huygens Pyth state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Huygens Pyth position must be an object");
  }
  const C = core();
  const A = readPoint(state.A, "saved A");
  const B = readPoint(state.B, "saved B");
  const Cc = readPoint(state.C, "saved C");
  const angleA = num(state, "angleA");
  const s: State = {
    A, B, C: Cc, angleA,
    showNames: state.showNames === true, showHint: state.showHint === true,
  };
  const r = proofReading(C, s);
  const orientation = C.orientation(A, B, Cc);
  const swapped = orientation === 1;
  return {
    ...state,
    stateVersion,
    // The whole plain-data state the page saved with Track.state, unchanged.
    saved: { ...state },
    position: {
      A: pt(A), B: pt(B), C: pt(Cc),
      angleA: n6(angleA), angleADeg: deg(angleA),
      showNames: s.showNames, showHint: s.showHint,
      orientation, swapped,
    },
    reading: r,
    note:
      "Track.state saved the core's whole state: corners A, B, C, angleA in radians and the two display flags. " +
      "The core rebuilds G, D, P, N, K, S, L and M and re-measures the extensions, the half-area triangles, " +
      "the two strips and AC² + BC² = AB² from those three corners. " +
      (swapped
        ? `Orientation +1 means the applet's UpgradePoints has exchanged A and B, so the stored angleA = ${deg(angleA)}° is the angle at B and the measured angle at A is its complement ${r.triangle.angleAtADeg}°. `
        : `Orientation -1 means the corners are in the opening order, so the stored angleA = ${deg(angleA)}° is the measured angle at A. `) +
      `Here AC² + BC² = ${r.pythagorean.sum} = AB² = ${r.pythagorean.AB2} (holds = ${r.pythagorean.holds}); ` +
      `this is a demo, so there is no win or loss.`,
  };
}
