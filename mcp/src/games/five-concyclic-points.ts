/*
 * run_game_logic actions and saved-position reader for Five Concyclic Points.
 *
 * Two lines L1 = MN and L2 = PQ meet at X. Circles MPX and NPX are cut by the
 * secants QLm and QLn at M1,M2 and N1,N2; those four points lie on a circle
 * (O), which meets L1 again at M3,N3. The second intersection of MQX with QLm
 * is M4, and of NQX with QLn is N4. The page claims Q, M3, N3, M4, N4 lie on
 * one circle. The reason is radical axes: Q lies on L2, the radical axis of
 * MPX and NPX, so QM1*QM2 = QN1*QN2 and M1,M2,N1,N2 are concyclic on (O);
 * Y = QLm ∩ L1 and Z = QLn ∩ L1 have equal powers in (O) and in the circle
 * through Q,M4,N4, making L1 their common chord and M3,N3 the crossings.
 *
 * Every number below is measured by the game's real core
 * (five-concyclic-points/five-concyclic-points-core.js), copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 500 x 420 viewBox, y down; circles have { center, radius }, with the
 * applet's radius equal to the mean of three distances to the circumcenter.
 * See _shared.ts for the module shape. This is a drawing, so there is no win
 * or loss: the tracker records that it was explored.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type Name = "M" | "N" | "P" | "Q" | "Lm" | "Ln";
type State = Record<Name, Pt>;
type Geometry = {
  X: Pt;
  MPX: Circle; NPX: Circle; MQX: Circle; NQX: Circle;
  Mm: Pt[] | null; Nn: Pt[] | null;
  CircleO: Circle;
  CircleQ: Circle | null;
  S: Pt[] | null;
  M3: Pt | null; N3: Pt | null; M4: Pt | null; N4: Pt | null;
  Y: Pt; Z: Pt;
  valid: boolean;
  gap: number;
  auxGap: number;
};
type Core = {
  WIDTH: number; HEIGHT: number; EDGE: number; NAMES: string[]; START: Json;
  dist(a: Pt, b: Pt): number;
  clampPoint(p: Pt): Pt;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  start(): State;
  setPoint(s: State, name: string, p: Pt): State;
  geometry(s: State): Geometry;
  position(s: State): Json;
};

const core = (): Core =>
  cores["five-concyclic-points"].FiveConcyclicPointsCore as unknown as Core;
const NAMES: Name[] = ["M", "N", "P", "Q", "Lm", "Ln"];

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/* Keep tiny residuals visible: a 1e-11 gap is the interesting result here. */
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : round(v, 6);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x, 4), y: round(p.y, 4) }
    : null;
const circ = (c: Circle | null | undefined): { center: Pt; radius: number } | null =>
  c && pt(c.center) && Number.isFinite(c.radius)
    ? { center: pt(c.center)!, radius: round(c.radius, 4) }
    : null;
const power = (p: Pt | null, c: Circle, C: Core): number | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(c.radius)
    ? C.dist(p, c.center) ** 2 - c.radius ** 2
    : null;
const same = (a: number | null, b: number | null): boolean =>
  a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the page's { x, y } and the tutor's [x, y] alike. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Six real draggable points: omitted handles keep the applet's opening places. */
function buildState(C: Core, args: Json): State {
  if (args && (typeof args !== "object" || Array.isArray(args))) {
    throw new Error("arguments must be an object of M, N, P, Q, Lm and Ln points");
  }
  const given = (args && typeof args === "object" ? args : {}) as Json;
  let s = C.start();
  for (const name of NAMES) {
    const v = given[name];
    if (v !== undefined && v !== null) s = C.setPoint(s, name, readPoint(v, name));
  }
  return s;
}

/** Refuse a figure the core cannot draw (parallel lines, missing intersections). */
function geometryOf(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g.valid || !g.CircleO || !g.CircleQ || !g.M3 || !g.N3 || !g.M4 || !g.N4 ||
      !g.Mm || !g.Nn || !pt(g.X) || !pt(g.Y) || !pt(g.Z)) {
    throw new Error(
      "those six points are degenerate: the core cannot draw the five-point circle " +
      "(lines parallel or circles not meeting). Move a handle and try again.",
    );
  }
  return g;
}

/** The whole construction, measured rather than assumed, in tutor-friendly units. */
function reading(C: Core, s: State, g: Geometry) {
  const five = { Q: s.Q, M3: g.M3!, N3: g.N3!, M4: g.M4!, N4: g.N4! };
  const radiusErrors = Object.fromEntries(
    Object.entries(five).map(([name, p]) =>
      [name, sig(Math.abs(C.dist(p, g.CircleQ!.center) - g.CircleQ!.radius))]),
  );
  const concyclic = Number.isFinite(g.gap) &&
    g.gap <= 1e-4 * Math.max(1, g.CircleQ!.radius);
  const auxConcyclic = Number.isFinite(g.auxGap) &&
    g.auxGap <= 1e-4 * Math.max(1, g.CircleO.radius);
  return {
    board: { width: C.WIDTH, height: C.HEIGHT },
    handles: Object.fromEntries(NAMES.map((n) => [n, pt(s[n])])),
    junctions: { X: pt(g.X), Y: pt(g.Y), Z: pt(g.Z) },
    auxiliaryCircles: {
      MPX: circ(g.MPX), NPX: circ(g.NPX), MQX: circ(g.MQX), NQX: circ(g.NQX),
    },
    secantPoints: {
      M1: pt(g.Mm![0]), M2: pt(g.Mm![1]), N1: pt(g.Nn![0]), N2: pt(g.Nn![1]),
    },
    circleO: { circle: circ(g.CircleO), maxGap: sig(g.auxGap), fourPointsConcyclic: auxConcyclic },
    fivePoints: Object.fromEntries(Object.entries(five).map(([n, p]) => [n, pt(p)])),
    fivePointCircle: {
      circle: circ(g.CircleQ),
      radiusErrors,
      maxGap: sig(g.gap),
      concyclic,
    },
    concyclic,
  };
}

/** The power equalities behind Bui Quang Tuan's radical-axis proof. */
function radicalChecks(C: Core, s: State, g: Geometry) {
  const qM = power(s.Q, g.MPX, C), qN = power(s.Q, g.NPX, C);
  const secM = C.dist(s.Q, g.Mm![0]) * C.dist(s.Q, g.Mm![1]);
  const secN = C.dist(s.Q, g.Nn![0]) * C.dist(s.Q, g.Nn![1]);
  const yO = power(g.Y, g.CircleO, C), yQ = power(g.Y, g.CircleQ!, C);
  const zO = power(g.Z, g.CircleO, C), zQ = power(g.Z, g.CircleQ!, C);
  return {
    atQ: {
      statement: "QM1 * QM2 = QN1 * QN2",
      powerMPX: sig(qM), powerNPX: sig(qN), powerDifference: sig(qM! - qN!),
      secantQM1M2: round(secM), secantQN1N2: round(secN),
      secantDifference: sig(secM - secN),
      equalPowers: same(qM, qN) && same(secM, secN),
    },
    atY: {
      point: pt(g.Y), powerO: sig(yO), powerFivePointCircle: sig(yQ),
      powerDifference: sig(yO! - yQ!), equalPowers: same(yO, yQ),
    },
    atZ: {
      point: pt(g.Z), powerO: sig(zO), powerFivePointCircle: sig(zQ),
      powerDifference: sig(zO! - zQ!), equalPowers: same(zO, zQ),
    },
    lineL1IsCommonChord: same(yO, yQ) && same(zO, zQ),
  };
}

const EXAMPLE_ARGS =
  '{"M":[304,336],"N":[100,84],"P":[300,105],"Q":[125,336],"Lm":[416.6667,70],"Ln":[250,70]}';

export function actions(): GameActions {
  return {
    five_point_circle: {
      describe:
        "Given the six draggable points M, N, P, Q, Lm, Ln (each [x, y] or { x, y } on the page's 500 x 420 board, y down; omit any to keep the applet's opening arrangement), rebuild the real core's whole construction. Report X where MN meets PQ, the four auxiliary circles MPX, NPX, MQX, NQX, the points M1,M2,N1,N2 on circle (O), M3,N3 where (O) meets MN, M4,N4 on the two secants, and the circle through Q, M3, N3, M4, N4 with its centre, radius, individual radius errors and largest gap. A gap near zero confirms the page's claim that those five points are concyclic; a degenerate figure the core cannot draw is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = geometryOf(C, s);
        const r = reading(C, s, g);
        return {
          ...r,
          note: r.concyclic && r.circleO.fourPointsConcyclic
            ? `M1,M2,N1,N2 all sit within ${r.circleO.maxGap} units of (O), and Q, M3, N3, M4, N4 all sit within ${r.fivePointCircle.maxGap} units of the green circle centred at (${r.fivePointCircle.circle!.center.x}, ${r.fivePointCircle.circle!.center.y}) with radius ${r.fivePointCircle.circle!.radius}. The residual is floating-point noise, which is why the five marked dots never visibly drift apart. This is an illustration, not a game with a win or loss.`
            : `The core could not confirm the two circles here (five-point gap ${r.fivePointCircle.maxGap}, auxiliary gap ${r.circleO.maxGap}); move a handle so the lines and circles meet properly.`,
        };
      },
    },

    radical_axis_powers: {
      describe:
        "For the same six points, check the power-of-a-point equalities behind Bui Quang Tuan's proof with the real core. Q lies on L2, the radical axis of circles MPX and NPX, so QM1*QM2 = QN1*QN2; and Y = QLm ∩ MN and Z = QLn ∩ MN each have equal power in (O) and in the five-point circle, making L1 = MN their common chord. Report both powers and their difference at Q, Y and Z, the two secant products at Q, and whether each equality holds; arguments are as in five_point_circle.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = geometryOf(C, s);
        const checks = radicalChecks(C, s, g);
        return {
          ...checks,
          fivePointCircle: reading(C, s, g).fivePointCircle,
          note: checks.atQ.equalPowers && checks.lineL1IsCommonChord
            ? `Q's power is ${checks.atQ.powerMPX} in MPX and ${checks.atQ.powerNPX} in NPX (difference ${checks.atQ.powerDifference}), so QM1*QM2 = QN1*QN2 and the four secant points share circle (O). Y and Z have matching powers in (O) and the five-point circle (differences ${checks.atY.powerDifference} and ${checks.atZ.powerDifference}), so their line MN is the common chord containing M3 and N3 — the two circles meet exactly at the marked points.`
            : "At least one power equality failed; see the `atQ`, `atY` and `atZ` differences. The core's circles use the applet's averaged radius, so move the handles to a non-degenerate figure before drawing conclusions.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Five Concyclic Points state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Five Concyclic Points position must be an object");
  }
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    const parsed = {} as State;
    for (const name of NAMES) parsed[name] = readPoint(state[name], name);
    s = parsed;
  } catch {
    s = C.start();
    savedReadable = false;
  }

  const g = C.geometry(s);
  if (!g.valid || !g.CircleQ || !g.M3 || !g.N3 || !g.M4 || !g.N4 ||
      !g.Mm || !g.Nn || !pt(g.X) || !pt(g.Y) || !pt(g.Z)) {
    return {
      ...state,
      stateVersion,
      savedReadable,
      valid: false,
      note: "The saved points make parallel lines or circles that no longer meet, so the core cannot draw the five-point circle here. Move a handle on the page and look again.",
    };
  }

  const r = reading(C, s, g);
  const checks = radicalChecks(C, s, g);
  return {
    ...state,
    stateVersion,
    saved: Object.fromEntries(NAMES.map((n) => [n, pt(s[n])])),
    savedReadable,
    valid: true,
    board: r.board,
    junctions: r.junctions,
    circleO: r.circleO,
    fivePoints: r.fivePoints,
    fivePointCircle: r.fivePointCircle,
    concyclic: r.concyclic,
    radicalAxis: checks,
    core: r,
    note: !savedReadable
      ? "The saved points could not be read, so the applet's opening arrangement is shown; the core reading below comes from those opening points."
      : `Track.state saved the six draggable points in board units; the page does not save the circles. The real core rebuilds them: M1,M2,N1,N2 lie on (O) to within ${r.circleO.maxGap}, and Q, M3, N3, M4, N4 lie on the green circle to within ${r.fivePointCircle.maxGap}. Q's equal powers in MPX and NPX and Y,Z's equal powers in (O) and the five-point circle explain why MN is their common chord. This is an illustration, so there is no win or loss.`,
  };
}
