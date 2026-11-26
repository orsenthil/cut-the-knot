/*
 * run_game_logic actions and saved-position reader for Bui Quang Tuan's
 * Six Circles illustration (Alexander Bogomolny's applet, invented by
 * Bui Quang Tuan).
 *
 * Start with any circle inscribed in the angle at A1 of a triangle, centred
 * at a draggable point P on the bisector of that angle. Inscribe the next
 * circle in the angle at A2 so that it touches A1A2 at the same point T1;
 * continue round the corners. After six steps the seventh circle is the
 * first again (C7 = C1), the six touching points T1..T6 lie on one circle
 * centred at the incenter I, and the six circle centres form a parahexagon
 * (opposite sides parallel and equal).
 *
 * Every number below is measured by the game's real core
 * (bui-quang-tuan/bui-quang-tuan-core.js), copied into src/generated/cores/
 * at build time. Coordinates are board units from the page's 600 x 440
 * viewBox, with y down. See _shared.ts for the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type State = {
  A1: Point; A2: Point; A3: Point; P: Point;
  ta: number; width: number; height: number;
};
type Chain = { first: Circle; drawn: Circle[]; seventh: Circle; tangency: Point[]; big: Circle };
type Claims = {
  closes: boolean;
  tangencyCloses: boolean;
  concyclic: boolean;
  centreIsIncenter: boolean;
  parahexagon: boolean;
  valid: true;
};
type Core = {
  DEFAULT_TA: number;
  start(options?: Json): State;
  withPoint(s: State, name: string, p: Point): State;
  circles(s: State): Chain;
  incenter(s: State): Point;
  claims(s: State): Claims | null;
  result(s?: State): null;
  dist(p: Point, q: Point): number;
  nearestPoint(p: Point, a: Point, b: Point): Point;
};

const core = () => cores["bui-quang-tuan"].BuiQuangTuanCore as unknown as Core;

/* The core is exact up to floating point; tidy only what it prints. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const pt = (p: Point) => ({ x: round(p.x, 3), y: round(p.y, 3) });
const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);

/** Tool args and saved positions may give [x, y] or {x, y}. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = o.x as number;
    y = o.y as number;
  } else {
    throw new Error(`"${label}" must be [x, y] or {x, y}`);
  }
  x = Number(x);
  y = Number(y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric coordinates, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/**
 * A state the core accepts: three corners and P's fraction ta along the
 * bisector at A1 (0 at A1, 1 at its foot on A2A3). An explicit P overrides ta
 * the way dragging P does: the core projects it back onto the bisector.
 */
function readState(args: Json, useP = true): State {
  const C = core();
  const width = num(args, "width", 600);
  const height = num(args, "height", 440);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('"width" and "height" must be positive board dimensions');
  }
  const ta = num(args, "ta", C.DEFAULT_TA);
  if (!Number.isFinite(ta)) throw new Error('"ta" must be a finite number');
  const o: Json = {
    width, height, ta,
    A1: args.A1 === undefined ? undefined : readPoint(args.A1, "A1"),
    A2: args.A2 === undefined ? undefined : readPoint(args.A2, "A2"),
    A3: args.A3 === undefined ? undefined : readPoint(args.A3, "A3"),
  };
  const s = C.start(o);
  // Three nearly collinear corners make the angle bisectors and the circle
  // chain undefined; say so instead of handing NaNs to the tutor.
  const cross = (s.A2.x - s.A1.x) * (s.A3.y - s.A1.y) -
                (s.A2.y - s.A1.y) * (s.A3.x - s.A1.x);
  const span = Math.max(dist(s.A1, s.A2), dist(s.A1, s.A3), dist(s.A2, s.A3), 1);
  if (Math.abs(cross) < 1e-9 * span * span) {
    throw new Error("A1, A2 and A3 are nearly collinear: the angle bisectors and the circle chain cannot be built");
  }
  return useP && args.P !== undefined ? C.withPoint(s, "P", readPoint(args.P, "P")) : s;
}

/** Everything the core measures at one position, phrased for a tutor. */
function measure(s: State) {
  const C = core();
  const ch = C.circles(s);
  const cl = C.claims(s);
  if (!cl) {
    throw new Error("the circle chain degenerates here (a centre or radius is not finite): move the corners apart");
  }
  const I = C.incenter(s);
  const centres = [ch.first, ...ch.drawn].map((o) => o.c); // C1..C6
  const touchDistances = ch.tangency.slice(0, 6).map((t) => C.dist(ch.big.c, t));
  const paraErrors = [0, 1, 2].map((i) => {
    const side1 = { x: centres[(i + 1) % 6].x - centres[i].x, y: centres[(i + 1) % 6].y - centres[i].y };
    const side2 = { x: centres[(i + 4) % 6].x - centres[(i + 3) % 6].x,
                    y: centres[(i + 4) % 6].y - centres[(i + 3) % 6].y };
    // Traversing the hexagon, opposite sides point opposite ways.
    return Math.hypot(side1.x + side2.x, side1.y + side2.y);
  });
  const centerGap = C.dist(ch.big.c, I);
  const centerGapOfSeventh = C.dist(ch.seventh.c, ch.first.c);
  const radiusGapOfSeventh = Math.abs(ch.seventh.r - ch.first.r);
  const tangencyGap = C.dist(C.nearestPoint(ch.seventh.c, s.A1, s.A2), ch.tangency[0]);
  return {
    vertices: { A1: pt(s.A1), A2: pt(s.A2), A3: pt(s.A3) },
    start: { P: pt(s.P), ta: round(s.ta) },
    firstCircle: { center: pt(ch.first.c), radius: round(ch.first.r) },
    /** C1..C6 in the order the applet draws them. */
    circles: centres.map((c, i) => ({
      n: i + 1, center: pt(c), radius: round(([ch.first, ...ch.drawn][i]).r),
    })),
    /** T1..T6, each on the side the next circle is inscribed against. */
    tangencyPoints: ["A1A2", "A2A3", "A3A1", "A1A2", "A2A3", "A3A1"]
      .map((side, i) => ({ n: i + 1, side, point: pt(ch.tangency[i]) })),
    seventhCircle: { center: pt(ch.seventh.c), radius: round(ch.seventh.r) },
    closure: {
      statement: "C7 = C1 (centre and radius both come back after six circles)",
      holds: cl.closes,
      centerGap: round(centerGap),
      radiusGap: round(radiusGapOfSeventh),
      tangencyCloses: cl.tangencyCloses,
      tangencyGap: round(tangencyGap),
    },
    concyclic: {
      statement: "T1..T6 lie on one circle centred at the incenter",
      holds: cl.concyclic,
      circle: { center: pt(ch.big.c), radius: round(ch.big.r) },
      distancesFromCircleCenter: touchDistances.map((d) => round(d)),
      largestDeviationFromRadius: round(Math.max(...touchDistances.map((d) => Math.abs(d - ch.big.r)))),
      centerIsIncenter: cl.centreIsIncenter,
      centerGapToIncenter: round(centerGap),
      incenter: pt(I),
    },
    parahexagon: {
      statement: "C1..C6 form a parahexagon: opposite sides are parallel and equal",
      holds: cl.parahexagon,
      oppositeSideErrors: paraErrors.map((e) => round(e)),
      largestError: round(Math.max(...paraErrors)),
    },
    valid: true,
  };
}

export function actions(): GameActions {
  return {
    six_circles: {
      describe:
        "For a triangle A1, A2, A3 on the page's 600 x 440 board (y down), build the six-circle chain with the real core and report the centre and radius of C1..C6, the six tangency points T1..T6 with the side each lies on, and the computed seventh circle. ta is the fraction of the way from A1 to the bisector foot on A2A3 that P sits (default 0.7); an explicit P may be given instead, and is projected onto the bisector as a drag would be. The report shows that C7 comes back to C1 in centre and radius and that its tangency point matches T1. Omit a corner to use the illustration's opening triangle.",
      args: '{ "A1": {"x": 304, "y": 100}, "A2": {"x": 200, "y": 314}, "A3": {"x": 500, "y": 251}, "ta": 0.7 }',
      run: (args) => measure(readState(args)),
    },
    theorem_checks: {
      describe:
        "For a triangle A1, A2, A3 (and optional ta or P, as in six_circles), check the page's three claims with the real core: the chain closes with C7 = C1 at the same tangency point; T1..T6 are concyclic on a circle whose centre is the triangle's incenter (report each distance from that centre and the largest deviation from its radius); and the six circle centres form a parahexagon, i.e. the three pairs of opposite sides are parallel and equal (report each side-pair error). A report with all three checks true is a verified instance of Bui Quang Tuan's Six Circles Theorem.",
      args: '{ "A1": {"x": 304, "y": 100}, "A2": {"x": 200, "y": 314}, "A3": {"x": 500, "y": 251} }',
      run: (args) => {
        const m = measure(readState(args));
        return {
          vertices: m.vertices,
          closure: m.closure,
          concyclic: m.concyclic,
          parahexagon: m.parahexagon,
          allClaimsHold: m.closure.holds && m.closure.tangencyCloses &&
            m.concyclic.holds && m.concyclic.centerIsIncenter && m.parahexagon.holds,
          note:
            "Each new circle touches the previous one at the same point on a side and sits in the next corner's angle. " +
            "Six steps bring the chain back to its start (C7 = C1); the touching points lie on a circle about the incenter, " +
            "and the path of the six centres is a parahexagon (opposite sides parallel and equal). " +
            "The reported gaps are floating-point residuals; the core's booleans use its scale-aware tolerance.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus the core's reading of that same picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Bui Quang Tuan state version ${stateVersion}`);
  }
  const C = core();
  const saved = state ?? ({} as Json);
  // The page saves P as well as ta; build from ta so the saved fraction is
  // what gets read, then compare the saved P with the core's own position.
  const s = readState(saved, false);
  const savedP = readPoint(saved.P, "P");
  const which = Math.round(num(saved, "which", 0));
  if (!Number.isInteger(which) || which < 0 || which > 6) {
    throw new Error('"which" must be an integer from 0 (all circles) to 6');
  }
  const showNames = Boolean(saved.showNames);
  const joinCenters = Boolean(saved.joinCenters);
  const shown = which === 0
    ? "all six circles"
    : `circles C${which} and C${which % 6 + 1}`;
  const base = {
    stateVersion,
    A1: pt(s.A1), A2: pt(s.A2), A3: pt(s.A3),
    P: pt(savedP), ta: round(s.ta), width: s.width, height: s.height,
    which, showNames, joinCenters, shown,
    result: C.result(s), // an illustration: nothing can be won or lost
    savedPGap: round(dist(savedP, s.P)),
  };
  if (!C.claims(s)) {
    return {
      ...base,
      valid: false,
      note: "The saved picture has degenerated: the core cannot build the circle chain. Move the corners apart.",
    };
  }
  const m = measure(s);
  return {
    ...base,
    valid: true,
    core: {
      closure: m.closure,
      concyclic: m.concyclic,
      parahexagon: m.parahexagon,
    },
    note:
      `Track.state saved three corners, P at ta = ${round(s.ta)} and which = ${which} (${shown}; ` +
      `names ${showNames ? "shown" : "hidden"}, centre links ${joinCenters ? "shown" : "hidden"}). ` +
      "The core rebuilds the six circles and checks them: " +
      `C7 = C1 holds: ${m.closure.holds}, the six touching points are concyclic about the incenter: ` +
      `${m.concyclic.holds}, and the six centres form a parahexagon: ${m.parahexagon.holds}.`,
  };
}
