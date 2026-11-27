/*
 * run_game_logic actions and saved-position reader for Fagnano III.
 *
 * Fagnano's problem asks for the smallest triangle inscribed in an acute
 * triangle; the answer is the orthic triangle. This applet draws Hans
 * Samelson's third proof: roll ABC over its sides and a short straight line
 * becomes that answer. Every number below is measured by the real core in
 * fagnano-iii/fagnano-iii-core.js, copied into src/generated/cores/ at build
 * time. The page saves only the four draggable points (A, B, C and a point P
 * on AB) and five checkbox booleans with Track.state; the core rebuilds the
 * rolled copies, the crossing O, the bisector through C, the midpoints M/M'
 * and the orthic feet from them. Coordinates are board units of the 360 x 240
 * view, with y down. This is a demo: there is no win or loss. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Tri = { A: Pt; B: Pt; C: Pt };
type Options = {
  showAltitudes: boolean; showConstruction: boolean; showMap: boolean;
  moreTriangles: boolean; showNames: boolean;
};
type State = {
  A: Pt; B: Pt; C: Pt; P: Pt;
  showAltitudes: boolean; showConstruction: boolean; showMap: boolean;
  moreTriangles: boolean; showNames: boolean;
};
type Compute = {
  t0: Tri; t1: Tri; t2: Tri; t3: Tri; t4: Tri; t5: Tri;
  P: Pt; O: Pt; bisector: Pt; B1: Pt; B2: Pt; M1: Pt; M2: Pt; M3: Pt;
  P2: Pt; P3: Pt; angleC: number; crossing: number;
  orthic: Tri; foldX: Pt; minLength: number;
};
type Images = { q: Pt; r: Pt; leg1: number; leg2: number; base: number };
type Core = {
  WIDTH: number; HEIGHT: number; MARGIN: number; START_T: number; EPS: number;
  dist(p: Pt, q: Pt): number;
  dot(p: Pt, q: Pt): number;
  cross(p: Pt, q: Pt): number;
  sub(p: Pt, q: Pt): Pt;
  len(p: Pt): number;
  available(p: Pt): boolean;
  start(): State;
  move(s: State, name: "A" | "B" | "C" | "P", q: Pt): State;
  option(s: State, name: string, value: boolean): State;
  compute(s: State): Compute;
  images(f: Compute, p: Pt): Images;
  isAcute(s: State): boolean;
  altitude(p: Pt, a: Pt, b: Pt): Pt;
  pointAt(a: Pt, b: Pt, t: number): Pt;
  parameter(a: Pt, b: Pt, p: Pt): number;
  describe(s: State, f: Compute): string;
};

const OPTION_KEYS: (keyof Options)[] = [
  "showAltitudes", "showConstruction", "showMap", "moreTriangles", "showNames",
];

const core = (): Core => cores["fagnano-iii"].FagnanoIIICore as unknown as Core;

/* The core is exact up to floating point and the applet's vertical shortcut;
 * tidy only what we print and keep non-finite points JSON-safe as null. */
const round = (v: number, digits = 6): number | null =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : null;
const pt = (p: Pt | null | undefined): { x: number | null; y: number | null } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;
const deg = (rad: number): number | null => round((rad * 180) / Math.PI, 4);
const tol = 0.05; // board units; check-fagnano-iii.mjs allows a couple of units for the vertical shortcut
const angleTol = 1e-2; // radians; the applet's shortcut costs ~0.006 rad

/** A corner or point, from the tutor's [x, y] or the page's saved { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
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

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/**
 * Start from the applet's opening figure, drag any supplied corners (each
 * drag uses the core's own board clamp and keeps P at the same fraction of
 * AB), then place P either at the parameter t along AB or at a point. The five
 * checkboxes are cosmetic and do not change the geometry.
 */
function buildState(args: Json, C: Core): State {
  let s = C.start();
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  if (args.t !== undefined && args.t !== null) {
    const t = num(args, "t");
    if (t < 0 || t > 1) throw new Error('argument "t" must be between 0 and 1');
    s = C.move(s, "P", C.pointAt(s.A, s.B, t));
  } else if (args.P !== undefined && args.P !== null) {
    s = C.move(s, "P", readPoint(args.P, "P"));
  }
  for (const key of OPTION_KEYS) s = C.option(s, key, readBool(args, key, false));
  return s;
}

/** Perpendicular distance from p to the line through a and b, in board units. */
function lineDistance(C: Core, p: Pt, a: Pt, b: Pt): number {
  const ab = C.sub(b, a);
  const n = C.len(ab);
  return n < 1e-9 ? NaN : Math.abs(C.cross(ab, C.sub(p, a))) / n;
}

const tri = (t: Tri) => ({ A: pt(t.A), B: pt(t.B), C: pt(t.C) });

/** The whole rolling picture, taken straight from one core.compute(). */
function reading(C: Core, s: State) {
  const f = C.compute(s);
  const acute = C.isAcute(s);
  const foot = C.altitude(s.C, s.A, s.B);
  const bisRes = lineDistance(C, s.C, f.O, f.bisector);
  const footRes = C.dist(f.M1, foot);
  const mm = C.sub(f.M2, f.M1);
  const bv = C.sub(f.bisector, f.O);
  const perpRes = Math.abs(C.dot(mm, bv)) / Math.max(1e-9, C.len(mm) * C.len(bv));
  const angleGap = Math.abs(f.crossing - (Math.PI - 2 * f.angleC));

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P) },
    acute,
    options: {
      showAltitudes: s.showAltitudes, showConstruction: s.showConstruction,
      showMap: s.showMap, moreTriangles: s.moreTriangles, showNames: s.showNames,
    },
    angleCdeg: deg(f.angleC),
    crossingDeg: deg(f.crossing),
    expectedCrossingDeg: deg(Math.PI - 2 * f.angleC),
    crossingMinusExpectedDeg: round((angleGap * 180) / Math.PI, 4),
    crossingIs180Minus2C: angleGap <= angleTol,
    construction: {
      O: pt(f.O), bisectorPoint: pt(f.bisector),
      bisectorThroughC: Number.isFinite(bisRes) && bisRes <= tol,
      bisectorResidual: round(bisRes, 6),
      Bprime: pt(f.B1), BprimeNext: pt(f.B2),
      M: pt(f.M1), Mprime: pt(f.M2), Mnext: pt(f.M3),
      altitudeFootFromC: pt(foot),
      MIsAltitudeFoot: Number.isFinite(footRes) && footRes <= tol,
      footResidual: round(footRes, 6),
      MMprimePerpendicularToBisector: Number.isFinite(perpRes) && perpRes <= 1e-2,
      perpendicularResidual: round(perpRes, 6),
      foldX: pt(f.foldX),
    },
    /* The applet numbers its triangles t0..t5; the page's t1,t2,t3 are
     * the applet's t0,t2,t3. */
    rolled: {
      t0: tri(f.t0), t1: tri(f.t1), t2: tri(f.t2), t3: tri(f.t3),
      t4: tri(f.t4), t5: tri(f.t5),
    },
    orthic: tri(f.orthic),
    minLength: round(f.minLength),
    status: C.describe(s, f),
  };
}

export function actions(): GameActions {
  return {
    roll_and_construction: {
      describe:
        "Build triangle ABC on the 360 x 240 board (y down) from corners A, B, C, each [x, y] or { x, y }, with an optional point P on AB; omit any for the applet's opening figure, and set the five checkbox booleans if you wish. The real core rolls the triangle over its sides and reports the crossing angle at O (checked against 180° − 2C), the angle bisector through C, the reflected B's, the midpoints M and M′, the foot of the altitude from C and the orthic triangle, plus an acute-only status line.",
      args: '{"A":[63,120],"B":[30,210],"C":[120,180],"P":[39.9,183],"showConstruction":true}',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        const rr = reading(C, s);
        const con = rr.construction;
        return {
          ...rr,
          note: !rr.acute
            ? "The core still draws the rolled copies, but this triangle is not acute, so the 180° − 2C and shortest-line claims do not apply; drag a corner so all three angles are less than 90°. This is Samelson's illustration of Fagnano's problem, not a game, so there is no win or loss."
            : `Rolling B in CA, then A in B′C, then C in A′B′ leaves the first three copies sharing C, and side c and its image meet at O at ${rr.crossingDeg}° = 180° − 2 × ${rr.angleCdeg}. `
              + `The bisector at O passes through C (residual ${con.bisectorResidual} board units) and reflecting the two B's in it and halving gives M on AB, exactly the altitude foot from C (residual ${con.footResidual}). `
              + "Folding the three pieces back gives the orthic triangle, the smallest triangle inscribed in an acute triangle — the answer to Fagnano's problem. This applet is Samelson's third proof of it, not a game: there is no win or loss. "
              + "The applet's triangles are t0..t5 (the page's t1,t2,t3 are t0,t2,t3).",
        };
      },
    },

    shortest_path: {
      describe:
        "For triangle ABC (corners as in roll_and_construction) place P on AB with a point P or a fraction t of the way from B to A (t = 0 at B, 1 at A; omit both for the applet's opening P). The core reports the three copies of P, the two equal legs and their fixed translation base, and the same reading at M, the altitude foot where the broken line straightens to the minimum length and folds back to the orthic triangle. Angles and distances are in board units of the 360 x 240 view.",
      args: '{"A":[63,120],"B":[30,210],"C":[120,180],"t":0.33}',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        const f = C.compute(s);
        const atP = C.images(f, s.P);
        const atM = C.images(f, f.M1);
        const acute = C.isAcute(s);
        const straight = Math.abs(atM.leg1 + atM.leg2 - atM.base) <= tol;
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          acute,
          yourP: {
            P: pt(s.P), t: round(C.parameter(s.A, s.B, s.P)),
            copyOnRolledSide: pt(atP.q), copyOnLastSide: pt(atP.r),
            leg1: round(atP.leg1), leg2: round(atP.leg2), base: round(atP.base),
            pathLength: round(atP.leg1 + atP.leg2),
            legsEqual: Math.abs(atP.leg1 - atP.leg2) <= tol,
          },
          atM: {
            M: pt(f.M1), t: round(C.parameter(s.A, s.B, f.M1)),
            Mprime: pt(f.M2), Mnext: pt(f.M3),
            leg1: round(atM.leg1), leg2: round(atM.leg2), base: round(atM.base),
            pathLength: round(atM.leg1 + atM.leg2),
            straight,
          },
          fixedBase: round(f.minLength),
          pathAtLeastBase: atP.leg1 + atP.leg2 >= f.minLength - tol,
          orthic: tri(f.orthic),
          status: C.describe(s, f),
          note: !acute
            ? "The core still measures the broken line, but for a non-acute triangle the altitude foot can leave side AB, so the shortest-path claim does not apply; make all three angles less than 90° first. This is Samelson's illustration of Fagnano's problem, so there is no win or loss."
            : `Your P has equal legs ${round(atP.leg1)} and ${round(atP.leg2)} and a fixed base ${round(atP.base)} — the translation taking A to its fifth copy, length ${round(f.minLength)} — so its broken path is ${round(atP.leg1 + atP.leg2)} long, never shorter than that base. `
              + `At M = (${pt(f.M1)?.x}, ${pt(f.M1)?.y}), the foot of the altitude from C at t = ${round(C.parameter(s.A, s.B, f.M1))}, the three copies lie on one line (straight: ${straight}) and the path reaches its minimum ${round(atM.leg1 + atM.leg2)}. `
              + "Folded back, the three pieces are the sides of the orthic triangle, the smallest triangle inscribed in an acute triangle — Fagnano's problem, which this applet illustrates rather than plays. ",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those same points. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Fagnano III state version ${stateVersion}`);
  }
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(src, C);
  } catch {
    s = C.start();
    savedReadable = false;
  }
  const rr = reading(C, s);
  const echo = (v: unknown) => pt(v && typeof v === "object" ? v as Pt : null);
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved: {
      A: echo(src.A), B: echo(src.B), C: echo(src.C), P: echo(src.P),
      showAltitudes: readBool(src, "showAltitudes", false),
      showConstruction: readBool(src, "showConstruction", false),
      showMap: readBool(src, "showMap", false),
      moreTriangles: readBool(src, "moreTriangles", false),
      showNames: readBool(src, "showNames", false),
    },
    validAcute: rr.acute,
    ...rr,
    note: (!savedReadable
      ? "The saved position could not be read, so the core reading below is from the applet's opening figure. "
      : "Track.state saved the four draggable points A, B, C, P and the five checkbox booleans as plain data; the core rebuilds the rolled copies, the crossing O at 180° − 2C, the bisector through C, the midpoints M and M′ and the orthic feet from them. ")
      + (rr.acute
        ? "This triangle is acute, so the page's shortest-line claim applies; it is Samelson's illustration of Fagnano's problem, with no win or loss."
        : "This triangle is not acute, so the page's claims do not apply; move a corner to make all three angles less than 90°."),
  };
}
