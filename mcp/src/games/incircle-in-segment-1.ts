/*
 * run_game_logic actions and saved-position reader for Incircle In Segment 1
 * (Bogomolny's IncircleInSegment1 applet).
 *
 * A horizontal chord AB of the outer circle (centre O, radius r) carries two
 * draggable contact points C and D. For each contact P the applet builds the
 * circle through O tangent to the chord at P: N is the projection of O on MP,
 * Q is the reflection of M in N, W is where OQ meets the vertical through P,
 * and the inscribed circle has centre W and radius WP.
 *
 * The page claims that when the two circles meet at U and V, the line UV goes
 * through M (the midpoint of the far arc). The real reason is stronger: for
 * *every* inscribed circle MA*MB = MT^2 = MP*MQ, where T is either end of the
 * chord, so M has the same power with respect to both circles and lies on
 * their radical axis. The sibling applet IncircleInSegment only claims that
 * M, P and Q are collinear for one circle — a weaker statement.
 *
 * Every number below is measured by the game's real core, copied at build
 * time from incircle-in-segment-1/incircle-in-segment-1-core.js into
 * src/generated/cores/. Coordinates are board units of the 360 x 300 view,
 * y down. See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleInfo = {
  P: Pt; N: Pt; Q: Pt; R: Pt; center: Pt; radius: number;
  power: number; product: number; singleClaim: boolean;
};
type Line = { p: Pt; q: Pt };
type State = {
  center: Pt; radius: number; angle: number; c: number; d: number;
  hint: boolean; explored: boolean;
};
type Handles = { O: Pt; M: Pt; A: Pt; B: Pt; C: Pt; D: Pt };
type Geometry = {
  O: Pt; M: Pt; A: Pt; B: Pt; C: Pt; D: Pt;
  circles: (CircleInfo | null)[];
  chordHalf: number; chordHeight: number; mt: number; degenerate: boolean;
  intersections: Pt[]; radicalLine: Line | null;
  powersEqual: boolean; identity: boolean; collinear: boolean; claim: boolean;
};
type Core = {
  VIEW: { width: number; height: number };
  CENTER: Pt; RADIUS: number; DEFAULT_ANGLE: number; MAX_SIN: number;
  distance(p: Pt, q: Pt): number;
  clampAngle(a: number): number;
  handles(s: State): Handles;
  start(o?: {
    radius?: number; angle?: number; hint?: boolean; random?: boolean; rng?: () => number;
  }): State;
  move(s: State, m: Json): State;
  geometry(s: State): Geometry;
  position(s: State): Json;
  describe(s: State): string;
  result(s: State): null;
  inscribedCircle(O: Pt, M: Pt, P: Pt): CircleInfo | null;
};
const core = (): Core =>
  cores["incircle-in-segment-1"].IncircleInSegment1Core as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const sig = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;

/** Signed distance from r to the line through p and q, in board units. */
function lineResidual(C: Core, p: Pt | null, q: Pt | null, r: Pt | null): number | null {
  if (!p || !q || !r) return null;
  const vx = q.x - p.x, vy = q.y - p.y;
  const len = Math.hypot(vx, vy);
  return sig(len < 1e-9 ? C.distance(p, r) : (vx * (r.y - p.y) - vy * (r.x - p.x)) / len);
}

function asArgs(args: Json): Json {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with angle, c, d, radius and hint");
  }
  return args;
}

function numberArg(args: Json, key: string, fallback: number, lo?: number, hi?: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`argument "${key}" must be a finite number, got ${JSON.stringify(raw)}`);
  }
  if ((lo !== undefined && n < lo) || (hi !== undefined && n > hi)) {
    throw new Error(`argument "${key}" must be between ${lo} and ${hi}, got ${n}`);
  }
  return n;
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${key}" must be true or false, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/**
 * A chord contact is an x coordinate in board units; accept [x, y] or
 * { x, y } too, since tutors often paste a point read off the picture.
 */
function contactX(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  let x: number;
  if (typeof raw === "number") {
    x = raw;
  } else if (Array.isArray(raw) && raw.length === 2) {
    x = Number(raw[0]);
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    x = Number((raw as Json).x);
  } else {
    throw new Error(`argument "${label}" must be an x coordinate, [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x)) {
    throw new Error(`argument "${label}" must be a finite x coordinate, got ${JSON.stringify(raw)}`);
  }
  return x;
}

/** The core's opening picture, with any supplied angle, radius and contacts. */
function buildState(C: Core, args: Json): State {
  const a = asArgs(args);
  const angle = numberArg(a, "angle", C.DEFAULT_ANGLE);
  const radius = numberArg(a, "radius", C.RADIUS, 20, 120);
  let s = C.start({ angle, radius, hint: boolArg(a, "hint", false) });
  for (const [key, name] of [["c", "C"], ["d", "D"]] as const) {
    const x = contactX(a[key], key, s[name === "C" ? "c" : "d"]);
    // Only drag when the tutor supplied a value; the core's AdjustPoint clamps
    // the contact to lie between A and B and marks the picture explored.
    if (a[key] !== undefined && a[key] !== null) {
      s = C.move(s, { type: "point", name, x, y: s.center.y });
    }
  }
  return s;
}

function circleOut(c: CircleInfo | null) {
  if (!c) return null;
  return {
    contactP: pt(c.P), footN: pt(c.N), tangencyQ: pt(c.Q),
    centreW: pt(c.center), radius: cnt(c.radius),
    powerAtM: cnt(c.power), mpTimesMq: cnt(c.product),
    mP_Q_collinear: c.singleClaim,
  };
}

/** Everything the real core says about one picture. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const circles = g.circles.map(circleOut);
  const powers = g.circles.map((c) => cnt(c ? c.power : NaN));
  return {
    board: C.VIEW,
    state: {
      angle: r6(s.angle), radius: r6(s.radius), c: r6(s.c), d: r6(s.d),
      hint: s.hint, explored: s.explored,
    },
    chord: { A: pt(g.A), B: pt(g.B) },
    M: pt(g.M),
    chordHalf: cnt(g.chordHalf), chordHeight: cnt(g.chordHeight), mt: cnt(g.mt),
    circles,
    intersections: {
      U: pt(g.intersections[0]), V: pt(g.intersections[1]), count: g.intersections.length,
    },
    radicalAxis: g.radicalLine
      ? {
          through: [pt(g.radicalLine.p), pt(g.radicalLine.q)],
          Mresidual: lineResidual(C, g.radicalLine.p, g.radicalLine.q, g.M),
          fromCrossings: g.intersections.length === 2,
        }
      : null,
    checks: {
      degenerate: g.degenerate,
      powersAtM: powers,
      powersEqual: g.powersEqual,
      mtSquared: cnt(g.mt * g.mt),
      productEqualsMtSquared: g.identity,
      UVthroughM: g.collinear,
      pageClaim: g.claim,
      weakerSiblingClaim: g.circles.every((c) => Boolean(c && c.singleClaim)),
    },
    status: C.describe(s),
    result: C.result(s),
  };
}

const FIXTURE_ARGS =
  '{"angle":3.948660380823622,"c":203.57022603955159,"d":165.85786437626902}';

export function actions(): GameActions {
  return {
    radical_axis: {
      describe:
        "Set the chord with 'angle' (radians; the core clamps the chord away from a collapsed picture) and the two contact x coordinates 'c' and 'd' on the 360 x 300 board; 'radius' (20 to 120) and 'hint' are optional, and omitted arguments keep the applet's opening picture. Run the real core and report both inscribed circles, their intersections U and V, the radical axis UV, M, the two powers at M and the products MP*MQ: they are all MT^2 = MA*MB, so UV passes through M. The example is the live saved position.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const m = reading(C, s);
        return {
          ...m,
          note:
            "For each inscribed circle the core checks MP*MQ = MT^2 = MA*MB, so M has the same power with respect to both circles and lies on their radical axis; when the circles cross at U and V that axis is the line UV. " +
            "This is stronger than the sibling applet's claim that only M, P and Q are collinear. " +
            (m.checks.degenerate
              ? "The chord is collapsed here, so no inscribed circle is drawn."
              : m.intersections.count === 2
                ? "Here the circles meet in U and V, and the core measures how close that line comes to M."
                : "Here the circles do not meet in two real points, so the core draws its fallback radical line from M; the equal powers still hold.") +
            " This is an illustration, so there is no win or loss.",
        };
      },
    },

    single_circle_claim: {
      describe:
        "For one chord contact, given as 'p' (or 'c') — an x coordinate, [x, y] or { x, y } — together with 'angle' and optional 'radius' and 'hint', report the applet's construction N, Q, W and the inscribed circle through O tangent to the chord at P. The core checks both the weaker sibling claim that M, P and Q are collinear and the stronger identity MP*MQ = MT^2 that makes M lie on the radical axis of any two such circles; the example uses the first contact of the live saved position.",
      args: '{"angle":3.948660380823622,"p":203.57022603955159}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const s = buildState(C, {
          ...a,
          c: a.p !== undefined && a.p !== null ? a.p : a.c,
        });
        const g = C.geometry(s);
        const h = C.handles(s);
        const circle = C.inscribedCircle(h.O, h.M, h.C);
        if (!circle) {
          return {
            board: C.VIEW,
            state: reading(C, s).state,
            chord: { A: pt(g.A), B: pt(g.B) },
            M: pt(g.M),
            circle: null,
            note: "The core could not draw this inscribed circle: the chord is too short or OQ is nearly parallel to the vertical through P. Drag A away from the top or bottom of the outer circle.",
          };
        }
        const mt2 = g.mt * g.mt;
        const scale = Math.max(300, g.mt * 2, circle.radius * 2);
        const detail = circleOut(circle);
        return {
          board: C.VIEW,
          state: reading(C, s).state,
          chord: { A: pt(g.A), B: pt(g.B), half: cnt(g.chordHalf), height: cnt(g.chordHeight) },
          contacts: { P: pt(h.C), other: pt(h.D) },
          M: pt(g.M), tangencyT: pt(g.A), mt: cnt(g.mt),
          circle: detail,
          outerCircle: { centre: pt(h.O), radius: r6(s.radius), passesThroughO: true },
          checks: {
            mtSquared: cnt(mt2),
            mpTimesMq: cnt(circle.product),
            productResidual: cnt(circle.product - mt2),
            productEqualsMtSquared: Math.abs(circle.product - mt2) <= 1e-7 * scale * scale,
            coreIdentityForBothCircles: g.identity,
            weakerSiblingClaim: circle.singleClaim,
            weakerClaimResidual: lineResidual(C, h.M, circle.P, circle.Q),
            powerAtM: cnt(circle.power),
          },
          note:
            "The sibling applet IncircleInSegment only asserts M, P, Q collinear: N is the projection of O on MP, Q is M reflected in N, so M, P and Q do line up. Here the core also measures MP*MQ against MT^2: because MA*MB = MT^2 for every inscribed circle, M's power is the same for any pair of them and hence M lies on their radical axis. " +
            (g.degenerate
              ? "The other circle is degenerate in this picture, so the two-circle identity is not checked by the core."
              : "The second contact is held at the value saved in the state while this single circle is measured.") +
            " This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Incircle In Segment 1 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Incircle In Segment 1 position must be an object");
  }
  const C = core();
  const safeNum = (raw: unknown, fallback: number): number => {
    const n = Number(raw);
    return raw !== undefined && raw !== null && Number.isFinite(n) ? n : fallback;
  };
  let s = C.start({ angle: safeNum(state.angle, C.DEFAULT_ANGLE), radius: safeNum(state.radius, C.RADIUS) });
  if (state.hint === true) s = C.move(s, { type: "hint", value: true });
  for (const [key, name] of [["c", "C"], ["d", "D"]] as const) {
    const x = contactX(state[key], `saved ${key}`, s[key]);
    if (state[key] !== undefined && state[key] !== null) {
      s = C.move(s, { type: "point", name, x, y: s.center.y });
    }
  }
  if (typeof state.explored === "boolean") s = { ...s, explored: state.explored };

  const g = C.geometry(s);
  const readingNow = reading(C, s);
  const saved = {
    angle: state.angle, c: state.c, d: state.d,
    hint: state.hint === true, explored: state.explored === true,
    chord: {
      A: pt((state.chord as Json | undefined)?.A as Pt | undefined),
      B: pt((state.chord as Json | undefined)?.B as Pt | undefined),
    },
    centers: Array.isArray(state.centers)
      ? state.centers.map((p) => pt(p as Pt))
      : [null, null],
    M: pt(state.M as Pt | undefined),
  };
  const pair = (from: Pt | null, to: Pt | null) => ({
    saved: from, core: to, distance: from && to ? sig(C.distance(from, to)) : null,
  });

  return {
    ...state,
    stateVersion,
    saved,
    valid: !g.degenerate,
    core: readingNow,
    savedVsCore: {
      angle: { saved: state.angle, core: r6(s.angle) },
      c: { saved: state.c, core: r6(s.c) },
      d: { saved: state.d, core: r6(s.d) },
      chordA: pair(saved.chord.A, g.A),
      chordB: pair(saved.chord.B, g.B),
      M: pair(saved.M, g.M),
      centers: [0, 1].map((i) =>
        pair(saved.centers[i], g.circles[i] ? g.circles[i]!.center : null)),
    },
    note:
      "Track.state saved the chord angle, the two contact x coordinates, the hint and explored flags, plus the derived chord ends, the two inscribed-circle centres and M, all in board units of the 360 x 300 view; it saves no radius (the core uses 100). " +
      "The real core rebuilds the chord and both inscribed circles from angle, c and d, and savedVsCore measures how close its chord, centres and M are to the saved ones. " +
      "For every inscribed circle MA*MB = MT^2 = MP*MQ, so M lies on the radical axis: if the circles cross, that line is UV, the stronger page claim; M, P and Q collinear is only the weaker sibling claim. " +
      "This is an illustration, so there is no win or loss.",
  };
}
