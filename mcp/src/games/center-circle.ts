/*
 * run_game_logic actions and saved-position reader for Center Circle.
 *
 * The core lives in center-circle/center-circle-core.js and is copied into
 * src/generated/cores/ at build time. Every number below is measured by it.
 * See _shared.ts for the shape of a game module.
 *
 * A node of the core's tree is one center-circle of a subset of the shown
 * lines. Its children are the center-circles of the subsets with one line
 * removed. Three lines give a triangle's circumcircle (the first
 * center-circle). With four lines, the four child circles meet at the Miquel
 * point P and their four centers lie concyclic on the next circle; P also
 * lies on that circle at four lines only. From five lines on the first two
 * facts survive but the third does not, so we ask the core's
 * miquelOnSteinerCircle check only at order four.
 *
 * Coordinates are board units from the illustration's 400 x 250 viewBox,
 * with y down. This is an illustration: nothing can be won or lost.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["center-circle"].CenterCircleCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; radius: number };
type Line = { a: Point; b: Point };
type Node = {
  order: number;
  subset: number[];
  circle: Circle | null;
  corners: (Point | null)[];
  children: Node[];
  point: Point | null;
};
type State = {
  lines: Line[];
  shown: boolean[];
  width: number;
  height: number;
  showCircles: boolean;
  showCenters: boolean;
  showCommon: boolean;
};
type Diagram = {
  lines: Line[];
  indices: number[];
  points: Point[];
  root: Node | null;
  nodes: Node[];
  scale: number;
};
type Claims = {
  threeLinesMakeACircle: boolean;
  circlesThroughTheirCorners: boolean;
  centersConcyclic: boolean;
  commonOnEveryCircle: boolean;
  miquelOnSteinerCircle: boolean;
  pointFoundAtEveryLevel: boolean;
};
type Built = { C: Core; state: State; n: number; d: Diagram; claims: Claims };

const MAX_LINES = 7; // the applet's m_NLines

/** The page's fixed opening layout: "New lines" is the only random source. */
const OPENING: Line[] = [
  { a: { x: 87, y: 63 }, b: { x: 231, y: 214 } },
  { a: { x: 20, y: 51 }, b: { x: 290, y: 147 } },
  { a: { x: 304, y: 124 }, b: { x: 38, y: 80 } },
  { a: { x: 39, y: 195 }, b: { x: 312, y: 124 } },
  { a: { x: 380, y: 161 }, b: { x: 113, y: 165 } },
  { a: { x: 139, y: 228 }, b: { x: 366, y: 21 } },
  { a: { x: 173, y: 201 }, b: { x: 34, y: 110 } },
];

const clone = (l: Line): Line => ({ a: { ...l.a }, b: { ...l.b } });
const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
/** Residuals can be tiny or large; keep their size and sign instead of zeroing. */
const sig = (v: number): number => Number(v.toExponential(2));
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x, 2), y: round(p.y, 2) } : null;
const circ = (c: Circle | null | undefined) =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.radius)
    ? { center: pt(c), radius: round(c.radius, 2) }
    : null;

/** Accept {x, y} or [x, y], the two shapes other readers also take. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`${label} must be [x, y] or {"x": ..., "y": ...}`);
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} needs two finite numbers`);
    return { x, y };
  }
  const p = value as Json | null;
  if (!p || typeof p !== "object") throw new Error(`${label} must be [x, y] or {"x": ..., "y": ...}`);
  return { x: num(p, "x"), y: num(p, "y") };
}

/** Three to seven lines; actions may fall back to the page's opening layout. */
function readLines(args: Json, allowDefault: boolean): Line[] {
  const raw = args.lines;
  if (raw === undefined || raw === null) {
    if (allowDefault) return OPENING.map(clone);
    throw new Error('missing required argument "lines": the page saves seven lines');
  }
  if (!Array.isArray(raw)) throw new Error('argument "lines" must be an array of {a, b} lines');
  if (raw.length < 3 || raw.length > MAX_LINES) {
    throw new Error(`"lines" must hold between 3 and ${MAX_LINES} lines, got ${raw.length}`);
  }
  return raw.map((item, i) => {
    const l = item as Json;
    if (!l || typeof l !== "object") throw new Error(`lines[${i}] must be {a, b}`);
    return { a: readPoint(l.a, `lines[${i}].a`), b: readPoint(l.b, `lines[${i}].b`) };
  });
}

function readCount(value: unknown, max: number, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 3 || n > max) {
    throw new Error(`${label} must be an integer from 3 to ${max} (the lines available)`);
  }
  return n;
}

/** Build the real core state from action arguments (n = number of shown lines). */
function build(args: Json): Built {
  const C = core();
  const lines = readLines(args, true);
  const n = readCount(args.n === undefined ? Math.min(4, lines.length) : args.n, lines.length, '"n"');
  const width = num(args, "width", 400);
  const height = num(args, "height", 250);
  if (width <= 0 || height <= 0) throw new Error('"width" and "height" must be positive');
  const state = C.start({
    lines,
    shown: lines.map((_, i) => i < n),
    width,
    height,
    showCircles: args.showCircles === true,
    showCenters: args.showCenters === true,
    showCommon: args.showCommon === true,
  }) as unknown as State;
  return {
    C, state, n,
    d: C.diagram(state) as unknown as Diagram,
    claims: C.claims(state) as unknown as Claims,
  };
}

/** The saved position has its own shown flags rather than a single n. */
function builtFromSaved(state: Json): Built {
  const C = core();
  const lines = readLines(state, false);
  const shown = state.shown;
  if (!Array.isArray(shown) || shown.length !== lines.length || !shown.every((v) => typeof v === "boolean")) {
    throw new Error('"shown" must be a boolean array with one entry per line');
  }
  const restored: State = {
    lines: lines.map(clone),
    shown: shown.slice(),
    width: num(state, "width", 400),
    height: num(state, "height", 250),
    showCircles: state.showCircles === true,
    showCenters: state.showCenters === true,
    showCommon: state.showCommon === true,
  };
  const n = restored.shown.filter(Boolean).length;
  return {
    C, state: restored, n,
    d: C.diagram(restored) as unknown as Diagram,
    claims: C.claims(restored) as unknown as Claims,
  };
}

/** The same absolute tolerance the core uses for all its on-circle claims. */
const tolerance = (d: Diagram): number => 2e-3 * Math.max(1, d.scale);

function gap(p: Point | null, c: Circle | null, C: Core): number | null {
  if (!p || !c || !C.finitePoint(p) || !C.finiteCircle(c)) return null;
  return C.dist(p, c) - c.radius;
}

function onCircle(p: Point | null, c: Circle | null, C: Core, tol: number): boolean {
  const g = gap(p, c, C);
  return g !== null && Math.abs(g) <= tol;
}

/** The child circles of the top node, named by the lines in each subset. */
function childCircles(root: Node | null, C: Core) {
  if (!root) return [];
  return root.children
    .filter((child) => C.finiteCircle(child.circle))
    .map((child) => ({
      lines: child.subset.map((i) => i + 1),
      circle: circ(child.circle),
    }));
}

/**
 * One reading of the top of the chain. The extra "P on the next circle"
 * answer is asked only at order four, exactly as the core limits that claim.
 */
function reading(g: Built) {
  const { C, d, claims, n } = g;
  const root = d.root;
  const tol = tolerance(d);
  const children = root ? root.children.filter((child) => C.finiteCircle(child.circle)) : [];
  const centersOnCircle = Boolean(root && C.finiteCircle(root.circle) &&
    children.every((child) => onCircle(child.circle, root.circle, C, tol)));
  const pointOnChildren = root
    ? children.filter((child) => onCircle(root.point, child.circle, C, tol)).length
    : 0;
  const childGap = gap(root?.point ?? null, root?.circle ?? null, C);
  const orders = [...new Set(d.nodes.map((node) => node.order))].sort((a, b) => a - b);
  return {
    linesShown: d.indices.map((i) => i + 1),
    nLines: n,
    orders,
    circlesByOrder: Object.fromEntries(orders.map((order) => [
      order, new Set(d.nodes.filter((node) => node.order === order)
        .map((node) => node.subset.join(","))).size,
    ])),
    top: {
      order: root?.order ?? null,
      lines: root?.subset.map((i) => i + 1) ?? [],
      circle: circ(root?.circle),
      commonPoint: pt(root?.point),
    },
    triangleCorners: root?.order === 3 ? root.corners.map(pt) : [],
    childCircles: childCircles(root, C),
    childCentersOnNextCircle: centersOnCircle,
    commonPointOnChildCircles: { of: pointOnChildren, total: children.length },
    claims,
    allClaimsHold: Object.values(claims).every(Boolean),
    // The article's extra sentence is a four-line fact only. At n > 4 the
    // signed gap is still reported to show it failing, but no yes/no claim is
    // made about the top circle; the core asks that question at order 4 only.
    pointOnNextCircle: root?.order === 4
      ? { asked: true, holds: onCircle(root.point, root.circle, C, tol), signedGap: childGap === null ? null : sig(childGap) }
      : { asked: false, signedGap: childGap === null ? null : sig(childGap) },
  };
}

function noteFor(g: Built): string {
  const order = g.d.root?.order;
  if (!order || order < 3) {
    return "Show at least three lines: three crossings make a triangle, and the circle through them is the first center-circle.";
  }
  if (order === 3) {
    return "Three lines cross in three points, and the circle through them is the first center-circle. Show a fourth line to get child circles, a common point and a circle through their centers.";
  }
  const base = `With ${order} lines shown, the top node has ${g.d.root?.children.length ?? 0} child circles of order ${order - 1}. Their centers lie on its circle and the children share the point P. `;
  return order === 4
    ? base + "At four lines the four child circles meet at the Miquel point, their four centers lie on the Steiner circle, and P lies on that circle too — the core's miquelOnSteinerCircle check applies here."
    : base + "The core's point-on-the-next-circle check asks only order-four nodes: it is true there but not a fact at this level, so no yes/no answer is given for the top circle. The signed gap is shown to illustrate the article's over-broad sentence.";
}

export function actions(): GameActions {
  return {
    circle_chain: {
      describe:
        "For n shown lines (3 to 7) report the core's chain of center-circles: the top circle and its common point P, the child circles with the line numbers behind each, whether their centers are concyclic on the top circle, how many child circles pass through P, the core's six claims, and the signed gap from P to the top circle. Omit n to use four lines; omit lines to use the illustration's opening seven. The point-on-the-next-circle answer is asked only when n = 4 (the Miquel point on the Steiner circle); from five lines it generally fails.",
      args: '{ "n": 4 }',
      run: (args) => {
        const g = build(args);
        return { ...reading(g), note: noteFor(g) };
      },
    },
    check_incidence: {
      describe:
        "Check the article's sentence that the common point also lies on the next circle, for each requested number of shown lines (3 to 7; default all of them). For every level report the child circles, common point, circle through their centers, signed gap from P to that circle, and whether the child centers are concyclic and the child circles share P. The core's miquelOnSteinerCircle check is reported with its true scope: order-four nodes only. At four lines the sentence holds; from five on it does not, although the two deeper facts still do.",
      args: '{ "n": [3, 4, 5, 6, 7] }',
      run: (args) => {
        const C = core();
        const lines = readLines(args, true);
        const raw = args.n === undefined ? null : args.n;
        const ns = raw === null
          ? Array.from({ length: lines.length - 2 }, (_, i) => i + 3)
          : Array.isArray(raw) && raw.length > 0
            ? raw.map((v) => readCount(v, lines.length, 'each entry of "n"'))
            : [readCount(raw, lines.length, '"n"')];
        const rows = ns.map((n) => {
          const state = C.start({
            lines,
            shown: lines.map((_, i) => i < n),
            width: num(args, "width", 400),
            height: num(args, "height", 250),
          }) as unknown as State;
          const d = C.diagram(state) as unknown as Diagram;
          const claims = C.claims(state) as unknown as Claims;
          const tol = tolerance(d);
          const root = d.root;
          const orderFour = d.nodes.filter((node) => node.order === 4 &&
            C.finitePoint(node.point) && C.finiteCircle(node.circle));
          const g = gap(root?.point ?? null, root?.circle ?? null, C);
          return {
            nLines: n,
            topOrder: root?.order ?? null,
            childCircles: root?.children.length ?? 0,
            commonPoint: pt(root?.point),
            nextCircle: circ(root?.circle),
            signedGapFromPToNextCircle: g === null ? null : sig(g),
            pointOnNextCircle: root?.order === 4
              ? { asked: true, holds: onCircle(root.point, root.circle, C, tol) }
              : { asked: false },
            orderFourNodesWithPointOnTheirCircle: {
              of: orderFour.filter((node) => onCircle(node.point, node.circle, C, tol)).length,
              total: orderFour.length,
            },
            centersConcyclic: claims.centersConcyclic,
            commonOnEveryCircle: claims.commonOnEveryCircle,
            miquelOnSteinerCircleCoreCheck: claims.miquelOnSteinerCircle,
          };
        });
        return {
          rows,
          note:
            "Three lines give the first center-circle. With four, the four child circles meet at the Miquel point P, their centers lie on one circle, and P is on it too. With five, six or seven the child circles still share a point and their centers still share a circle, but P usually misses the new circle (a negative signed gap means P is inside it). That is why the core's miquelOnSteinerCircle check asks order-four nodes only: it stays true there even when the top circle of a larger set does not contain its point, and it is vacuously true at three lines where there are no order-four nodes.",
        };
      },
    },
  };
}

/** What the core says about the lines, flags and point the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const rawLines = Array.isArray(state.lines) ? state.lines.map((l) => {
    const line = l as Json;
    return {
      a: Array.isArray(line.a) ? { x: Number(line.a[0]), y: Number(line.a[1]) } : (line.a as Point),
      b: Array.isArray(line.b) ? { x: Number(line.b[0]), y: Number(line.b[1]) } : (line.b as Point),
    };
  }) : null;
  const saved = {
    stateVersion,
    lines: rawLines,
    shown: Array.isArray(state.shown) ? state.shown.slice() : null,
    width: state.width ?? null,
    height: state.height ?? null,
    showCircles: state.showCircles === true,
    showCenters: state.showCenters === true,
    showCommon: state.showCommon === true,
    result: C.result() ?? null,
  };
  try {
    const g = builtFromSaved(state);
    return {
      ...saved,
      lines: g.state.lines,
      reading: reading(g),
      note:
        "Track.state saved the line endpoints, which lines are shown and the three display buttons. The core rebuilds the whole circle hierarchy from them: child circles, their common point, the circle through their centers and the article's claims at exactly this position. The point-on-the-next-circle answer is asked only for four shown lines.",
    };
  } catch (err) {
    return {
      ...saved,
      reading: null,
      error: err instanceof Error ? err.message : String(err),
      note:
        "The saved position is not one the core can draw: it needs between three and seven lines, each with two finite endpoints, and one shown flag per line.",
    };
  }
}
