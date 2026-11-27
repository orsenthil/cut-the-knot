/*
 * run_game_logic actions and saved-position reader for Fagnano's problem.
 *
 * The real core is fagnano/fagnano-core.js, copied into src/generated/cores/
 * at build time; every number reported here is measured by it. Coordinates
 * are board units of the applet's 500 x 400 canvas, y down. See _shared.ts
 * for the shape of a game module.
 *
 * Given a triangle ABC, choose P on BC, Q on CA and R on AB. Of all inscribed
 * triangles PQR the orthic one (the three altitude feet) has the smallest
 * perimeter when ABC is acute. Schwarz's proof rolls ABC five times about
 * CA, BC, AB, CA, BC: the three sides of PQR reappear as six red pieces of one
 * broken line, straightening into a segment of length twice the orthic
 * perimeter exactly when PQR is orthic. Fejér's two reflections of P in CA
 * and AB give P'P'' = 2 AP sin(A); for a fixed P the shortest broken path is
 * that segment, so AP must be an altitude. For a right or obtuse triangle no
 * proper inscribed triangle reaches the infimum 2 x (shortest altitude): it
 * is approached as a vertex of PQR collapses onto a corner of ABC.
 *
 * This is the original Fagnano applet. Fagnano III (Samelson's own solution)
 * and Fagnano IV (Izvolsky's circumcenter and 2 Area / R bound) are different
 * pages and are not drawn here. It is an illustration: no win, no loss.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Orthic = { P: Pt; Q: Pt; R: Pt };
type Fejer = {
  prime: Pt; second: Pt; angle: number; base: number; ap: number; angleA: number;
};
type ChainTri = {
  A: Pt; B: Pt; C: Pt; P: Pt; Q: Pt; R: Pt; type: number;
};
type State = {
  A: Pt; B: Pt; C: Pt; P: Pt; Q: Pt; R: Pt;
  tP: number; tQ: number; tR: number;
  showNames: boolean; showAltitudes: boolean;
};
type Computed = {
  chain: ChainTri[];
  path: [Pt, Pt][];
  perimeter: number;
  orthic: Orthic;
  orthicPerimeter: number;
  foldedLength: number;
  bend: number;
  finalAB: Pt;
  initialAB: Pt;
  fejer: Fejer;
};
type Core = {
  WIDTH: number; HEIGHT: number; EPS: number;
  start(): State;
  option(s: State, name: string, value: boolean): State;
  move(s: State, name: string, q: Pt | null): State;
  setSide(s: State, name: string, q: Pt | null): State;
  foot(p: Pt, a: Pt, b: Pt): Pt;
  dist(a: Pt, b: Pt): number;
  sub(a: Pt, b: Pt): Pt;
  cross(a: Pt, b: Pt): number;
  dot(a: Pt, b: Pt): number;
  lerp(a: Pt, b: Pt, t: number): Pt;
  clamp(v: number, lo: number, hi: number): number;
  sideParameter(p: Pt, u: Pt, v: Pt): number;
  perimeter(p: Pt, q: Pt, r: Pt): number;
  orthic(s: State): Orthic;
  orthicState(s: State): State;
  fejer(s: State, P: Pt): Fejer;
  compute(s: State): Computed;
  describe(s: State): string;
};

const core = (): Core => cores["fagnano"].FagnanoCore as unknown as Core;

const OBTUSE_CAVEAT =
  "For a right or obtuse triangle the altitude feet fall outside the sides, so the acute-triangle answer does not apply: no proper inscribed triangle attains the minimum. Perimeters only approach twice the shortest altitude as one of P, Q, R collapses onto a corner.";
const NOT_THE_SIBLING =
  "This is the original Fagnano applet and its Schwarz/Fejér reflection proof. Fagnano III (Samelson's separate solution) and Fagnano IV (Izvolsky's circumcenter and 2 Area / R bound) are different pages and are not drawn here.";
const QUIRK =
  "The Java's reflection routine takes a shortcut when a mirror side is within one board unit of vertical; the core keeps it, so a measured folded length can drift a little from the ideal straight segment, while the page's claims are about true reflections.";

/** Board numbers as plain JSON numbers, rounded or null when not finite. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const len = (p: Pt): number => Math.hypot(p.x, p.y);
const nearLen = (a: number, b: number, scale: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(scale, 1);
const nearPoint = (a: Pt, b: Pt, scale: number, tol = 1e-7): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y) <= tol * Math.max(scale, 1);

/** Largest side of ABC, used to scale every geometric tolerance. */
function scaleOf(C: Core, s: State): number {
  return Math.max(1, C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A));
}
function twiceArea(C: Core, s: State): number {
  return Math.abs(C.cross(C.sub(s.B, s.A), C.sub(s.C, s.A)));
}

/** Accept the page's { x, y } and the tutor's [x, y] alike; null = not given. */
function readPoint(args: Json, key: string, fallback: Pt | null): Pt | null {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback ? { ...fallback } : null;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${key}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A side fraction in [0, 1]; absent means keep the applet's own value. */
function readT(args: Json, key: string): number | undefined {
  const raw = args[key];
  if (raw === undefined || raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`argument "${key}" must be a number in [0, 1], got ${JSON.stringify(raw)}`);
  }
  return n;
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean`);
  return v;
}

/**
 * A real core state from the tutor's optional corners and side points. Moving
 * a corner runs the applet's CheckMidPoint rule (it projects the opposite dot
 * onto the new side), exactly as the page's drag handler does; a tP/tQ/tR or
 * an explicit P/Q/R then overrides that dot.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points, side fractions and options");
  }
  let s = C.start();
  for (const name of ["A", "B", "C"] as const) {
    s = C.move(s, name, readPoint(args, name, s[name]));
  }
  const sides = [
    { name: "P", tKey: "tP", u: s.B, v: s.C },
    { name: "Q", tKey: "tQ", u: s.C, v: s.A },
    { name: "R", tKey: "tR", u: s.A, v: s.B },
  ];
  for (const d of sides) {
    const explicit = readPoint(args, d.name, null);
    const t = readT(args, d.tKey);
    if (explicit) s = C.setSide(s, d.name, explicit);
    else if (t !== undefined) s = C.setSide(s, d.name, C.lerp(d.u, d.v, t));
  }
  s = C.option(s, "showNames", readBool(args, "showNames", s.showNames));
  s = C.option(s, "showAltitudes", readBool(args, "showAltitudes", s.showAltitudes));
  return s;
}

function live(C: Core, args: Json) {
  const s = buildState(C, args);
  const f = C.compute(s);
  const scale = scaleOf(C, s);
  if (twiceArea(C, s) <= 1e-9 * scale * scale || !Number.isFinite(f.foldedLength) ||
      !Number.isFinite(f.perimeter) || !Number.isFinite(f.bend)) {
    throw new Error(
      "A, B and C must form a proper, non-degenerate triangle on the page's " +
      `${C.WIDTH} x ${C.HEIGHT} board; the core cannot fold a collapsed triangle.`,
    );
  }
  return { s, f, scale };
}

/** Acute / right / obtuse from the sign of the dot product at each corner. */
function triangleKind(C: Core, s: State) {
  const atA = C.dot(C.sub(s.B, s.A), C.sub(s.C, s.A));
  const atB = C.dot(C.sub(s.A, s.B), C.sub(s.C, s.B));
  const atC = C.dot(C.sub(s.A, s.C), C.sub(s.B, s.C));
  const tol = 1e-9 * scaleOf(C, s) ** 2;
  const kind: "acute" | "right" | "obtuse" =
    atA < -tol || atB < -tol || atC < -tol ? "obtuse"
      : atA <= tol || atB <= tol || atC <= tol ? "right" : "acute";
  const altitudes = [
    C.dist(s.A, C.foot(s.A, s.B, s.C)),
    C.dist(s.B, C.foot(s.B, s.C, s.A)),
    C.dist(s.C, C.foot(s.C, s.A, s.B)),
  ];
  const shortest = Math.min(...altitudes);
  return {
    kind,
    cornerDotProducts: { atA: sig(atA), atB: sig(atB), atC: sig(atC) },
    altitudes: altitudes.map(r6),
    shortestAltitude: r6(shortest),
    infimumPerimeter: r6(2 * shortest),
  };
}

/** The three altitude feet and the least perimeter of an acute triangle. */
function orthicReading(f: Computed) {
  return {
    P: pt(f.orthic.P), Q: pt(f.orthic.Q), R: pt(f.orthic.R),
    perimeter: r6(f.orthicPerimeter),
  };
}

/** The six reflected copies' red pieces, their total length and straightness. */
function unfoldingReading(C: Core, f: Computed) {
  const pieces = f.path.map((seg, i) => ({
    index: i + 1, from: pt(seg[0]), to: pt(seg[1]), length: r6(C.dist(seg[0], seg[1])),
  }));
  const la = len(f.finalAB), lb = len(f.initialAB);
  const sine = la > 0 && lb > 0 ? Math.abs(C.cross(f.finalAB, f.initialAB)) / (la * lb) : NaN;
  const cosine = la > 0 && lb > 0 ? C.dot(f.finalAB, f.initialAB) / (la * lb) : NaN;
  return {
    copies: f.chain.length,
    pieces,
    foldedLength: r6(f.foldedLength),
    largestBendSine: sig(f.bend),
    straight: f.bend < 1e-7,
    twiceOrthicPerimeter: r6(2 * f.orthicPerimeter),
    finalAB: pt(f.finalAB), initialAB: pt(f.initialAB),
    parallelSine: sig(sine), directionCosine: r6(cosine),
    finalParallelSameDirection: Number.isFinite(sine) && sine < 1e-7 && cosine > 0.999,
  };
}

/** Fejér's P', P'' and the identity P'P'' = 2 AP sin(A) at a given P. */
function fejerReading(C: Core, s: State, P: Pt, scale: number) {
  const f = C.fejer(s, P);
  const apPrime = C.dist(s.A, f.prime);
  const apSecond = C.dist(s.A, f.second);
  const expected = 2 * f.ap * Math.sin(f.angleA);
  return {
    A: pt(s.A), P: pt(P), prime: pt(f.prime), second: pt(f.second),
    angleA: { radians: r6(f.angleA), degrees: r6(f.angleA * 180 / Math.PI) },
    anglePAP: { radians: r6(f.angle), degrees: r6(f.angle * 180 / Math.PI) },
    AP: r6(f.ap), APprime: r6(apPrime), APsecond: r6(apSecond),
    base: r6(f.base), expectedBase: r6(expected),
    checks: {
      angleIsTwiceA: Math.abs(f.angle - 2 * f.angleA) < 1e-7,
      reflectionsKeepAP: nearLen(apPrime, f.ap, scale) && nearLen(apSecond, f.ap, scale),
      baseIs2APsinA: nearLen(f.base, expected, scale),
    },
  };
}

/** Which of the saved dots sit on the corresponding altitude foot. */
function footFlags(C: Core, s: State, o: Orthic, scale: number) {
  return {
    P: nearPoint(s.P, o.P, scale),
    Q: nearPoint(s.Q, o.Q, scale),
    R: nearPoint(s.R, o.R, scale),
  };
}

export function actions(): GameActions {
  return {
    orthic_and_unfolding: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the applet's 500 x 400 board, y down; omit any to keep the opening triangle), report the altitude feet, the orthic triangle's perimeter (the least perimeter of an inscribed triangle when ABC is acute), the current inscribed triangle's perimeter and the five-reflection Schwarz chain: six red pieces, the folded length, its bend (0 means one straight segment), and whether the final AB is parallel and equally directed to the first. Pass tP, tQ, tR in [0, 1] or explicit P, Q, R points to choose the inscribed triangle; omitting them lets the applet's drag rule put all three dots on the altitude feet. The two checkbox flags showNames and showAltitudes may be given as booleans. Also reports the right/obtuse caveat with the infimum 2 x shortest altitude, and notes that Fagnano III and IV are different pages. A degenerate triangle is refused.",
      args: '{"A":[104,200],"B":[50,350],"C":[200,300],"tP":0.25,"tQ":0.65,"tR":0.6}',
      run: (args) => {
        const C = core();
        const { s, f, scale } = live(C, args);
        const tri = triangleKind(C, s);
        const unfolded = unfoldingReading(C, f);
        // The same figure with the three dots moved onto the altitude feet:
        // here the six pieces must become one straight doubled segment.
        const os = C.orthicState(s);
        const of = C.compute(os);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), ...tri },
          inscribed: {
            P: pt(s.P), Q: pt(s.Q), R: pt(s.R),
            parameters: { tP: r6(s.tP), tQ: r6(s.tQ), tR: r6(s.tR) },
            perimeter: r6(f.perimeter),
            noLessThanOrthic: f.perimeter > f.orthicPerimeter - 1e-7 * scale,
            marginOverOrthic: r6(f.perimeter - f.orthicPerimeter),
          },
          orthic: orthicReading(f),
          unfolding: unfolded,
          orthicUnfolding: {
            perimeter: r6(of.perimeter),
            foldedLength: r6(of.foldedLength),
            largestBendSine: sig(of.bend),
            straight: of.bend < 1e-7,
            foldedEqualsTwiceOrthic: nearLen(of.foldedLength, 2 * of.orthicPerimeter, scale),
          },
          options: { showNames: s.showNames, showAltitudes: s.showAltitudes },
          status: C.describe(s),
          note:
            "The altitude feet form the orthic triangle; for an acute triangle its perimeter is the smallest any inscribed triangle can have, and the current perimeter is no less. Reflecting ABC five times about CA, BC, AB, CA, BC turns the three sides of PQR into six red pieces of one broken line: the final AB returns parallel and equally directed, and when PQR is orthic the pieces form a single straight segment of length twice the orthic perimeter. " +
            (tri.kind === "acute"
              ? "This triangle is acute, so that straight segment is the true minimum. "
              : `This triangle is ${tri.kind}, so ${OBTUSE_CAVEAT} `) +
            QUIRK + " " + NOT_THE_SIBLING,
        };
      },
    },

    fejer_reflections: {
      describe:
        "For triangle A, B, C ([x, y] or { x, y }; defaults as in orthic_and_unfolding) and a point P on BC given as a point P or a fraction tP in [0, 1], reflect P in CA and AB to get P' and P''. Report P'P'' (the shortest broken path from P' through Q, R to P''), AP, the angle P'AP'' versus 2A, and the checks AP' = AP'' = AP and P'P'' = 2 AP sin(A). Also compare the base at the chosen P with the base when P is the altitude foot (the orthic perimeter), showing why AP must be an altitude to minimize. Angles are in radians and degrees; the right/obtuse caveat and the Fagnano III/IV distinction are noted. A degenerate triangle is refused.",
      args: '{"A":[104,200],"B":[50,350],"C":[200,300],"tP":0.6}',
      run: (args) => {
        const C = core();
        const { s, scale } = live(C, args);
        const tri = triangleKind(C, s);
        const fj = fejerReading(C, s, s.P, scale);
        const f = C.compute(s);
        const foot = C.orthic(s).P;
        const chosenBase = C.fejer(s, s.P).base;
        const footBase = C.fejer(s, foot).base;
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), kind: tri.kind },
          fejer: fj,
          minimization: {
            foot: pt(foot),
            baseAtChosenP: r6(chosenBase),
            baseAtAltitudeFoot: r6(footBase),
            footIsBetter: footBase <= chosenBase + 1e-7 * scale,
            orthicPerimeter: r6(f.orthicPerimeter),
            footBaseEqualsOrthicPerimeter: nearLen(footBase, f.orthicPerimeter, scale),
          },
          note:
            "Reflecting P in CA and AB keeps AP' = AP'' = AP and makes angle P'AP'' = 2A, so the base P'P'' = 2 AP sin(A) is smallest when AP is the altitude from A; with Q and R on the straight segment P'P'' that gives the orthic triangle and the least broken path. " +
            (tri.kind === "acute"
              ? "Here that base at the altitude foot equals the orthic perimeter. "
              : `Here the triangle is ${tri.kind}, so ${OBTUSE_CAVEAT} `) +
            QUIRK + " " + NOT_THE_SIBLING,
        };
      },
    },
  };
}

/** A real state built from the saved fields without re-projecting any dot. */
function savedState(C: Core, state: Json): State {
  const seed = C.start();
  const A = readPoint(state, "A", seed.A)!;
  const B = readPoint(state, "B", seed.B)!;
  const Cc = readPoint(state, "C", seed.C)!;
  const P = readPoint(state, "P", seed.P)!;
  const Q = readPoint(state, "Q", seed.Q)!;
  const R = readPoint(state, "R", seed.R)!;
  const savedT = (key: string, derived: number): number => {
    const raw = state[key];
    const n = Number(raw);
    return raw !== undefined && raw !== null && Number.isFinite(n) ? C.clamp(n, 0, 1) : derived;
  };
  return {
    A, B, C: Cc, P, Q, R,
    tP: savedT("tP", C.sideParameter(P, B, Cc)),
    tQ: savedT("tQ", C.sideParameter(Q, Cc, A)),
    tR: savedT("tR", C.sideParameter(R, A, B)),
    showNames: readBool(state, "showNames", seed.showNames),
    showAltitudes: readBool(state, "showAltitudes", seed.showAltitudes),
  };
}

/** Echo the fields Track.state saved plus a fresh core reading of that figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Fagnano state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Fagnano position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const scale = scaleOf(C, s);
  const f = C.compute(s);
  if (twiceArea(C, s) <= 1e-9 * scale * scale || !Number.isFinite(f.foldedLength) ||
      !Number.isFinite(f.perimeter)) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note:
        "The saved corners are collinear or coincident, so the core cannot fold an inscribed triangle. Drag a corner apart on the page and look again. " +
        NOT_THE_SIBLING,
    };
  }
  const tri = triangleKind(C, s);
  const o = C.orthic(s);
  const fj = fejerReading(C, s, s.P, scale);
  const onFeet = footFlags(C, s, o, scale);
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: true,
    triangle: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C),
      kind: tri.kind,
      shortestAltitude: tri.shortestAltitude,
      infimumPerimeter: tri.infimumPerimeter,
    },
    inscribed: {
      P: pt(s.P), Q: pt(s.Q), R: pt(s.R),
      parameters: { tP: r6(s.tP), tQ: r6(s.tQ), tR: r6(s.tR) },
      perimeter: r6(f.perimeter),
    },
    orthic: {
      ...orthicReading(f),
      onAltitudeFeet: onFeet,
    },
    unfolding: unfoldingReading(C, f),
    comparison: {
      marginOverOrthic: r6(f.perimeter - f.orthicPerimeter),
      currentIsOrthic: onFeet.P && onFeet.Q && onFeet.R,
      orthicIsMinimum: tri.kind === "acute" && f.perimeter > f.orthicPerimeter - 1e-7 * scale,
    },
    fejer: { ...fj, baseAtAltitudeFoot: r6(C.fejer(s, o.P).base) },
    status: C.describe(s),
    note:
      "Track.state saved the six draggable points, the three side fractions and the two checkbox flags; the page does not save the reflected chain. The real core rebuilds the altitude feet, the six red pieces, the folded length and Fejér's reflections from those points: " +
      `the perimeter is ${r6(f.perimeter)} against the orthic ${r6(f.orthicPerimeter)}, and the largest bend sine is ${sig(f.bend)}. ` +
      (tri.kind === "acute"
        ? "For this acute triangle the orthic perimeter is the least possible. "
        : `This triangle is ${tri.kind}, so ${OBTUSE_CAVEAT} `) +
      QUIRK + " " + NOT_THE_SIBLING +
      " This page is an illustration with no win or loss; the tracker records exploration.",
  };
}
