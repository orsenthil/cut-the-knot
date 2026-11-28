/*
 * run_game_logic actions and saved-position reader for In Tangent,
 * Alexander Bogomolny's InTangent applet.
 *
 * The real core is in-tangent/in-tangent-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the page's 400 x 300 SVG, with y down.
 *
 * A is the apex, B and C the ends of the base line, and X = B*t + C*(1-t) a
 * point on BC. IB and IC are the incenters of ABX and ACX. Reflecting the
 * common tangent AX in the line IB IC gives the second internal common
 * tangent; its crossing S with BC is exactly T, where the incircle of ABC
 * touches BC. Both X and T lie on the circle with diameter IB IC, and
 * TX equals the gap T_B T_C between the contact points on AX. The applet
 * lights its three eyes only when |BX - BT| < 1 board unit. There is no win
 * or loss: this is a demonstration. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type State = {
  width: number; height: number;
  A: Pt; B: Pt; C: Pt;
  t: number; showCircle: boolean;
};
type Analysis = {
  A: Pt; B: Pt; C: Pt; X: Pt;
  IB: Pt; IC: Pt;
  incBX: { center: Pt; radius: number };
  incCX: { center: Pt; radius: number };
  A2: Pt; X2: Pt; S: Pt | null; T: Pt; circle: Circle;
  TB: Pt; TC: Pt; Bp: Pt; Cp: Pt; finished: boolean;
};
type SavedPosition = {
  A: Pt; B: Pt; C: Pt; X: Pt; T: Pt; S: Pt | null;
  IB: Pt; IC: Pt; t: number; showCircle: boolean; finished: boolean;
};
type Core = {
  EPS: number;
  distance(p: Pt, q: Pt): number;
  foot(p: Pt, a: Pt, b: Pt): Pt;
  onLine(a: Pt, b: Pt, t: number): Pt;
  start(options?: {
    width?: number; height?: number; t?: number; showCircle?: boolean;
  }): State;
  moveVertex(s: State, name: string, p: Pt): State;
  moveX(s: State, p: Pt): State;
  moveXToT(s: State): State;
  analyze(s: State): Analysis;
  position(s: State): SavedPosition;
};

const core = (): Core =>
  cores["in-tangent"].InTangentCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const sig = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** A point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object") {
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

/** A derived point in a saved position may be absent; treat that as unknown. */
const maybePoint = (raw: unknown): Pt | null => {
  try {
    return readPoint(raw, "point");
  } catch {
    return null;
  }
};

function dimension(args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) {
    throw new Error(`argument "${key}" must be a positive board size, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** X is B*t + C*(1-t); both small triangles must be non-degenerate. */
function fraction(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "boolean") {
    throw new Error(`argument "${label}" must be a number strictly between 0 and 1`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) {
    throw new Error(`argument "${label}" must be a number strictly between 0 and 1, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** A real core state: start from the applet's opening board, then drag corners. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C points with optional t, width, height and showCircle");
  }
  let s = C.start({
    width: dimension(args, "width", 400),
    height: dimension(args, "height", 300),
    t: fraction(args.t, "t", 0.3),
    showCircle: args.showCircle === true,
  });
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.moveVertex(s, name, readPoint(v, name));
  }
  requireTriangle(C, s);
  return s;
}

/** Refuse triangles with no incircle or no base to put X on. */
function requireTriangle(C: Core, s: State): void {
  const BC = C.distance(s.B, s.C);
  const cross = (s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x);
  if (!(BC > C.EPS) || Math.abs(cross) <= 1e-9 * Math.max(1, BC * BC)) {
    throw new Error("A, B and C must be distinct, non-collinear corners with B different from C: the core cannot draw the incircles here");
  }
}

type Reading = ReturnType<typeof reading>;
type Claim = {
  name: string; claim: string; left: number | null; right: number | null;
  residual: number | null; holds: boolean;
};

/** One analyze() call, with the page's claims expressed as checked residuals. */
function reading(C: Core, s: State, g: Analysis = C.analyze(s)) {
  const d = (p: Pt, q: Pt): number => C.distance(p, q);
  const center = g.circle.center, radius = g.circle.radius;
  const tol = 1e-6 * Math.max(1, radius, d(s.B, s.C));
  const claim = (name: string, text: string, left: number | null, right: number | null): Claim => ({
    name, claim: text,
    left: left === null ? null : round(left),
    right: right === null ? null : round(right),
    residual: left === null || right === null ? null : sig(left - right),
    holds: left !== null && right !== null && near(left, right, tol),
  });

  const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const sxMid = g.S ? mid(g.S, g.X) : null;
  const bpCpMid = mid(g.Bp, g.Cp);
  const dX = d(g.X, center), dT = d(g.T, center);
  const claims: Claim[] = [
    claim("secondTangentAtT", "S = T (the reflected tangent meets BC at the touch point)",
      g.S ? d(g.S, g.T) : null, 0),
    claim("XOnDiameterCircle", "|X - midpoint(IB,IC)| = |IB-IC|/2", dX, radius),
    claim("TOnDiameterCircle", "|T - midpoint(IB,IC)| = |IB-IC|/2", dT, radius),
    claim("TXequalsGap", "TX = T_B T_C", d(g.T, g.X), d(g.TB, g.TC)),
    claim("midpointsCoincide", "midpoint(S,X) = midpoint(B',C')",
      sxMid ? d(sxMid, bpCpMid) : null, 0),
    claim("SBprimeEqualsXCprime", "S B' = X C'", g.S ? d(g.S, g.Bp) : null, d(g.X, g.Cp)),
    claim("SCprimeEqualsXBprime", "S C' = X B'", g.S ? d(g.S, g.Cp) : null, d(g.X, g.Bp)),
    claim("axisTouchesIncB", "dist(IB, AX) = radius(ABX)",
      d(g.IB, C.foot(g.IB, g.A, g.X)), g.incBX.radius),
    claim("axisTouchesIncC", "dist(IC, AX) = radius(ACX)",
      d(g.IC, C.foot(g.IC, g.A, g.X)), g.incCX.radius),
  ];

  return {
    t: s.t, showCircle: s.showCircle,
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), X: pt(g.X), T: pt(g.T), S: pt(g.S),
      IB: pt(g.IB), IC: pt(g.IC), A2: pt(g.A2), X2: pt(g.X2),
      TB: pt(g.TB), TC: pt(g.TC), Bp: pt(g.Bp), Cp: pt(g.Cp),
    },
    incircles: {
      ABX: { center: pt(g.IB), radius: round(g.incBX.radius) },
      ACX: { center: pt(g.IC), radius: round(g.incCX.radius) },
    },
    secondTangent: {
      reflectedLine: { from: pt(g.A2), to: pt(g.X2) },
      crossingS: pt(g.S), touchT: pt(g.T),
      ST: g.S ? round(d(g.S, g.T)) : null,
      passesThroughT: !!g.S && near(d(g.S, g.T), 0, tol),
    },
    diameterCircle: {
      center: pt(center), radius: round(radius),
      distX: round(dX), distT: round(dT),
      XResidual: sig(dX - radius), TResidual: sig(dT - radius),
      XOnCircle: near(dX, radius, tol), TOnCircle: near(dT, radius, tol),
    },
    lengths: {
      TX: round(d(g.T, g.X)), TBTC: round(d(g.TB, g.TC)),
      residual: sig(d(g.T, g.X) - d(g.TB, g.TC)),
      equal: near(d(g.T, g.X), d(g.TB, g.TC), tol),
    },
    midpointCheck: {
      SX: pt(sxMid), BpCp: pt(bpCpMid),
      coincide: !!sxMid && near(d(sxMid, bpCpMid), 0, tol),
    },
    claims,
    allClaimsHold: claims.every((c) => c.holds),
    eyes: {
      finished: g.finished,
      BX: round(d(s.B, g.X)), BT: round(d(s.B, g.T)),
      gap: round(Math.abs(d(s.B, g.X) - d(s.B, g.T))),
    },
  };
}

const opening = { A: [227, 100], B: [150, 200], C: [275, 225], t: 0.3 };
const NO_GAME =
  "This is a demonstration, so there is no win or loss; the tracker records exploration.";

export function actions(): GameActions {
  return {
    tangent_through_t: {
      describe:
        "For triangle ABC (corners as [x, y] or { x, y } in the page's 400 x 300 board, y down; omit a corner for the opening picture) and X at fraction t of BC from C, run the real In Tangent core: report the ABX and ACX incenters, the reflected second common tangent and its crossing S with BC against T (where the incircle of ABC touches BC), the circle with diameter IB IC and whether X and T lie on it, TX against the contact gap T_B T_C, the midpoint and equal-tangent checks, and the applet's one-unit eyes test. Optional width, height and showCircle set the board and the dashed circle; t must lie strictly between 0 and 1 and ABC must be a proper triangle.",
      args: JSON.stringify(opening),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return {
          board: { width: s.width, height: s.height },
          ...r,
          note:
            `The core's reflected tangent crosses BC at S = ${JSON.stringify(r.secondTangent.crossingS)} while ` +
            `the incircle of ABC touches at T = ${JSON.stringify(r.secondTangent.touchT)} (|S-T| = ` +
            `${r.secondTangent.ST}); X and T sit ${r.diameterCircle.distX} and ${r.diameterCircle.distT} from ` +
            `the midpoint of IB IC against a radius of ${r.diameterCircle.radius}, and TX = ${r.lengths.TX} ` +
            `matches T_B T_C = ${r.lengths.TBTC}. All nine claims hold: ${r.allClaimsHold}. ` +
            `The eyes are ${r.eyes.finished ? "lit" : "dark"} (|BX - BT| = ${r.eyes.gap}). ` + NO_GAME,
        };
      },
    },

    eyes_threshold: {
      describe:
        "For the same triangle (arguments as in tangent_through_t), slide X along BC to signed offsets in board units from the touch point T and report, for each, the recomputed X, |BX - BT|, whether the eyes light, the tangent crossing S against T, and the residuals for TX = T_B T_C and for X and T on the diameter circle; also show the 'Put X at T' shortcut. The eyes light only when |BX - BT| is under one unit, but the theorem holds for every X. Offsets default to [-2, -0.5, 0, 0.5, 2] and may be any array of up to 20 finite numbers.",
      args: JSON.stringify({ ...opening, offsets: [-2, -0.5, 0, 0.5, 2] }),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const raw = args.offsets;
        let offsets: number[];
        if (raw === undefined || raw === null) {
          offsets = [-2, -0.5, 0, 0.5, 2];
        } else {
          if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
            throw new Error('argument "offsets" must be an array of 1 to 20 finite numbers');
          }
          offsets = raw.map((o, i) => {
            const n = Number(o);
            if (!Number.isFinite(n)) throw new Error(`offsets[${i}] must be a finite number`);
            return n;
          });
        }
        const g0 = C.analyze(s);
        const BC = C.distance(s.B, s.C);
        const BT = C.distance(s.B, g0.T);
        const samples = offsets.map((offset) => {
          /* Point at distance offset from T along BC, clamped to the segment. */
          const u = Math.max(0.001, Math.min(0.999, (BT + offset) / BC));
          const moved = C.moveX(s, C.onLine(s.B, s.C, u));
          const g = C.analyze(moved);
          return {
            offset: round(offset),
            t: round(moved.t, 9),
            X: pt(g.X),
            BXminusBT: round(C.distance(s.B, g.X) - BT),
            eyesLit: g.finished,
            S: pt(g.S),
            ST: g.S ? round(C.distance(g.S, g.T)) : null,
            XOnCircleResidual: sig(Math.abs(C.distance(g.X, g.circle.center) - g.circle.radius)),
            TOnCircleResidual: sig(Math.abs(C.distance(g.T, g.circle.center) - g.circle.radius)),
            TXminusTBTC: sig(C.distance(g.T, g.X) - C.distance(g.TB, g.TC)),
          };
        });
        const atT = C.moveXToT(s);
        const gT = C.analyze(atT);
        return {
          board: { width: s.width, height: s.height },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          T: pt(g0.T), BC: round(BC), BT: round(BT),
          samples,
          putXAtT: {
            t: round(atT.t, 9), X: pt(gT.X),
            gapXT: round(C.distance(gT.X, gT.T)), eyesLit: gT.finished,
          },
          note:
            `BT = ${round(BT)} along a base of ${round(BC)}. The applet's Finished test is ` +
            `|BX - BT| < 1, so only offsets within one unit of T light the eyes, while |S-T| and ` +
            `the circle and length residuals stay at floating-point zero at every offset. ` +
            `"Put X at T" gives t = ${round(atT.t, 9)} with eyesLit = ${gT.finished}. ` + NO_GAME,
        };
      },
    },
  };
}

/** Echo the derived fields Track.state saved, then re-measure from A, B, C and t. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported In Tangent state version ${stateVersion}`);
  }
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  const C = core();
  let savedReadable = true;
  let s: State;
  try {
    const seed = C.start({});
    s = {
      width: seed.width, height: seed.height,
      A: readPoint(src.A, "saved A", seed.A),
      B: readPoint(src.B, "saved B", seed.B),
      C: readPoint(src.C, "saved C", seed.C),
      t: fraction(src.t, "saved t", seed.t),
      showCircle: src.showCircle === true,
    };
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const saved = {
    A: pt(maybePoint(src.A)), B: pt(maybePoint(src.B)), C: pt(maybePoint(src.C)),
    X: pt(maybePoint(src.X)), T: pt(maybePoint(src.T)), S: pt(maybePoint(src.S)),
    IB: pt(maybePoint(src.IB)), IC: pt(maybePoint(src.IC)),
    t: maybePoint(src.A) ? (Number.isFinite(Number(src.t)) ? Number(src.t) : null) : null,
    showCircle: src.showCircle === true,
    finished: src.finished === true,
  };

  let valid = true;
  try {
    requireTriangle(C, s);
  } catch {
    valid = false;
  }
  const common = { ...src, stateVersion, savedReadable, saved };
  if (!valid) {
    return {
      ...common, valid: false,
      note:
        (!savedReadable
          ? "Some saved fields could not be read, so the applet's opening diagram is shown. "
          : "Track.state saved the corners A, B, C and the fraction t of X on BC, but they are collinear, coincident or too close here. ") +
        "The core cannot draw the incircles or the reflected tangent. " + NO_GAME,
    };
  }

  const g = C.analyze(s);
  const r = reading(C, s, g);
  const gap = (raw: unknown, actual: Pt | null): number | null => {
    const p = maybePoint(raw);
    return p && actual ? round(C.distance(p, actual)) : null;
  };
  return {
    ...common,
    valid: true,
    reading: r,
    agreesWithSaved: {
      X: gap(src.X, g.X), T: gap(src.T, g.T), S: gap(src.S, g.S),
      IB: gap(src.IB, g.IB), IC: gap(src.IC, g.IC),
      t: src.t === undefined ? null : sig(s.t - Number(src.t)),
      showCircle: s.showCircle === (src.showCircle === true),
      finished: src.finished === undefined ? null : g.finished === (src.finished === true),
    },
    note:
      (!savedReadable
        ? "Some saved fields could not be read, so the reading below is from the applet's opening diagram. "
        : "Track.state saved the corners A, B, C, the fraction t of X on BC, the derived points X, T, S, IB, IC, the showCircle option and the eyes flag in board units; the core rebuilds every derived point from A, B, C and t. ") +
      `Here S = ${JSON.stringify(r.secondTangent.crossingS)} against the saved T = ` +
      `${JSON.stringify(saved.T)}, X and T lie on the circle of radius ${r.diameterCircle.radius}, ` +
      `TX = ${r.lengths.TX} equals T_B T_C = ${r.lengths.TBTC}, and all nine checks are ` +
      `${r.allClaimsHold ? "true" : "not all true"}. The eyes are ${r.eyes.finished ? "lit" : "dark"} ` +
      `(they light only within one unit of T, which is a hint and not a win). ` + NO_GAME,
  };
}
