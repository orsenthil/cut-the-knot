/*
 * run_game_logic actions and saved-position reader for Fagnano IV.
 *
 * The real core is fagnano-iv/fagnano-iv-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the applet's 400 x 250 canvas, y down.
 *
 * Izvolsky's solution of Fagnano's problem does not unfold anything. Joining
 * the circumcenter O to P on BC, Q on CA and R on AB splits ABC into three
 * quadrilaterals; each has area at most its inner side times the circumradius
 * r / 2, so perimeter(PQR) >= 2 area(ABC) / r. Nagel's theorem makes the sides
 * of the orthic triangle perpendicular to OA, OB and OC, so an acute triangle
 * reaches equality at its three altitude feet, and that is the only inscribed
 * triangle that does. For an obtuse triangle the feet leave the sides and the
 * orthic triangle is not inscribed, so there is a strict gap. This is the
 * original Fagnano applet's fourth page and a demo: no win, no loss. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt;
  tP: number; tQ: number; tR: number;
  showNames: boolean; showHint: boolean;
};
type Compute = {
  A: Pt; B: Pt; C: Pt; P: Pt; Q: Pt; R: Pt; O: Pt;
  r: number; Ha: Pt; Hb: Pt; Hc: Pt;
  normals: [Pt, Pt][];
  area: number; perimeter: number; bound: number; ratio: number;
  eyesOpen: boolean;
  orthicParams: { tP: number; tQ: number; tR: number };
};
type Core = {
  WIDTH: number; HEIGHT: number; K: number; EPS: number;
  dist(a: Pt, b: Pt): number;
  dot(a: Pt, b: Pt): number;
  sub(a: Pt, b: Pt): Pt;
  cross(a: Pt, b: Pt): number;
  clamp(v: number, lo: number, hi: number): number;
  start(): State;
  move(s: State, name: string, q: Pt): State;
  option(s: State, name: string, value: boolean): State;
  along(t: number, m1: Pt, m2: Pt): Pt;
  compute(s: State): Compute;
  acute(s: State): boolean;
  orthicState(s: State): State;
  describe(s: State, f: Compute): string;
  result(s: State): null;
};

const core = (): Core => cores["fagnano-iv"].FagnanoIvCore as unknown as Core;

const BOUND_NOTE =
  "Izvolsky's bound comes from joining O to P, Q and R: the quadrilaterals OPCQ, OQAR and ORBP fill ABC, and each has area at most its inner side times r / 2, so area(ABC) <= perimeter(PQR) * r / 2. The core measures that perimeter, the area and the circumradius r directly and checks the ratio against 1; equality needs every inner side square to the radius towards the opposite corner.";
const ORTHIC_NOTE =
  "By Nagel's theorem the orthic triangle's sides are perpendicular to OA, OB and OC, so all three area inequalities become equalities; the core moves P, Q and R onto the altitude feet and checks those three dot products and the ratio 2 area / r against the perimeter.";
const OBTUSE_CAVEAT =
  "For an obtuse triangle the circumcenter and some altitude feet fall outside the sides, so the orthic triangle is not inscribed: the core's clamped feet leave a clear gap above the bound and the quadrilateral area step can fail. In a right triangle the orthic triangle collapses to a segment, so the uniqueness of equality is a claim about acute triangles only.";
const NOT_THE_SIBLINGS =
  "Fagnano IV is Izvolsky's circumcenter-and-bound proof; the original Fagnano page uses Schwarz's five reflections and Fejér's two, while Fagnano III is Samelson's rolling proof. Those are different pages and are not drawn here.";

/** Printable numbers: round what we show, but keep non-finite values JSON-safe. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Pt | null | undefined): { x: number | null; y: number | null } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;

/** A point from the tutor's [x, y] or the page's saved { x, y }. */
function readPointRaw(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}
function readPoint(args: Json, key: string, fallback: Pt): Pt {
  const raw = args[key];
  return raw === undefined || raw === null ? { ...fallback } : readPointRaw(raw, key);
}

/** A side fraction in [0, 1]; absent means keep the opening/saved value. */
function readT(args: Json, key: string, fallback: number, C?: Core): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a number in [0, 1], got ${JSON.stringify(raw)}`);
  return C ? C.clamp(n, 0, 1) : Math.max(0, Math.min(1, n));
}
function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean`);
  return v;
}

/** Largest side of ABC, the scale for every geometric tolerance. */
function scaleOf(C: Core, s: State): number {
  return Math.max(1, C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A));
}

/**
 * Start from the applet's opening figure, drag any supplied corners through
 * the core's own board clamp, then place each side dot at its fraction t or at
 * an explicit point, also through the core's move/projection rule.
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
    { name: "P", tKey: "tP", fallback: s.tP, u: s.B, v: s.C },
    { name: "Q", tKey: "tQ", fallback: s.tQ, u: s.C, v: s.A },
    { name: "R", tKey: "tR", fallback: s.tR, u: s.A, v: s.B },
  ];
  for (const d of sides) {
    const explicit = args[d.name];
    if (explicit !== undefined && explicit !== null) s = C.move(s, d.name, readPointRaw(explicit, d.name));
    else s = C.move(s, d.name, C.along(readT(args, d.tKey, d.fallback, C), d.u, d.v));
  }
  s = C.option(s, "showNames", readBool(args, "showNames", s.showNames));
  s = C.option(s, "showHint", readBool(args, "showHint", s.showHint));
  return s;
}

function live(C: Core, args: Json) {
  const s = buildState(C, args);
  const f = C.compute(s);
  if (!Number.isFinite(f.r) || f.r <= 0 || !Number.isFinite(f.area) || f.area <= 1e-9) {
    throw new Error(
      "A, B and C must form a proper, non-collinear triangle on the page's " +
      `${C.WIDTH} x ${C.HEIGHT} board; the circumcircle and the bound are not defined for a collapsed triangle.`,
    );
  }
  return { s, f, scale: scaleOf(C, s) };
}

/** Acute / right / obtuse from the corner dot products, plus the core's own test. */
function triangleKind(C: Core, s: State, scale: number) {
  const atA = C.dot(C.sub(s.B, s.A), C.sub(s.C, s.A));
  const atB = C.dot(C.sub(s.A, s.B), C.sub(s.C, s.B));
  const atC = C.dot(C.sub(s.A, s.C), C.sub(s.B, s.C));
  const tol = 1e-9 * scale * scale;
  const kind: "acute" | "right" | "obtuse" =
    atA < -tol || atB < -tol || atC < -tol ? "obtuse"
      : atA <= tol || atB <= tol || atC <= tol ? "right" : "acute";
  return {
    kind,
    acutePerCore: C.acute(s),
    cornerDotProducts: { atA: sig(atA), atB: sig(atB), atC: sig(atC) },
  };
}

/**
 * Snap P, Q, R to the altitude feet with the core's orthicState and measure
 * the equality, Nagel's three perpendicularities and (for acute triangles)
 * the strict gap when one dot is nudged off its foot.
 */
function orthicReading(C: Core, s: State, f: Compute, scale: number) {
  const os = C.orthicState(s);
  const of = C.compute(os);
  const dQR = C.dot(C.sub(of.R, of.Q), C.sub(of.A, of.O));
  const dRP = C.dot(C.sub(of.P, of.R), C.sub(of.B, of.O));
  const dPQ = C.dot(C.sub(of.Q, of.P), C.sub(of.C, of.O));
  const dotTol = 1e-6 * scale * scale;
  const acute = C.acute(os);

  const probes = [];
  if (acute) {
    for (const key of ["tP", "tQ", "tR"] as const) {
      const t = os[key];
      const d = Math.min(0.01, t / 2, (1 - t) / 2);
      for (const dir of [-1, 1]) {
        const pf = C.compute({ ...os, [key]: t + dir * d });
        probes.push({
          parameter: key,
          offset: r6(dir * d),
          ratio: r6(pf.ratio),
          strictlyAboveOne: pf.ratio > 1 + 1e-9,
        });
      }
    }
  }

  return {
    altitudeFeet: { Ha: pt(f.Ha), Hb: pt(f.Hb), Hc: pt(f.Hc) },
    parameters: {
      tP: r6(f.orthicParams.tP), tQ: r6(f.orthicParams.tQ), tR: r6(f.orthicParams.tR),
    },
    P: pt(of.P), Q: pt(of.Q), R: pt(of.R),
    perimeter: r6(of.perimeter), bound: r6(of.bound), ratio: r6(of.ratio),
    eyesOpen: of.eyesOpen,
    acute,
    equality: {
      holds: acute && Number.isFinite(of.ratio) && Math.abs(of.ratio - 1) <= 1e-6,
      nagel: {
        QRdotOA: sig(dQR), RPdotOB: sig(dRP), PQdotOC: sig(dPQ),
        allPerpendicular: Math.abs(dQR) <= dotTol && Math.abs(dRP) <= dotTol && Math.abs(dPQ) <= dotTol,
      },
    },
    uniqueness: acute
      ? { applicable: true, probes, allStrictlyAboveOne: probes.every((p) => p.strictlyAboveOne) }
      : { applicable: false, reason: "The altitude feet are not all on the sides, so the acute-triangle uniqueness claim does not apply." },
  };
}

export function actions(): GameActions {
  return {
    perimeter_bound: {
      describe:
        "For triangle ABC on the applet's 400 x 250 board (y down), with corners A, B, C as [x, y] or { x, y } and P on BC, Q on CA, R on AB set by fractions tP, tQ, tR in [0, 1] or by explicit points, report the area, circumcenter O and circumradius r, the inscribed triangle's perimeter, and Izvolsky's bound 2 area / r with the ratio perimeter / bound. Also reports the orthic triangle and its equality case, notes acute/right/obtuse and distinguishes Fagnano, Fagnano III and Fagnano IV; a collapsed triangle is refused.",
      args: '{"A":[95.75,31.25],"B":[31.25,218.75],"C":[337.5,187.5],"tP":0.4,"tQ":0.2,"tR":0.3}',
      run: (args) => {
        const C = core();
        const { s, f, scale } = live(C, args);
        const tri = triangleKind(C, s, scale);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), ...tri },
          circumcircle: { O: pt(f.O), r: r6(f.r) },
          area: r6(f.area),
          inscribed: {
            P: pt(f.P), Q: pt(f.Q), R: pt(f.R),
            parameters: { tP: r6(s.tP), tQ: r6(s.tQ), tR: r6(s.tR) },
            perimeter: r6(f.perimeter),
          },
          bound: {
            value: r6(f.bound), ratio: r6(f.ratio),
            meetsBound: Number.isFinite(f.ratio) && f.ratio >= 1 - 1e-7,
          },
          orthic: orthicReading(C, s, f, scale),
          options: { showNames: s.showNames, showHint: s.showHint },
          status: C.describe(s, f),
          note:
            BOUND_NOTE + " " + ORTHIC_NOTE + " " +
            (tri.kind === "acute"
              ? "This triangle is acute, so the orthic triangle is inscribed and attains the bound. "
              : `This triangle is ${tri.kind}, so ${OBTUSE_CAVEAT} `) +
            NOT_THE_SIBLINGS,
        };
      },
    },

    orthic_equality: {
      describe:
        "For triangle ABC on the same board (corners A, B, C as [x, y] or { x, y }; omit any to keep the opening triangle), move P, Q and R onto the three altitude feet with the core's orthicState and report the resulting perimeter against 2 area / r. Checks Nagel's three perpendicularities QR to OA, RP to OB and PQ to OC, whether equality holds only for an acute triangle, and probes a small nudge of each side dot to support uniqueness; the obtuse caveat is noted.",
      args: '{"A":[95.75,31.25],"B":[31.25,218.75],"C":[337.5,187.5]}',
      run: (args) => {
        const C = core();
        const { s, f, scale } = live(C, args);
        const tri = triangleKind(C, s, scale);
        const orthic = orthicReading(C, s, f, scale);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), ...tri },
          circumcircle: { O: pt(f.O), r: r6(f.r) },
          area: r6(f.area),
          orthic,
          comparison: {
            bound: r6(f.bound),
            currentPerimeter: r6(f.perimeter),
            orthicPerimeter: orthic.perimeter,
            orthicMeetsBound: orthic.equality.holds,
            currentMeetsBound: Number.isFinite(f.ratio) && f.ratio >= 1 - 1e-7,
          },
          status: C.describe(C.orthicState(s), C.compute(C.orthicState(s))),
          note:
            ORTHIC_NOTE + " " + BOUND_NOTE + " " +
            (orthic.acute
              ? "This triangle is acute, so the orthic feet lie on the sides and equality is attained; nudging any one dot off its foot makes the ratio strictly exceed 1. "
              : `This triangle is ${tri.kind}, so the altitude feet are clamped to the sides and ${OBTUSE_CAVEAT} `) +
            NOT_THE_SIBLINGS,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved plus a fresh core reading of the figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Fagnano IV state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Fagnano IV position must be an object");
  }
  const C = core();
  const seed = C.start();
  const s: State = {
    A: readPoint(state, "A", seed.A),
    B: readPoint(state, "B", seed.B),
    C: readPoint(state, "C", seed.C),
    tP: readT(state, "tP", seed.tP, C),
    tQ: readT(state, "tQ", seed.tQ, C),
    tR: readT(state, "tR", seed.tR, C),
    showNames: readBool(state, "showNames", seed.showNames),
    showHint: readBool(state, "showHint", seed.showHint),
  };
  const f = C.compute(s);
  if (!Number.isFinite(f.r) || f.r <= 0 || !Number.isFinite(f.area) || f.area <= 1e-9) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note:
        "The saved corners are collinear or coincident, so the core cannot find a circumcircle or a bound; drag a corner apart on the page and look again. " +
        NOT_THE_SIBLINGS,
    };
  }
  const scale = scaleOf(C, s);
  const tri = triangleKind(C, s, scale);
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: true,
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), ...tri },
    circumcircle: { O: pt(f.O), r: r6(f.r) },
    area: r6(f.area),
    inscribed: {
      P: pt(f.P), Q: pt(f.Q), R: pt(f.R),
      parameters: { tP: r6(s.tP), tQ: r6(s.tQ), tR: r6(s.tR) },
      perimeter: r6(f.perimeter),
    },
    bound: {
      value: r6(f.bound), ratio: r6(f.ratio),
      meetsBound: Number.isFinite(f.ratio) && f.ratio >= 1 - 1e-7,
    },
    orthic: orthicReading(C, s, f, scale),
    status: C.describe(s, f),
    note:
      "Track.state saved the three corners, the three side fractions tP, tQ, tR and the two checkbox flags showNames and showHint; the page does not save P, Q, R, the circumcircle or the altitude feet. The real core rebuilds them from those fields: the perimeter is " +
      r6(f.perimeter) + " against the bound 2 area / r = " + r6(f.bound) + ", a ratio of " + r6(f.ratio) + ". " +
      BOUND_NOTE + " " + ORTHIC_NOTE + " " +
      (tri.kind === "acute"
        ? "This triangle is acute, so the orthic triangle is inscribed and attains the bound. "
        : `This triangle is ${tri.kind}, so ${OBTUSE_CAVEAT} `) +
      NOT_THE_SIBLINGS + " This page is a demo with no win or loss; the tracker records exploration.",
  };
}
