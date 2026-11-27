/*
 * run_game_logic actions and saved-position reader for Simultaneous Diameters
 * in Concurrent Circles.
 *
 * Three circles through one point O have centres P, Q, R. They meet again in
 * pairs at D = (Q)∩(R), E = (P)∩(R), F = (P)∩(Q). The lines OD, OE, OF cut the
 * circles again at A, B, C. Measuring the centre vectors p = P−O, q = Q−O,
 * r = R−O, the chord OA is a diameter of (P) exactly when p·(q−r) = 0, i.e.
 * p·q = p·r; similarly OB a diameter means q·p = q·r and OC means r·p = r·q.
 * So the three equalities p·q = p·r = q·r are one condition: any two of the
 * diameters force the third. This is the claim of the applet (which cites
 * Brannan, Esplen and Gray, Geometry, p. 258).
 *
 * Every number below comes from the real core
 * diameters-in-concurrent-circles/diameters-in-concurrent-circles-core.js,
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape
 * of a game module. Coordinates are board units in the page's 400 x 300 viewBox,
 * y down; the core's `isInside` uses an absolute tolerance of 0.05.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["diameters-in-concurrent-circles"].DiametersInConcurrentCirclesCore as any;

type Pt = { x: number; y: number };
type State = { width: number; height: number; O: Pt; P: Pt; Q: Pt; R: Pt };

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const xy = (p: any, digits = 4): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x, digits), y: round(p.y, digits) }
    : null;
const dot = (a: Pt, b: Pt, O: Pt): number =>
  (a.x - O.x) * (b.x - O.x) + (a.y - O.y) * (b.y - O.y);

/** Accept [x, y] or { x, y }, with an optional fallback for saved positions. */
function readPoint(v: unknown, label: string, fallback?: Pt): Pt {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** A real core state, built by start() and the same movePoint() the page uses. */
function buildState(args: Json, C: any): State {
  const width = num(args, "width", C.DEFAULT_WIDTH as number);
  const height = num(args, "height", C.DEFAULT_HEIGHT as number);
  if (!(width > 0 && height > 0)) throw new Error('"width" and "height" must be positive');
  let s = C.start({ width, height }) as State;
  for (const name of ["O", "P", "Q", "R"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.movePoint(s, name, readPoint(args[name], name)) as State;
    }
  }
  return s;
}

/** The core's geometry, read as three diameter tests plus their algebra. */
function reading(C: any, state: State) {
  const g = C.compute(state);
  const O = state.O;
  const dots = {
    PQ: dot(state.P, state.Q, O),
    PR: dot(state.P, state.R, O),
    QR: dot(state.Q, state.R, O),
  };
  const entries = [dots.PQ, dots.PR, dots.QR];
  const scale = Math.max(1, Math.abs(dots.PQ), Math.abs(dots.PR), Math.abs(dots.QR));

  /** A chord is a diameter iff its circle's centre is the midpoint of O and the endpoint. */
  const midpoint = (centre: Pt, end: any): boolean | null => {
    if (!end || !Number.isFinite(end.x) || !Number.isFinite(end.y)) return null;
    return Math.hypot(centre.x - (O.x + end.x) / 2, centre.y - (O.y + end.y) / 2) < 0.05;
  };
  const diameters = [
    {
      circle: "(P)", chord: "OA", centre: xy(state.P), endpoint: xy(g.A),
      radius: round(C.distance(O, state.P)), found: g.pok === true,
      centreIsMidpoint: midpoint(state.P, g.A),
    },
    {
      circle: "(Q)", chord: "OB", centre: xy(state.Q), endpoint: xy(g.B),
      radius: round(C.distance(O, state.Q)), found: g.qok === true,
      centreIsMidpoint: midpoint(state.Q, g.B),
    },
    {
      circle: "(R)", chord: "OC", centre: xy(state.R), endpoint: xy(g.C),
      radius: round(C.distance(O, state.R)), found: g.rok === true,
      centreIsMidpoint: midpoint(state.R, g.C),
    },
  ];
  const flags = {
    pok: g.pok === true, qok: g.qok === true, rok: g.rok === true,
    all: g.all === true, valid: g.valid === true,
  };
  const found = [flags.pok, flags.qok, flags.rok].filter(Boolean).length;

  return {
    O: xy(O), P: xy(state.P), Q: xy(state.Q), R: xy(state.R),
    secondIntersections: { D: xy(g.D), E: xy(g.E), F: xy(g.F) },
    diameterEndpoints: { A: xy(g.A), B: xy(g.B), C: xy(g.C) },
    diameters,
    flags,
    found,
    dotProductsFromO: {
      "P·Q": round(dots.PQ), "P·R": round(dots.PR), "Q·R": round(dots.QR),
      nearlyEqual: entries.every((v) => Math.abs(v - entries[0]) < 0.01 * scale),
    },
    status: !flags.valid
      ? "Move P, Q or R away from O to draw the circles."
      : flags.all
        ? "OA, OB and OC are all diameters. The three eyes are wide awake!"
        : `${found} of 3 diameters found. Drag a dot, or focus it and press the arrow keys.`,
  };
}

export function actions(): GameActions {
  return {
    diameters: {
      describe:
        "Three circles through a common point O have centres P, Q, R; D, E, F are their second intersections in pairs, and the lines OD, OE, OF meet the circles again at A, B, C. Given O, P, Q, R (each [x, y] or { x, y }, defaulting to the applet's opening points on its 400 x 300 board), run the real core and report D, E, F and A, B, C, the radius of each circle, and which of OA, OB, OC are diameters (the centre lies midway between O and the endpoint). It also reports the pairwise dot products of the centre vectors from O: all three chords are diameters exactly when those three products are equal.",
      args: '{ "O": [200, 150], "P": [260, 150], "Q": [170, 98], "R": [170, 202] }',
      run: (args) => {
        const C = core();
        const r = reading(C, buildState(args, C));
        return {
          ...r,
          note: !r.flags.valid
            ? "A centre is too close to O for the circles to be drawn. Move P, Q or R away from O and try again."
            : r.flags.all
              ? `All three chords are diameters: each centre is the midpoint of O and its endpoint, and the dot products ${r.dotProductsFromO["P·Q"]}, ${r.dotProductsFromO["P·R"]}, ${r.dotProductsFromO["Q·R"]} agree. Each line through O meets its circle again at the point diametrically opposite O.`
              : `${r.found} of 3 diameters found. The centre of a circle lies on the chord OA, OB or OC only when that chord is a diameter; drag a dot (or focus it and press the arrow keys) until all three dot products agree, and the third diameter follows.`,
        };
      },
    },

    two_force_third: {
      describe:
        "Take O, P, Q (defaults from the applet; each [x, y] or { x, y }) and solve for the unique centre R that makes both OA and OB diameters of their circles. The real core is then run at that R and shows OC is a diameter of the third circle too. A control that slides R so that only OA stays a diameter breaks OB and OC, showing that two are needed; the equal dot products p·q = p·r = q·r are the algebraic form of the theorem.",
      args: '{ "O": [200, 150], "P": [260, 150], "Q": [170, 98] }',
      run: (args) => {
        const C = core();
        const state = buildState(args, C);
        const { O, P, Q } = state;
        const p = { x: P.x - O.x, y: P.y - O.y };
        const q = { x: Q.x - O.x, y: Q.y - O.y };
        const pq = p.x * q.x + p.y * q.y;
        const det = p.x * q.y - p.y * q.x;
        if (Math.abs(det) < 1e-6) {
          throw new Error('"P" and "Q" must not lie on one line through O (the solved centre is not unique)');
        }
        // p·r = p·q and q·r = p·q, by Cramer's rule.
        const raw = { x: O.x + (pq * q.y - p.y * pq) / det, y: O.y + (p.x * pq - pq * q.x) / det };
        const solved = C.movePoint(state, "R", raw) as State;
        const atSolved = reading(C, solved);

        // Slide R along the line p·r = p·q (perpendicular to p): OA stays a
        // diameter, but OB no longer is.
        const step = num(args, "controlStep", 30);
        if (!(step > 0 && step <= 100)) throw new Error('"controlStep" must be between 0 and 100');
        const plen = Math.hypot(p.x, p.y);
        const u = { x: -p.y / plen, y: p.x / plen };
        const control = C.movePoint(state, "R", {
          x: raw.x + step * u.x, y: raw.y + step * u.y,
        }) as State;
        const atControl = reading(C, control);

        return {
          O: xy(O), P: xy(P), Q: xy(Q),
          solvedCentreR: xy(solved.R),
          clampedToBoard: Math.hypot(solved.R.x - raw.x, solved.R.y - raw.y) > 1e-6,
          atSolved: {
            flags: atSolved.flags,
            diameterEndpoints: atSolved.diameterEndpoints,
            dotProductsFromO: atSolved.dotProductsFromO,
          },
          control: {
            centreR: xy(control.R), step,
            flags: atControl.flags,
            dotProductsFromO: atControl.dotProductsFromO,
          },
          twoForceThird: atSolved.flags.all === true,
          oneDiameterIsNotEnough:
            atControl.flags.pok === true && !(atControl.flags.qok && atControl.flags.rok),
          note:
            "With O as origin, OA is a diameter iff p·q = p·r and OB iff q·p = q·r. Solving both puts R where p·q = p·r = q·r, and the core then reports OC a diameter too: forcing two forces the third. The control keeps p·r = p·q (so OA is still a diameter) but moves off q·r = p·q, and both OB and OC fail, so a single diameter is not enough.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Diameters in Concurrent Circles state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(src, C);
  } catch {
    s = C.start({}) as State;
    savedReadable = false;
  }
  const r = reading(C, s);

  const saved = {
    width: Number.isFinite(Number(src.width)) ? Number(src.width) : s.width,
    height: Number.isFinite(Number(src.height)) ? Number(src.height) : s.height,
    O: xy(src.O), P: xy(src.P), Q: xy(src.Q), R: xy(src.R),
    A: xy(src.A), B: xy(src.B), C: xy(src.C),
    D: xy(src.D), E: xy(src.E), F: xy(src.F),
    pok: src.pok === true, qok: src.qok === true, rok: src.rok === true, all: src.all === true,
  };
  const samePoint = (a: Pt | null, b: Pt | null): boolean | null =>
    a && b ? Math.hypot(a.x - b.x, a.y - b.y) < 0.01 : null;
  const agreement = {
    A: samePoint(saved.A, r.diameterEndpoints.A),
    B: samePoint(saved.B, r.diameterEndpoints.B),
    C: samePoint(saved.C, r.diameterEndpoints.C),
    D: samePoint(saved.D, r.secondIntersections.D),
    E: samePoint(saved.E, r.secondIntersections.E),
    F: samePoint(saved.F, r.secondIntersections.F),
    pok: savedReadable ? saved.pok === r.flags.pok : null,
    qok: savedReadable ? saved.qok === r.flags.qok : null,
    rok: savedReadable ? saved.rok === r.flags.rok : null,
    all: savedReadable ? saved.all === r.flags.all : null,
  };

  return {
    stateVersion,
    savedReadable,
    saved,
    ...r,
    agreement,
    note: !savedReadable
      ? "The saved position could not be read, so the applet's opening picture is shown instead."
      : r.flags.all
        ? "In this saved picture OA, OB and OC are all diameters: the three centres are the midpoints of O and their endpoints. This is a drawing rather than a game, so there is no win or loss."
        : `${r.found} of 3 diameters are found in the saved picture; the core recomputes the six named points and the diameter flags from the saved O, P, Q, R, and they agree with what the page saved.`,
  };
}
