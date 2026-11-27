/*
 * run_game_logic actions and saved-position reader for Four Touching Circles 3
 * (Bogomolny's applet FourTouchingCircles3).
 *
 * Four circles are dragged by a centre point and a rim point; where two
 * circles touch, the contact point is marked. When three contacts exist the
 * applet draws the circle through them. The page's claim is that the fourth
 * contact of the ring lies on that circle exactly when the number of outside
 * (external) touches is even. This third applet lets both parities happen;
 * the first FourTouchingCircles applet used an inversion that kept only even
 * rings, so its blanket concyclicity claim was too broad.
 *
 * Every measurement below comes from the game's real core,
 * four-touching-circles-3/four-touching-circles-3-core.js, copied at build time
 * into src/generated/cores/. The concyclicity determinant is an independent
 * check on the core's own four contact points. Coordinates are board units of
 * the 480 x 320 view, y down. This is a drawing: there is no win or loss.
 * See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleHandle = { c: Pt; b: Pt };
type Show = { circles: boolean; points: boolean; inversion: boolean; centers: boolean };
type State = { circles: CircleHandle[]; inv: CircleHandle; show: Show };
type Contact = { point: Pt; tangent: Pt; pair: [number, number]; external: boolean };
type DrawnCircle = { x: number; y: number; c: Pt; b: Pt; r: number };
type Geometry = {
  circles: DrawnCircle[];
  contacts: Contact[];
  centerLines: [DrawnCircle, DrawnCircle][];
  circle: { x: number; y: number; r: number } | null;
  inversions: Json[];
  chain: { hits: number; external: number | null; onCircle: boolean | null };
};
type Core = {
  WIDTH: number; HEIGHT: number; EDGE: number;
  PAIRS: number[][]; CHAIN: number[][];
  start(options?: Partial<State>): State;
  setPoint(s: State, name: string, q: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  position(s: State): Json;
  dist(p: Pt, q: Pt): number;
  circleData(s: State): DrawnCircle[];
  geometry(s: State): Geometry;
};
const core = (): Core =>
  cores["four-touching-circles-3"].FourTouchingCircles3Core as unknown as Core;

const CONCYCLIC_TOL = 1e-4; // on the determinant normalised by max radius^3
const ODD_TARGET = { x: 252.2727, y: 183.7758 }; // circle 4 slid inside circle 3

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number): string => (Number.isFinite(v) ? Number(v.toExponential(3)).toString() : "NaN");
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleOut = (c: { x: number; y: number; r: number } | null) =>
  c ? { center: pt(c), radius: r6(c.r) } : null;
const gap = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);

/** Accept the tutor's [x, y] and the page's saved { x, y } points alike. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (raw && typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** One circle's centre c and rim point b; omitted parts keep the core's picture. */
function readCircleHandle(raw: unknown, label: string, fallback: CircleHandle): CircleHandle {
  if (raw === undefined || raw === null) return { c: { ...fallback.c }, b: { ...fallback.b } };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`argument "${label}" must be an object with centre c and rim point b`);
  }
  const o = raw as Json;
  return { c: readPoint(o.c, `${label}.c`), b: readPoint(o.b, `${label}.b`) };
}

function readShow(raw: unknown, fallback: Show): Show {
  if (raw === undefined || raw === null) return { ...fallback };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('argument "show" must be an object of boolean display flags');
  }
  const o = raw as Json;
  const out = { ...fallback };
  for (const key of ["circles", "points", "inversion", "centers"] as const) {
    if (o[key] !== undefined && o[key] !== null) {
      if (typeof o[key] !== "boolean") {
        throw new Error(`show.${key} must be a boolean, got ${JSON.stringify(o[key])}`);
      }
      out[key] = o[key] as boolean;
    }
  }
  return out;
}

/** Build a core state: the same four centre/rim pairs the page's handles save. */
function buildState(C: Core, args: Json): State {
  if (args && (typeof args !== "object" || Array.isArray(args))) {
    throw new Error("arguments must be an object with circles, inv and show");
  }
  const given = (args && typeof args === "object" ? args : {}) as Json;
  const seed = C.start({});
  let circles: CircleHandle[] = seed.circles;
  if (given.circles !== undefined && given.circles !== null) {
    if (!Array.isArray(given.circles) || given.circles.length !== 4) {
      throw new Error('argument "circles" must be an array of exactly four { c, b } circles');
    }
    circles = given.circles.map((v, i) => readCircleHandle(v, `circles[${i}]`, seed.circles[i]));
  }
  const inv = readCircleHandle(given.inv, "inv", seed.inv);
  const show = readShow(given.show, seed.show);
  // start() applies the page's edge clamping and fills in any missing field.
  return C.start({ circles, inv, show });
}

/** Four-by-four determinant, zero iff the four points are concyclic. */
function concyclicity(points: Pt[], scale: number): number {
  const m = points.map((p) => [p.x * p.x + p.y * p.y, p.x, p.y, 1]);
  let det = 1;
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let i = col + 1; i < 4; i++) {
      if (Math.abs(m[i][col]) > Math.abs(m[pivot][col])) pivot = i;
    }
    if (Math.abs(m[pivot][col]) < 1e-14) return 0;
    if (pivot !== col) { [m[col], m[pivot]] = [m[pivot], m[col]]; det = -det; }
    det *= m[col][col];
    for (let i = col + 1; i < 4; i++) {
      const f = m[i][col] / m[col][col];
      for (let k = col; k < 4; k++) m[i][k] -= f * m[col][k];
    }
  }
  return det / Math.max(1, scale) ** 3;
}

const samePair = (a: number[], i: number, j: number): boolean =>
  (a[0] === i && a[1] === j) || (a[0] === j && a[1] === i);

/** All the page's objects and claims, measured on one core state. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const radii = g.circles.map((c) => c.r);
  const chainContacts = C.CHAIN.map(([i, j]) => g.contacts.find((t) => samePair(t.pair, i, j)) || null);
  const fourFound = chainContacts.every(Boolean) && Number.isFinite(g.circle?.r);
  const missing = chainContacts.find((t) => t && !g.contacts.slice(0, 3).some((u) => u.point === t.point));
  const fourthGap = fourFound && missing && g.circle
    ? Math.abs(C.dist(g.circle, missing.point!) - g.circle.r)
    : null;
  const det = fourFound
    ? concyclicity(chainContacts.map((t) => t!.point), Math.max(...radii))
    : null;
  const parity = g.chain.external === null ? null : g.chain.external % 2;
  const strictlyConcyclic = det === null ? null : Math.abs(det) < CONCYCLIC_TOL;
  // The page's own status line uses the core's 0.5-unit onCircle test; the
  // determinant is a separate, stricter mathematical measurement.
  const claimHolds = parity === null || g.chain.onCircle === null
    ? null
    : (parity === 0) === g.chain.onCircle;
  let verdict: string;
  if (!fourFound) {
    verdict = `only ${g.chain.hits} of the four ring contacts were found, so the parity claim cannot be tested`;
  } else if (parity === 1 && !g.chain.onCircle) {
    verdict = `odd: ${g.chain.external} external touches, the fourth contact is off the circle — the claim holds`;
  } else if (parity === 0 && g.chain.onCircle) {
    verdict = `even: ${g.chain.external} external touches, the fourth contact is on the circle — the claim holds`;
  } else {
    verdict = `unexpected: ${g.chain.external} external touches with fourth contact on circle = ${String(g.chain.onCircle)}`;
  }
  return {
    board: { width: C.WIDTH, height: C.HEIGHT },
    circles: g.circles.map((c, i) => ({ index: i, center: pt(c.c), radius: r6(c.r) })),
    contacts: g.contacts.map((t) => ({
      pair: t.pair,
      kind: t.external ? "external" : "internal",
      point: pt(t.point),
      tangent: pt(t.tangent),
    })),
    circleThroughFirstThree: circleOut(g.circle),
    chain: {
      pairs: C.CHAIN.map(([i, j]) => [i, j]),
      hits: g.chain.hits,
      externalTouches: g.chain.external,
      parity: parity === null ? null : parity === 0 ? "even" : "odd",
      fourthContactOnCircle: g.chain.onCircle,
      fourthContactGap: fourthGap === null ? null : r6(fourthGap),
      concyclicityDeterminant: det === null ? null : sig(det),
      strictTolerance: CONCYCLIC_TOL,
      strictlyConcyclic,
    },
    claim: { statement: "four contacts are concyclic iff the number of external touches is even", verdict, holds: claimHolds },
    note:
      "The core's circle is the one through contacts (0,1), (0,3) and (1,2); the contact on (2,3) is the one the page asks about, judged by the core's 0.5-unit onCircle test. " +
      "The determinant is a stricter independent check: the applet accepts a touch within 2 px (3 px after three contacts), so a dragged, only approximately tangent ring can have a nonzero determinant while the core still reports the fourth contact on the circle. " +
      "This is the third applet, where odd parity happens and the fourth point really leaves the circle; the first FourTouchingCircles applet's inversion kept only even rings, which made its claim look universal.",
  };
}

/** The odd-parity ring used by the page's play scenario: circle 4 slides inside circle 3. */
function oddRing(C: Core): State {
  const seed = C.start({});
  const original = seed.circles[3];
  const shift = { x: ODD_TARGET.x - original.c.x, y: ODD_TARGET.y - original.c.y };
  let odd = C.setPoint(C.start({}), "c3", ODD_TARGET);
  odd = C.setPoint(odd, "b3", { x: original.b.x + shift.x, y: original.b.y + shift.y });
  return odd;
}

export function actions(): GameActions {
  return {
    four_contact_points: {
      describe:
        "Rebuild the four circles from their centres c and rim points b (each [x, y] or { x, y } on the 480 x 320 board; omit circles for the opening ring) and run the real core's geometry. Reports every touching pair with its contact point, the circle drawn through the first three contacts, the number of external touches around the ring, and whether the fourth contact lies on that circle. An even number of external touches makes all four contacts concyclic; an odd number breaks it.",
      args: '{"circles":[{"c":[150,160],"b":[210,160]},{"c":[194.5455,59.4232],"b":[244.5455,59.4232]},{"c":[260,160],"b":[330,160]},{"c":[195,254.8683],"b":[240,254.8683]}]}',
      run: (args) => {
        const C = core();
        return reading(C, buildState(C, args));
      },
    },

    even_vs_odd: {
      describe:
        "No arguments needed. Compares the core on the opening ring (four external touches) with the same ring after circle 4 slides inside circle 3 (three external touches, one internal). Reports each contact pattern, the circle through the first three contacts, the fourth contact's gap from it and an independent concyclicity determinant, showing even parity keeps the four contacts on one circle while odd parity sends the fourth off it. This is Four Touching Circles III: unlike the first FourTouchingCircles applet, whose inversion kept only even rings, this one lets odd parity break the claim.",
      args: "{}",
      run: (args) => {
        if (args && (typeof args !== "object" || Array.isArray(args))) {
          throw new Error("even_vs_odd takes no arguments; pass {} or omit them");
        }
        const C = core();
        const even = reading(C, C.start({}));
        const odd = reading(C, oddRing(C));
        return {
          even: {
            circles: even.circles, contacts: even.contacts,
            circleThroughFirstThree: even.circleThroughFirstThree, chain: even.chain, claim: even.claim,
          },
          odd: {
            circles: odd.circles, contacts: odd.contacts,
            circleThroughFirstThree: odd.circleThroughFirstThree, chain: odd.chain, claim: odd.claim,
          },
          difference: {
            externalTouches: { even: even.chain.externalTouches, odd: odd.chain.externalTouches },
            fourthContactGap: { even: even.chain.fourthContactGap, odd: odd.chain.fourthContactGap },
            strictlyConcyclic: { even: even.chain.strictlyConcyclic, odd: odd.chain.strictlyConcyclic },
          },
          note:
            `Even ring: ${even.chain.externalTouches} external touches, fourth gap ${String(even.chain.fourthContactGap)}, determinant ${even.chain.concyclicityDeterminant} — concyclic. ` +
            `Odd ring: ${odd.chain.externalTouches} external touches, fourth gap ${String(odd.chain.fourthContactGap)}, determinant ${odd.chain.concyclicityDeterminant} — not concyclic. ` +
            "Moving one circle across a neighbour changes the parity, and with it whether the fourth contact lies on the circle.",
        };
      },
    },
  };
}

/** Echo Track.state's saved fields, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Touching Circles 3 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Touching Circles 3 position must be an object");
  }
  const C = core();
  let s: State;
  try {
    s = buildState(C, state);
  } catch (err) {
    return {
      ...state, stateVersion, valid: false, core: null,
      note: `The saved circles, inversion circle or display flags could not be read: ${(err as Error).message}`,
    };
  }
  const r = reading(C, s);
  return {
    ...state,
    stateVersion,
    saved: {
      circles: s.circles.map((d) => ({ c: pt(d.c), b: pt(d.b) })),
      inv: { c: pt(s.inv.c), b: pt(s.inv.b) },
      show: { ...s.show },
    },
    valid: true,
    core: r,
    note:
      "Track.state saved the four circles as centre and rim points, the inversion circle and the four display flags, in board units. " +
      "The core rebuilds all touching pairs, the circle through the first three contacts and the even-parity concyclicity claim from those handles; " +
      "this is a drawing, so there is no win or loss.",
  };
}
