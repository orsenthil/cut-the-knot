/*
 * run_game_logic actions and saved-position reader for Four Circles In Triangle.
 *
 * The real core is four-circles-in-triangle/four-circles-in-triangle-core.js,
 * copied into src/generated/cores/ at build time; every number below is
 * measured by it. Coordinates are board units in the page's 360 x 260 board,
 * y down; the three draggable handles A, B, C are the only free inputs.
 *
 * The incircle centre I is the side-length barycentric incenter of ABC and its
 * radius r is the distance to a side. In each corner the small circle is the
 * incircle shrunk towards that vertex by a homothety of ratio t in [0, 1]: the
 * applet's quadratic has small root t = (d - r)/(d + r), where d is the
 * distance from that vertex to I. Its radius is r*t and it touches both sides
 * at the vertex and the incircle externally. Its tangency point on the
 * incircle lies opposite the vertex, midway between the two adjacent side
 * contact points. Joining each side's contact point to the tangency point of
 * the opposite corner circle gives the three lines in the picture; they are
 * angle bisectors of the contact triangle, so they meet at that triangle's
 * incenter. Both claims are re-measured below. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number; ratio: number };
type State = {
  width: number; height: number;
  vertices: Point[];
  showLines: boolean; showPoints: boolean;
};
type Diagram = {
  visible: boolean; reason: string;
  incircle: { center: Point; radius: number };
  circles: Circle[];
  feet: Point[];
  touch: Point[];
  lines: { a: Point; b: Point }[];
  meeting: Point;
  deviation: number;
};
interface Core {
  WIDTH: number; HEIGHT: number; MARGIN: number;
  dist(a: Point, b: Point): number;
  lineDistance(p: Point, a: Point, b: Point): number;
  incenter(v: Point[]): Point | null;
  start(options?: Json): State;
  setVertex(state: State, index: number, point: Point): State;
  diagram(state: State): Diagram;
  position(state: State): Json;
}

const core = (): Core =>
  cores["four-circles-in-triangle"].FourCirclesInTriangleCore as unknown as Core;

const NAMES = ["A", "B", "C"] as const;
const TOL = 1e-6;
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const close = (a: number, b: number, tol = TOL): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback: Point): Point {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readNumber(args: Json, key: string, fallback: number, min: number, max: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a finite number`);
  if (n < min || n > max) throw new Error(`argument "${key}" must be between ${min} and ${max}`);
  return n;
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/**
 * A real core state: optional board size and display options, then the three
 * handles applied as page drags so the core clamps them to its board exactly.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of vertices A, B, C and optional board options");
  }
  let s = C.start({
    width: readNumber(args, "width", C.WIDTH, 100, 2000),
    height: readNumber(args, "height", C.HEIGHT, 100, 2000),
    showLines: readBool(args, "showLines", true),
    showPoints: readBool(args, "showPoints", true),
  });
  for (let i = 0; i < 3; i++) {
    s = C.setVertex(s, i, readPoint(args[NAMES[i]], NAMES[i], s.vertices[i]));
  }
  return s;
}

/** A drawable core diagram, or the core's own reason for refusing one. */
function live(args: Json): { C: Core; s: State; d: Diagram } {
  const C = core();
  const s = buildState(C, args);
  const d = C.diagram(s);
  if (!d.visible) {
    throw new Error(
      `A, B and C must make a triangle big enough for the four circles on the ` +
      `${s.width} x ${s.height} board; the core reports "${d.reason}"`,
    );
  }
  return { C, s, d };
}

/** The incircle and the three corner circles, with every tangency measured. */
function circleReading(C: Core, s: State, d: Diagram) {
  const r = d.incircle.radius;
  const cornerCircles = d.circles.map((c, i) => {
    const vertex = NAMES[i];
    const sidesAtVertex = [vertex + NAMES[(i + 1) % 3], vertex + NAMES[(i + 2) % 3]];
    const sideErrors = [1, 2].map((step) =>
      round(C.lineDistance(c.center, s.vertices[i], s.vertices[(i + step) % 3]) - c.radius, 9));
    const vertexDistance = C.dist(s.vertices[i], d.incircle.center);
    const ratioFormula = (vertexDistance - r) / (vertexDistance + r);
    const centreDistance = C.dist(c.center, d.incircle.center);
    const radiiSum = r + c.radius;
    return {
      vertex,
      sidesAtVertex,
      center: pt(c.center),
      radius: round(c.radius),
      ratio: round(c.ratio, 9),
      ratioFormula: round(ratioFormula, 9),
      radiusFromRatio: round(r * c.ratio),
      bisectorError: round(C.lineDistance(c.center, s.vertices[i], d.incircle.center), 9),
      sideTangencyErrors: sideErrors,
      tangentToBothSides: sideErrors.every((e) => Math.abs(e) <= TOL * Math.max(1, c.radius)),
      incircleTangency: {
        centreDistance: round(centreDistance),
        radiiSum: round(radiiSum),
        error: round(centreDistance - radiiSum, 9),
      },
      touchPoint: pt(d.touch[i]),
      onIncircleError: round(C.dist(d.touch[i], d.incircle.center) - r, 9),
      onCornerCircleError: round(C.dist(d.touch[i], c.center) - c.radius, 9),
    };
  });
  return {
    triangle: { A: pt(s.vertices[0]), B: pt(s.vertices[1]), C: pt(s.vertices[2]) },
    incircle: { center: pt(d.incircle.center), radius: round(r) },
    cornerCircles,
    allTangentToBothSides: cornerCircles.every((c) => c.tangentToBothSides),
    allTangentToIncircle: cornerCircles.every((c) =>
      Math.abs(c.incircleTangency.error) <= TOL * Math.max(1, c.incircleTangency.radiiSum)),
    allRatiosMatchFormula: cornerCircles.every((c) => close(c.ratio, c.ratioFormula)),
    tolerance: TOL,
  };
}

/** The three joins and their common point, checked against the contact incenter. */
function concurrenceReading(C: Core, s: State, d: Diagram) {
  const scale = Math.max(...[0, 1, 2].map((i) => C.dist(s.vertices[i], s.vertices[(i + 1) % 3])));
  const tol = TOL * Math.max(1, scale);
  const joins = d.lines.map((line, i) => {
    const miss = C.lineDistance(d.meeting, line.a, line.b);
    return {
      oppositeVertex: NAMES[i],
      side: NAMES[(i + 1) % 3] + NAMES[(i + 2) % 3],
      sideContact: pt(line.a),
      tangencyWithOppositeCircle: pt(line.b),
      miss: round(miss, 9),
      missPctOfLongestSide: round(scale > 0 ? miss / scale * 100 : NaN, 9),
    };
  });
  const maxMiss = Math.max(...joins.map((j) => j.miss));
  const contactIncenter = C.incenter(d.feet);
  const incenterAgreement = contactIncenter ? C.dist(d.meeting, contactIncenter) : NaN;
  return {
    triangle: { A: pt(s.vertices[0]), B: pt(s.vertices[1]), C: pt(s.vertices[2]) },
    incircle: { center: pt(d.incircle.center), radius: round(d.incircle.radius) },
    contactPoints: {
      onSideBC: pt(d.feet[0]), onSideCA: pt(d.feet[1]), onSideAB: pt(d.feet[2]),
    },
    meeting: pt(d.meeting),
    joins,
    coreDeviation: sig(d.deviation),
    maxMiss: round(maxMiss, 9),
    contactTriangleIncenter: pt(contactIncenter),
    incenterAgreement: round(incenterAgreement, 9),
    tolerance: round(tol, 9),
    concurrent: Number.isFinite(maxMiss) && maxMiss <= tol && d.deviation <= tol,
    atContactIncenter: Number.isFinite(incenterAgreement) && incenterAgreement <= tol,
  };
}

/** Read a saved { x, y[, radius] } derived point without throwing. */
function savedPoint(value: unknown): (Point & { radius?: number }) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  const x = Number(o.x), y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const rawRadius = o.radius;
  const radius = rawRadius === undefined || rawRadius === null ? undefined : Number(rawRadius);
  return {
    x, y,
    radius: radius !== undefined && Number.isFinite(radius) ? radius : undefined,
  };
}

export function actions(): GameActions {
  return {
    corner_circles: {
      describe:
        "For a triangle with handles A, B, C (each [x, y] or { x, y } on the page's 360 x 260 board, y down; omit any to keep the applet's opening triangle), run the real core and report the incircle and the three smaller circles, one in each corner, with their centres, radii, homothety ratios and tangency points. Each corner circle is the incircle shrunk towards its vertex by ratio t = (d - r)/(d + r), so it touches both sides at that vertex and the incircle externally; every such residual is measured. Optional width, height, showLines and showPoints set the board and display; a collapsed or too-small triangle is refused with the core's reason.",
      args: '{ "A": [184, 20], "B": [45, 240], "C": [315, 208] }',
      run: (args) => {
        const { C, s, d } = live(args);
        const reading = circleReading(C, s, d);
        return {
          ...reading,
          options: { showLines: s.showLines, showPoints: s.showPoints },
          note:
            `The incircle has centre (${reading.incircle.center!.x}, ${reading.incircle.center!.y}) and radius ` +
            `${reading.incircle.radius}. Each corner circle sits on the bisector from its vertex and is the incircle ` +
            `scaled by t, so its radius is r*t and the distance between the two centres is r + r*t. ` +
            `Here the three ratios are ${reading.cornerCircles.map((c) => c.ratio).join(", ")}, matching ` +
            `(d - r)/(d + r) at each vertex; every corner circle touches both sides at its vertex and the incircle, ` +
            `and each tangency point lies on both circles. This is an illustration, so there is no win or loss.`,
        };
      },
    },

    concurrent_joins: {
      describe:
        "For a triangle with handles A, B, C (each [x, y] or { x, y } in board units; omit any for the opening triangle), run the real core and report the incircle's contact point on each side, the tangency point with the opposite corner circle, and the three joins between them. The joins meet at one point: each join's miss from that point is measured, and the point is compared with the incenter of the contact triangle formed by the three side contact points. Optional width, height, showLines and showPoints set the board and display; collapsed or too-small triangles are refused.",
      args: '{ "A": [184, 20], "B": [45, 240], "C": [315, 208] }',
      run: (args) => {
        const { C, s, d } = live(args);
        const reading = concurrenceReading(C, s, d);
        return {
          ...reading,
          options: { showLines: s.showLines, showPoints: s.showPoints },
          note:
            `The three joins meet at (${reading.meeting!.x}, ${reading.meeting!.y}); the largest miss of that point ` +
            `from a join is ${reading.maxMiss} board units (${reading.joins.reduce((m, j) =>
              Math.max(m, j.missPctOfLongestSide ?? Infinity), 0)}% of the longest side). ` +
            `The contact triangle's own incenter is (${reading.contactTriangleIncenter!.x}, ` +
            `${reading.contactTriangleIncenter!.y}), ${reading.incenterAgreement} board units away. ` +
            "Each corner circle is the incircle shrunk towards its vertex, so its tangency point is opposite that " +
            "vertex on the incircle; that makes each join an angle bisector of the contact triangle, and the three " +
            "bisectors must concur at its incenter. This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Circles In Triangle state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Circles In Triangle position must be an object");
  }
  const C = core();
  const savedIncircle = savedPoint(state.incircle);
  const savedMeeting = savedPoint(state.meeting);
  // Core.position saves the three handles under "vertices"; accept A/B/C too.
  const normalized: Json = Array.isArray(state.vertices)
    ? { ...state, A: state.vertices[0], B: state.vertices[1], C: state.vertices[2] }
    : state;
  let savedReadable = Array.isArray(state.vertices) && state.vertices.length === 3;
  let s: State;
  try {
    s = buildState(C, normalized);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const d = C.diagram(s);
  if (!d.visible) {
    return {
      ...state, stateVersion, savedReadable,
      visible: false,
      reason: d.reason,
      note:
        "Track.state saved three handle positions, but at those corners the core cannot draw the four circles " +
        `(${d.reason}). Move A, B or C apart to restore the diagram.`,
    };
  }

  const differences: Array<{ field: string; saved: number; core: number; diff: number }> = [];
  const compare = (field: string, a: number | undefined, b: number): void => {
    if (a === undefined) return;
    differences.push({ field, saved: round(a), core: round(b), diff: round(Math.abs(a - b), 9) });
  };
  if (savedIncircle) {
    compare("incircle.x", savedIncircle.x, d.incircle.center.x);
    compare("incircle.y", savedIncircle.y, d.incircle.center.y);
    compare("incircle.radius", savedIncircle.radius, d.incircle.radius);
  }
  if (savedMeeting) {
    compare("meeting.x", savedMeeting.x, d.meeting.x);
    compare("meeting.y", savedMeeting.y, d.meeting.y);
  }
  const savedMatchesCore = differences.length > 0 &&
    differences.every((x) => x.diff <= TOL * Math.max(1, Math.abs(x.core)));

  return {
    ...state,
    stateVersion,
    savedReadable,
    saved: {
      vertices: s.vertices.map((p) => pt(p)),
      visible: state.visible,
      incircle: savedIncircle ? pt(savedIncircle) : null,
      incircleRadius: savedIncircle?.radius === undefined ? null : round(savedIncircle.radius),
      meeting: savedMeeting ? pt(savedMeeting) : null,
      board: { width: s.width, height: s.height },
    },
    visible: d.visible,
    reading: {
      ...circleReading(C, s, d),
      ...concurrenceReading(C, s, d),
    },
    savedMatchesCore,
    differences,
    note: !savedReadable
      ? "The saved vertices could not be read as three board points, so the core's opening triangle was rebuilt; the reading below is of that picture."
      : `Track.state saved the three handle positions in board units, a visible flag, the incircle centre and radius, ` +
        `and the meeting point. The core rebuilds all four circles, the side contact points, the three joins and ` +
        `their common point from those handles: the corner circles are tangent to both sides at their vertex and ` +
        `to the incircle, and the joins meet at the contact triangle's incenter ` +
        `(${(concurrenceReading(C, s, d).incenterAgreement ?? NaN).toExponential(2)} units away). ` +
        `${savedMatchesCore ? "The saved incircle and meeting point agree with the core's recomputation." : "Some saved derived points differ from the core's recomputation; check whether they were captured from the same handles."} ` +
        "This is an illustration, so the tracker records exploration rather than a win or a loss.",
  };
}
