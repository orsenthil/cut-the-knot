/*
 * run_game_logic actions and saved-position reader for Brahmagupta.
 *
 * Answers come from the real core, copied at build time from
 * brahmagupta/brahmagupta-core.js into src/generated/cores/. See _shared.ts
 * for the module shape. Coordinates are the applet's 500x400 canvas (y grows
 * downwards): drag A and D on the circle; B and C are their mirror images in
 * the vertical and horizontal diameters, so AC is vertical, BD horizontal and
 * the two diagonals cross at right angles at T.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["brahmagupta"].BrahmaguptaCore;

type Pt = { x: number; y: number };

const r2 = (v: number) => Math.round(v * 100) / 100;
const round = (p: Pt | null) => (p ? { x: r2(p.x), y: r2(p.y) } : null);

/** Accept {x, y} (the saved state) or [x, y] (convenient for a caller). */
function readPoint(args: Json, key: string, fallback: Pt): Pt {
  const v = args[key];
  if (v === undefined || v === null) return { ...fallback };
  if (Array.isArray(v)) {
    if (v.length < 2) throw new Error(`argument "${key}" needs two coordinates [x, y]`);
    return { x: num({ x: v[0] }, "x"), y: num({ y: v[1] }, "y") };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be a point {x, y} or [x, y]`);
}

/**
 * The player's two draggable points, projected onto the circle the way
 * CTKMoveableDoub does in the applet, so the reading describes a real position.
 */
function readState(args: Json) {
  const C = core();
  const base = C.start();
  const center = readPoint(args, "center", base.center);
  const r = args.r === undefined || args.r === null ? base.r : num(args, "r");
  if (!(r > 0)) throw new Error('argument "r" (the circle radius) must be positive');
  const seed = { center, r, A: base.A, D: base.D };
  return {
    center,
    r,
    A: C.project(seed, readPoint(args, "A", base.A)),
    D: C.project(seed, readPoint(args, "D", base.D)),
  };
}

function analyse(args: Json) {
  const C = core();
  const s = readState(args);
  const g = C.configuration(s);
  const m = C.formula(g);
  const ordered = C.ordered(s);
  const T = g.T;

  const diagonalsPerpendicular = !!T && Math.abs(C.dot(C.sub(g.C, g.A), C.sub(g.D, g.B)))
    < 1e-9 * C.distance(g.A, g.C) * C.distance(g.B, g.D);

  // Brahmagupta's theorem: from T through the midpoint of a side, the line is
  // perpendicular to the opposite side. All four such lines pass through T.
  const pairs = [
    { from: "BC", mid: C.midpoint(g.B, g.C), side: "AD", p: g.A, q: g.D },
    { from: "CD", mid: C.midpoint(g.C, g.D), side: "AB", p: g.A, q: g.B },
    { from: "DA", mid: C.midpoint(g.D, g.A), side: "BC", p: g.B, q: g.C },
    { from: "AB", mid: C.midpoint(g.A, g.B), side: "CD", p: g.C, q: g.D },
  ];
  const perpendiculars = T ? pairs.map(({ from, mid, side, p, q }) => {
    const denom = C.distance(mid, T) * C.distance(p, q);
    const cos = denom > 0 ? C.dot(C.sub(mid, T), C.sub(q, p)) / denom : 0;
    return {
      throughMidpointOf: from,
      perpendicularTo: side,
      footOnOppositeSide: round(C.intersect(T, mid, p, q)),
      cosineWithSide: r2(cos),
      perpendicular: Math.abs(cos) < 1e-6,
    };
  }) : null;

  // Power of the point T inside the circle: the two pieces of each chord
  // through T have equal products. With T as origin, p=TA, q=TC (vertical
  // diagonal) and m=TB, n=TD (horizontal diagonal), so pq = mn. This is what
  // makes the slope of T->midpoint(BC) times the slope of AD equal -1.
  const power = T ? (() => {
    const p = C.distance(T, g.A);
    const q = C.distance(T, g.C);
    const m = C.distance(T, g.B);
    const n = C.distance(T, g.D);
    return {
      diagonalPieces: { p: r2(p), q: r2(q), m: r2(m), n: r2(n) },
      pq: r2(p * q),
      mn: r2(m * n),
      holds: Math.abs(p * q - m * n) < 1e-6 * Math.max(1, p * q),
    };
  })() : null;

  const area = {
    sides: { a: r2(m.a), b: r2(m.b), c: r2(m.c), d: r2(m.d) },
    semiperimeter: r2(m.s),
    brahmaguptaS: r2(m.S),
    measuredArea: r2(m.measured),
    matches: m.holds,
    ordered,
    formula: "S = sqrt((s-a)(s-b)(s-c)(s-d))",
  };

  let note: string;
  if (!T || !g.E) {
    note = "Two of the points have met: the diagonals or the line QT no longer cross, so the construction is undefined here. Drag a handle away to see it again.";
  } else if (!ordered) {
    note = "The four corners have crossed over, so the outline is no longer a quadrilateral: the shoelace area of the crossed path differs from Brahmagupta's formula. The midpoint lines are still perpendicular to the opposite sides.";
  } else {
    note = "With the corners in order, the diagonals are perpendicular at T, each midpoint-to-opposite-side line passes through T at a right angle (pq = mn), and the measured area equals Brahmagupta's S = sqrt((s-a)(s-b)(s-c)(s-d)).";
  }

  return {
    points: {
      center: round(g.center), radius: r2(g.r),
      A: round(g.A), B: round(g.B), C: round(g.C), D: round(g.D),
      T: round(T), Q: round(g.Q), E: round(g.E),
      diagonalsPerpendicular,
    },
    perpendiculars,
    power,
    area,
    note,
  };
}

export function actions(): GameActions {
  return {
    theorem: {
      describe:
        "For the cyclic quadrilateral made by dragging A and D on the circle (500x400 canvas, y down; B and C are their mirror images), report the crossing T of the perpendicular diagonals, the line from T through the midpoint of each side to the opposite side with its foot, and the power identity pq = mn for the four diagonal pieces. A and D may be given as {x, y} or [x, y].",
      args: '{ "A": [200, 77], "D": [381, 226] }',
      run: (args) => {
        const reading = analyse(args);
        return {
          points: reading.points,
          perpendiculars: reading.perpendiculars,
          power: reading.power,
          note: reading.note,
        };
      },
    },
    area: {
      describe:
        "For the same cyclic quadrilateral, report the side lengths a, b, c, d, the semiperimeter s, Brahmagupta's area S = sqrt((s-a)(s-b)(s-c)(s-d)) and the area measured from the picture. Say whether they agree, and warn when the outline has crossed over: a crossed path is no longer a quadrilateral.",
      args: '{ "A": [200, 77], "D": [381, 226] }',
      run: (args) => {
        const reading = analyse(args);
        return { area: reading.area, note: reading.note };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const reading = analyse(state);
  return {
    stateVersion,
    center: reading.points.center,
    radius: reading.points.radius,
    A: reading.points.A,
    D: reading.points.D,
    reading: {
      points: reading.points,
      perpendiculars: reading.perpendiculars,
      power: reading.power,
      area: reading.area,
      note: reading.note,
    },
  };
}
