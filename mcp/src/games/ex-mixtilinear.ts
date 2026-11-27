/*
 * run_game_logic actions and saved-position reader for Ex Mixtilinear.
 *
 * The real core is ex-mixtilinear/ex-mixtilinear-core.js, copied into
 * src/generated/cores/ at build time. For a point K on BC there are two circles
 * touching AK, BC and the circumcircle from outside. Their centre lies on the
 * angle bisector at K, so it is K + t·u and tangency to the circumcircle gives
 * one quadratic in t: (1 - d0²)t² + 2(u·(K-O) - R·d0)t + (|K-O|² - R²) = 0.
 * The page claims that each circle's touch-chord (its two contact feet) and
 * the line of the two centres pass through the A-excenter E, and that when K
 * is the incircle's contact point both radii equal the A-exradius r_a. Both
 * claims are measured below by the same core the page draws with.
 *
 * Quirk kept from the applet and reported here: QuadraticEquation.Solve2
 * rejects a coefficient whose magnitude is below 0.01, so when AK is nearly
 * parallel to BC (|qa| = |1 - d0²| < 0.01) that circle is silently not drawn.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number; bc: Point; ak: Point };
type Circumcircle = { center: Point; radius: number };
type Figure = {
  circumcircle: Circumcircle | null;
  incenter: Point | null;
  incircleTouch: Point | null;
  excenter: Point | null;
  exradius: number | null;
  circles: (Circle | null)[];
  V: Point | null;
  W: Point | null;
  H: Point | null;
  O: Point | null;
  finished: boolean;
};
type State = {
  A: Point; B: Point; C: Point; K: Point;
  showNames: boolean; showHint: boolean;
};
type Quadratic = { d0: number; qa: number; qb: number; qc: number; disc: number; solverRejects: boolean };
interface ExMixtilinear {
  start(options?: Json): State;
  move(state: State, m: Json): State | null;
  snapToIncircle(state: State): State;
  figure(state: State): Figure;
  result(state: State): string | null;
  add(p: Point, q: Point): Point;
  sub(p: Point, q: Point): Point;
  scale(p: Point, k: number): Point;
  dot(p: Point, q: Point): number;
  cross(p: Point, q: Point): number;
  dist(p: Point, q: Point): number;
  distToLine(p: Point, a: Point, b: Point): number;
  mid(p: Point, q: Point): Point;
  unit(p: Point): Point | null;
  circumcircle(a: Point, b: Point, c: Point): Circumcircle | null;
}

const core = (): ExMixtilinear =>
  cores["ex-mixtilinear"].ExMixtilinearCore as unknown as ExMixtilinear;

/* The core is exact up to floating point; only what we print is rounded. */
const round = (v: number | null | undefined, digits = 6): number | null =>
  (typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(digits)) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toPrecision(6)) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x)!, y: round(p.y)! } : null;
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** A board point, accepted as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite numeric x and y`);
  return { x, y };
}

/**
 * A real core state from optional corners and K. Missing points use the core's
 * opening picture; a supplied K is snapped onto line BC by the core's move(),
 * just as the page's K handle is constrained to that line.
 */
function readState(C: ExMixtilinear, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, K points and display options");
  }
  const seed = C.start();
  const A = args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A");
  const B = args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B");
  const V = args.C === undefined || args.C === null ? seed.C : readPoint(args.C, "C");
  const K = args.K === undefined || args.K === null ? seed.K : readPoint(args.K, "K");
  if (near(C.dist(B, V), 0, 1e-9)) {
    throw new Error('"B" and "C" must be different points to define the side BC');
  }
  if (C.distToLine(A, B, V) < 1e-6) {
    throw new Error('"A", "B" and "C" are collinear, so there is no circumcircle or excenter');
  }
  const moved = C.move(
    {
      A, B, C: V, K,
      showNames: args.showNames === undefined ? seed.showNames : args.showNames === true,
      showHint: args.showHint === undefined ? seed.showHint : args.showHint === true,
    },
    { point: "K", x: K.x, y: K.y },
  );
  if (!moved) throw new Error("the core could not place K on the line BC");
  return moved;
}

/**
 * The tangency quadratic for the circle next to `vertex` (B gives the first
 * circle, C the second), transcribed from tangentCircle with the core's own
 * vector helpers. This is diagnostic only: the circle itself always comes from
 * the core. It exposes why Solve2 drops a circle near parallel lines.
 */
function quadratic(C: ExMixtilinear, s: State, vertex: Point): Quadratic | null {
  const cc = C.circumcircle(s.A, s.B, s.C);
  if (!cc) return null;
  const W = { x: 2 * s.K.x - s.A.x, y: 2 * s.K.y - s.A.y }; // reflect A in K
  const dv = C.unit(C.sub(vertex, s.K));
  const dw = C.unit(C.sub(W, s.K));
  if (!dv || !dw) return null;
  const u = C.unit(C.add(dv, dw));
  if (!u || C.dist(W, s.K) < 1e-12) return null;
  const d0 = Math.abs(C.cross(C.sub(W, s.K), u)) / C.dist(W, s.K);
  const delta = C.sub(s.K, cc.center);
  const qa = 1 - d0 * d0;
  const qb = C.dot(delta, u) - cc.radius * d0;
  const qc = C.dot(delta, delta) - cc.radius * cc.radius;
  const disc = qb * qb - qa * qc;
  return {
    d0: sig(d0)!, qa: sig(qa)!, qb: sig(qb)!, qc: sig(qc)!, disc: sig(disc)!,
    solverRejects: Math.abs(qa) < 0.01 || !Number.isFinite(disc) || disc < 0,
  };
}

/** Every measurement the core makes, in plain JSON. */
function reading(C: ExMixtilinear, s: State) {
  const fig = C.figure(s);
  const E = fig.excenter;
  const ra = fig.exradius;
  const circles = fig.circles.map((c, i) => {
    const side = i === 0 ? "next to B" : "next to C";
    const q = quadratic(C, s, i === 0 ? s.B : s.C);
    if (!c) {
      return {
        side, drawn: false, center: null, radius: null, contactOnBC: null, contactOnAK: null,
        excenterToChord: null, chordThroughExcenter: null, radiusOverExradius: null,
        quadratic: q,
        why: !q
          ? "the angle bisector at K is undefined here"
          : Math.abs(q.qa ?? 0) < 0.01
            ? "Solve2 rejects a coefficient of magnitude below 0.01 (AK nearly parallel to BC), so this circle is not drawn"
            : q.disc !== null && q.disc < 0
              ? "the tangency quadratic has no real root"
              : "the core could not construct this circle",
      };
    }
    const gap = E ? C.distToLine(E, c.bc, c.ak) : null;
    return {
      side, drawn: true,
      center: pt(c.center),
      radius: round(c.radius),
      contactOnBC: pt(c.bc),
      contactOnAK: pt(c.ak),
      excenterToChord: round(gap, 9),
      chordThroughExcenter: gap === null ? null : gap <= 1e-6 * Math.max(1, ra ?? 1),
      radiusOverExradius: ra ? round(c.radius / ra) : null,
      quadratic: q,
      why: null,
    };
  });
  const [first, second] = fig.circles;
  const centresGap = E && first && second ? C.distToLine(E, first.center, second.center) : null;
  const midVH = fig.V && fig.H ? C.mid(fig.V, fig.H) : null;
  const midWH = fig.W && fig.H ? C.mid(fig.W, fig.H) : null;
  const bothMatchExradius = !!(ra && first && second &&
    near(first.radius / ra, 1, 0.01) && near(second.radius / ra, 1, 0.01));

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    K: pt(s.K),
    showNames: s.showNames,
    showHint: s.showHint,
    circumcircle: fig.circumcircle
      ? { center: pt(fig.circumcircle.center), radius: round(fig.circumcircle.radius) }
      : null,
    incenter: pt(fig.incenter),
    incircleTouch: pt(fig.incircleTouch),
    excenter: pt(E),
    exradius: round(ra),
    circles,
    chords: {
      excenterToCentresLine: round(centresGap, 9),
      bothChordsAndCentresLineThroughExcenter: centresGap !== null &&
        centresGap <= 1e-6 * Math.max(1, ra ?? 1) &&
        circles.every((c) => c.chordThroughExcenter === true),
    },
    hint: {
      V: pt(fig.V), W: pt(fig.W), H: pt(fig.H), O: pt(fig.O),
      midpointVH: pt(midVH),
      midpointVHIsContactM: !!(midVH && first && C.dist(midVH, first.bc) < 1e-6),
      midpointWH: pt(midWH),
      midpointWHIsFirstCentre: !!(midWH && first && C.dist(midWH, first.center) < 1e-6),
    },
    bothRadiiEqualExradius: bothMatchExradius,
    finished: fig.finished,
    result: C.result(s),
  };
}

export function actions(): GameActions {
  return {
    tangent_chords: {
      describe:
        "For triangle corners A, B, C (each [x, y] or { x, y } in board coordinates, y downward; omit any to keep the core's opening picture) and a point K (snapped onto line BC by the core), run the real Ex Mixtilinear core. Report the circumcircle, the incenter and its touch point on BC, the A-excenter E and exradius, both tangent circles with their contact feet on BC and AK, the distance from E to each touch-chord and to the line of the two centres, the hint points V, W, H, O, and the tangency quadratic coefficients. A missing circle with |qa| < 0.01 is the applet's Solve2 quirk, not an error.",
      args: '{ "A": [203, 30], "B": [140, 280], "C": [260, 280], "K": [176, 280] }',
      run: (args) => {
        const C = core();
        const r = reading(C, readState(C, args));
        return {
          ...r,
          note:
            "Both contact chords, and the line joining the two circle centres, pass through the A-excenter E: each measured distance above is essentially zero. The quadratic's centre is K + t·u on the angle bisector at K; Solve2 refuses |qa| < 0.01, which happens when AK and BC are nearly parallel, and then draws no circle. Here both circles exist" +
            (r.finished
              ? " and both radii already equal the A-exradius r_a."
              : ", but their radii differ from r_a: move K to the incircle's contact point with equal_excircles."),
        };
      },
    },

    equal_excircles: {
      describe:
        "For an optional triangle A, B, C, move K to where the incircle touches BC (the page's 'Find equal circles' button) and run the real core there; report both circle radii, the A-exradius r_a, their ratios, and the core's finished signal. Also sample K at several other parameters along BC to show that only the incircle contact makes both radii equal r_a.",
      args: '{ "A": [203, 30], "B": [140, 280], "C": [260, 280] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const snapped = C.snapToIncircle(s);
        const r = reading(C, snapped);
        const side = C.sub(s.C, s.B);
        const tContact = C.dot(C.sub(snapped.K, s.B), side) / C.dot(side, side);
        const parameters = [0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 0.95];
        const sweep = parameters.map((p) => {
          const K = C.add(C.scale(s.B, 1 - p), C.scale(s.C, p));
          const fig = C.figure({ ...s, K });
          return {
            parameterOnBC: p,
            radii: fig.circles.map((c) => (c ? round(c.radius) : null)),
            radiiOverExradius: fig.circles.map((c) => (c && fig.exradius ? round(c.radius / fig.exradius) : null)),
            bothEqualExradius: fig.finished,
          };
        });
        return {
          triangle: r.triangle,
          contactParameterOnBC: round(tContact),
          KAtIncircleContact: r.K,
          incircleTouch: r.incircleTouch,
          exradius: r.exradius,
          circles: r.circles,
          bothRadiiEqualExradius: r.bothRadiiEqualExradius,
          finished: r.finished,
          result: r.result,
          otherPositionsOnBC: sweep,
          note:
            "At the incircle's contact point both radii equal the A-exradius (" + r.exradius +
            "), so the core reports the finished position that the page marks as done; the midpoint of W and H is then the first circle's centre O, while the midpoint of V and H is its contact M on BC. Away from that point one circle grows while the other shrinks. This is a demonstration, not a game: there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved and re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Ex Mixtilinear state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Ex Mixtilinear position must be an object");
  }
  const C = core();
  let savedReadable = true;
  let s: State;
  let saved: Json;
  try {
    const built = readState(C, state);
    s = built;
    saved = {
      A: pt(built.A), B: pt(built.B), C: pt(built.C), K: pt(built.K),
      showNames: built.showNames, showHint: built.showHint,
    };
  } catch (err) {
    savedReadable = false;
    s = C.start();
    saved = { ...state };
  }
  const r = reading(C, s);
  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    reading: r,
    isIllustration: true,
    note: !savedReadable
      ? "The saved fields could not be read as a triangle and a point on BC, so the core's opening picture was reconstructed; the reading below is of that picture."
      : "Track.state saved A, B, C, K (board units) and the two display checkboxes. The core recomputes the two tangent circles, their contact chords and the A-excenter they both pass through; if K is the incircle's contact point the radii both equal r_a. This is an illustration: there is no win or loss.",
  };
}
