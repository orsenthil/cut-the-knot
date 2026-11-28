/*
 * run_game_logic actions and saved-position reader for Max Common Chord 5
 * (Bogomolny's MaxCommonChord5 applet, the cut-the-knot page "Two Circles and
 * Two More").
 *
 * Two fixed circles C(E) and C(F) meet at P and Q. A lies on C(E), B lies on
 * C(F), and the chord AB is kept through P: dragging A or B re-fixes the far
 * endpoint on its own circle along the line through P. W is AE meet BF. The
 * page claims E, Q, W, F lie on one circle and A, Q, W, B on another, so W is
 * the two circles' second common point after Q. The directed angle between
 * the lines AE and BF is constant; as an ordinary angle EWF equals EPF or its
 * supplement, depending on which side of AB the point W falls. Unlike sibling
 * 4 (which runs rays through the two centres to L, M, G, H and compares angles
 * at Q), this applet takes A and B on the circles and studies W = AE n BF.
 * A quirk of the applet: dragging P or Q does NOT re-fix the chord, so AB can
 * stop passing through P while the drawing is otherwise still valid.
 *
 * Every number below comes from the game's real core, copied at build time
 * from max-common-chord-5/max-common-chord-5-core.js into
 * src/generated/cores/. Coordinates are board units of the 400 x 250 board,
 * y down. See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type State = { P: Pt; Q: Pt; A: Pt; B: Pt };
type Geometry = {
  P: Pt; Q: Pt; A: Pt; B: Pt;
  E: Circle | null; F: Circle | null;
  EQF: Circle | null; ABQ: Circle | null;
  W: Pt | null; R: Pt | null; S: Pt | null; U: Pt | null;
  T: Pt | null; N: Pt | null; L: Pt | null; M: Pt | null;
  valid: boolean; throughP: boolean;
  angleEPF: number; angleEWF: number; angleAQB: number; angleAWB: number;
};
type Core = {
  WIDTH: number; HEIGHT: number; EDGE: number; MIN_SEPARATION: number;
  P0: Pt; Q0: Pt; A0: Pt; B0: Pt;
  dist(a: Pt, b: Pt): number;
  cross(a: Pt, b: Pt, c: Pt): number;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  circle(a: Pt, b: Pt, c: Pt): Circle;
  onCircle(c: Circle, theta: number): Pt;
  angle(a: Pt, v: Pt, b: Pt): number;
  clampPoint(p: Pt): Pt;
  start(): State;
  move(s: State, name: string, target: Pt, mode: string): State;
  geometry(s: State): Geometry;
  position(s: State): Json;
};
const core = (): Core =>
  cores["max-common-chord-5"].MaxCommonChord5Core as unknown as Core;

const HANDLES = ["P", "Q", "A", "B"] as const;
type Handle = (typeof HANDLES)[number];

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON cannot carry NaN/Infinity; print non-finite core values as null. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const finitePt = (v: Pt | null | undefined): v is Pt =>
  !!v && Number.isFinite(v.x) && Number.isFinite(v.y);
const pt = (v: Pt | null | undefined): Pt | null =>
  finitePt(v) ? { x: r6(v.x), y: r6(v.y) } : null;
const circ = (v: Circle | null | undefined) =>
  v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.r)
    ? { center: { x: r6(v.x), y: r6(v.y) }, radius: r6(v.r) }
    : null;

/** Tutor points may be [x, y]; saved Track.state points are { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional point argument: throw on a present but malformed value. */
function maybePoint(args: Json, key: string): Pt | null {
  const v = args[key];
  return v === undefined || v === null ? null : readPoint(v, key);
}

function readMode(args: Json): "chord" | "circles" {
  const v = args.mode;
  if (v === undefined || v === null) return "chord";
  if (v !== "chord" && v !== "circles") {
    throw new Error('"mode" must be "chord" (drag along the circle, the applet default) or "circles" (free A and B)');
  }
  return v;
}

/** Direct four-point picture, defaulting to the core's opening diagram. */
function directState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points P, Q, A and B");
  }
  const s = C.start();
  for (const name of HANDLES) {
    const p = maybePoint(args, name);
    if (p) s[name] = p;
  }
  return s;
}

/** Does p lie on circle c, within the core's coordinate rounding? */
function liesOn(C: Core, p: Pt | null, c: Circle | null): boolean {
  if (!finitePt(p) || !c || !Number.isFinite(c.r)) return false;
  return Math.abs(C.dist(p, c) - c.r) <= 1e-3 * Math.max(1, c.r);
}

/** Everything the real core can say about one diagram, in tutor-friendly form. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const E = circ(g.E), F = circ(g.F), EQF = circ(g.EQF), ABQ = circ(g.ABQ);
  const W = pt(g.W);
  // W is drawn as AE n BF; check that against the core's intersection helper.
  const wCross = g.valid && g.E && g.F
    ? C.intersect(s.A, g.E, s.B, g.F)
    : null;
  const wCrossGap = finitePt(g.W) && finitePt(wCross) ? cnt(C.dist(g.W, wCross)) : null;
  const epf = g.angleEPF, ewf = g.angleEWF;
  const equal = Number.isFinite(epf) && Number.isFinite(ewf) && Math.abs(epf - ewf) < 1e-4;
  const supplementary = Number.isFinite(epf) && Number.isFinite(ewf) &&
    Math.abs(epf + ewf - 180) < 1e-4;
  const chordLength = C.dist(s.A, s.B);
  const offChord = g.valid && chordLength > 0
    ? cnt(Math.abs(C.cross(s.A, s.B, s.P)) / chordLength)
    : null;

  return {
    valid: g.valid,
    throughP: g.throughP,
    offChordBy: offChord,
    handles: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    givenCircles: { E, F },
    claimedCircles: { EQF, ABQ },
    commonPointW: W,
    wIsAEmeetBF: { fromCore: wCrossGap === null ? null : wCrossGap < 1e-3, gap: wCrossGap },
    bothCirclesShareQandW: {
      circleEQF: { Q: liesOn(C, s.Q, g.EQF), W: liesOn(C, g.W, g.EQF) },
      circleABQ: { Q: liesOn(C, s.Q, g.ABQ), W: liesOn(C, g.W, g.ABQ) },
      claimHolds: liesOn(C, s.Q, g.EQF) && liesOn(C, g.W, g.EQF) &&
        liesOn(C, s.Q, g.ABQ) && liesOn(C, g.W, g.ABQ),
    },
    angles: {
      EPF: cnt(epf), EWF: cnt(ewf), AQB: cnt(g.angleAQB), AWB: cnt(g.angleAWB),
      equal, supplementary, sameLineAngle: equal || supplementary,
    },
    status: g.valid
      ? (g.throughP
        ? "E, Q, W, F lie on one circle and A, Q, W, B on another; both pass through Q and W."
        : "The two circles still exist, but AB no longer goes through P: dragging P or Q broke the chord.")
      : "Some points are too close together, so the core cannot draw every circle.",
    note:
      "E and F are the circumcentres of A,P,Q and B,P,Q; W is where AE meets BF. " +
      "The core draws C(E,Q,F) and C(A,B,Q); both pass through Q and W, so W is their second common point. " +
      (equal
        ? `The undirected angle EWF equals EPF = ${cnt(epf)}°, as the page says.`
        : supplementary
          ? `W lies on the other side here: EWF = ${cnt(ewf)}° is the supplement of EPF = ${cnt(epf)}°. ` +
            "The directed angle between the lines AE and BF is the same in both cases, so the invariant holds; " +
            "an ordinary (non-directed) angle may need the supplement."
          : "The angle reading is degenerate here; move the points apart.") +
      (g.throughP ? "" : " AB was not re-fixed because P or Q was dragged: A, B and P are no longer collinear.") +
      " This is an illustration, so there is no win or loss. " +
      "Sibling 4 is a different diagram (rays through the centres to L, M, G, H), not this A,B,W construction.",
  };
}

/** Rebuild a core state from the four handles Track.state saved. */
function savedState(C: Core, state: Json): State {
  const s = C.start();
  for (const name of HANDLES) {
    const v = state[name];
    if (v !== undefined && v !== null) s[name] = readPoint(v, `saved ${name}`);
  }
  return s;
}

export function actions(): GameActions {
  return {
    concyclic_pair: {
      describe:
        "Build the two-circle diagram from the four draggable points P, Q, A and B (each [x, y] or { x, y } on the 400 x 250 board; omit any to keep the core's opening picture) and run the real geometry. Report the given circles C(A,P,Q) and C(B,P,Q), the claimed circles through E,Q,F and A,Q,B, check that Q and W lie on both, verify W is AE meet BF, and compare the angles EWF and EPF. The angle is invariant as a directed angle between the lines AE and BF; as an ordinary angle it is EPF or its supplement. Unlike sibling 4, this applet studies the chord AB through P and W = AE n BF.",
      args: '{"P":[222.181818,150],"Q":[200,200],"A":[160,150],"B":[341.818182,150]}',
      run: (args) => {
        const C = core();
        const s = directState(C, args);
        return {
          diagram: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
          ...reading(C, s),
        };
      },
    },

    slide_and_drag: {
      describe:
        "Sweep A around its circle with the applet's real Fix (mode 'chord', the default, slides A on C(E) and re-fixes B so AB keeps going through P; mode 'circles' lets A and B move freely), then drag P off the chord to show the applet's quirk. For each sample report angle EPF (fixed, since E, F and P do not move), angle EWF and whether it equals EPF or its supplement, and whether AB still goes through P. An optional 'A' point [x,y] or {x,y} is applied after the sweep; an optional 'P' point sets where P is dragged (default: 40 units straight up off the chord). Dragging P or Q never re-fixes the chord, so throughP turns false while the circles stay valid.",
      args: '{"mode":"chord","P":[218.181818,110]}',
      run: (args) => {
        const C = core();
        const mode = readMode(args);
        const start = C.start();
        const c = C.circle(start.A, start.P, start.Q);
        const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        const samples = angles.map((theta) => {
          const s = C.move(start, "A", C.onCircle(c, theta), mode);
          const g = C.geometry(s);
          const epf = g.angleEPF, ewf = g.angleEWF;
          return {
            theta: r6(theta),
            A: pt(s.A), B: pt(s.B), W: pt(g.W),
            angleEPF: cnt(epf), angleEWF: cnt(ewf),
            relation: Math.abs(epf - ewf) < 1e-4 ? "equal"
              : Math.abs(epf + ewf - 180) < 1e-4 ? "supplement" : "other",
            throughP: g.throughP, valid: g.valid,
          };
        });
        const aTarget = maybePoint(args, "A");
        const afterA = aTarget ? C.move(start, "A", aTarget, mode) : null;
        const pTarget = maybePoint(args, "P") ?? { x: start.P.x, y: start.P.y - 40 };
        const afterP = C.move(afterA ?? start, "P", pTarget, mode);
        const gP = C.geometry(afterP);
        const relations = Array.from(new Set(samples.map((s) => s.relation)));
        const epfs = Array.from(new Set(samples.map((s) => s.angleEPF)));
        return {
          mode,
          board: { width: C.WIDTH, height: C.HEIGHT },
          samples,
          summary: {
            angleEPFConstant: epfs.length === 1,
            angleEPF: epfs[0] ?? null,
            relations,
            everyEqualOrSupplement: samples.every((s) => s.relation !== "other"),
            chordStaysThroughP: samples.every((s) => s.throughP),
          },
          afterOptionalA: afterA
            ? { A: pt(afterA.A), B: pt(afterA.B), throughP: C.geometry(afterA).throughP }
            : null,
          pDrag: {
            P: pt(afterP.P), A: pt(afterP.A), B: pt(afterP.B),
            throughP: gP.throughP, valid: gP.valid,
          },
          note:
            "E, F and P are fixed during an A slide, so angle EPF never changes; W moves, and EWF is EPF on one side of the chord and 180° - EPF on the other. " +
            "That is the directed-angle invariant with the ordinary-angle supplement caveat. In 'chord' mode the core re-fixes B along the line through P; dragging P or Q does not, so the final pDrag shows throughP " +
            (gP.throughP ? "still true for this target" : "false: AB no longer passes through P") +
            " while the geometry can remain valid. Sibling 4 uses a different construction (rays through the centres), not A, B and W.",
        };
      },
    },
  };
}

/** Echo every field Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Max Common Chord 5 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Max Common Chord 5 position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const g = C.geometry(s);
  const analysis = reading(C, s);

  const scalar = (saved: unknown, value: number) => ({
    saved,
    core: cnt(value),
    equal: Number.isFinite(Number(saved)) && Math.abs(Number(saved) - value) < 1e-4,
  });
  const pointPair = (saved: unknown, value: Pt | Circle | null) => {
    const p = saved === undefined || saved === null ? null : readPoint(saved, "saved point");
    return { saved: pt(p), core: pt(value), distance: finitePt(p) && finitePt(value) ? cnt(C.dist(p, value)) : null };
  };
  const savedCirc = (saved: unknown): Circle | null => {
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
    const o = saved as Json;
    const c = o.center;
    const radius = Number(o.radius);
    if (!c || typeof c !== "object" || Array.isArray(c) || !Number.isFinite(radius)) return null;
    const q = c as Json;
    const x = Number(q.x), y = Number(q.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y, r: radius } : null;
  };
  const circlePair = (saved: unknown, value: Circle | null) => {
    const c = savedCirc(saved);
    return {
      saved: circ(c),
      core: circ(value),
      centreDistance: c && finitePt(value) ? cnt(C.dist(c, value)) : null,
      radiusDifference: c && value ? cnt(Math.abs(c.r - value.r)) : null,
    };
  };

  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: g.valid,
    throughP: g.throughP,
    core: analysis,
    savedVsCore: {
      P: pointPair(state.P, g.P), Q: pointPair(state.Q, g.Q),
      A: pointPair(state.A, g.A), B: pointPair(state.B, g.B),
      E: pointPair(state.E, g.E), F: pointPair(state.F, g.F),
      W: pointPair(state.W, g.W),
      circleE: circlePair(state.circleE, g.E),
      circleF: circlePair(state.circleF, g.F),
      circleEQF: circlePair(state.circleEQF, g.EQF),
      circleABQ: circlePair(state.circleABQ, g.ABQ),
      throughP: { saved: state.throughP === true, core: g.throughP, equal: state.throughP === true === g.throughP },
      angleEPF: scalar(state.angleEPF, g.angleEPF),
      angleEWF: scalar(state.angleEWF, g.angleEWF),
    },
    note:
      "Track.state saved the four handles P, Q, A, B in board units together with the derived centres E and F, W = AE n BF, the four circles, the throughP flag and the two angles. " +
      "The real core rebuilds C(A,P,Q), C(B,P,Q), C(E,Q,F), C(A,B,Q) and W from the handles, and savedVsCore measures how close the saved derived fields are. " +
      (g.throughP
        ? "AB still passes through P."
        : "AB no longer passes through P: the applet does not re-fix when P or Q is dragged, so the chord is broken even though the circles remain valid.") +
      " Sibling 4 is a different applet (rays through the centres), not this two-chord-point picture.",
  };
}
