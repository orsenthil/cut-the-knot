/*
 * run_game_logic actions and saved-position reader for Equi Tri In Rec
 * (Bogomolny's EquiTriInRec applet).
 *
 * ABCD is a parallelogram. On BC and CD the applet erects equilateral
 * triangles BCY and CDX, both turned the same way. AX meets the line BC at P
 * and AY meets the line CD at Q. Rotating a copy of the side vector by 60
 * degrees shows AXY is equilateral for every parallelogram, and P and Q are
 * the same multiple of AX and AY, so APQ is its equilateral image under a
 * homothety centred at A. In the opening rectangle that multiplier is 2: X
 * and Y are the midpoints of AP and AQ. For a slanted parallelogram the
 * multiplier changes, and when the two small triangles are turned opposite
 * ways the claim fails. All numbers below come from the game's real core in
 * equi-tri-in-rec/equi-tri-in-rec-core.js, copied into src/generated/cores/
 * at build time. Coordinates are board units of the 400 x 400 viewBox, y down.
 * See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  A: Point; B: Point; C: Point; D: Point;
  names: boolean; statement: boolean; premise: boolean; hint: boolean;
  moves: number; explored: boolean;
};

const core = () => cores["equi-tri-in-rec"].EquiTriInRecCore;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["construct"]>>;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(3)) : NaN);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const finite = (p: Point | null | undefined): p is Point =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
/** Signed area of triangle a,b,c; its sign says which side of ab holds c. */
const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Accept [x, y] and the page's { x, y } dots alike. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required point "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    x = NaN; y = NaN;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional derived point: the page saves null when the picture cannot be drawn. */
function readOptionalPoint(value: unknown, label: string): Point | null {
  if (value === undefined || value === null) return null;
  return readPoint(value, label);
}

function samePoint(a: Point | null, b: Point | null, tol = 1e-6): boolean {
  if (!finite(a) || !finite(b)) return a === null && b === null;
  return near(a.x, b.x, tol) && near(a.y, b.y, tol);
}

/** The four corners, given as { A, B, C, D } (or top-level dots) or as core moves. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of corners or core moves");
  }
  const C = core();
  const src = args.corners !== undefined && args.corners !== null
    ? args.corners : args;
  const hasCorners = ["A", "B", "C", "D"].every((k) =>
    src && typeof src === "object" && (src as Json)[k] !== undefined && (src as Json)[k] !== null);
  const someCorners = ["A", "B", "C", "D"].some((k) =>
    src && typeof src === "object" && (src as Json)[k] !== undefined && (src as Json)[k] !== null);
  if (someCorners && !hasCorners) {
    throw new Error('corners must give all four of A, B, C, D');
  }
  if (args.moves !== undefined && args.moves !== null && someCorners) {
    throw new Error('give either "corners" or "moves", not both');
  }

  if (hasCorners) {
    const corners = src as Json;
    const A = readPoint(corners.A, "corners.A");
    const B = readPoint(corners.B, "corners.B");
    const Cc = readPoint(corners.C, "corners.C");
    const D = readPoint(corners.D, "corners.D");
    const gap = Math.max(Math.abs(A.x + Cc.x - B.x - D.x), Math.abs(A.y + Cc.y - B.y - D.y));
    if (gap > 1e-6 * Math.max(1, Math.abs(A.x), Math.abs(Cc.x), Math.abs(A.y), Math.abs(Cc.y))) {
      throw new Error("A, B, C, D must be a parallelogram: A + C must equal B + D");
    }
    return { A, B, C: Cc, D, names: false, statement: false, premise: false, hint: false, moves: 0, explored: true };
  }

  let s = C.start();
  const raw = args.moves;
  if (raw !== undefined && raw !== null) {
    if (!Array.isArray(raw) || raw.length > 40) {
      throw new Error('"moves" must be an array of at most 40 core moves');
    }
    raw.forEach((value, i) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`moves[${i}] must be a move object`);
      }
      const m = value as Json;
      const type = String(m.type);
      let move: unknown;
      if (type === "point") {
        if (!C.CORNERS.includes(String(m.name))) {
          throw new Error(`moves[${i}].name must be one of A, B, C, D`);
        }
        move = { type: "point", name: String(m.name), x: num(m, "x"), y: num(m, "y") };
      } else if (C.SWITCHES.includes(type)) {
        if (typeof m.value !== "boolean") throw new Error(`moves[${i}].value must be true or false`);
        move = { type, value: m.value };
      } else if (type === "reset") {
        move = { type: "reset" };
      } else {
        throw new Error(`moves[${i}].type "${type}" is not a move the applet allows`);
      }
      const next = C.move(s, move);
      if (!next) throw new Error(`moves[${i}] was refused by the core`);
      s = next as State;
    });
  }
  return s as State;
}

function construct(C: Core, s: State): Geometry | null {
  const g = C.construct(s);
  if (!g || !finite(g.X) || !finite(g.Y)) return null;
  return g as Geometry;
}

/** Everything the core can say about one parallelogram and its two apexes. */
function reading(C: Core, s: State) {
  const corners = { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) };
  const g = construct(C, s);
  if (!g) {
    return {
      valid: false,
      reason: "the core cannot build both equilateral apexes here; move the corners apart",
      corners,
      status: C.status(s),
    };
  }
  const apqSides = { AP: C.dist(g.A, g.P), AQ: C.dist(g.A, g.Q), PQ: C.dist(g.P, g.Q) };
  const axySides = { AX: C.dist(g.A, g.X), AY: C.dist(g.A, g.Y), XY: C.dist(g.X, g.Y) };
  const drawn = finite(g.P) && finite(g.Q) && Object.values(apqSides).every((v) => Number.isFinite(v));
  const apqSpread = drawn ? Math.max(...Object.values(apqSides)) - Math.min(...Object.values(apqSides)) : NaN;
  const axySpread = Math.max(...Object.values(axySides)) - Math.min(...Object.values(axySides));
  const ratios = drawn ? {
    AP_over_AX: apqSides.AP / axySides.AX,
    AQ_over_AY: apqSides.AQ / axySides.AY,
    PQ_over_XY: apqSides.PQ / axySides.XY,
  } : null;
  const ratio = ratios ? (ratios.AP_over_AX + ratios.AQ_over_AY + ratios.PQ_over_XY) / 3 : NaN;
  const ratioSpread = ratios
    ? Math.max(...Object.values(ratios)) - Math.min(...Object.values(ratios)) : NaN;
  const midX = { x: (g.A.x + (g.P as Point).x) / 2, y: (g.A.y + (g.P as Point).y) / 2 };
  const midY = { x: (g.A.x + (g.Q as Point).x) / 2, y: (g.A.y + (g.Q as Point).y) / 2 };
  const midpointErrors = drawn ? {
    X_vs_mid_AP: C.dist(g.X, midX), Y_vs_mid_AQ: C.dist(g.Y, midY),
  } : null;
  const xMidpoint = drawn && near(midpointErrors!.X_vs_mid_AP, 0, 1e-7);
  const yMidpoint = drawn && near(midpointErrors!.Y_vs_mid_AQ, 0, 1e-7);
  const signBCY = Math.sign(cross(g.B, g.C, g.Y));
  const signCDX = Math.sign(cross(g.C, g.D, g.X));
  const xy = { x: g.Y.x - g.X.x, y: g.Y.y - g.X.y };
  const pq = drawn ? { x: (g.P as Point).x - (g.Q as Point).x, y: (g.P as Point).y - (g.Q as Point).y } : null;
  const parallelSin = pq
    ? Math.abs(xy.x * pq.y - xy.y * pq.x) /
      Math.max(1e-9, Math.hypot(xy.x, xy.y) * Math.hypot(pq.x, pq.y))
    : NaN;
  const axyEquilateral = axySpread <= 1e-7 * Math.max(1, ...Object.values(axySides));
  const apqEquilateral = drawn && apqSpread <= 1e-7 * Math.max(1, ...Object.values(apqSides));
  const sameRatio = Boolean(ratios && near(ratioSpread, 0, 1e-7));

  return {
    valid: true,
    board: { width: C.WIDTH, height: C.HEIGHT },
    corners,
    apexes: { X: pt(g.X), Y: pt(g.Y) },
    intersections: { P: finite(g.P) ? pt(g.P) : null, Q: finite(g.Q) ? pt(g.Q) : null },
    axy: {
      sides: { AX: r6(axySides.AX), AY: r6(axySides.AY), XY: r6(axySides.XY) },
      sideSpread: sig(axySpread),
      equilateral: axyEquilateral,
    },
    apq: drawn ? {
      sides: { AP: r6(apqSides.AP), AQ: r6(apqSides.AQ), PQ: r6(apqSides.PQ) },
      sideSpread: sig(apqSpread),
      equilateral: apqEquilateral,
    } : null,
    homothety: {
      center: pt(g.A),
      ratio: r6(ratio),
      ratios: ratios ? {
        AP_over_AX: r6(ratios.AP_over_AX),
        AQ_over_AY: r6(ratios.AQ_over_AY),
        PQ_over_XY: r6(ratios.PQ_over_XY),
      } : null,
      ratioSpread: sig(ratioSpread),
      sameRatio,
      ratioIsTwo: sameRatio && near(ratio, 2),
      xIsMidpointOfAP: xMidpoint,
      yIsMidpointOfAQ: yMidpoint,
      midpointErrors: midpointErrors ? {
        X_vs_mid_AP: sig(midpointErrors.X_vs_mid_AP),
        Y_vs_mid_AQ: sig(midpointErrors.Y_vs_mid_AQ),
      } : null,
    },
    orientation: {
      BCY: signBCY, CDX: signCDX, same: signBCY === signCDX,
      note: "The sign of the cross product on B→C and C→D: both apexes must be turned the same way.",
    },
    xyParallelPQ: { sin: sig(parallelSin), parallel: drawn && parallelSin < 1e-9 },
    claims: {
      axyEquilateral,
      apqEquilateral,
      sameHomothetyRatio: sameRatio,
      xIsMidpointOfAP: xMidpoint,
      yIsMidpointOfAQ: yMidpoint,
      sameOrientationOfSmallTriangles: signBCY === signCDX,
      xyParallelPQ: drawn && parallelSin < 1e-9,
    },
    status: C.status(s),
  };
}

const DILATION_NOTE =
  "The core rotates a copy of each side by 60 degrees to get X and Y. Triangle AXY is equilateral for any parallelogram, and P and Q are the same multiple of AX and AY, so the homothety centred at A with that ratio takes AXY onto APQ. In the opening rectangle the ratio is exactly 2, which makes X and Y the midpoints of AP and AQ; drag a corner to make the shape slanted and the ratio changes while both triangles stay equilateral.";

export function actions(): GameActions {
  return {
    apq_and_homothety: {
      describe:
        "Build the applet's construction for a parallelogram ABCD and report the sides of AXY and APQ, whether each is equilateral, and the homothety centred at A that maps X to P and Y to Q: its common ratio, the three individual ratios, and whether X and Y are the midpoints of AP and AQ. It also checks that XY is parallel to PQ and that the two small equilateral triangles have the same orientation. Give the four corners as `corners` { A, B, C, D } (or top-level A, B, C, D), or `moves` — core moves such as { type: 'point', name: 'C', x, y } or a switch toggle; omit both for the opening rectangle, where the ratio is 2.",
      args: '{ "corners": { "A": [124, 114], "B": [124, 246], "C": [280, 246], "D": [280, 114] } }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        return { ...reading(C, s), note: DILATION_NOTE };
      },
    },

    orientation_check: {
      describe:
        "Compare the applet's two same-way equilateral triangles with the cases where just one, or both, are turned to the other side of their side of the parallelogram. For each choice it rebuilds P = AX ∩ BC and Q = AY ∩ CD with the core's own rotation and line intersection, and reports the three sides of APQ and whether it is equilateral. Turning both apexes over is still the same orientation and keeps the claim; turning only one gives opposite orientations and breaks it.",
      args: '{ "moves": [{ "type": "point", "name": "C", "x": 300, "y": 246 }] }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        const g = construct(C, s);
        if (!g) throw new Error("the core cannot build both equilateral apexes from those corners");
        // equilateral(p, q) and equilateral(q, p) put the apex on opposite sides.
        const Xflip = C.equilateral(g.D, g.C);
        const Yflip = C.equilateral(g.C, g.B);
        const combos = [
          { name: "applet (same orientation)", X: g.X, Y: g.Y },
          { name: "both flipped (still same)", X: Xflip as Point, Y: Yflip as Point },
          { name: "X flipped only (opposite)", X: Xflip as Point, Y: g.Y },
          { name: "Y flipped only (opposite)", X: g.X, Y: Yflip as Point },
        ];
        const rows = combos.map((combo) => {
          const P = C.intersect(g.A, combo.X, g.B, g.C);
          const Q = C.intersect(g.A, combo.Y, g.C, g.D);
          const sides = {
            AP: C.dist(g.A, P), AQ: C.dist(g.A, Q), PQ: C.dist(P, Q),
          };
          const drawn = finite(P) && finite(Q) && Object.values(sides).every((v) => Number.isFinite(v));
          const spread = drawn
            ? Math.max(...Object.values(sides)) - Math.min(...Object.values(sides)) : NaN;
          const same = Math.sign(cross(g.B, g.C, combo.Y)) === Math.sign(cross(g.C, g.D, combo.X));
          return {
            name: combo.name,
            X: pt(combo.X), Y: pt(combo.Y),
            P: finite(P) ? pt(P) : null, Q: finite(Q) ? pt(Q) : null,
            sides: {
              AP: r6(sides.AP), AQ: r6(sides.AQ), PQ: r6(sides.PQ),
            },
            sideSpread: sig(spread),
            equilateral: drawn && spread <= 1e-7 * Math.max(1, ...Object.values(sides)),
            sameOrientation: same,
          };
        });
        const sameRows = rows.filter((r) => r.sameOrientation);
        const oppositeRows = rows.filter((r) => !r.sameOrientation);
        return {
          corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
          rows,
          sameOrientationAllEquilateral: sameRows.every((r) => r.equilateral),
          oppositeOrientationNoneEquilateral: oppositeRows.every((r) => !r.equilateral),
          note:
            "The applet turns BCY and CDX the same way, and APQ is equilateral. Reflecting both apexes keeps them the same way round and the claim survives; reflecting just one makes their orientations opposite, and the three sides of APQ then disagree. " +
            "P and Q still lie on the lines BC and CD — for a wide or tall parallelogram either may fall beyond the side itself.",
        };
      },
    },
  };
}

/** The saved Track.state: corners, the derived points and the four checkbox flags. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equi Tri In Rec state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equi Tri In Rec position must be an object");
  }
  const C = core();
  const home = C.start();
  const A = readPoint(state.A, "saved A", home.A);
  const B = readPoint(state.B, "saved B", home.B);
  const Cc = readPoint(state.C, "saved C", home.C);
  const D = readPoint(state.D, "saved D", home.D);
  const moves = num(state, "moves", 0);
  const s: State = {
    A, B, C: Cc, D,
    names: state.names === true,
    statement: state.statement === true,
    premise: state.premise === true,
    hint: state.hint === true,
    moves,
    explored: state.explored === true || moves > 0,
  };
  const readingHere = reading(C, s);
  const savedX = readOptionalPoint(state.X, "saved X");
  const savedY = readOptionalPoint(state.Y, "saved Y");
  const savedP = readOptionalPoint(state.P, "saved P");
  const savedQ = readOptionalPoint(state.Q, "saved Q");
  const g = construct(C, s);
  const savedMatchesCore = {
    X: samePoint(savedX, g ? g.X : null),
    Y: samePoint(savedY, g ? g.Y : null),
    P: samePoint(savedP, g && finite(g.P) ? g.P : null),
    Q: samePoint(savedQ, g && finite(g.Q) ? g.Q : null),
  };
  const cornerGap = Math.max(Math.abs(A.x + Cc.x - B.x - D.x), Math.abs(A.y + Cc.y - B.y - D.y));

  return {
    stateVersion,
    // Every plain-data field the page saved, unchanged.
    saved: { ...state },
    reconstruction: {
      corners: { A: pt(A), B: pt(B), C: pt(Cc), D: pt(D) },
      parallelogramGap: sig(cornerGap),
      parallelogram: cornerGap <= 1e-6 * Math.max(1, Math.abs(A.x), Math.abs(Cc.x), Math.abs(A.y), Math.abs(Cc.y)),
      switches: {
        names: s.names, statement: s.statement, premise: s.premise, hint: s.hint,
      },
      movesSoFar: s.moves,
      explored: s.explored,
      result: C.result(s),
    },
    savedMatchesCore,
    savedDerivedPointsMatchCore: Object.values(savedMatchesCore).every(Boolean),
    ...readingHere,
    // Short aliases, and a nested copy for clients that expect a `reading` field.
    apqEquilateral: Boolean(readingHere.apq?.equilateral),
    axyEquilateral: Boolean(readingHere.axy?.equilateral),
    homothetyRatio: readingHere.homothety?.ratio ?? null,
    reading: readingHere,
    note:
      "Track.state saved the four draggable corners, the derived points X, Y, P and Q as drawn, the four checkbox flags and the move count. " +
      "The core rebuilds the two equilateral apexes and the two intersections from the corners alone; savedMatchesCore says whether what the page drew still agrees. " +
      "AXY is equilateral for every parallelogram, APQ is its image under the homothety centred at A, and in a rectangle that homothety has ratio 2 (X and Y are the midpoints of AP and AQ).",
  };
}
