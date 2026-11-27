/*
 * run_game_logic actions and saved-position reader for Fixed Tangent Point.
 *
 * From a circle with centre O and radius r, and a horizontal line m that misses
 * it, the tangent length from a point P on m satisfies PT² = OP² - r². Writing
 * M for the foot of the perpendicular from O to m and z² = OM² - r², the point
 * Q on MO with MQ = z gives PQ² = MP² + z² = OP² - r² = PT². Q is independent
 * of P, and reflecting it in m gives a second fixed point Q'; the circles
 * centred on m through their tangency point T are all orthogonal to C.
 *
 * Every number below is measured by the real core,
 * fixed-tangent-point/fixed-tangent-point-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are the applet's board units
 * with y down. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { names: boolean; hint: boolean; statement: boolean };
type State = {
  width: number; height: number;
  O: Pt; R: Pt; X: Pt; P: Pt;
  options: Options;
};
type Shown = {
  noDraw: boolean; noDot: boolean; radius: number;
  M: Pt | null; T: Pt[];
  tangentCircle: { center: Pt; radius: number } | null;
  Q: Pt | null; mirrorQ: Pt | null; N: Pt | null;
  z: number | null; tangentLength: number | null; pq: number | null;
};
type Core = {
  DEFAULT_WIDTH: number; DEFAULT_HEIGHT: number;
  dist(a: Pt, b: Pt): number;
  sqDist(a: Pt, b: Pt): number;
  start(options?: { width?: number; height?: number }): State;
  movePoint(s: State, name: string, p: Pt): State;
  compute(s: State, previous?: Shown | null): Shown;
  position(s: State, shown: Shown): Json;
  result(s: State): null;
};

const core = (): Core =>
  cores["fixed-tangent-point"].FixedTangentPointCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const numberOr = (raw: unknown, fallback: number): number =>
  raw !== undefined && raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
const boolOr = (raw: unknown, fallback: boolean): boolean =>
  typeof raw === "boolean" ? raw : fallback;

/** A board point, accepted as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A point that may be absent in a saved position (the applet keeps stale dots). */
function maybePoint(raw: unknown, fallback?: Pt): Pt | null {
  try {
    return readPoint(raw, "point", fallback);
  } catch {
    return null;
  }
}

function dimension(args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) {
    throw new Error(`argument "${key}" must be a positive board size, got ${JSON.stringify(raw)}`);
  }
  return n;
}

function onBoard(p: Pt, s: State, label: string): void {
  if (p.x < 0 || p.x > s.width || p.y < 0 || p.y > s.height) {
    throw new Error(`"${label}" = (${p.x}, ${p.y}) is off the ${s.width} x ${s.height} board`);
  }
}

/**
 * The core's Reset board, moved onto the caller's O, R, X and P. A numeric
 * radius may replace R, placing it to the left of O as in the opening picture.
 * P is snapped onto m (the applet's Fix(2) keeps P on the line through X).
 */
function makeState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with O, R (or radius), X and P points");
  }
  let s = C.start({
    width: dimension(args, "width", C.DEFAULT_WIDTH),
    height: dimension(args, "height", C.DEFAULT_HEIGHT),
  });
  const O = readPoint(args.O, "O", s.O);
  onBoard(O, s, "O");
  s = C.movePoint(s, "O", O);

  let R: Pt;
  if (args.radius !== undefined && args.R === undefined) {
    const radius = num(args, "radius");
    if (radius <= 0) throw new Error('argument "radius" must be positive');
    R = { x: O.x - radius, y: O.y };
  } else {
    R = readPoint(args.R, "R", s.R);
  }
  onBoard(R, s, args.R === undefined && args.radius !== undefined ? "radius" : "R");
  s = C.movePoint(s, "R", R);

  const X = readPoint(args.X, "X", s.X);
  onBoard(X, s, "X");
  s = C.movePoint(s, "X", X);

  const P = readPoint(args.P, "P", s.P);
  onBoard({ x: P.x, y: X.y }, s, "P");
  return C.movePoint(s, "P", { x: P.x, y: X.y });
}

/** Refuse the two cases where the applet stops drawing a fresh picture. */
function requireDrawable(C: Core, s: State): Shown {
  const r = C.dist(s.O, s.R);
  if (!(r > 0)) throw new Error('"R" must differ from O to define a circle');
  const op = C.dist(s.P, s.O);
  if (!(op > r)) {
    throw new Error(
      `P is inside or on the circle (OP = ${r6(op)}, r = ${r6(r)}); the applet's guard stops the redraw`,
    );
  }
  const gap = (s.O.y - s.X.y) ** 2 - r * r;
  if (!(gap > 0)) {
    throw new Error(
      `the line m meets or touches C (OM² - r² = ${r6(gap)}); the applet's square root is NaN and Q keeps its last drawn place`,
    );
  }
  const shown = C.compute(s, null);
  if (shown.noDraw || shown.noDot || !shown.Q || !shown.mirrorQ) {
    throw new Error("this position does not give a drawable tangent circle and fixed point");
  }
  return shown;
}

/** The four right triangles and equalities the page's math section describes. */
function reading(C: Core, s: State, g: Shown) {
  const { O, R, X, P } = s;
  const M = g.M!, Q = g.Q!, Qp = g.mirrorQ!, N = g.N;
  const r = g.radius, PT = g.tangentLength!, PQ = g.pq!, z = g.z!;
  const MP = C.dist(M, P), OM = C.dist(O, M), MQ = C.dist(M, Q), MN = N ? C.dist(M, N) : null;
  const tol = 1e-6 * Math.max(1, r, OM, MP);
  const op2 = C.sqDist(O, P), r2 = r * r, pt2 = PT * PT, pq2 = PQ * PQ;
  const triangle = (name: string, claim: string, left: number, right: number) => ({
    name, claim,
    left: r6(left), right: r6(right), residual: sig(left - right), holds: near(left, right, tol),
  });
  const tc = g.tangentCircle;
  return {
    circle: { center: pt(O), radius: r6(r), radiusPoint: pt(R) },
    line: { throughX: pt(X), y: r6(X.y), footM: pt(M), OM: r6(OM) },
    pointP: pt(P),
    tangency: {
      T: g.T.map(pt),
      tangentCircle: tc ? { center: pt(tc.center), radius: r6(tc.radius) } : null,
      PT: r6(PT),
      circlePassesThroughQ: !!tc && near(C.dist(tc.center, Q), tc.radius, tol),
      circlePassesThroughMirrorQ: !!tc && near(C.dist(tc.center, Qp), tc.radius, tol),
    },
    fixedPoint: {
      Q: pt(Q), MQ: r6(MQ), mirrorQ: pt(Qp), z: r6(z), MN: MN === null ? null : r6(MN),
      MNequalsZ: MN === null ? null : near(MN, z, tol),
      reflectedAcrossM: near(Q.x, Qp.x, tol) && near(2 * X.y - Q.y, Qp.y, tol),
    },
    lengths: {
      PQ: r6(PQ), PT: r6(PT), difference: sig(PQ - PT), equal: near(PQ, PT, tol),
      PQprime: r6(C.dist(P, Qp)), equalToMirror: near(PQ, C.dist(P, Qp), tol),
      derivedPQ2: r6(MP * MP + z * z), measuredPQ2: r6(pq2),
    },
    orthogonality: {
      claim: "OP² = r² + PT²",
      OP2: r6(op2), r2: r6(r2), PT2: r6(pt2),
      residual: sig(op2 - r2 - pt2), holds: near(op2, r2 + pt2, tol),
    },
    fourRightTriangles: [
      triangle("OPT", "r² + PT² = OP²", r2 + pt2, op2),
      triangle("OMP", "OM² + MP² = OP²", OM * OM + MP * MP, op2),
      triangle("QMP", "MQ² + MP² = PQ²", MQ * MQ + MP * MP, pq2),
      MN === null ? null : triangle("OMN", "ON² + MN² = OM²", r2 + MN * MN, OM * OM),
    ],
    note:
      "PT² = OP² - r² (radius OT perpendicular to tangent PT), and with MQ = z = MN, PQ² = MP² + z² = OP² - r², so PQ = PT whatever P does: the circle centred at P through T always passes through the same Q. Reflecting Q in m gives Q' with PQ' = PQ; the circles are orthogonal to C and m is their radical axis. There is no win or loss in this illustration.",
  };
}

export function actions(): GameActions {
  return {
    fixed_point: {
      describe:
        "For a circle with centre O and radius point R (or a numeric radius), a horizontal line through its handle X and a point P on that line, report the fixed point Q with PQ = PT, its reflected twin Q', the tangent points T, the orthogonality OP² = r² + PT² and the four right triangles behind the proof. Points are board units (y down), as [x, y] or {x, y}; omit any to keep the opening picture, and P is snapped onto the line. The line must miss the circle and P must lie outside it, as in the applet.",
      args: '{"width":480,"height":360,"O":[242,90],"R":[180,135],"X":[460,216],"P":[318,216]}',
      run: (args) => {
        const C = core();
        const s = makeState(C, args);
        const g = requireDrawable(C, s);
        return {
          board: { width: s.width, height: s.height },
          ...reading(C, s, g),
        };
      },
    },

    slide_p: {
      describe:
        "Slide P along the horizontal line m and watch the circle centred at P through the tangent point T. For each x in xs report PT, PQ, Q and Q', and check PQ = PT, that Q never moves, and that OP² = r² + PT² still holds; positions where P goes inside the circle are reported as not drawable. Accepts O, R (or radius) and X as in fixed_point; xs defaults to three positions across the board.",
      args: '{"width":480,"height":360,"O":[242,90],"R":[180,135],"X":[460,216],"xs":[96,240,384]}',
      run: (args) => {
        const C = core();
        const base = makeState(C, args);
        const first = requireDrawable(C, base);
        const raw = args.xs;
        let xs: number[];
        if (raw === undefined || raw === null) {
          xs = [0.2, 0.5, 0.8].map((f) => f * base.width);
        } else {
          if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
            throw new Error('argument "xs" must be an array of 1 to 20 x coordinates');
          }
          xs = raw.map((x, i) => {
            const n = Number(x);
            if (!Number.isFinite(n)) throw new Error(`xs[${i}] must be a finite number`);
            return n;
          });
        }
        const drawn: Array<{ s: State; g: Shown }> = [];
        const samples = xs.map((x) => {
          const s = C.movePoint(base, "P", { x, y: base.X.y });
          const at = pt(s.P)!;
          if (!(C.dist(s.P, s.O) > first.radius)) {
            return {
              x: at.x, P: at, drawable: false,
              reason: "P is inside or on C, so the applet stops redrawing",
            };
          }
          const g = C.compute(s, null);
          if (g.noDraw || g.noDot || !g.Q || !g.mirrorQ) {
            return {
              x: at.x, P: at, drawable: false,
              reason: "the line does not give a real z, so Q is not drawn afresh",
            };
          }
          drawn.push({ s, g });
          return {
            x: at.x, P: at, drawable: true,
            PT: r6(g.tangentLength!), PQ: r6(g.pq!),
            equal: near(g.pq!, g.tangentLength!, 1e-6 * Math.max(1, first.radius)),
            Q: pt(g.Q), mirrorQ: pt(g.mirrorQ),
            orthogonalityResidual: sig(
              C.sqDist(s.O, s.P) - g.radius * g.radius - g.tangentLength! * g.tangentLength!,
            ),
          };
        });
        const anchor = drawn[0];
        const tol = 1e-6 * Math.max(1, first.radius);
        const qStays = anchor
          ? drawn.every(({ g }) => C.dist(g.Q!, anchor.g.Q!) <= tol &&
              C.dist(g.mirrorQ!, anchor.g.mirrorQ!) <= tol)
          : false;
        return {
          board: { width: base.width, height: base.height },
          line: { y: r6(base.X.y), footM: pt(first.M), z: r6(first.z ?? NaN) },
          fixedQ: anchor ? pt(anchor.g.Q!) : null,
          fixedMirrorQ: anchor ? pt(anchor.g.mirrorQ!) : null,
          samples,
          qNeverMoves: qStays,
          allPQequalPT: drawn.every(({ g }) => near(g.pq!, g.tangentLength!, tol)),
          allOrthogonal: drawn.every(({ s, g }) =>
            near(C.sqDist(s.O, s.P), g.radius * g.radius + g.tangentLength! * g.tangentLength!, tol)),
          note:
            "Q depends only on O, X and r (through z² = OM² - r²), so sliding P changes the drawn circle's radius PT but not Q. Each radius still equals PQ, and every circle stays orthogonal to C because OP² = r² + PT². This is an illustration: there is no win or loss.",
        };
      },
    },
  };
}

/** A state rebuilt from the fields Track.state saved, with safe fallbacks. */
function savedState(C: Core, state: Json): State {
  const seed = C.start({
    width: numberOr(state.width, C.DEFAULT_WIDTH),
    height: numberOr(state.height, C.DEFAULT_HEIGHT),
  });
  const O = maybePoint(state.O, seed.O)!;
  const R = maybePoint(state.R, seed.R)!;
  const X = maybePoint(state.X, seed.X)!;
  const P = maybePoint(state.P, seed.P)!;
  const options = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
  return {
    width: seed.width, height: seed.height,
    O, R, X, P: { x: P.x, y: X.y },
    options: {
      names: boolOr(options.names, seed.options.names),
      hint: boolOr(options.hint, seed.options.hint),
      statement: boolOr(options.statement, seed.options.statement),
    },
  };
}

function statusText(g: Shown): string {
  if (g.noDraw) return "P is inside the circle. Move it or the centre until the line misses the circle.";
  if (g.noDot || !g.Q) return "The line cuts the circle. Move X until the line clears it, then Q appears again.";
  return `PQ = ${r6(g.pq!)} and PT = ${r6(g.tangentLength!)}. Slide P: the point Q stays where it is.`;
}

/** Echo the fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Fixed Tangent Point state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Fixed Tangent Point position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const options = state.options && typeof state.options === "object" ? state.options as Json : {};
  const saved = {
    width: s.width, height: s.height,
    O: pt(s.O), R: pt(s.R), X: pt(s.X), P: pt(s.P),
    M: pt(maybePoint(state.M)), Q: pt(maybePoint(state.Q)),
    mirrorQ: pt(maybePoint(state.mirrorQ)), N: pt(maybePoint(state.N)),
    T: Array.isArray(state.T) ? state.T.map((p) => pt(maybePoint(p))).filter((p) => p !== null) : [],
    radius: state.radius === undefined ? null : r6(numberOr(state.radius, NaN)),
    tangentLength: state.tangentLength === undefined ? null : r6(numberOr(state.tangentLength, NaN)),
    pq: state.pq === undefined ? null : r6(numberOr(state.pq, NaN)),
    noDraw: state.noDraw === true, noDot: state.noDot === true,
    options: {
      names: boolOr(options.names, s.options.names),
      hint: boolOr(options.hint, s.options.hint),
      statement: boolOr(options.statement, s.options.statement),
    },
  };
  const shown = C.compute(s, null);
  const common = {
    ...state,
    stateVersion,
    saved,
    status: statusText(shown),
  };
  if (shown.noDraw || shown.noDot || !shown.Q || !shown.mirrorQ) {
    return {
      ...common,
      valid: false,
      reason: shown.noDraw ? "P is inside C: the applet keeps the last picture" :
        "m cuts C: z is not real, so the applet keeps the last drawn Q and N",
      reading: { Q: null, mirrorQ: null, T: shown.T.map(pt), M: pt(shown.M) },
      note:
        "The core recomputes from the saved O, R, X and P. When z is not real the applet keeps Q and N from its last draw; a position saved then cannot be reconstructed from this state alone, so no fresh fixed point is reported. This illustration has no win or loss.",
    };
  }
  const gap = (raw: unknown, actual: Pt | null): number | null => {
    const p = maybePoint(raw);
    return p && actual ? r6(C.dist(p, actual)) : null;
  };
  return {
    ...common,
    valid: true,
    reading: reading(C, s, shown),
    agreesWithSaved: {
      Q: gap(state.Q, shown.Q),
      mirrorQ: gap(state.mirrorQ, shown.mirrorQ),
      N: gap(state.N, shown.N),
      T: shown.T.map((t, i) => gap(Array.isArray(state.T) ? state.T[i] : undefined, t)),
      radius: state.radius === undefined ? null : sig(C.dist(s.O, s.R) - numberOr(state.radius, NaN)),
      tangentLength: state.tangentLength === undefined ? null : sig(shown.tangentLength! - numberOr(state.tangentLength, NaN)),
      pq: state.pq === undefined ? null : sig(shown.pq! - numberOr(state.pq, NaN)),
    },
    note:
      "Track.state saved the four handles O, R, X, P, the drawn points M, N, T, Q and its mirror, the measured lengths, the two quiet-picture flags and the three display options. The core rebuilds Q and its twin from O, R and X alone: they stay put as P slides, and PQ = PT with OP² = r² + PT². There is no win or loss; the tracker records exploration.",
  };
}
