/*
 * run_game_logic actions and saved-position reader for Van Schooten's Locus
 * Problem. The core (ellipse-by-van-schooten/ in the site, copied into
 * src/generated/cores/ at build time) draws the circle through O, A and B and
 * the diameter through C; every number below is measured from that core. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ellipse-by-van-schooten"].EllipseByVanSchootenCore;

type Point = { x: number; y: number };

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/* Circles and diameter ends can be NaN when three points are collinear. */
function safeNum(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function safePoint(p: unknown): Point | null {
  if (!p || typeof p !== "object") return null;
  const q = p as Json;
  const x = safeNum(q.x), y = safeNum(q.y);
  return x === null || y === null ? null : { x, y };
}

function optionsOf(args: Json) {
  const raw = (args.options && typeof args.options === "object" ? args.options : args) as Json;
  return {
    names: raw.names === undefined ? true : !!raw.names,
    hint: raw.hint === undefined ? false : !!raw.hint,
    trace: raw.trace === undefined ? false : !!raw.trace,
    rigid: raw.rigid === undefined ? true : !!raw.rigid,
  };
}

/**
 * A complete core state from the triangle's starting data: the two arms and
 * the two fixed angles determine C, and with it the circle and the diameter.
 * `rigid` may be forced on for the sliding action, which needs AB constant.
 */
function build(args: Json, forcedRigid?: boolean) {
  const C = core();
  const options = optionsOf(args);
  if (forcedRigid !== undefined) options.rigid = forcedRigid;
  const start = C.start(options);
  const O = args.O === undefined ? start.O : readPoint(args.O, "O");
  const shift = { x: O.x - start.O.x, y: O.y - start.O.y };
  const X = args.X === undefined
    ? { x: start.X.x + shift.x, y: start.X.y + shift.y }
    : readPoint(args.X, "X");
  const Y = args.Y === undefined
    ? { x: start.Y.x + shift.x, y: start.Y.y + shift.y }
    : readPoint(args.Y, "Y");
  const ca = num(args, "coefA", start.coefA);
  const cb = num(args, "coefB", start.coefB);
  if (ca < 0 || ca > 1 || cb < 0 || cb > 1) {
    throw new Error("coefA and coefB must lie between 0 and 1 (the fraction along the arm from O)");
  }
  const A = args.A === undefined ? C.lerp(O, X, ca) : readPoint(args.A, "A");
  const B = args.B === undefined ? C.lerp(O, Y, cb) : readPoint(args.B, "B");
  const angleC = num(args, "angleC", start.angles.x);
  const angleB = num(args, "angleB", start.angles.y);
  const s = Object.assign({}, start, {
    O, X, Y, A, B,
    As: { x: A.x, y: A.y }, Bs: { x: B.x, y: B.y },
    angles: { x: angleC, y: angleB },
    length: C.dist(A, B),
    coefA: C.lineParameter(O, X, A),
    coefB: C.lineParameter(O, Y, B),
    options, trace: [],
  });
  return C.upgradePFromAngles(s);
}

function unit(p: Point): Point | null {
  const r = Math.hypot(p.x, p.y);
  return r > 0 ? { x: p.x / r, y: p.y / r } : null;
}

/* The two distances from C to the ends of the diameter through C. */
function halfAxes(C: ReturnType<typeof core>, s: ReturnType<typeof build>) {
  const P = safePoint(s.P), Q = safePoint(s.Q);
  const M = safePoint(s.circle && s.circle.center);
  const R = safeNum(s.circle && s.circle.radius);
  const MC = M ? C.dist(M, s.C) : null;
  const CP = P ? C.dist(s.C, P) : null;
  const CQ = Q ? C.dist(s.C, Q) : null;
  return {
    P, Q, MC, CP, CQ,
    OMplusMC: R !== null && MC !== null ? R + MC : null,
    OMminusMCAbs: R !== null && MC !== null ? Math.abs(R - MC) : null,
    agree: CP !== null && CQ !== null && R !== null && MC !== null
      ? Math.min(Math.abs(CP - (R + MC)), Math.abs(CP - Math.abs(R - MC))) < 1e-6 &&
        Math.min(Math.abs(CQ - (R + MC)), Math.abs(CQ - Math.abs(R - MC))) < 1e-6
      : null,
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "Draw circle L through O, A and B and check the trammel: AB is its diameter (Thales), the diameter through C meets it at P and Q with OP perpendicular to OQ, and CP and CQ are the ellipse's half-axes OM + MC and |OM - MC|.",
      args: '{ "O": {"x":174.43,"y":142.86}, "X": {"x":323,"y":142.86}, "Y": {"x":174.43,"y":50}, "A": {"x":263.57,"y":142.86}, "B": {"x":174.43,"y":96.43} }',
      run: (args) => {
        const C = core();
        const s = build(args);
        const M = safePoint(s.circle && s.circle.center);
        const R = safeNum(s.circle && s.circle.radius);
        const h = halfAxes(C, s);
        const oa = C.sub(s.A, s.O), ob = C.sub(s.B, s.O);
        const dotO = C.dot(oa, ob);
        const dotPQ = h.P && h.Q ? C.dot(C.sub(h.P, s.O), C.sub(h.Q, s.O)) : null;
        const mid = h.P && h.Q ? C.lerp(h.P, h.Q, 0.5) : null;
        const radiusFromAB = C.dist(s.A, s.B) / 2;
        return {
          O: s.O, A: s.A, B: s.B, C: s.C,
          circle: M && R !== null ? { center: M, radius: R } : null,
          AB: C.dist(s.A, s.B), radiusFromAB,
          angleAOB: {
            dot: dotO,
            isRight: Math.abs(dotO) < 1e-8 * Math.hypot(oa.x, oa.y) * Math.hypot(ob.x, ob.y),
          },
          diameter: h.P && h.Q
            ? { P: h.P, Q: h.Q, length: C.dist(h.P, h.Q), midpoint: mid,
                isDiameter: !!M && !!mid && C.dist(mid, M) < 1e-6 &&
                  Math.abs(C.dist(h.P, h.Q) - 2 * R!) < 1e-6 }
            : null,
          OPperpendicularOQ: dotPQ === null ? null : { dot: dotPQ, isRight: Math.abs(dotPQ) < 1e-6 },
          MC: h.MC,
          halfAxes: {
            OMplusMC: h.OMplusMC, OMminusMCAbs: h.OMminusMCAbs,
            CP: h.CP, CQ: h.CQ, match: h.agree,
          },
          fromCore: C.describe(s),
          note: "O, A and B lie on L, so Thales' theorem makes AB a diameter and its radius AB/2. PQ is the diameter through C: M is its midpoint and OP is perpendicular to OQ, so C rides a fixed-length rod whose two ends slide on perpendicular lines, and CP, CQ are the ellipse's half-axes.",
        };
      },
    },
    slide: {
      describe:
        "Slide A along the horizontal arm with the triangle rigid (AB fixed) and sample the resulting C positions in the perpendicular OP/OQ frame. The circle radius stays AB/2 and every C satisfies (u/big)^2 + (v/small)^2 = 1, the ellipse with those half-axes.",
      args: '{ "O": {"x":174.43,"y":142.86}, "X": {"x":323,"y":142.86}, "Y": {"x":174.43,"y":50}, "A": {"x":263.57,"y":142.86}, "B": {"x":174.43,"y":96.43}, "coefficients": [0.1, 0.25, 0.4, 0.55, 0.65] }',
      run: (args) => {
        const C = core();
        const s = build(args, true); // AB stays fixed, as with "Define triangle" off.
        const coefs = args.coefficients === undefined
          ? [0.1, 0.25, 0.4, 0.55, 0.65]
          : numArray(args, "coefficients");
        if (!coefs.length || coefs.length > 20) {
          throw new Error("coefficients must contain between 1 and 20 numbers");
        }
        if (coefs.some((c) => c < 0 || c > 1)) {
          throw new Error("each coefficient must lie between 0 and 1 (the fraction along the arm from O)");
        }
        const P0 = safePoint(s.P), Q0 = safePoint(s.Q);
        const R0 = safeNum(s.circle && s.circle.radius);
        const h = halfAxes(C, s);
        if (!P0 || !Q0 || h.CP === null || h.CQ === null || R0 === null) {
          return { note: "This starting triangle has no diameter through C; choose three points that are not nearly collinear." };
        }
        const u0 = unit(C.sub(P0, s.O));
        const v0 = unit(C.sub(Q0, s.O));
        if (!u0 || !v0) {
          return { note: "O coincides with P or Q, so the perpendicular frame is undefined." };
        }
        const big = Math.max(h.CP, h.CQ), small = Math.min(h.CP, h.CQ);
        const samples = coefs.map((coef) => {
          const target = C.lerp(s.O, s.X, coef);
          const next = C.moveA(s, { x: target.x, y: s.O.y });
          const u = C.dot(C.sub(next.C, s.O), u0);
          const v = C.dot(C.sub(next.C, s.O), v0);
          // P and Q may swap ends, so try both pairings of the half-axes.
          const residual = Math.min(
            Math.abs((u / big) ** 2 + (v / small) ** 2 - 1),
            Math.abs((u / small) ** 2 + (v / big) ** 2 - 1),
          );
          return {
            coefficient: coef,
            A: next.A, B: next.B, C: next.C,
            radius: safeNum(next.circle && next.circle.radius),
            halfAxesFromC: next.P && next.Q
              ? [C.dist(next.C, next.P), C.dist(next.C, next.Q)]
              : null,
            ellipseResidual: residual,
          };
        });
        const radii = samples.map((s) => s.radius).filter((r): r is number => r !== null);
        const residual = Math.max(...samples.map((s) => s.ellipseResidual));
        return {
          frame: { O: s.O, axisOP: u0, axisOQ: v0, radius: R0, halfAxes: { big, small } },
          samples,
          radiusSpread: radii.length ? Math.max(...radii) - Math.min(...radii) : null,
          maxEllipseResidual: residual,
          note: `With AB fixed the circle keeps radius ${R0.toFixed(4)} (the spread across the samples is ${(radii.length ? Math.max(...radii) - Math.min(...radii) : 0).toExponential(1)}). C's coordinates in the fixed perpendicular OP/OQ frame satisfy the ellipse equation to within ${residual.toExponential(1)}, with half-axes ${big.toFixed(2)} and ${small.toFixed(2)}.`,
        };
      },
    },
  };
}

/** What the core says about the drawing the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const O = readPoint(state.O, "O");
  const X = readPoint(state.X, "X");
  const Y = readPoint(state.Y, "Y");
  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const Cpt = readPoint(state.C, "C");
  const options = optionsOf(state);
  const s = C.withConstruction(Object.assign({}, C.start(options), {
    O, X, Y, A, B, C: Cpt, options, trace: [],
  }));
  const M = safePoint(s.circle && s.circle.center);
  const R = safeNum(s.circle && s.circle.radius);
  const h = halfAxes(C, s);
  const mid = h.P && h.Q ? C.lerp(h.P, h.Q, 0.5) : null;
  const dotPQ = h.P && h.Q ? C.dot(C.sub(h.P, O), C.sub(h.Q, O)) : null;
  return {
    stateVersion,
    O, X, Y, A, B, C: Cpt,
    savedP: safePoint(state.P), savedQ: safePoint(state.Q),
    savedCenter: safePoint(state.center), savedRadius: safeNum(state.radius),
    options: s.options, traceLength: num(state, "traceLength", 0),
    circle: M && R !== null ? { center: M, radius: R } : null,
    P: h.P, Q: h.Q,
    radiusFromAB: C.dist(A, B) / 2,
    diameter: h.P && h.Q && M && mid
      ? { length: C.dist(h.P, h.Q), midpoint: mid,
          isDiameter: C.dist(mid, M) < 1e-6 && Math.abs(C.dist(h.P, h.Q) - 2 * (R ?? NaN)) < 1e-6 }
      : null,
    OPperpendicularOQ: dotPQ === null ? null : { dot: dotPQ, isRight: Math.abs(dotPQ) < 1e-6 },
    MC: h.MC,
    halfAxes: {
      OMplusMC: h.OMplusMC, OMminusMCAbs: h.OMminusMCAbs,
      CP: h.CP, CQ: h.CQ, match: h.agree,
    },
    fromCore: C.describe(s),
    note: h.P && h.Q
      ? `The saved circle L has centre (${M ? M.x.toFixed(2) : "?"}, ${M ? M.y.toFixed(2) : "?"}) and radius ${R === null ? "?" : R.toFixed(2)}; M is the midpoint of the diameter PQ through C, and OP meets OQ at a right angle. The half-axes of C's ellipse are CP = ${h.CP === null ? "?" : h.CP.toFixed(2)} and CQ = ${h.CQ === null ? "?" : h.CQ.toFixed(2)}.`
      : "The saved configuration has no diameter through C; move the points apart to draw one.",
  };
}
