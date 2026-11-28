/*
 * run_game_logic actions and saved-position reader for JLAyme, Bogomolny's
 * illustration of Y. Sawayama's Lemma. The core (jl-ayme/ in the site, copied
 * into src/generated/cores/ at build time) does the whole construction: the
 * circle touching AD, BC and the circumcircle, its chord EF, and the four
 * steps of the proof that EF passes through the incenter I. Every number below
 * comes from that core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["jl-ayme"].JlAymeCore;

/** A geometric tolerance in the board's units (points are ~100–300 apart). */
const TOL = 1e-6;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || typeof p !== "object" ||
      !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** The four draggable points, defaulting to the applet's own starting board. */
function readState(args: Json) {
  const C = core();
  const start = C.start({});
  return C.start({
    points: {
      A: args.A === undefined || args.A === null ? start.A : readPoint(args.A, "A"),
      B: args.B === undefined || args.B === null ? start.B : readPoint(args.B, "B"),
      C: args.C === undefined || args.C === null ? start.C : readPoint(args.C, "C"),
      D: args.D === undefined || args.D === null ? start.D : readPoint(args.D, "D"),
    },
    showNames: args.showNames === undefined ? true : !!args.showNames,
    showStatement: args.showStatement === true,
    step1: args.step1 === true, step2: args.step2 === true,
    step3: args.step3 === true, step4: args.step4 === true,
  });
}

/* The core can return null or non-finite coordinates for degenerate drags;
 * JSON cannot carry NaN, so sanitise anything we put into an answer. */
function safeNum(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function safePoint(p: unknown): Point | null {
  if (!p || typeof p !== "object") return null;
  const q = p as Json;
  const x = safeNum(q.x), y = safeNum(q.y);
  return x === null || y === null ? null : { x, y };
}

function safeCircle(c: unknown): Circle | null {
  if (!c || typeof c !== "object") return null;
  const q = c as Json;
  const center = safePoint(q.center);
  const radius = safeNum(q.radius);
  return center && radius !== null && radius >= 0 ? { center, radius } : null;
}

const near = (a: number | null, b: number | null, tol = TOL): boolean =>
  a !== null && b !== null && Math.abs(a - b) <= tol;

/** The (unsigned) angle at q between qp and qr, in degrees. */
function angleDeg(p: Point | null, q: Point | null, r: Point | null): number | null {
  if (!p || !q || !r) return null;
  const C = core();
  const u = C.sub(p, q), v = C.sub(r, q);
  if ((u.x === 0 && u.y === 0) || (v.x === 0 && v.y === 0)) return null;
  return safeNum(Math.atan2(Math.abs(C.cross(u, v)), C.dot(u, v)) * 180 / Math.PI);
}

export function actions(): GameActions {
  return {
    sawayama_figure: {
      describe:
        "For a triangle ABC cut by the line AD, build Sawayama's tangent circle and report its contact points E and F and tangency K, the incenter I, and the crossings M, N and J = AM ∩ EF. Checks that the chord EF passes through I, that J coincides with I, that MN is parallel to EF, and that M is the midpoint of arc BC.",
      args: '{ "A": {"x":136.33,"y":120}, "B": {"x":100,"y":200}, "C": {"x":320,"y":200}, "D": {"x":266.67,"y":200} }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const g = C.figure(state);
        if (!g.valid) return { valid: false, reason: g.reason };
        const O = safePoint((g.circumcircle as Json)?.center);
        const R = safeNum((g.circumcircle as Json)?.radius);
        const I = safePoint(g.I), E = safePoint(g.E), F = safePoint(g.F);
        const K = safePoint(g.K), M = safePoint(g.M), N = safePoint(g.N);
        const J = safePoint(g.J);
        const P = safePoint((g.circleP as Json)?.center);
        const rP = safeNum((g.circleP as Json)?.radius);
        const dMN = M && N ? C.sub(N, M) : null;
        const dEF = E && F ? C.sub(F, E) : null;
        const parallelSin = dMN && dEF
          ? safeNum(Math.abs(C.cross(dMN, dEF)) /
              (Math.hypot(dMN.x, dMN.y) * Math.hypot(dEF.x, dEF.y)))
          : null;
        const kBoth = K && O && P
          ? near(C.dist(K, O), R) && near(C.dist(K, P), rP)
          : false;
        return {
          valid: true,
          points: { A: state.A, B: state.B, C: state.C, D: state.D },
          circumcircle: safeCircle(g.circumcircle),
          tangentCircle: safeCircle(g.circleP),
          incircle: safeCircle(g.incircle),
          incenter: I,
          contacts: { E, F, K },
          crossings: { M, N, J },
          checks: {
            chordEFThroughIncenter: E && F && I
              ? C.distToLine(I, E, F) <= TOL : false,
            JIsIncenter: J && I ? C.dist(J, I) <= TOL : false,
            MNParallelEF: parallelSin !== null && parallelSin <= TOL,
            parallelSin,
            MIsArcMidpointOfBC: M && O
              ? near(C.dist(M, state.B), C.dist(M, state.C)) &&
                near(C.dist(M, O), R)
              : false,
            KOnBothCircles: kBoth,
          },
          note:
            "The centre of the tangent circle lies on the bisector of angle ADC, so its radius is fixed by one quadratic in the distance from D. Sawayama's Lemma says the chord EF of its contacts goes through the incenter I; the applet's J = AM ∩ EF is that same point, and MN is parallel to EF.",
        };
      },
    },
    proof_steps: {
      describe:
        "Walk the four cyclicity and tangency steps of the proof: J lies on the circle through A, F, K and on the one through E, I, K (which touches AM at J); the circle centred at M passes through B and I; and the angles BKE, MAC and MBE agree, forcing J = I. Reports the auxiliary circles and the measured angles.",
      args: '{ "A": {"x":136.33,"y":120}, "B": {"x":100,"y":200}, "C": {"x":320,"y":200}, "D": {"x":266.67,"y":200} }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const g = C.figure(state);
        if (!g.valid) return { valid: false, reason: g.reason };
        const J = safePoint(g.J), I = safePoint(g.I);
        const eik = safeCircle(g.EIK), atM = safeCircle(g.circleM);
        const akf = safeCircle(g.AKF), bke = safeCircle(g.BKE);
        const onCircle = (p: Point | null, c: Circle | null): boolean =>
          !!p && !!c && near(C.dist(p, c.center), c.radius);
        const footEIK = eik ? safePoint(C.foot(eik.center, state.A, g.M)) : null;
        const angles = {
          BKE: angleDeg(state.B, safePoint(g.K), safePoint(g.E)),
          MAC: angleDeg(safePoint(g.M), state.A, state.C),
          MBE: angleDeg(safePoint(g.M), state.B, safePoint(g.E)),
        };
        const measured = Object.values(angles).filter((a): a is number => a !== null);
        return {
          valid: true,
          circles: { AKF: akf, EIK: eik, BKE: bke, centredAtM: atM },
          points: { I, J, E: safePoint(g.E), F: safePoint(g.F), K: safePoint(g.K), M: safePoint(g.M) },
          checks: {
            JOnCircleAKF: onCircle(J, akf),
            JOnCircleEIK: onCircle(J, eik),
            EIKTangentToAMAtJ: onCircle(J, eik) && footEIK !== null &&
              (!J || C.dist(footEIK, J) <= TOL),
            tangentFoot: footEIK,
            MCircleThroughBAndI: atM !== null &&
              near(C.dist(atM.center, state.B), atM.radius) &&
              near(C.dist(atM.center, I), atM.radius),
            angles,
            anglesMatch: measured.length === 3 &&
              Math.max(...measured) - Math.min(...measured) <= TOL,
          },
          note:
            "Each claim is checked against the core's own auxiliary circles: J on (AFK) and on (EIK), (EIK) tangent to AM at J, the circle centred at M through both B and I, and equal angles BKE = MAC = MBE. Together they pin J down to the incenter, which is why EF contains I.",
        };
      },
    },
  };
}

/** What the core says about the position saved on the page with Track.state. */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const here = readState(state);
  const g = C.figure(here);
  const I = safePoint(g.I), J = safePoint(g.J), E = safePoint(g.E), F = safePoint(g.F);
  const checks = g.valid
    ? {
        chordEFThroughIncenter: !!E && !!F && !!I && C.distToLine(I, E, F) <= TOL,
        JIsIncenter: !!J && !!I && C.dist(J, I) <= TOL,
      }
    : { chordEFThroughIncenter: false, JIsIncenter: false };
  return {
    A: here.A, B: here.B, C: here.C, D: here.D,
    showNames: here.showNames,
    showStatement: here.showStatement,
    step1: here.step1, step2: here.step2,
    step3: here.step3, step4: here.step4,
    valid: !!g.valid,
    reason: g.reason || "",
    incenter: I,
    contacts: g.valid ? { E, F } : null,
    tangentCircle: g.valid ? safeCircle(g.circleP) : null,
    checks,
    explored: C.result(here) === "done",
    note: !g.valid
      ? "The dragged points cannot form the tangent circle; move them apart."
      : checks.JIsIncenter
        ? "The chord EF passes through the incenter I, and the crossing J = AM ∩ EF is that same point."
        : "The tangent circle exists; check whether EF still passes through the incenter.",
  };
}
