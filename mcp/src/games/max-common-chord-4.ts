/*
 * run_game_logic actions and saved-position reader for Max Common Chord 4
 * (Bogomolny's MaxCommonChord4 applet).
 *
 * Two circles C(E) and C(F) meet at P and Q. The ray EP meets C(F) again at M
 * and the ray FP meets C(E) again at L; another circle through E, Q and F
 * picks out exactly those two points. The core shows that E, F, L, M and Q
 * are concyclic and that the isosceles triangles ELP and FMP give equal apex
 * angles ∠LEP = ∠MFP. The page's unqualified claim ∠LQP = ½∠LEP needs one
 * correction: when Q sits on the small arc LP the inscribed angle becomes
 * 180° − ½∠LEP, the supplement of ∠MQP.
 *
 * Every number below comes from the game's real core
 * (max-common-chord-4/max-common-chord-4-core.js), copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * 400 x 300 applet canvas, y down; a circle carries its centre { x, y } and
 * the applet's mean-of-three-distances radius r. See _shared.ts for the
 * module shape. This is a drawing, so there is no win or loss.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleInfo = { x: number; y: number; r: number };
type Show = {
  statement1: boolean;
  statement2: boolean;
  hint: boolean;
  names: boolean;
};
type State = {
  width: number;
  height: number;
  P: Pt;
  Q: Pt;
  A: Pt;
  B: Pt;
  show: Show;
};
type Figure = {
  valid: boolean;
  complete?: boolean;
  E?: CircleInfo;
  F?: CircleInfo;
  O?: CircleInfo;
  ABQ?: CircleInfo;
  P: Pt;
  Q: Pt;
  A: Pt;
  B: Pt;
  L?: Pt;
  M?: Pt;
  R?: Pt;
  S?: Pt | null;
  G?: Pt;
  H?: Pt;
};
type Claims = {
  apexE: number;
  apexF: number;
  baseE: number;
  baseF: number;
  lqp: number;
  mqp: number;
  lqm: number;
  lem: number;
  lfm: number;
  qMajorLP: boolean;
  qMajorMP: boolean;
  qWithEonLM: boolean;
  qWithFonLM: boolean;
  halfE: number;
  halfF: number;
  offEM: number;
  offFL: number;
  offLM_E: number;
  offM: number;
  offQ: number;
};
type Core = {
  WIDTH: number;
  HEIGHT: number;
  MIN_GAP: number;
  NAMES: string[];
  OPTIONS: string[];
  start(o?: { show?: Partial<Show> }): State;
  movePoint(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  ready(s: State): boolean;
  compute(s: State): Figure;
  claims(f: Figure): Claims | null;
  describe(f: Figure): string;
  position(s: State): Json;
  result(s: State): null;
  legalMoves(s: State): string[];
  dist(a: Pt, b: Pt): number;
  circleThrough(p: Pt, q: Pt, r: Pt): CircleInfo | null;
};

const core = (): Core =>
  cores["max-common-chord-4"].MaxCommonChord4Core as unknown as Core;

const HANDLES = ["P", "Q", "A", "B"] as const;
const SHOW_KEYS = ["statement1", "statement2", "hint", "names"] as const;
type ShowKey = (typeof SHOW_KEYS)[number];

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON cannot carry NaN/Infinity; print non-finite core values as null. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (v: Pt | null | undefined): Pt | null =>
  v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: r6(v.x), y: r6(v.y) } : null;
const circ = (v: CircleInfo | null | undefined) =>
  v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.r)
    ? { center: { x: r6(v.x), y: r6(v.y) }, radius: r6(v.r) }
    : null;
const close = (a: number, b: number, tolerance = 1e-4): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;

/** A tutor point may be [x, y] or { x, y }; saved Track.state points are { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** The four checkboxes; each is optional and must be a boolean when present. */
function readShow(value: unknown, label: string): Partial<Show> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be an object with optional boolean ${SHOW_KEYS.join(", ")} fields`);
  }
  const raw = value as Json;
  for (const key of Object.keys(raw)) {
    if (SHOW_KEYS.indexOf(key as ShowKey) < 0) {
      throw new Error(`"${label}.${key}" is not a checkbox; use ${SHOW_KEYS.join(", ")}`);
    }
    if (raw[key] !== undefined && raw[key] !== null && typeof raw[key] !== "boolean") {
      throw new Error(`"${label}.${key}" must be true or false`);
    }
  }
  const out: Partial<Show> = {};
  for (const key of SHOW_KEYS) {
    if (raw[key] !== undefined && raw[key] !== null) out[key] = raw[key] === true;
  }
  return out;
}

/** Start at the applet's opening picture, then drag any supplied handle. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and checkboxes");
  }
  let s = C.start();
  for (const name of HANDLES) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.movePoint(s, name, readPoint(v, name));
  }
  const show = readShow(args.show, "show");
  for (const key of SHOW_KEYS) s = C.setOption(s, key, show[key] === true);
  return s;
}

/** Rebuild a core state from the four handles Track.state saved. */
function savedState(C: Core, state: Json): State {
  let s = C.start();
  for (const name of HANDLES) {
    const v = state[name];
    if (v !== undefined && v !== null) s = C.movePoint(s, name, readPoint(v, `saved ${name}`));
  }
  const show = readShow(state.show, "saved show");
  for (const key of SHOW_KEYS) s = C.setOption(s, key, show[key] === true);
  return s;
}

/** Everything the real core can say about one picture. */
function reading(C: Core, s: State) {
  const fig = C.compute(s);
  const c = C.claims(fig);
  const base = {
    ready: C.ready(s),
    valid: fig.valid === true,
    complete: fig.complete === true,
    status: C.describe(fig),
    handles: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    options: Object.fromEntries(SHOW_KEYS.map((k) => [k, s.show[k] === true])),
    result: C.result(s),
  };
  if (!fig.valid || !fig.complete || !c) {
    return {
      ...base,
      reason: fig.valid
        ? "The circles do not meet here; move P or Q."
        : "Move the draggable points at least 2 units apart to draw the circles.",
      note:
        "The core skips the construction when P, Q, A or B are too close together, or when the auxiliary circles no longer meet. " +
        "Drag a handle and ask again; this is an illustration, so there is no win or loss.",
    };
  }

  const maxCircleResidual = Math.max(c.offLM_E, c.offM, c.offQ);
  const atQ = {
    LQP: r6(c.lqp),
    MQP: r6(c.mqp),
    LQM: r6(c.lqm),
    LEM: r6(c.lem),
    LFM: r6(c.lfm),
    halfApexE: r6(c.apexE / 2),
    halfApexF: r6(c.apexF / 2),
    qOnMajorArcLP: c.qMajorLP,
    qOnMajorArcMP: c.qMajorMP,
    expectedAngle: cnt(c.halfE),
    expectedAngleF: cnt(c.halfF),
    matchesClaim: close(c.lqp, c.halfE) && close(c.mqp, c.halfF),
    halfAngleCase: c.qMajorLP && close(c.lqp, c.apexE / 2),
    smallArcCase: !c.qMajorLP,
    supplementHolds: !c.qMajorLP && close(c.lqp + c.apexE / 2, 180),
    lqpPlusMqp: r6(c.lqp + c.mqp),
    anglesSupplement: close(c.lqp + c.mqp, 180),
    lqmEqualsLem: close(c.lqm, c.lem),
  };
  const arcText = c.qMajorLP
    ? "Q is on the large arc LP, so ∠LQP = ½∠LEP."
    : "Q is on the small arc LP: ∠LQP = 180° − ½∠LEP, the supplement of ∠MQP (the page's unqualified half-angle claim fails here).";

  return {
    ...base,
    reason: null,
    circles: {
      E: circ(fig.E),
      F: circ(fig.F),
      throughEQF: circ(fig.O),
      throughABQ: circ(fig.ABQ),
    },
    constructed: {
      L: pt(fig.L),
      M: pt(fig.M),
      R: pt(fig.R),
      S: pt(fig.S),
      G: pt(fig.G),
      H: pt(fig.H),
    },
    apexAngles: {
      LEP: r6(c.apexE),
      MFP: r6(c.apexF),
      equal: close(c.apexE, c.apexF),
      baseELP: r6(c.baseE),
      baseFMP: r6(c.baseF),
      baseEqual: close(c.baseE, c.baseF),
    },
    atQ,
    concyclic: {
      circleThroughLEF: circ(C.circleThrough(fig.L!, fig.E!, fig.F!)),
      residualE: cnt(c.offLM_E),
      residualM: cnt(c.offM),
      residualQ: cnt(c.offQ),
      maxResidual: cnt(maxCircleResidual),
      within1e4: maxCircleResidual < 1e-4,
    },
    constructedLines: {
      mOffLineEP: cnt(c.offEM),
      lOffLineFP: cnt(c.offFL),
      mOnEP: c.offEM < 1e-3,
      lOnFP: c.offFL < 1e-3,
    },
    note:
      "ELP and FMP are isosceles because E and F are circle centres; their equal base angles at P force equal apex angles, so ∠LEP = ∠MFP. " +
      "L, E, P and M, F, P are collinear, and the residual of each point from the circle through L, E, F measures the five-point concyclicity. " +
      arcText +
      " This is a drawing, so there is no win or loss.",
  };
}

function readQPositions(value: unknown): Pt[] {
  if (value === undefined || value === null) {
    return [{ x: 200, y: 240 }, { x: 40, y: 240 }];
  }
  if (!Array.isArray(value)) throw new Error('"qs" must be an array of Q positions');
  if (value.length < 1 || value.length > 24) {
    throw new Error('"qs" must contain between 1 and 24 positions');
  }
  return value.map((v, i) => readPoint(v, `qs[${i}]`));
}

export function actions(): GameActions {
  return {
    five_point_circle: {
      describe:
        "Build the construction from the four draggable points P, Q, A and B on the 400 x 300 board, each [x, y] or { x, y }; omit any to keep the applet's opening picture. 'show' may set the statement1, statement2, hint and names checkboxes. Report the circles E, F and the one through E, Q, F, the constructed points L, M, R, S, G and H, the residuals showing E, F, L, M, Q concyclic, the equal apex angles ∠LEP = ∠MFP, and the angle at Q with the small-arc supplement case made explicit.",
      args: '{"P":[204,180],"Q":[200,240],"A":[120,210],"B":[340,180],"show":{"statement1":true,"statement2":true}}',
      run: (args) => {
        const C = core();
        return reading(C, buildState(C, args));
      },
    },

    arc_sweep: {
      describe:
        "Hold P, A and B fixed and compute the picture for each Q position in 'qs' (default [200,240] on the large arc LP and [40,240] on the small arc LP), with P, A, B read exactly as in five_point_circle. For each Q the core reports which arc it lies on, ∠LQP, ∠MQP, ½∠LEP and its supplement, whether concyclicity and the equal apex angles still hold, and the status line: on the small arc ∠LQP becomes 180° − ½∠LEP and is the supplement of ∠MQP.",
      args: '{"P":[204,180],"A":[120,210],"B":[340,180],"qs":[[200,240],[40,240]]}',
      run: (args) => {
        const C = core();
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("arguments must be an object of points and a qs array");
        }
        const qs = readQPositions(args.qs);
        let base = C.start();
        for (const name of ["P", "A", "B"] as const) {
          const v = args[name];
          if (v !== undefined && v !== null) base = C.movePoint(base, name, readPoint(v, name));
        }
        const rows = qs.map((q) => {
          const result = reading(C, C.movePoint(base, "Q", q));
          return {
            Q: pt(q),
            valid: result.valid,
            complete: result.complete,
            status: result.status,
            apexLEP: "apexAngles" in result ? result.apexAngles.LEP : null,
            apexMFP: "apexAngles" in result ? result.apexAngles.MFP : null,
            atQ: "atQ" in result ? result.atQ : null,
            concyclic: "concyclic" in result ? result.concyclic.within1e4 : null,
            maxCircleResidual: "concyclic" in result ? result.concyclic.maxResidual : null,
          };
        });
        const drawn = rows.filter((row) => row.valid && row.complete && row.atQ);
        return {
          from: { P: pt(base.P), A: pt(base.A), B: pt(base.B) },
          rows,
          summary: {
            largeArcSeen: drawn.some((row) => row.atQ!.qOnMajorArcLP && row.atQ!.halfAngleCase),
            smallArcSeen: drawn.some((row) => row.atQ!.smallArcCase && row.atQ!.supplementHolds),
            equalApexEverywhere: drawn.every((row) => row.apexLEP !== null &&
              Math.abs(row.apexLEP - row.apexMFP!) < 1e-4),
            concyclicEverywhere: drawn.every((row) => row.concyclic === true),
          },
          note:
            "An inscribed angle is half the central angle over the same chord only when Q is on the large arc; on the small arc LP it is the supplement, 180° − ½∠LEP, and ∠LQP + ∠MQP = 180°. " +
            "The five-point circle and the equal apex angles survive every non-degenerate drag; only the page's unqualified half-angle equalities fail on the small arc.",
        };
      },
    },
  };
}

/** Echo every field Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Max Common Chord 4 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Max Common Chord 4 position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const analysis = reading(C, s);
  const roundTrip = Object.fromEntries(HANDLES.map((name) => {
    const saved = state[name];
    const savedPoint = saved === undefined || saved === null ? null : readPoint(saved, `saved ${name}`);
    return [name, {
      saved: pt(savedPoint),
      core: pt(s[name]),
      distance: savedPoint ? cnt(C.dist(savedPoint, s[name])) : null,
    }];
  }));
  return {
    ...state,
    stateVersion,
    saved: {
      P: pt(state.P as Pt),
      Q: pt(state.Q as Pt),
      A: pt(state.A as Pt),
      B: pt(state.B as Pt),
      show: Object.fromEntries(SHOW_KEYS.map((k) => {
        const raw = (state.show as Json | undefined)?.[k];
        return [k, raw === true];
      })),
    },
    valid: analysis.valid,
    core: analysis,
    roundTrip,
    note:
      "Track.state saved the four draggable points P, Q, A and B in board units together with the four display checkboxes; the page does not save the circles or the constructed points. " +
      "The real core rebuilds C(E), C(F), the circle through E, Q and F, and L, M, R, S, G, H from those handles. " +
      "roundTrip checks that the saved handles are the ones the core used; core measures the equal apex angles, the concyclicity of E, F, L, M, Q, and whether the angle at Q is half the apex angle or its small-arc supplement. " +
      "This is an illustration, so there is no win or loss.",
  };
}
