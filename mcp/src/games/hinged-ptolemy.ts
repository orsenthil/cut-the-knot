/*
 * run_game_logic actions and saved-position reader for Hinged Ptolemy.
 *
 * The real core is hinged-ptolemy/hinged-ptolemy-core.js, copied verbatim into
 * src/generated/cores/ at build time; every number below is measured from it.
 * Four points A, B, P, C lie on one circle in the board's 400 x 320 view
 * (y downward, centre (200, 160), radius 100). For such a cyclic quadrilateral
 *
 *     AC·BP + AB·CP = AP·BC,                                      (Ptolemy)
 *
 * and swinging triangle ACP about A through `rotation`% of the signed angle
 * from AC to AB puts C' on AB and makes C'P' parallel to BP at the full turn;
 * P' lands on the line BP exactly when AB = AC. See _shared.ts for the shape
 * of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  center: Pt; radius: number; A: Pt; B: Pt; C: Pt; P: Pt;
  rotation: number; showNames: boolean;
};
type Geometry = { angle: number; turned: number; Cp: Pt; Pp: Pt; Pq: Pt };
type Measure = {
  AB: number; BP: number; CP: number; AP: number; BC: number; AC: number;
  CpPp: number; BPq: number; PPq: number;
  left: number; right: number; gap: number;
  parallelCross: number; bpqCross: number; cpqCross: number;
};
interface Core {
  MIN_ROTATION: number;
  MAX_ROTATION: number;
  CENTER: Pt;
  RADIUS: number;
  start(o?: Partial<{
    center: Pt; radius: number; rotation: number; showNames: boolean;
    angles: { A?: number; B?: number; C?: number; P?: number };
  }>): State;
  withPoint(s: State, name: string, p: Pt): State;
  setRotation(s: State, v: number): State;
  compute(s: State): Geometry;
  measure(s: State, g?: Geometry): Measure;
  describe(s: State, g?: Geometry, m?: Measure): string;
  dist(p: Pt, q: Pt): number;
  sqDist(p: Pt, q: Pt): number;
  result(s: State): null;
}

const core = (): Core => cores["hinged-ptolemy"].HingedPtolemyCore as unknown as Core;
const NAMES = ["A", "B", "C", "P"] as const;
type Name = (typeof NAMES)[number];

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
/** Non-finite values (the applet's near-parallel intersections) become null. */
const cnt = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;
const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });

const isPoint = (raw: unknown): boolean => {
  if (!raw || typeof raw !== "object") return false;
  if (Array.isArray(raw)) return raw.length === 2 && raw.every((x) => Number.isFinite(Number(x)));
  const o = raw as Json;
  return Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y));
};

/** Accept the page's { x, y } dots and a tutor's [x, y] dots; both validated. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/**
 * Build a core state the way the page does: start from the opening picture,
 * set the slider, then drag each supplied dot radially onto the circle.
 * Omitted dots keep their opening positions.
 */
function buildState(C: Core, args: Json, defaultRotation: number): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, P points and optional centre, radius, rotation, showNames");
  }
  const center = readPoint(args.center, "center", C.CENTER);
  const radius = args.radius === undefined || args.radius === null
    ? C.RADIUS : Number(args.radius);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('argument "radius" must be a positive number');
  }
  const rotation = intArg(args, "rotation", defaultRotation, C.MIN_ROTATION, C.MAX_ROTATION);
  const showNames = boolArg(args, "showNames", false);
  let s = C.start({ center, radius, rotation, showNames });
  for (const name of NAMES) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

/** Everything the tutor may report, all of it measured by the real core. */
function reading(C: Core, s: State) {
  const g = C.compute(s);
  const m = C.measure(s, g);
  /* Cross products have units of area, so scale the tolerance by r^2. */
  const tol = 1e-6 * Math.max(C.sqDist(s.center, s.A), 1);
  const lenTol = 1e-6 * Math.max(m.AP * m.BC, 1);
  const pPrimeCross = cross(sub(g.Pp, s.B), sub(s.P, s.B));

  return {
    center: pt(s.center), radius: s.radius,
    points: { A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P) } as Record<Name, Pt | null>,
    rotation: s.rotation, showNames: s.showNames,
    turn: {
      signedAngleDeg: cnt((g.angle * 180) / Math.PI),
      fraction: round(s.rotation / 100),
      turnedDeg: cnt((g.turned * 180) / Math.PI),
      note: "The slider turns triangle ACP about A from AC towards AB.",
    },
    lengths: {
      AB: cnt(m.AB), BP: cnt(m.BP), CP: cnt(m.CP),
      AP: cnt(m.AP), BC: cnt(m.BC), AC: cnt(m.AC), CpPp: cnt(m.CpPp),
    },
    ptolemy: {
      formula: "AC·BP + AB·CP = AP·BC",
      acTimesBp: cnt(m.AC * m.BP), abTimesCp: cnt(m.AB * m.CP),
      left: cnt(m.left), right: cnt(m.right), gap: sig(m.gap),
      holds: near(m.left, m.right, lenTol),
    },
    hinge: {
      Cp: pt(g.Cp), Pp: pt(g.Pp), Pq: pt(g.Pq),
      cPrimeFromABCross: sig(m.cpqCross), cPrimeOnAB: Math.abs(m.cpqCross) <= tol,
      cPrimePpParallelBP: sig(m.parallelCross),
      parallelToBP: Math.abs(m.parallelCross) <= tol,
      fullTurn: s.rotation === 100,
    },
    intersection: {
      BPq: cnt(m.BPq), PPq: cnt(m.PPq),
      apTimesBcOverAc: cnt((m.AP * m.BC) / m.AC),
      ppEqualsApTimesBcOverAc: near(m.PPq, (m.AP * m.BC) / m.AC, lenTol),
    },
    pPrime: {
      crossWithBP: sig(pPrimeCross),
      onBP: Math.abs(pPrimeCross) <= tol,
      AB: cnt(m.AB), AC: cnt(m.AC),
      equalChords: near(m.AB, m.AC, 1e-6 * Math.max(m.AB, m.AC, 1)),
      distanceToPq: cnt(C.dist(g.Pp, g.Pq)),
    },
  };
}

/**
 * With A and B fixed, reflect B in the line OA: the new C lies on the same
 * circle and chord AC equals chord AB, so the full turn sends C' exactly to B.
 */
function equalChordCase(C: Core, s: State) {
  const O = s.center;
  const r = C.dist(O, s.A);
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(C.dist(O, s.B))) return null;
  const ux = (s.A.x - O.x) / r;
  const uy = (s.A.y - O.y) / r;
  const d = (s.B.x - O.x) * ux + (s.B.y - O.y) * uy;
  const foot = { x: O.x + d * ux, y: O.y + d * uy };
  const alt = C.withPoint(s, "C", { x: 2 * foot.x - s.B.x, y: 2 * foot.y - s.B.y });
  const full = C.setRotation(alt, 100);
  const g = C.compute(full);
  const m = C.measure(full, g);
  const tol = 1e-6 * Math.max(C.sqDist(O, s.A), 1);
  const crossWithBP = cross(sub(g.Pp, s.B), sub(s.P, s.B));
  return {
    C: pt(full.C), AB: cnt(m.AB), AC: cnt(m.AC),
    equalChords: near(m.AB, m.AC, 1e-6 * Math.max(m.AB, m.AC, 1)),
    cPrimeEqualsB: C.dist(g.Cp, s.B) <= 1e-6 * Math.max(r, 1),
    pPrimeOnBP: Math.abs(crossWithBP) <= tol,
    pPrimeCrossWithBP: sig(crossWithBP),
    distancePprimeToPq: cnt(C.dist(g.Pp, g.Pq)),
  };
}

/* The live page saved exactly these values with Track.state(state). */
const FIXTURE_POINTS =
  '"A":[108.23190325494389,199.73180614809777],' +
  '"B":[270.71067811865476,230.71067811865476],' +
  '"C":[250,73.39745962155614],' +
  '"P":[286.6025403784439,110]';

export function actions(): GameActions {
  return {
    ptolemy_identity: {
      describe:
        "Measure the four sides and diagonals of the cyclic quadrilateral A, B, P, C and check Ptolemy's identity AC·BP + AB·CP = AP·BC. Pass A, B, C and P as [x, y] or { x, y } on the page's 400 x 320 board (y downward; centre (200, 160), radius 100); any omitted dot keeps its opening position and supplied dots are snapped onto the circle just as a drag is. Also accepts an optional centre and a positive radius. The example uses the four dots saved by the live page.",
      args: `{ ${FIXTURE_POINTS} }`,
      run: (args) => {
        const C = core();
        const r = reading(C, buildState(C, args, 0));
        return {
          center: r.center, radius: r.radius, points: r.points,
          lengths: r.lengths, ptolemy: r.ptolemy, turn: r.turn,
          note: `With AC = ${r.lengths.AC}, BP = ${r.lengths.BP}, AB = ${r.lengths.AB} and CP = ${r.lengths.CP}, AC·BP + AB·CP = ${r.ptolemy.left} while AP·BC = ${r.ptolemy.right}; the gap is ${r.ptolemy.gap}, so the identity ${r.ptolemy.holds ? "holds" : "does not hold"} here. This is an illustration, so there is no win or loss.`,
        };
      },
    },

    hinge_rotation: {
      describe:
        "Swing triangle ACP about A through rotation percent of the signed angle from AC to AB (integer 0–105, the applet's scrollbar; the example uses the full turn). Report C', P' and the meeting point P'': at the full turn C' lies on AB and C'P' is parallel to BP, while P' falls on the line BP only when AB = AC. Pass the same point arguments as ptolemy_identity; equalChordCase keeps A, B and P but moves C to the point with AC = AB to show the special case.",
      args: `{ ${FIXTURE_POINTS}, "rotation": 100 }`,
      run: (args) => {
        const C = core();
        const s = buildState(C, args, 100);
        const r = reading(C, s);
        return {
          center: r.center, radius: r.radius, points: r.points,
          rotation: r.rotation, turn: r.turn,
          hinge: r.hinge, intersection: r.intersection, pPrime: r.pPrime,
          ptolemy: { holds: r.ptolemy.holds, gap: r.ptolemy.gap },
          equalChordCase: equalChordCase(C, s),
          note: `At ${r.rotation}% of the ${r.turn.signedAngleDeg}° turn, C' is ${r.hinge.cPrimeOnAB ? "on" : "not yet on"} AB and C'P' is ${r.hinge.parallelToBP ? "parallel to" : "not parallel to"} BP. P' is ${r.pPrime.onBP ? "on" : "off"} the line BP (AB = ${r.pPrime.AB}, AC = ${r.pPrime.AC})${r.hinge.fullTurn ? "; moving C so that AC = AB puts P' on BP" : ""}.` +
            (r.intersection.ppEqualsApTimesBcOverAc
              ? ` At the full turn the core also measures PP'' = ${r.intersection.PPq} = AP·BC/AC.` : ""),
        };
      },
    },
  };
}

/** Saved fields are echoed; a damaged value falls back to the opening picture. */
function savedState(C: Core, state: Json): State {
  const base = C.start();
  const rot = Number(state.rotation);
  let s = C.start({
    center: isPoint(state.center) ? readPoint(state.center, "center") : base.center,
    radius: Number.isFinite(Number(state.radius)) && Number(state.radius) > 0
      ? Number(state.radius) : base.radius,
    rotation: Number.isInteger(rot) && rot >= C.MIN_ROTATION && rot <= C.MAX_ROTATION
      ? rot : base.rotation,
    showNames: typeof state.showNames === "boolean" ? state.showNames : base.showNames,
  });
  for (const name of NAMES) {
    if (isPoint(state[name])) s = C.withPoint(s, name, readPoint(state[name], name));
  }
  return s;
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Ptolemy state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hinged Ptolemy position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const r = reading(C, s);
  return {
    stateVersion,
    center: r.center, radius: r.radius,
    A: r.points.A, B: r.points.B, C: r.points.C, P: r.points.P,
    rotation: s.rotation, showNames: s.showNames,
    result: C.result(s),
    reading: {
      turn: r.turn, lengths: r.lengths, ptolemy: r.ptolemy,
      hinge: r.hinge, intersection: r.intersection, pPrime: r.pPrime,
    },
    note:
      "Track.state saved the circle's centre and radius, the four draggable dots, the slider and the name flag; the core rebuilds that picture by snapping the dots onto the circle. " +
      `The turn is ${r.rotation}% of ${r.turn.signedAngleDeg}°, AC·BP + AB·CP = ${r.ptolemy.left} against AP·BC = ${r.ptolemy.right} (gap ${r.ptolemy.gap}), C' is ${r.hinge.cPrimeOnAB ? "on" : "off"} AB and C'P' is ${r.hinge.parallelToBP ? "parallel to" : "not parallel to"} BP. ` +
      (r.rotation === 0
        ? "The slider is at rest, so P' is still the original P, which lies on BP by definition."
        : `P' is ${r.pPrime.onBP ? "on" : "off"} the line BP${r.hinge.fullTurn ? ` (AB = ${r.pPrime.AB}, AC = ${r.pPrime.AC})` : ""}.`),
  };
}
