/*
 * run_game_logic actions and saved-position reader for Max Common Chord
 * (Bogomolny's MaxCommonChord applet, the 1975 USAMO problem).
 *
 * Two circles through P and Q are cut by a bar A-P-B. A, B and Q lie on one
 * circle, so its chords AB and PQ meet at P and the intersecting chords
 * theorem gives AP × PB = PQ × PR, where R is the second cut of line PQ with
 * that circle. PQ is the radical axis of the two circles, so R has equal
 * tangents At and Bt; the product is largest (and PR longest) exactly when
 * At, P and Bt line up — the unique longest chord through P.
 *
 * Every number below comes from the real core, copied at build time from
 * max-common-chord/max-common-chord-core.js into src/generated/cores/.
 * Coordinates are board units of the 640 x 460 board, y down. See _shared.ts
 * for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleInfo = { center: Pt; radius: number };
type Segment = { p: Pt; q: Pt };
type State = { width: number; height: number; mode: string; P: Pt; Q: Pt; A: Pt; B: Pt };
type Geometry = {
  valid: boolean; reason: string | null;
  E: CircleInfo | null; F: CircleInfo | null; ABQ: CircleInfo | null;
  R: Pt | null; At: Pt | null; Bt: Pt | null; Pe: Pt | null; Pf: Pt | null;
  RA: Segment | null; RB: Segment | null; tangent: Segment | null;
  inside: boolean; between: boolean; onChord: boolean;
  product: number; pqpr: number; pq: number;
};
type Core = {
  DEFAULT_WIDTH: number; DEFAULT_HEIGHT: number;
  dist(p: Pt, q: Pt): number;
  circle(a: Pt, b: Pt, c: Pt): CircleInfo;
  start(o?: { width?: number; height?: number; mode?: string }): State;
  setMode(s: State, mode: string): State;
  movePoint(s: State, name: string, p: Pt): State;
  compute(s: State): Geometry;
};
const core = (): Core => cores["max-common-chord"].MaxCommonChordCore as unknown as Core;

const HANDLES = ["P", "Q", "A", "B"] as const;

/** Six decimals keep the core's numbers readable without losing meaning. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
/** JSON cannot carry NaN/Infinity; print non-finite core values as null. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (v: Pt | null | undefined): Pt | null =>
  v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: r6(v.x), y: r6(v.y) } : null;
const circ = (v: CircleInfo | null) =>
  v ? { center: pt(v.center), radius: cnt(v.radius) } : null;
const seg = (v: Segment | null) => v ? { p: pt(v.p), q: pt(v.q) } : null;
const gap = (C: Core, a: Pt | null, b: Pt | null): number | null =>
  a && b ? cnt(C.dist(a, b)) : null;
const close = (a: number, b: number, tol = 1e-4): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tol;

/** Tutor points may be [x, y] or { x, y }; both must be finite. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
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

function readOptions(C: Core, args: Json): { width: number; height: number; mode: string } {
  const width = args.width === undefined || args.width === null ? C.DEFAULT_WIDTH : Number(args.width);
  const height = args.height === undefined || args.height === null ? C.DEFAULT_HEIGHT : Number(args.height);
  if (!Number.isFinite(width) || width < 100 || width > 5000) {
    throw new Error('"width" must be a number from 100 to 5000');
  }
  if (!Number.isFinite(height) || height < 100 || height > 5000) {
    throw new Error('"height" must be a number from 100 to 5000');
  }
  const mode = args.mode === undefined || args.mode === null ? "chord" : String(args.mode);
  if (mode !== "chord" && mode !== "circles") {
    throw new Error('"mode" must be "chord" or "circles"');
  }
  return { width, height, mode };
}

/** Start at the applet's opening picture, then use any supplied handles as-is. */
function makeState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const s = C.start(readOptions(C, args));
  for (const name of HANDLES) {
    const v = args[name];
    if (v !== undefined && v !== null) s[name] = readPoint(v, name);
  }
  return s;
}

/** The signed distance of At and Bt from line P, in board units per unit length. */
function lineUpError(C: Core, at: Pt | null, bt: Pt | null, p: Pt): number | null {
  if (!at || !bt) return null;
  const cross = (at.x - p.x) * (bt.y - p.y) - (at.y - p.y) * (bt.x - p.x);
  return cnt(cross / Math.max(1, C.dist(at, bt)));
}

/** Everything the real core can say about one picture. */
function reading(C: Core, s: State, g: Geometry) {
  const RA = gap(C, g.R, g.At);
  const RB = gap(C, g.R, g.Bt);
  const AP = gap(C, s.A, s.P);
  const PB = gap(C, s.P, s.B);
  const PR = gap(C, s.P, g.R);
  const aligned = lineUpError(C, g.At, g.Bt, s.P);
  return {
    valid: g.valid,
    reason: g.reason,
    mode: s.mode,
    handles: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    chord: {
      A: pt(s.A), P: pt(s.P), B: pt(s.B),
      AP, PB, product: cnt(g.product), onChord: g.onChord,
    },
    radicalAxis: {
      P: pt(s.P), Q: pt(s.Q), PQ: cnt(g.pq), R: pt(g.R), PR,
      PQtimesPR: cnt(g.pqpr), insidePQ: g.inside,
    },
    equalTangents: {
      At: pt(g.At), Bt: pt(g.Bt), RA, RB,
      lengthsEqual: RA !== null && RB !== null && close(RA, RB, 1e-3),
      tangentChord: seg(g.tangent), Pe: pt(g.Pe), Pf: pt(g.Pf),
    },
    circles: { E: circ(g.E), F: circ(g.F), ABQ: circ(g.ABQ) },
    powerOfPoint: {
      productMinusPQPR: cnt(g.product - g.pqpr),
      equal: close(g.product, g.pqpr),
      note: g.onChord
        ? "A, P and B are in line, so chords AB and PQ of circle ABQ meet at P and AP × PB = PQ × PR."
        : "A, P and B are not in line, so AP × PB is not the intersecting-chords product PQ × PR; drag A or B onto the chord.",
    },
    longest: {
      AtPBtCollinear: g.between,
      collinearityError: aligned,
      note: g.between
        ? "At, P and Bt are in line: PR, and with it AP × PB, is as large as it can be for these two circles."
        : "At, P and Bt are not in line yet; when they line up, R is farthest from P and the chord is longest.",
    },
    note:
      "PQ is the radical axis of the two circles, so R has equal tangents At and Bt and AP × PB = PQ × PR when the bar really passes through P. " +
      "Because P and Q are fixed, maximising AP × PB is the same as pushing R as far from P as possible, which happens at the one bar direction with At, P and Bt in line. " +
      "This is a drawing, so there is no win or loss.",
  };
}

export function actions(): GameActions {
  return {
    chord_power: {
      describe:
        "Read one picture from the optional handles P, Q, A and B ([x, y] or { x, y }; omit any to keep the opening picture) and width, height and mode. Reports AP × PB, PQ × PR from the point R on the radical axis, whether the bar A-P-B is straight, the two equal tangents from R, and whether At, P and Bt line up to give the longest chord.",
      args: '{"P":[324,276],"Q":[320,368],"A":[192,322],"B":[404.078702702703,245.7842162162161]}',
      run: (args) => {
        const C = core();
        const s = makeState(C, args);
        return reading(C, s, C.compute(s));
      },
    },

    longest_chord: {
      describe:
        "Slide the bar all the way around the circle through A, P and Q (in Adjust-chord mode) in `steps` directions (12 to 1440, default 360) and return the chord with the largest AP × PB. The real core finds R and the tangents at each step, so the result shows the unique maximum where PQ × PR matches the product and At, P and Bt are in line.",
      args: '{"steps":360}',
      run: (args) => {
        const C = core();
        const base = C.setMode(makeState(C, args), "chord");
        const rawSteps = args.steps === undefined || args.steps === null ? 360 : Number(args.steps);
        if (!Number.isInteger(rawSteps) || rawSteps < 12 || rawSteps > 1440) {
          throw new Error('"steps" must be a whole number from 12 to 1440');
        }
        const E = C.circle(base.A, base.P, base.Q);
        if (!Number.isFinite(E.center.x) || !Number.isFinite(E.center.y) ||
            !Number.isFinite(E.radius) || E.radius <= 0) {
          throw new Error("A, P and Q are close to one line, so the circle through them has no finite centre; move them apart.");
        }
        let best: Geometry | null = null;
        let bestState: State | null = null;
        let validCount = 0;
        let longestCount = 0;
        for (let i = 0; i < rawSteps; i++) {
          const angle = (2 * Math.PI * i) / rawSteps;
          const a = {
            x: E.center.x + E.radius * Math.cos(angle),
            y: E.center.y + E.radius * Math.sin(angle),
          };
          const s = C.movePoint(base, "A", a);
          const g = C.compute(s);
          if (!g.valid) continue;
          validCount++;
          if (g.between) longestCount++;
          if (!best || g.product > best.product) {
            best = g;
            bestState = s;
          }
        }
        if (!best || !bestState) {
          return {
            steps: rawSteps, validChords: 0, longest: null,
            note: "No direction gave a drawable chord; move P, Q, A or B apart.",
          };
        }
        return {
          steps: rawSteps,
          validChords: validCount,
          directionsAtTheMaximum: longestCount,
          longest: reading(C, bestState, best),
          note:
            `Of ${validCount} drawable directions, ${longestCount} line At, P and Bt up; the best one has AP × PB = PQ × PR = ${r6(best.product)}. ` +
            "Only one bar direction gives the true maximum; a coarse sweep may land near it rather than exactly on it.",
        };
      },
    },
  };
}

/** Echo every field Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Max Common Chord state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Max Common Chord position must be an object");
  }
  const C = core();
  const s = makeState(C, state);
  const g = C.compute(s);
  const scalar = (saved: unknown, value: number) => ({
    saved, core: cnt(value), equal: close(Number(saved), value),
  });
  const flag = (saved: unknown, value: boolean) => ({
    saved: saved === true, core: value, equal: (saved === true) === value,
  });
  const pointPair = (label: string, saved: unknown, value: Pt | null) => {
    const p = saved === undefined || saved === null ? null : readPoint(saved, `saved ${label}`);
    return { saved: pt(p), core: pt(value), distance: gap(C, p, value) };
  };
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: g.valid,
    core: reading(C, s, g),
    savedVsCore: {
      product: scalar(state.product, g.product),
      pqpr: scalar(state.pqpr, g.pqpr),
      onChord: flag(state.onChord, g.onChord),
      between: flag(state.between, g.between),
      valid: flag(state.valid, g.valid),
      R: pointPair("R", state.R, g.R),
      At: pointPair("At", state.At, g.At),
      Bt: pointPair("Bt", state.Bt, g.Bt),
    },
    note:
      "Track.state saved the four handles P, Q, A and B, the mode and board size, and the derived point R on the radical axis, the tangent points At and Bt, AP × PB, PQ × PR and the three flags onChord, between and valid, all in board units. " +
      "The real core rebuilds the two circles, the circumcircle ABQ and R from those handles; savedVsCore measures how close the saved derived values are to a fresh computation. " + (g.onChord
        ? " Here A, P and B are in line, so the intersecting-chords identity AP × PB = PQ × PR applies."
        : " Here A, P and B are not in line, so AP × PB differs from PQ × PR."),
  };
}
