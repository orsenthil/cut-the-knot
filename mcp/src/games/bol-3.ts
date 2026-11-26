/*
 * run_game_logic actions and saved-position reader for BOL3 (Archimedes' Book of
 * Lemmas, Proposition 3).
 *
 * AB is a diameter, P is on the circle, N is the foot of the perpendicular from
 * P to AB, D is the reflection of A in N (so AN = ND), and Q is the other point
 * of the circle with PA = PQ. The proposition says BQ = BD. The core finds Q as
 * the reflection of A in the line OP (O and P are both equally far from A and
 * Q, so OP is the perpendicular bisector of AQ) and measures everything from
 * that one reflection. The core is copied into src/generated/cores/ at build
 * time. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-3"].Bol3Core;
type Point = { x: number; y: number };

/** Round for readable JSON; the checks themselves use the core's full precision. */
const r = (v: number, digits = 4) => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: r(p.x), y: r(p.y) });

/** Accept either [x, y] or {x, y}; reject anything that is not a finite point. */
function pointFrom(v: unknown, name: string): Point {
  let x: number;
  let y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`${name} must be a point [x, y] or {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${name} must have finite numeric coordinates`);
  }
  return { x, y };
}

/**
 * Build a core position from a request or a saved Track.state payload. The
 * game saves only {A, B, P}; P is projected onto the circle exactly as the
 * page's handle does, so a hand-entered point off the circle still gives a
 * valid illustration.
 */
function read(args: Json) {
  const C = core();
  const base = C.start({});
  const A = args.A === undefined ? base.A : pointFrom(args.A, "A");
  const B = args.B === undefined ? base.B : pointFrom(args.B, "B");
  if (C.dist(A, B) < 1e-9) throw new Error("A and B must be different points: AB is the diameter");
  const requested = args.P === undefined ? base.P : pointFrom(args.P, "P");
  const state = C.withP({ A, B, P: requested }, requested);
  return { state, requested };
}

/** The six lengths of the picture and all the proposition's checks. */
function reading(state: ReturnType<typeof read>["state"], requested: Point) {
  const C = core();
  const m = C.measure(state);
  const checks = C.claims(state);
  return {
    A: pt(m.A), B: pt(m.B), O: pt(m.O), radius: r(m.R, 6),
    requestedP: pt(requested), P: pt(m.P),
    radialOffset: r(C.dist(requested, m.O) - m.R, 6),
    N: pt(m.N), D: pt(m.D), Q: pt(m.Q),
    lengths: {
      PA: r(m.PA, 6), PQ: r(m.PQ, 6), AN: r(m.AN, 6), ND: r(m.ND, 6),
      PN: r(m.PN, 6), BQ: r(m.BQ, 6), BD: r(m.BD, 6), AB: r(m.AB, 6),
    },
    checks,
    allClaimsHold: Object.values(checks).every(Boolean),
  };
}

export function actions(): GameActions {
  return {
    at_point: {
      describe:
        "For a point P on the circle with diameter AB, give N (the foot of the perpendicular from P to AB), D (A reflected in N, so AN = ND), Q (A reflected in line OP, the other point with PA = PQ), all six lengths and each claim of Archimedes' Proposition 3 checked at this position. Pass P as [x, y] or {x, y}; it is snapped onto the circle. Optional A and B default to the applet's [50, 225] and [350, 225] on its 400 x 300 board.",
      args: '{ "P": [95.4663, 117.4235] }',
      run: (args) => {
        const C = core();
        const { state, requested } = read(args);
        const m = C.measure(state);
        return {
          ...reading(state, requested),
          note: `N is the foot of the perpendicular from P to AB (PN perpendicular to AB), and N is the midpoint of AD, so AN = ND = ${r(m.AN, 6)}. Since O is the centre and OP is the perpendicular bisector of AQ, Q is the other circle point with PA = PQ = ${r(m.PA, 6)}. Triangle PQD is isosceles and a cyclic-angle chase gives angles BQD = BDQ, hence BQ = BD = ${r(m.BQ, 6)}.`,
        };
      },
    },
    sweep: {
      describe:
        "Check Proposition 3 all the way around the circle: for each angle in degrees about the centre, report P, BQ, BD, AN, ND and whether every claim holds, plus the largest gaps. The default angles are the eight compass points; pass any list of angles (up to 720) to sample more positions, including P exactly at A and at B.",
      args: '{ "angles": [0, 45, 90, 135, 180, 225, 270, 315] }',
      run: (args) => {
        const C = core();
        const angles = args.angles === undefined ? [0, 45, 90, 135, 180, 225, 270, 315] : numArray(args, "angles");
        if (angles.length === 0) throw new Error("angles must contain at least one angle");
        if (angles.length > 720) throw new Error("angles may contain at most 720 entries");
        const base = C.start({});
        const A = args.A === undefined ? base.A : pointFrom(args.A, "A");
        const B = args.B === undefined ? base.B : pointFrom(args.B, "B");
        if (C.dist(A, B) < 1e-9) throw new Error("A and B must be different points: AB is the diameter");
        const { c: O, r: R } = C.circle({ A, B, P: base.P });
        let maxBqBd = 0;
        let maxAnNd = 0;
        let allHold = true;
        const rows = angles.map((angle) => {
          const t = (angle * Math.PI) / 180;
          const p = { x: O.x + R * Math.cos(t), y: O.y + R * Math.sin(t) };
          const s = C.withP({ A, B, P: p }, p);
          const m = C.measure(s);
          const checks = C.claims(s);
          const holds = Object.values(checks).every(Boolean);
          if (!holds) allHold = false;
          const bqBd = Math.abs(m.BQ - m.BD);
          const anNd = Math.abs(m.AN - m.ND);
          maxBqBd = Math.max(maxBqBd, bqBd);
          maxAnNd = Math.max(maxAnNd, anNd);
          return {
            angle, P: pt(m.P), BQ: r(m.BQ, 6), BD: r(m.BD, 6),
            AN: r(m.AN, 6), ND: r(m.ND, 6),
            bqMinusBd: r(bqBd, 9), anMinusNd: r(anNd, 9), holds,
          };
        });
        return {
          checked: angles.length,
          allClaimsHold: allHold,
          maxBQMinusBD: r(maxBqBd, 9),
          maxANMinusND: r(maxAnNd, 9),
          samples: rows.slice(0, 10),
          note: allHold
            ? `At all ${angles.length} positions the core's checks pass: BQ = BD and AN = ND (largest gaps ${r(maxBqBd, 9)} and ${r(maxAnNd, 9)}, floating-point round-off only).`
            : "At least one position failed a claim; check that A and B are distinct and angles are finite.",
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const { state: here, requested } = read(state);
  const C = core();
  const m = C.measure(here);
  const shown = reading(here, requested);
  return {
    stateVersion,
    saved: shown,
    circle: { centre: pt(m.O), radius: r(m.R, 6) },
    onCircle: Math.abs(shown.radialOffset) < 1e-6,
    note: `The saved P is ${r(requested.x)}, ${r(requested.y)}. At this spot AN = ND = ${r(m.AN, 6)} and BQ = BD = ${r(m.BQ, 6)}: Archimedes' third lemma holds. N is the midpoint of AD, and Q is A reflected across the line OP, so PA = PQ.`,
  };
}
