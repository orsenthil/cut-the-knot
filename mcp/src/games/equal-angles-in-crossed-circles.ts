/*
 * run_game_logic actions and saved-position reader for Equal Angles In
 * Crossed Circles (Bogomolny's EqualAnglesInCrossedCircles applet).
 *
 * Two circles share S and T. One straight chord, the line RS→RB, cuts the
 * larger circle at A, B and the smaller at P, Q. When both pieces of the chord
 * lie inside the shared lens (the two spans are nested), the inscribed angles
 * in the cyclic quadrilaterals ASTB and PSTQ give ∠ASP = ∠BTQ and
 * ∠ATP = ∠BSQ. Drag the chord clear of that lens and the two chord spans are
 * disjoint: the picture the applet describes is gone and the angles part
 * company — the reader pins down such a configuration with the real core.
 *
 * This is a different theorem from the sibling applet Equal Angles In Crossing
 * Circles, which draws two lines through a crossing point and claims the two
 * chords AB = CD have equal length. Here there is one chord and the claim is
 * about two pairs of angles, not lengths.
 *
 * Every number below comes from the game's real core,
 * equal-angles-in-crossed-circles/equal-angles-in-crossed-circles-core.js,
 * copied into src/generated/cores/ at build time. Coordinates are board units
 * of the page's 400 x 400 view, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type CircleData = { x: number; y: number; r: number };
type State = {
  S: Point; T: Point; RB: Point; RS: Point;
  names: boolean; statement: boolean; extra: boolean;
};
type Drawing = {
  stale: boolean; valid: boolean;
  S: Point; T: Point; RB: Point; RS: Point;
  viaRB: CircleData; viaRS: CircleData;
  bigCircle: CircleData; smallCircle: CircleData;
  chord: { p1: Point; p2: Point };
  A: Point | null; B: Point | null; P: Point | null; Q: Point | null;
  angleASP?: number; angleBTQ?: number; angleBSQ?: number; angleATP?: number;
  signedASP?: number; signedBTQ?: number; signedBSQ?: number; signedATP?: number;
};
type Core = {
  VIEW: { width: number; height: number };
  MARGIN: number;
  start(options?: Json): Json;
  inside(p: Point, options?: Json): Point;
  withPoint(state: Json, name: string, p: Point): Json;
  withToggle(state: Json, name: string, value: boolean): Json;
  compute(state: Json): Drawing;
  drawn(d: Drawing): boolean;
  angleGap(d: Drawing): number;
  angle(v: Point, p: Point, q: Point): number;
  signedAngle(v: Point, p: Point, q: Point): number;
  dist(p: Point, q: Point): number;
};

const core = (): Core =>
  cores["equal-angles-in-crossed-circles"].EqualAnglesInCrossedCirclesCore as unknown as Core;

const EPS = 1e-6; // rad: how close the two marked angles must be to call them equal

const r4 = (v: number): number => Number(v.toFixed(4));
const sig = (v: number | undefined | null): number | null =>
  v === undefined || v === null || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const deg = (v: number | undefined): number | null =>
  v === undefined || !Number.isFinite(v) ? null : r4((v * 180) / Math.PI);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const circleOf = (c: CircleData | null | undefined): { center: Point | null; radius: number | null } | null =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: pt(c), radius: r4(c.r) }
    : null;

/** A point as the page saves it ({x,y}) or as short JSON arguments ([x,y]). */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** Supplied dots are applied as page drags, so the core clamps them onto the board. */
function buildState(args: Json, C: Core): State {
  let s = C.start({}) as State;
  for (const name of ["S", "T", "RB", "RS"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) {
      s = C.withPoint(s, name, C.inside(readPoint(raw, name))) as State;
    }
  }
  for (const name of ["names", "statement", "extra"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) {
      s = C.withToggle(s, name, readBool(args, name, false)) as State;
    }
  }
  return s;
}

/** Parameter of a chord point along the line RS→RB, as in the port's logic test. */
function along(d: Drawing, p: Point): number {
  const vx = d.RB.x - d.RS.x, vy = d.RB.y - d.RS.y;
  return ((p.x - d.RS.x) * vx + (p.y - d.RS.y) * vy) / (vx * vx + vy * vy);
}

/**
 * The page's picture needs the small chord's span PQ to sit inside the large
 * chord's span AB (or the other way round). Disjoint spans mean the chord has
 * left the shared lens, and the angle equalities are no longer guaranteed.
 */
function span(d: Drawing) {
  if (!d.valid || !d.A || !d.B || !d.P || !d.Q) {
    return { ab: null, pq: null, nested: null };
  }
  const ab = [along(d, d.A), along(d, d.B)].sort((a, b) => a - b);
  const pq = [along(d, d.P), along(d, d.Q)].sort((a, b) => a - b);
  const nested = (ab[0] <= pq[0] && pq[1] <= ab[1]) || (pq[0] <= ab[0] && ab[1] <= pq[1]);
  return {
    ab: [sig(ab[0]), sig(ab[1])],
    pq: [sig(pq[0]), sig(pq[1])],
    nested,
  };
}

/** Everything the core can say about one set of four draggable dots. */
function reading(C: Core, s: State) {
  const d = C.compute(s);
  const good = C.drawn(d);
  const gap = C.angleGap(d);
  const pair = (name: string, first?: number, second?: number, sf?: number, ss?: number) => ({
    first: deg(first), second: deg(second),
    firstSigned: deg(sf), secondSigned: deg(ss),
    difference: sig(Math.abs((first ?? NaN) - (second ?? NaN))),
    equal: Number.isFinite(first) && Number.isFinite(second) && Math.abs((first as number) - (second as number)) < EPS,
    label: name,
  });
  return {
    handles: { S: pt(s.S), T: pt(s.T), RB: pt(s.RB), RS: pt(s.RS) },
    toggles: { names: s.names === true, statement: s.statement === true, extra: s.extra === true },
    drawing: { valid: d.valid === true, stale: d.stale === true, drawn: good },
    circles: {
      viaRB: circleOf(d.viaRB), viaRS: circleOf(d.viaRS),
      big: circleOf(d.bigCircle), small: circleOf(d.smallCircle),
      bigCircleMadeBy: d.RB === s.RB || (d.RB.x === s.RB.x && d.RB.y === s.RB.y) ? "RB" : "RS",
    },
    chord: {
      line: [pt(d.chord?.p1), pt(d.chord?.p2)],
      bigCircleEnds: { A: pt(d.A), B: pt(d.B) },
      smallCircleEnds: { P: pt(d.P), Q: pt(d.Q) },
      span: span(d),
      lengthAB: d.A && d.B ? r4(C.dist(d.A, d.B)) : null,
      lengthPQ: d.P && d.Q ? r4(C.dist(d.P, d.Q)) : null,
    },
    angles: {
      main: pair("∠ASP = ∠BTQ", d.angleASP, d.angleBTQ, d.signedASP, d.signedBTQ),
      second: pair("∠ATP = ∠BSQ", d.angleATP, d.angleBSQ, d.signedATP, d.signedBSQ),
      maxGapRad: sig(gap),
      bothEqual: good && gap < EPS,
    },
    inscribed: good && d.A && d.B && d.P && d.Q
      ? {
          largeCircle: { atS: deg(C.angle(d.S, d.A, d.B)), atT: deg(C.angle(d.T, d.A, d.B)) },
          smallCircle: { atS: deg(C.angle(d.S, d.P, d.Q)), atT: deg(C.angle(d.T, d.P, d.Q)) },
        }
      : null,
  };
}

const SIBLING_NOTE =
  "This is not the sibling applet Equal Angles In Crossing Circles: there two lines through a crossing point make equal angles with the common chord and the claim is that their chords AB and CD have equal length; here one chord cuts both circles and the claim is about two pairs of angles.";

const PROOF_NOTE =
  "ASTB and PSTQ are cyclic quadrilaterals. Subtracting the exterior angles at S and Q gives ∠ASP = (180° − ∠ABT) − (180° − ∠PQT) = ∠BTQ; subtracting equal inscribed angles in the two circles gives ∠ATP = ∠BSQ. The unsigned angles agree even though the signed ones have opposite orientation.";

/** A configuration found by the port's logic test where the chord leaves the lens. */
const OUTSIDE = {
  S: [284, 38], T: [284, 217], RB: [239, 225], RS: [359, 369],
};

export function actions(): GameActions {
  return {
    equal_angles: {
      describe:
        "For the four draggable dots S, T, RB, RS (each [x, y] or { x, y } on the page's 400 by 400 board; omit any for the opening picture), run the applet's Compute() with the real core: the two circumcircles through S,T,RB and S,T,RS, the chord RS→RB cut once in each, and the four marked angles. Report the left-to-right chord ends A,B on the big circle and P,Q on the small one, the spans of the two chord pieces, ∠ASP against ∠BTQ and ∠ATP against ∠BSQ in degrees with their gaps, and the inscribed angles that prove the equalities. Optional boolean toggles names, statement and extra mirror the page's buttons. Points outside the board are clamped just as a drag would clamp them.",
      args: '{ "S": [153, 320], "T": [250, 320], "RB": [133, 200], "RS": [222.2222, 200], "statement": true }',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        const r = reading(C, s);
        return {
          ...r,
          note: r.drawing.stale
            ? `S and T are less than one unit apart, so the applet keeps its previous picture and there is no new chord to measure. ${SIBLING_NOTE}`
            : !r.drawing.drawn
              ? `The line RB–RS does not cut both circles twice here, so there are no four chord ends or marked angles; move the four dots. ${SIBLING_NOTE}`
              : r.chord.span.nested && r.angles.bothEqual
                ? `The small chord PQ sits inside AB and both angle pairs agree to ${r.angles.maxGapRad} rad, as the page claims. ${PROOF_NOTE} ${SIBLING_NOTE}`
                : `The two chord spans are ${r.chord.span.nested ? "nested but the angles still differ" : "disjoint: the chord has left the shared lens"}, with angle gap ${r.angles.maxGapRad} rad; the page's equality is about the nested crossing picture. ${PROOF_NOTE} ${SIBLING_NOTE}`,
        };
      },
    },

    outside_lens: {
      describe:
        "Show why the page's equality needs the crossing picture: with no arguments, measure a configuration (found by the port's logic test) where the chord misses the shared lens so the spans AB and PQ are disjoint, alongside the opening nested picture, using the real core for both. Pass S, T, RB, RS ([x, y] or { x, y }) to measure your own four dots instead; the default outside-lens dots are S=[284,38], T=[284,217], RB=[239,225], RS=[359,369]. Reports both angle pairs in degrees and their difference, and confirms the opening picture agrees while the disjoint one does not.",
      args: '{ "S": [284, 38], "T": [284, 217], "RB": [239, 225], "RS": [359, 369] }',
      run: (args) => {
        const C = core();
        const custom = ["S", "T", "RB", "RS"].some(
          (k) => args[k] !== undefined && args[k] !== null,
        );
        const brokenState = custom ? buildState(args, C) : buildState(OUTSIDE as unknown as Json, C);
        const openState = C.start({}) as State;
        const broken = reading(C, brokenState);
        const open = reading(C, openState);
        return {
          source: custom ? "four supplied dots" : "the logic test's outside-lens configuration",
          outside: broken,
          opening: open,
          comparison: {
            openingNested: open.chord.span.nested,
            openingGapRad: open.angles.maxGapRad,
            openingEqual: open.angles.bothEqual,
            outsideNested: broken.chord.span.nested,
            outsideGapRad: broken.angles.maxGapRad,
            outsideEqual: broken.angles.bothEqual,
          },
          note:
            `At the opening picture PQ lies inside AB and both pairs match to ${open.angles.maxGapRad} rad. ` +
            `Outside the lens the two chord pieces are disjoint and the marked angles differ by up to ${broken.angles.maxGapRad} rad ` +
            `(∠ASP vs ∠BTQ: ${broken.angles.main.first}° vs ${broken.angles.main.second}°; ` +
            `∠ATP vs ∠BSQ: ${broken.angles.second.first}° vs ${broken.angles.second.second}°). ` +
            `${PROOF_NOTE} ${SIBLING_NOTE}`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equal Angles In Crossed Circles state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  const home = C.start({}) as State;
  const read = (key: "S" | "T" | "RB" | "RS"): Point => {
    const raw = src[key];
    return raw === undefined || raw === null ? { ...home[key] } : C.inside(readPoint(raw, key));
  };
  const s: State = {
    S: read("S"), T: read("T"), RB: read("RB"), RS: read("RS"),
    names: readBool({ names: src.names }, "names", home.names),
    statement: readBool({ statement: src.statement }, "statement", home.statement),
    extra: readBool({ extra: src.extra }, "extra", home.extra),
  };
  const r = reading(C, s);
  return {
    ...src,
    stateVersion,
    saved: {
      S: pt(s.S), T: pt(s.T), RB: pt(s.RB), RS: pt(s.RS),
      names: s.names, statement: s.statement, extra: s.extra,
    },
    core: r,
    equalitiesHold: r.angles.bothEqual && r.chord.span.nested === true,
    note: r.drawing.stale
      ? "Track.state saved the four draggable dots and three buttons; S and T are now less than one unit apart, so the applet keeps its old picture. This is an illustration with no win or loss."
      : !r.drawing.drawn
        ? "Track.state saved the four draggable dots and three buttons; at this position the chord does not cut both circles twice, so no angles are drawn. This is an illustration with no win or loss."
        : `Track.state saved the four draggable dots and three buttons. The core rebuilds both circumcircles, the chord ends A,B,P,Q and the angles: ${r.angles.bothEqual ? `both pairs match to ${r.angles.maxGapRad} rad` : `the angle gap is ${r.angles.maxGapRad} rad`}, with the chord pieces ${r.chord.span.nested ? "nested in the shared lens" : "disjoint, outside the lens"}. This is an illustration with no win or loss. ${SIBLING_NOTE}`,
  };
}
