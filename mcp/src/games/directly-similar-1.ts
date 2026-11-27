/*
 * run_game_logic actions and saved-position reader for Directly Similar 1.
 *
 * The core (directly-similar-1/directly-similar-1-core.js, copied into
 * src/generated/cores/ at build time) writes a square from two opposite
 * corners as m + { d, rot(d), -d, -rot(d) }, where m is the centre, d the
 * half-diagonal and rot(dx, dy) = (dy, -dx) in the board's y-down coordinates.
 * Two such squares are directly similar: both use the same rot. So subtracting
 * the second from the first and adding P gives
 *
 *     third[k] = P + first[k] - second[k]
 *              = (P + m1 - m2) + { d1-d2, rot(d1)-rot(d2), ... }
 *              = (P + m1 - m2) + { d1-d2, rot(d1-d2), ... },
 *
 * another square: that is the page's A1 = P + AA', B1 = P + BB', ... . If the
 * given squares are translates (d1 = d2, offset t), the difference vanishes
 * and all four new corners fall on the single point P - t. Every number below
 * is measured by the game's real core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Position = { width: number; height: number; points: Pt[] };
type Figures = { first: Pt[]; second: Pt[]; third: Pt[] };
type Info = { side: number; spread: number; angleError: number };

interface DirectlySimilar1 {
  WIDTH: number;
  HEIGHT: number;
  NAMES: string[];
  start(options?: { width?: number; height?: number }): Position;
  movePoint(state: Position, index: number, p: Pt): Position;
  square(a: Pt, b: Pt): Pt[];
  figures(state: Position): Figures;
  translated(state: Position): Pt[];
  squareInfo(pts: Pt[]): Info;
  isSquare(pts: Pt[], eps?: number): boolean;
  describe(state: Position): string;
  result(): null;
}

const core = (): DirectlySimilar1 =>
  cores["directly-similar-1"].DirectlySimilar1Core as unknown as DirectlySimilar1;

const EPS = 1e-7;
const FIRST = ["A'", "B'", "C'", "D'"];
const SECOND = ["A", "B", "C", "D"];
const THIRD = ["A1", "B1", "C1", "D1"];

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
/** The applet's quarter turn on the y-down board: (dx, dy) -> (dy, -dx). */
const turn = (d: Pt): Pt => ({ x: d.y, y: -d.x });

/** Accept both the page's { x, y } and the tutor's [x, y]. */
function readPoint(v: unknown, key: string): Pt {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${key}" must be [x, y] or { x, y }`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`"${key}" needs two finite numbers, got ${JSON.stringify(v)}`);
    }
    return { x, y };
  }
  if (v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }`);
}

/**
 * The five saved dots: A', C' (opposite corners of the primed square), A, C
 * (those of the second) and P. A full saved state may be passed as `state`.
 */
function readPosition(args: Json): Position {
  const C = core();
  const seed = C.start({});
  const src: Json =
    args.state !== null && typeof args.state === "object" && !Array.isArray(args.state)
      ? (args.state as Json)
      : args;
  const raw = src.points;
  let points: Pt[];
  if (raw === undefined || raw === null) {
    points = seed.points.map((p) => ({ x: p.x, y: p.y }));
  } else {
    if (!Array.isArray(raw) || raw.length !== 5) {
      throw new Error('"points" must hold exactly five points: A\', C\', A, C, P');
    }
    points = raw.map((p, i) => readPoint(p, `points[${i}]`));
  }
  const width = num(src, "width", seed.width);
  const height = num(src, "height", seed.height);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('"width" and "height" must be positive numbers');
  }
  return { width, height, points };
}

/** The core's measurements of one square, including its centre and turn. */
function squareReading(C: DirectlySimilar1, pts: Pt[]) {
  const info = C.squareInfo(pts);
  const m = mid(pts[0], pts[2]);
  return {
    corners: pts.map(pt),
    centre: pt(m),
    halfDiagonal: pt(sub(pts[0], m)),
    quarterTurnedHalfDiagonal: pt(sub(pts[1], m)),
    side: round(info.side),
    sideSpread: round(info.spread),
    angleErrorDeg: round(info.angleError),
    isSquare: C.isSquare(pts),
  };
}

/** The page's A1 = P + AA' claim, checked corner by corner. */
function translatedCorners(s: Position, f: Figures) {
  const rows = THIRD.map((name, k) => {
    const givenStep = sub(f.first[k], f.second[k]);
    const fromP = sub(f.third[k], s.points[4]);
    return {
      vertex: name,
      step: `${SECOND[k]} -> ${FIRST[k]}`,
      givenStep: pt(givenStep),
      fromP: pt(fromP),
      equal: dist(givenStep, fromP) <= EPS,
    };
  });
  return {
    rule: "A1 = P + AA', B1 = P + BB', C1 = P + CC', D1 = P + DD'",
    corners: rows,
    allHold: rows.every((row) => row.equal),
  };
}

/** Why the difference of the two directly similar squares is a square. */
function quarterTurnProof(s: Position, f: Figures) {
  const m1 = mid(f.first[0], f.first[2]);
  const m2 = mid(f.second[0], f.second[2]);
  const m3 = mid(f.third[0], f.third[2]);
  const d1 = sub(f.first[0], m1), e1 = sub(f.first[1], m1);
  const d2 = sub(f.second[0], m2), e2 = sub(f.second[1], m2);
  const d3 = sub(f.third[0], m3), e3 = sub(f.third[1], m3);
  const expectedCentre = add(s.points[4], sub(m1, m2));
  const residuals = {
    firstIsQuarterTurn: round(dist(e1, turn(d1))),
    secondIsQuarterTurn: round(dist(e2, turn(d2))),
    centre: round(dist(m3, expectedCentre)),
    halfDiagonal: round(dist(d3, sub(d1, d2))),
    quarterTurn: round(dist(e3, sub(e1, e2))),
  };
  return {
    centres: { first: pt(m1), second: pt(m2), third: pt(m3) },
    expectedCentre: pt(expectedCentre),
    halfDiagonals: { first: pt(d1), second: pt(d2), difference: pt(sub(d1, d2)), third: pt(d3) },
    quarterTurns: { first: pt(e1), second: pt(e2), difference: pt(sub(e1, e2)), third: pt(e3) },
    residuals,
    linearityHolds: Object.values(residuals).every((r) => r <= EPS),
  };
}

export function actions(): GameActions {
  return {
    translated_square: {
      describe:
        "From the five draggable dots (A', C' opposite corners of the first square, A, C of the second, and P), report both given squares and the third square the core builds as third[k] = P + first[k] - second[k], with its side, side spread and right-angle error, the page's A1 = P + AA' corner-by-corner claim, and the quarter-turn proof that the difference of two directly similar squares is a square. Points may be [x, y] or { x, y } in a `points` array of five, or a whole saved `state`; omit them for the opening picture.",
      args: '{ "points": [[109, 188], [228, 312], [197, 219], [135, 281], [375, 250]] }',
      run: (args) => {
        const C = core();
        const s = readPosition(args);
        const f = C.figures(s);
        const third = squareReading(C, f.third);
        return {
          board: { width: s.width, height: s.height },
          namedPoints: {
            "A'": pt(s.points[0]), "C'": pt(s.points[1]),
            A: pt(s.points[2]), C: pt(s.points[3]), P: pt(s.points[4]),
          },
          given: { first: squareReading(C, f.first), second: squareReading(C, f.second) },
          translated: third,
          claim: translatedCorners(s, f),
          quarterTurnProof: quarterTurnProof(s, f),
          status: C.describe(s),
          note:
            "The core builds each given square from two opposite corners as centre plus {d, rot(d), -d, -rot(d)} with rot(dx,dy) = (dy,-dx). Both use the same quarter turn, so subtracting them keeps the pattern: the third figure has centre P + m1 - m2 and half-diagonal d1 - d2, hence it is a square and each new corner is P plus the matching step between the two given squares. If d1 = d2 this square collapses to one point (see collapsing_case).",
        };
      },
    },

    collapsing_case: {
      describe:
        "Shift the second given square to be an exact translate of the first by (dx, dy) (defaults 40, -25) and report what the real core draws: all four translated corners A1,B1,C1,D1 collapse onto the single point P - t = P + A' - A, so the new 'square' has side 0 and is not a square. The other saved dots can be supplied through `points` or `state`; the first two dots must be distinct opposite corners.",
      args: '{ "dx": 40, "dy": -25 }',
      run: (args) => {
        const C = core();
        const s0 = readPosition(args);
        const dx = num(args, "dx", 40);
        const dy = num(args, "dy", -25);
        if (dist(s0.points[0], s0.points[1]) <= EPS) {
          throw new Error("A' and C' must be distinct to define the first square");
        }
        const t = { x: dx, y: dy };
        let s = C.movePoint(s0, 2, add(s0.points[0], t));
        s = C.movePoint(s, 3, add(s0.points[1], t));
        const f = C.figures(s);
        const collapse = sub(s.points[4], t);
        const worst = Math.max(...f.third.map((q) => dist(q, collapse)));
        return {
          translation: pt(t),
          given: { first: squareReading(C, f.first), second: squareReading(C, f.second) },
          P: pt(s.points[4]),
          translated: squareReading(C, f.third),
          collapsePoint: pt(collapse),
          collapseFormula: "P - t = P + A' - A",
          worstOffsetFromCollapse: round(worst),
          allFourCornersCoincide: worst <= EPS,
          isSquare: C.isSquare(f.third),
          quarterTurnProof: quarterTurnProof(s, f),
          status: C.describe(s),
          note:
            "Translating the second square by t leaves its half-diagonal unchanged, so d1 - d2 = 0. The core's rule third[k] = P + first[k] - second[k] then gives the same point P - t for every k: the three squares are still directly similar, but the constructed one has shrunk to a point.",
        };
      },
    },
  };
}

/** The five saved dots, plus the core's reading of the constructed square. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Directly Similar 1 state version ${stateVersion}`);
  }
  const C = core();
  try {
    const s = readPosition(state);
    const f = C.figures(s);
    const third = squareReading(C, f.third);
    return {
      ...state,
      stateVersion,
      valid: true,
      board: { width: s.width, height: s.height },
      namedPoints: {
        "A'": pt(s.points[0]), "C'": pt(s.points[1]),
        A: pt(s.points[2]), C: pt(s.points[3]), P: pt(s.points[4]),
      },
      reading: {
        given: { first: squareReading(C, f.first), second: squareReading(C, f.second) },
        translated: third,
        claim: translatedCorners(s, f),
        quarterTurnProof: quarterTurnProof(s, f),
        collapsed: !third.isSquare && third.side <= EPS,
        result: C.result(),
        status: C.describe(s),
        note:
          "Track.state saved the five draggable dots and the board size. The core rebuilds both given squares from their opposite corners and the third as P + first - second, then measures its side, spread and corner error; a zero side means the two given squares are translates and the new square has collapsed to a point.",
      },
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Directly Similar 1 position needs five points: A', C', A, C and P, each { x, y }, plus optional width and height.",
    };
  }
}
