/*
 * run_game_logic actions and saved-position reader for Four Touching Circles.
 *
 * The applet fixes a ring of four touches: two upright parallel lines through
 * A and B and two circles tangent to them at A and B and to each other at E.
 * The fourth contact is the point at infinity where the parallel lines meet,
 * so A, E, B and infinity lie on the line AB. Inversion in the circle centred
 * at O through R sends AB to a circle through O and sends A, E, B to three
 * points on it: that is the page's proof. Putting O at E makes the two circle
 * images parallel lines and the circle through the contacts degenerate to a
 * line, i.e. a circle through infinity.
 *
 * The page's Remark is a separate, corrected claim: for a closed chain of
 * four *finite* circles the four contacts are concyclic iff the number of
 * external touches is even (0, 2 or 4); with 1 or 3 the claim fails. This
 * applet can only draw the even family; the odd counterexamples live in its
 * sibling game Four Touching Circles 3 (FourTouchingCircles3Core).
 *
 * Every geometric number below is measured by the game's real core, copied at
 * build time from four-touching-circles/four-touching-circles-core.js into
 * src/generated/cores/. Coordinates are board units of the 600 x 450 applet,
 * with y down. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { p: Pt; q: Pt };
type Disk = { center: Pt; radius: number };
type Image =
  | { kind: "circle"; center: Pt; radius: number }
  | { kind: "line"; p: Pt; q: Pt }
  | { kind: "none" };
type State = {
  width: number; height: number;
  A: Pt; B: Pt; E: Pt; O: Pt; R: Pt;
  inverted: boolean;
};
type Geometry = {
  A: Pt; B: Pt; E: Pt; O: Pt; R: Pt; width: number; height: number;
  inversion: { center: Pt; radius: number };
  lineA: Line; lineB: Line; lineAB: Line;
  cA: Disk; cB: Disk;
  imgLineA: Image; imgLineB: Image; imgLineAB: Image;
  imgCA: Image; imgCB: Image;
  invertedPoints: { A: Pt; E: Pt; B: Pt; infinity: Pt };
  through: Disk | null;
  concyclic: boolean; onAB: boolean; externalFinite: number; valid: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number;
  start(options?: { width?: number; height?: number; inverted?: boolean }): State;
  setPoint(s: State, name: string, p: Pt): State;
  setInverted(s: State, on: boolean): State;
  position(s: State): Json;
  geometry(s: State): Geometry;
};
const core = (): Core =>
  cores["four-touching-circles"].FourTouchingCirclesCore as unknown as Core;

const NAMES = ["A", "B", "E", "O", "R"] as const;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number): string | null => (Number.isFinite(v) ? Number(v.toExponential(2)).toString() : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const disk = (d: Disk): Json => ({ center: pt(d.center), radius: r6(d.radius) });
const lineShape = (l: Line): Json => ({ kind: "line", p: pt(l.p), q: pt(l.q) });
const image = (im: Image): Json =>
  im.kind === "circle"
    ? { kind: "circle", center: pt(im.center), radius: r6(im.radius) }
    : im.kind === "line"
      ? { kind: "line", p: pt(im.p), q: pt(im.q) }
      : { kind: "none" };
const direction = (im: Image): Pt | null =>
  im.kind === "line" ? { x: im.q.x - im.p.x, y: im.q.y - im.p.y } : null;
const cross = (a: Pt, b: Pt, c: Pt): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const distance = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);

/** The page's corrected claim, and why this applet cannot show its false half. */
const PARITY = {
  rule:
    "For a closed ring of four finite tangent circles the four contact points are concyclic exactly when the number of external touches is even (0, 2 or 4); with 1 or 3 external touches they are not.",
  thisApplet:
    "This applet replaces two of the circles by parallel lines, so its contacts A, E, B and infinity always lie on AB and their images always lie with O on one circle (a line when O is on AB). It can only illustrate the even case.",
  oddExamples:
    "The sibling applet Four Touching Circles 3 (FourTouchingCircles3Core) lets all four circles be dragged and produces the odd-parity chains where the page's unqualified opening claim fails.",
  caveat:
    "externalFiniteContacts below is this core's convention for the two finite circles in this figure; it is not the parity in the Remark, which counts a closed chain of four finite circles.",
};

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

/** A missing or malformed saved point falls back to the applet's opening dot. */
function maybePoint(raw: unknown, fallback: Pt): Pt {
  try {
    return readPoint(raw, "saved point", fallback);
  } catch {
    return { ...fallback };
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

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${key}" must be a boolean, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function asArgs(args: unknown): Json {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, E, O, R points and options");
  }
  return args as Json;
}

/** The applet's opening picture with any supplied handle moves applied. */
function buildState(C: Core, args: Json): State {
  let s = C.start({
    width: dimension(args, "width", C.WIDTH),
    height: dimension(args, "height", C.HEIGHT),
    inverted: boolArg(args, "inverted", false),
  });
  for (const name of NAMES) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.setPoint(s, name, readPoint(raw, name));
  }
  return s;
}

/**
 * The four contacts are concyclic in the ordinary picture. If AB passes
 * through O its inverse is a line and the "circle" has degenerated: test the
 * collinearity of A', B' and O instead (E' is then at infinity).
 */
function contactCurve(g: Geometry): { kind: string; onOneCurve: boolean; residual: string | null } {
  if (g.imgLineAB.kind === "line") {
    const a = g.invertedPoints.A, b = g.invertedPoints.B, o = g.invertedPoints.infinity;
    if (![a, b, o].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      return { kind: "line", onOneCurve: false, residual: null };
    }
    const residual = cross(a, b, o) / Math.max(1, distance(a, b));
    return { kind: "line", onOneCurve: Math.abs(residual) <= 1e-6, residual: sig(residual) };
  }
  const t = g.through;
  if (t && Number.isFinite(t.center.x) && Number.isFinite(t.center.y) && Number.isFinite(t.radius)) {
    const residual = (distance(t.center, g.invertedPoints.B) - t.radius) / Math.max(1, t.radius);
    return { kind: "circle", onOneCurve: Math.abs(residual) <= 1e-6, residual: sig(residual) };
  }
  return { kind: "unknown", onOneCurve: false, residual: null };
}

function status(s: State, g: Geometry): string {
  const curve = g.imgLineAB.kind === "line" ? "line" : "circle";
  const contacts = s.inverted
    ? `Inverted contacts A′, E′, B′ and O lie on one ${curve}`
    : "Contacts A, E, B and the point at infinity lie on the line AB";
  return `${contacts}. Inversion radius ${r6(g.inversion.radius)}. Drag the circled points to change the chain.`;
}

/** Everything the page draws and checks, measured from the core's geometry. */
function reading(s: State, g: Geometry) {
  const curve = contactCurve(g);
  return {
    board: { width: s.width, height: s.height },
    view: { inverted: s.inverted },
    handles: {
      A: pt(s.A), B: pt(s.B), E: pt(s.E), O: pt(s.O), R: pt(s.R),
    },
    inversion: { center: pt(g.inversion.center), radiusPoint: pt(s.R), radius: r6(g.inversion.radius) },
    chain: {
      guideLines: { throughA: lineShape(g.lineA), throughB: lineShape(g.lineB) },
      base: lineShape(g.lineAB),
      circles: { throughA: disk(g.cA), throughB: disk(g.cB) },
      tangencies: { A: pt(s.A), E: pt(s.E), B: pt(s.B), atInfinity: pt(g.inversion.center) },
      onAB: g.onAB,
      externalFiniteContacts: g.externalFinite,
    },
    invertedImages: {
      lineA: image(g.imgLineA), lineB: image(g.imgLineB), lineAB: image(g.imgLineAB),
      circleA: image(g.imgCA), circleB: image(g.imgCB),
    },
    contacts: {
      A: pt(g.invertedPoints.A), E: pt(g.invertedPoints.E), B: pt(g.invertedPoints.B),
      infinity: pt(g.invertedPoints.infinity),
      circleThroughOABE: g.through ? disk(g.through) : null,
      onOneCurve: curve.onOneCurve, curveKind: curve.kind, residual: curve.residual,
      coreConcyclic: g.concyclic,
    },
    valid: g.valid,
    status: status(s, g),
    parity: PARITY,
    note:
      "The two upright lines touch the two circles at A and B; those circles meet at E, and the lines meet at infinity, so all four contacts start on AB. Inversion in the circle about O through R keeps touches, sending AB to a circle through O and A′, E′, B′. " +
      PARITY.thisApplet + " " + PARITY.rule,
  };
}

export function actions(): GameActions {
  return {
    inversion_construction: {
      describe:
        "For the five draggable points A, B, E (kept on AB), O and R (each [x, y] or { x, y } on the 600 x 450 board; omit any to keep the applet's opening picture), report the two upright lines and two circles tangent at A, E and B, the inversion in the circle centred at O through R, the image of each line and circle, and the inverted contacts A′, E′, B′ and O. Check that the contacts lie on one curve. This applet only draws the even-touch family; the odd counterexamples to the page's corrected parity rule are in its sibling Four Touching Circles 3.",
      args: '{"A":[244,162],"B":[480,90],"E":[342.857143,131.840194],"O":[375,281.25],"R":[262.5,337.5]}',
      run: (args) => {
        const C = core();
        const s = buildState(C, asArgs(args));
        return reading(s, C.geometry(s));
      },
    },

    invert_at_e: {
      describe:
        "Reproduce the page's Invert at E button: force the inversion centre O onto the contact E (an O argument is ignored), optionally set R with an R point or a numeric radius, tick the inverted diagram, and report the images of the two circles touching at E. They become two parallel lines, and AB inverts to a line through O carrying A′ and B′, the degenerate circle-through-infinity that makes the contacts collinear. Accepts the same A, B, E and R points as inversion_construction; the odd-parity chains where concyclicity fails are the sibling game Four Touching Circles 3.",
      args: '{"A":[244,162],"B":[480,90],"E":[342.857143,131.840194]}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const base = buildState(C, a);
        const E = { ...base.E };
        let s = C.setPoint(base, "O", E);
        if (a.R !== undefined && a.R !== null) {
          s = C.setPoint(s, "R", readPoint(a.R, "R"));
        } else if (a.radius !== undefined && a.radius !== null) {
          const radius = Number(a.radius);
          if (!Number.isFinite(radius) || radius <= 0) {
            throw new Error('argument "radius" must be a positive number');
          }
          s = C.setPoint(s, "R", { x: E.x + radius, y: E.y });
        } else {
          s = C.setPoint(s, "R", { x: E.x + 70, y: E.y + 50 });
        }
        s = C.setInverted(s, true);
        const g = C.geometry(s);

        const dA = direction(g.imgCA), dB = direction(g.imgCB);
        const parallel = dA !== null && dB !== null &&
          Math.abs(dA.x * dB.y - dA.y * dB.x) <=
            1e-6 * Math.max(1, Math.hypot(dA.x, dA.y) * Math.hypot(dB.x, dB.y));
        const { A: A2, E: E2, B: B2, infinity: O2 } = g.invertedPoints;
        const collinear = Number.isFinite(A2.x) && Number.isFinite(B2.x) &&
          Math.abs(cross(A2, B2, O2)) <= 1e-6 * Math.max(1, distance(A2, B2));

        return {
          ...reading(s, g),
          movedCentre: { from: pt(base.O), to: pt(s.O) },
          imageLinesOfTouchingCircles: {
            circleA: image(g.imgCA), circleB: image(g.imgCB),
            bothAreLines: g.imgCA.kind === "line" && g.imgCB.kind === "line",
            parallel,
          },
          inverseOfAB: image(g.imgLineAB),
          collinearContacts: {
            A: pt(A2), E: pt(E2), B: pt(B2), infinity: pt(O2),
            collinear,
            residual: sig(cross(A2, B2, O2) / Math.max(1, distance(A2, B2))),
          },
          note:
            "With O at the touch E, circles through O invert to lines, so the two circles that touched at E become parallel lines - exactly the applet's note. E itself is the inversion centre and has no finite image, so the contact quartet degenerates: A′, B′ and O lie on the line that AB inverts to (AB passes through O, so it inverts to itself). This is still the even case. " +
            PARITY.rule + " " + PARITY.oddExamples,
        };
      },
    },
  };
}

/** A state rebuilt from the five fields Track.state saved, with safe fallbacks. */
function savedState(C: Core, state: Json): State {
  const seed = C.start({
    width: Number.isFinite(Number(state.width)) && Number(state.width) > 0 ? Number(state.width) : C.WIDTH,
    height: Number.isFinite(Number(state.height)) && Number(state.height) > 0 ? Number(state.height) : C.HEIGHT,
    inverted: state.inverted === true,
  });
  let s = seed;
  for (const name of NAMES) s = C.setPoint(s, name, maybePoint(state[name], seed[name]));
  return s;
}

/** Echo the fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Touching Circles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Touching Circles position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const g = C.geometry(s);
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: g.valid,
    core: reading(s, g),
    note:
      "Track.state saved the five draggable points A, B, E, O and R in board units plus the inverted-diagram flag; the page saves no width, height or outcome (this is a demo). The real core rebuilds the two tangent circles, the inversion, all five images and the contact circle from those points. " +
      PARITY.thisApplet + " " + PARITY.oddExamples,
  };
}
