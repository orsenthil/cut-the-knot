/*
 * run_game_logic actions and saved-position reader for Funny Square
 * (Alexander Bogomolny's FunnySquare applet, "Square From Nowhere").
 *
 * The real core is funny-square/funny-square-core.js, copied into
 * src/generated/cores/ at build time. Three draggable handles a, p and r sit
 * on one horizontal base line, and compute() places Q so that AP = QR, then
 * drops perpendiculars PD = PR, QB = QR and RC = PQ. The ends B, C, D of
 * those perpendiculars are the other vertices of a square ABCD.
 *
 * The reason is a pair of vectors. With signed u = AP and v = PR in screen
 * coordinates (y down), AB = (v, u) and AD = (u, -v): their dot product is 0
 * and their lengths are equal, so ABCD is a square. Signed lengths keep the
 * claim true when P and Q fall outside AR, which the page's triangle proof
 * had to treat separately. This port follows the page's AP = QR relation;
 * the applet's own Compute() instead used Q.x = R.x - P.x - A.x, which agrees
 * only when A.x = 0.
 *
 * All numbers below are measured by the core on its 480 x 440 board (y down).
 * This is a demonstration with no win or loss.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Flags = { showNames: boolean; hint: boolean; construction: boolean };
type State = Flags & { width: number; height: number; a: Pt; p: Pt; r: Pt };
type Figure = { A: Pt; R: Pt; P: Pt; Q: Pt; D: Pt; B: Pt; C: Pt; T: Pt };
type Metrics = {
  AP: number; QR: number; PR: number; AQ: number;
  PD: number; QB: number; RC: number; PQ: number;
  RT: number; CT: number; BT: number;
  sides: number[]; corners: number[];
};
type Core = {
  WIDTH: number; HEIGHT: number; PAD: number;
  start(options?: Json): State;
  move(s: State, m: { handle: string; x: number; y: number }): State | null;
  legalMoves(): string[];
  reset(s: State): State;
  result(s: State): null;
  toggle(s: State, key: string): State | null;
  compute(s: State): Figure;
  metrics(f: Figure): Metrics;
  position(s: State): Flags & { a: Pt; p: Pt; r: Pt };
};

const core = (): Core => cores["funny-square"].FunnySquareCore as unknown as Core;

const TOL = 1e-7;
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Keep the size of tiny residuals: rounding to six places would print 0. */
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = TOL): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dist = (p: Pt, q: Pt): number => Math.hypot(q.x - p.x, q.y - p.y);

/** Accept the page's { x, y } dots and the tutor's shorter [x, y] form. */
function readPoint(value: unknown, label: string, fallback?: Pt): Pt {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
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

const FLAG_KEYS = ["showNames", "hint", "construction"] as const;

/**
 * Build a core state from JSON args the way the page's drags do: start from
 * the opening diagram, apply a, p and r in order through move() (which keeps
 * all three at a common height and clamps them to the board), then flip any
 * requested checkboxes through toggle().
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) args = {};
  let s = C.start({});
  for (const name of ["a", "p", "r"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      const next = C.move(s, { handle: name, ...readPoint(args[name], name) });
      if (!next) throw new Error(`argument "${name}" could not be applied to the base line`);
      s = next;
    }
  }
  for (const key of FLAG_KEYS) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean`);
    if (s[key] !== v) {
      const next = C.toggle(s, key);
      if (!next) throw new Error(`argument "${key}" could not be toggled`);
      s = next;
    }
  }
  return s;
}

/**
 * Everything the core can say about one diagram: the eight points, the six
 * page lengths, the four sides and corner dot products of ABCD, the vector
 * reason it is a square, the status of P and Q relative to AR, and the
 * origin-dependent discrepancy with the applet's literal Compute().
 */
function reading(C: Core, s: State) {
  const f = C.compute(s);
  const m = C.metrics(f);
  const left = Math.min(s.a.x, s.r.x);
  const right = Math.max(s.a.x, s.r.x);
  const outsideAR = s.p.x <= left || s.p.x >= right || f.Q.x <= left || f.Q.x >= right;

  const ab = { x: f.B.x - f.A.x, y: f.B.y - f.A.y };
  const ad = { x: f.D.x - f.A.x, y: f.D.y - f.A.y };
  const lengthAB = Math.hypot(ab.x, ab.y);
  const lengthAD = Math.hypot(ad.x, ad.y);
  const dot = ab.x * ad.x + ab.y * ad.y;
  const sideSpread = Math.max(...m.sides) - Math.min(...m.sides);
  const maxCorner = Math.max(...m.corners.map(Math.abs));
  const isSquare = m.sides.every((v) => v > 0 && near(v, m.sides[0])) && near(maxCorner, 0);

  // The applet used Q.x = R.x - P.x - A.x; the page's AP = QR gives
  // Q.x = R.x - P.x + A.x (with A the left handle). They differ by 2*A.x.
  const bytecodeQx = f.R.x - f.P.x - f.A.x;
  const u = f.P.x - f.A.x; // signed AP
  const v = f.R.x - f.P.x; // signed PR

  return {
    board: { width: s.width, height: s.height },
    handles: { a: pt(s.a), p: pt(s.p), r: pt(s.r) },
    points: {
      A: pt(f.A), P: pt(f.P), Q: pt(f.Q), R: pt(f.R),
      B: pt(f.B), C: pt(f.C), D: pt(f.D), T: pt(f.T),
    },
    options: { showNames: s.showNames, hint: s.hint, construction: s.construction },
    lengths: {
      AP: sig(m.AP), QR: sig(m.QR), PD: sig(m.PD), PR: sig(m.PR),
      QB: sig(m.QB), RC: sig(m.RC), PQ: sig(m.PQ), AQ: sig(m.AQ),
      apEqualsQr: near(m.AP, m.QR), pdEqualsPr: near(m.PD, m.PR),
      qbEqualsQr: near(m.QB, m.QR), rcEqualsPq: near(m.RC, m.PQ),
    },
    square: {
      vertices: ["A", "B", "C", "D"],
      sides: m.sides.map(sig),
      cornerDotProducts: m.corners.map(sig),
      sideSpread: sig(sideSpread),
      maxCornerResidual: sig(maxCorner),
      isSquare,
    },
    vectors: {
      u_AP: r6(u), v_PR: r6(v),
      AB: { x: r6(ab.x), y: r6(ab.y) },
      AD: { x: r6(ad.x), y: r6(ad.y) },
      dotProduct: sig(dot),
      equalLengths: near(lengthAB, lengthAD),
      expectedAB: `{ x: ${r6(v)}, y: ${r6(u)} }`,
      expectedAD: `{ x: ${r6(u)}, y: ${-r6(v)} }`,
    },
    placement: {
      outsideAR,
      note: outsideAR
        ? "P or Q is outside AR, so the page's triangle proof needs adjusting; the vector proof uses signed u and v and still gives a square."
        : "P and Q lie on the segment AR; the page's triangle proof applies here.",
    },
    hintPoint: {
      T: pt(f.T),
      CT: sig(m.CT), RC: sig(m.RC), RT: sig(m.RT),
      BT: sig(m.BT), AP: sig(m.AP),
      note: "T is on the extension of RC with BT parallel to AR; when P and Q lie between A and R, CT = RC + RT and BT = AP.",
    },
    bytecode: {
      coreQ: pt(f.Q),
      appletQ: pt({ x: bytecodeQx, y: f.P.y }),
      xDifference_core_minus_applet: sig(f.Q.x - bytecodeQx),
      agrees: near(f.Q.x, bytecodeQx),
      note: "The literal applet Compute() used Q.x = R.x - P.x - A.x, which matches AP = QR only when the left handle A.x = 0; it differs here by 2 * A.x.",
    },
    result: C.result(s),
  };
}

const EXAMPLE_ARGS = '{ "a": [122, 264], "p": [200, 264], "r": [360, 264] }';

export function actions(): GameActions {
  return {
    square_from_base: {
      describe:
        "For three handles a, p and r on one horizontal base line ([x, y] or { x, y }, y down; omit any for the opening diagram), the real core places Q with AP = QR, drops the perpendiculars PD = PR, QB = QR and RC = PQ, and reports all eight points, those six lengths, the four sides and the four corner dot products of ABCD. It verifies ABCD is a square even when P or Q falls outside AR, explains it with the vectors AB = (v, u) and AD = (u, -v) where u = AP and v = PR, and compares the core's Q with the applet's origin-dependent Compute() value. Optional showNames, hint and construction flags match the page's checkboxes.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const view = reading(C, s);
        return {
          ...view,
          note:
            `AP = ${view.lengths.AP} and QR = ${view.lengths.QR}; PD = ${view.lengths.PD} and PR = ${view.lengths.PR}; ` +
            `QB = ${view.lengths.QB} and QR = ${view.lengths.QR}; RC = ${view.lengths.RC} and PQ = ${view.lengths.PQ}. ` +
            `ABCD has four sides of ${view.square.sides[0]} and corner dot products ${view.square.cornerDotProducts.join(", ")}, so it is a square: ` +
            `AB = (${view.vectors.AB.x}, ${view.vectors.AB.y}) and AD = (${view.vectors.AD.x}, ${view.vectors.AD.y}) are perpendicular and equally long. ` +
            (view.placement.outsideAR
              ? "P or Q is outside AR here; the signed-length vector proof still holds. "
              : "P and Q lie on AR here. ") +
            "The port follows the page's AP = QR; the applet's literal Q.x = R.x - P.x - A.x would only agree if A.x were 0. " +
            "This is a demonstration with no win or loss.",
        };
      },
    },

    drag_handle: {
      describe:
        "Drag one of the three base-line handles through the real core's move(), then re-check the square. 'handle' must be a, p or r and 'to' a finite [x, y] or { x, y } point; optional a/p/r set the starting diagram (or omit for the opening one). A drag also brings the other two handles to the new height and clamps them to the board. Aim 'to' past R (for example x = 420) to see P and Q land outside AR while ABCD stays a square; the applet's Compute() still puts Q at R.x - P.x - A.x, off by twice the left handle's x offset.",
      args: '{ "handle": "p", "to": [420, 264] }',
      run: (args) => {
        const C = core();
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("arguments must be an object with 'handle' and 'to'");
        }
        const handle = args.handle;
        if (typeof handle !== "string" || C.legalMoves().indexOf(handle) < 0) {
          throw new Error('argument "handle" must be one of a, p, r');
        }
        const to = readPoint(args.to, "to");
        const before = buildState(C, args);
        const next = C.move(before, { handle, x: to.x, y: to.y });
        if (!next) throw new Error(`could not drag handle "${handle}" to the requested point`);
        const was = reading(C, before);
        const now = reading(C, next);
        return {
          handle,
          draggedTo: pt(to),
          before: {
            handles: was.handles,
            isSquare: was.square.isSquare,
            apEqualsQr: was.lengths.apEqualsQr,
            outsideAR: was.placement.outsideAR,
            bytecodeAgrees: was.bytecode.agrees,
          },
          after: now,
          note:
            `Dragging ${handle} to (${pt(to)?.x}, ${pt(to)?.y}) kept all three handles at one height. ` +
            `ABCD was a square before (${was.square.isSquare}) and is one after (${now.square.isSquare}); ` +
            `AP = QR went from ${was.lengths.apEqualsQr} to ${now.lengths.apEqualsQr}. ` +
            (now.placement.outsideAR
              ? "P or Q now falls outside AR, where the signed vectors AB = (v, u) and AD = (u, -v) still make a square. "
              : "P and Q still lie on AR. ") +
            `The applet's Compute() agreed with the core before (${was.bytecode.agrees}) and after (${now.bytecode.agrees}): ` +
            "its Q.x loses the left handle's offset, an origin-dependent bug the page's AP = QR construction avoids. " +
            "This is a demonstration with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Funny Square state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Funny Square position must be an object");
  }
  const C = core();
  const seed = C.start({});
  const a = readPoint(state.a, "saved a", seed.a);
  const p = readPoint(state.p, "saved p", seed.p);
  const r = readPoint(state.r, "saved r", seed.r);
  const flags: Flags = { showNames: seed.showNames, hint: seed.hint, construction: seed.construction };
  for (const key of FLAG_KEYS) {
    const v = state[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`saved ${key} must be a boolean`);
    flags[key] = v;
  }
  const here: State = { ...seed, a, p, r, ...flags };
  const reading_ = reading(C, here);
  const movedHandles = (["a", "p", "r"] as const).filter(
    (name) => !near(here[name].x, seed[name].x) || !near(here[name].y, seed[name].y),
  );

  return {
    ...state,
    stateVersion,
    saved: {
      a: pt(a), p: pt(p), r: pt(r),
      showNames: flags.showNames, hint: flags.hint, construction: flags.construction,
    },
    movedHandles,
    reconstruction: { a: pt(a), p: pt(p), r: pt(r), ...flags },
    reading: reading_,
    note:
      "Track.state saved the three draggable base-line handles a, p, r in board units (y down) and the three checkbox flags; " +
      "the derived square vertices are not saved. The real core rebuilds Q and the perpendiculars from AP = QR, so it can report " +
      "the eight points, the six lengths, the four sides and corners of ABCD, and the vector reason it stays a square. " +
      (reading_.placement.outsideAR
        ? "P or Q lies outside AR here; signed lengths keep the square claim true. "
        : "P and Q lie on AR here. ") +
      "This is a demonstration rather than a game: there is no win or loss, and the tracker records exploration.",
  };
}
