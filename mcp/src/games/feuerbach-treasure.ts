/*
 * run_game_logic actions and saved-position reader for Feuerbach Treasure.
 *
 * Move the three corners A, B, C of a triangle and H is its orthocenter, so
 * each of A, B, C is the orthocenter of the triangle of the other three
 * points. The four triangles ABC, ABH, BCH and CAH therefore have the same
 * nine-point circle: the circumcircle of the three side midpoints, which also
 * carries the nine altitude feet and Euler points. Feuerbach's theorem says a
 * triangle's nine-point circle touches its incircle and its three excircles,
 * so in this picture one circle touches sixteen others — unless a right angle
 * collapses two of the four triangles (then eight circles remain, four of them
 * distinct because ABC and CAH coincide).
 *
 * Every number below is measured by the real core
 * feuerbach-treasure/feuerbach-treasure-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units in the
 * page's 400 x 280 viewBox, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { c: Pt; r: number };
type TriangleKey = "ABC" | "ABH" | "BCH" | "CAH";
type Show = Record<TriangleKey, boolean>;
type State = { A: Pt; B: Pt; C: Pt; show: Show; names: boolean };
type CircleEntry = { kind: string; circle: Circle; internal: boolean; point: Pt | null };
type FlatCircle = CircleEntry & { owner: string };
type Triangle = {
  key: string;
  data: {
    vertices: Pt[]; sides: { a: number; b: number; c: number }; area: number;
    incircle: Circle; excircles: Circle[]; ninePoint: Circle | null; feet: Pt[];
  };
  circles: CircleEntry[];
};
type Measures = {
  A: Pt; B: Pt; C: Pt; H: Pt | null; npc: Circle | null;
  triangles: Triangle[]; degenerate: boolean; visible: string[]; totalCircles: number;
};
type Claims = {
  orthocentric: boolean; ninePoints: boolean; sharedNinePointCircle: boolean;
  feuerbachTangency: boolean; tangencyPoints: boolean; sixteenCircles: boolean;
};
type Core = {
  TRIANGLES: string[];
  start(options?: Json): Json;
  measurements(s: Json): Measures;
  allCircles(m: Measures): FlatCircle[];
  distinctCircles(m: Measures, tol?: number): FlatCircle[];
  claims(s: Json): Claims;
  result(s: Json): unknown;
  distance(p: Pt, q: Pt): number;
};

const core = (): Core =>
  cores["feuerbach-treasure"].FeuerbachTreasureCore as unknown as Core;

const TRIANGLES: TriangleKey[] = ["ABC", "ABH", "BCH", "CAH"];
const ALL_ON: Show = { ABC: true, ABH: true, BCH: true, CAH: true };
const ALL_OFF: Show = { ABC: false, ABH: false, BCH: false, CAH: false };

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) } : null;
const circleView = (c: Circle | null | undefined): Json | null =>
  c && Number.isFinite(c.r) && c.c && Number.isFinite(c.c.x) && Number.isFinite(c.c.y)
    ? { centre: pt(c.c), radius: round(c.r) } : null;

/** A corner as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(value: unknown, label: string, fallback: Pt): Pt {
  if (value === undefined || value === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
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

/** Accept the page's `show` flags (nested under "show"), defaulting each key. */
function readShow(value: unknown, fallback: Show): Show {
  const out = { ...fallback };
  if (value === undefined || value === null) return out;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('argument "show" must be an object with ABC, ABH, BCH and CAH booleans');
  }
  const o = value as Json;
  for (const key of TRIANGLES) {
    const v = o[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`argument "show.${key}" must be true or false`);
    out[key] = v;
  }
  return out;
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** A real core state: start() with saved points, exactly as the page restores. */
function buildState(C: Core, args: Json, showDefault: Show): State {
  const seed = C.start({}) as unknown as State;
  return C.start({
    points: {
      A: readPoint(args.A, "A", seed.A),
      B: readPoint(args.B, "B", seed.B),
      C: readPoint(args.C, "C", seed.C),
    },
    show: readShow(args.show, showDefault),
    names: readBool(args, "names", false),
  }) as unknown as State;
}

/** Refuse points that make no nine-point circle at all (collinear/coincident). */
function living(C: Core, args: Json, showDefault: Show): { s: State; m: Measures } {
  const s = buildState(C, args, showDefault);
  const m = C.measurements(s);
  if (!m.npc) {
    throw new Error(
      "A, B and C must be distinct, non-collinear corners on the page's 400 x 280 board: " +
      "the core cannot draw a nine-point circle here",
    );
  }
  return { s, m };
}

/** The whole construction, measured by the core rather than assumed. */
function reading(C: Core, s: State, m: Measures): Json {
  const cl = C.claims(s);
  const distinct = C.distinctCircles(m);
  return {
    triangle: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    orthocenter: pt(m.H),
    ninePointCircle: circleView(m.npc),
    fourTriangles: m.triangles.map((t) => ({
      key: t.key,
      sides: {
        a: round(t.data.sides.a), b: round(t.data.sides.b), c: round(t.data.sides.c),
      },
      area: round(t.data.area),
      incircle: circleView(t.data.incircle),
      excircles: t.data.excircles.map(circleView),
      tangencies: t.circles.map((e) => ({
        kind: e.kind, internal: e.internal,
        circle: circleView(e.circle), point: pt(e.point),
      })),
    })),
    circles: {
      total: m.totalCircles,
      distinct: distinct.length,
      drawn: C.allCircles(m).map((e) => ({ owner: e.owner, kind: e.kind })),
      owners: m.triangles.map((t) => t.key),
      visible: m.visible,
    },
    degenerate: m.degenerate,
    claims: {
      orthocentric: cl.orthocentric === true,
      ninePoints: cl.ninePoints === true,
      sharedNinePointCircle: cl.sharedNinePointCircle === true,
      feuerbachTangency: cl.feuerbachTangency === true,
      tangencyPoints: cl.tangencyPoints === true,
      sixteenCircles: cl.sixteenCircles === true,
    },
    allClaimsHold: Object.values(cl).every((v) => v === true),
    result: C.result(s),
    options: { show: { ...s.show }, names: s.names },
  };
}

/** Which corner the orthocenter has collapsed onto, if any. */
function rightAngleVertex(C: Core, s: State, m: Measures): string | null {
  if (!m.H) return null;
  const scale = Math.max(1, m.npc ? m.npc.r : 1);
  const corners: Array<[string, Pt]> = [
    ["A", s.A], ["B", s.B], ["C", s.C],
  ];
  const at = corners.filter(([, p]) => C.distance(m.H!, p) < 1e-6 * scale);
  return at.length === 1 ? at[0][0] : null;
}

export function actions(): GameActions {
  const example =
    '{"A":[200.956,70.03],"B":[154.245,192.976],"C":[268.605,126.093],"show":{"ABC":true,"ABH":true,"BCH":true,"CAH":true}}';

  return {
    sixteen_circles: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the page's 400 x 280 board, y down; omit any for the opening triangle), run the real core and report the orthocenter H, the single nine-point circle shared by ABC, ABH, BCH and CAH, and every incircle, excircle and tangency point that touches it. The `show` flags (ABC, ABH, BCH, CAH, booleans; all on by default) and `names` choose what is drawn; all six numerical claims of the page are checked. For a general triangle one circle is tangent to all sixteen others.",
      args: example,
      run: (args) => {
        const C = core();
        const { s, m } = living(C, args, ALL_ON);
        const r = reading(C, s, m) as Json;
        const claims = r.claims as Json;
        const note = claims.sixteenCircles === true && claims.feuerbachTangency === true
          ? `H = (${(r.orthocenter as Json).x}, ${(r.orthocenter as Json).y}); each of A, B, C is the orthocenter of the triangle of the other three, so all four triangles share the one nine-point circle centred at ${JSON.stringify((r.ninePointCircle as Json).centre)}. By Feuerbach's theorem that circle touches the incircle and three excircles of each triangle, giving ${(r.circles as Json).total} tangencies at ${(r.circles as Json).distinct} distinct circles. All six claims hold.`
          : `The core found ${(r.circles as Json).total} circles (${(r.circles as Json).distinct} distinct), so the full sixteen-circle claim fails here. A right angle or a near-degenerate triangle collapses one or more of the four triangles; use right_angle_exception to see that case, or move the corners apart.`;
        return { ...r, note };
      },
    },

    right_angle_exception: {
      describe:
        "For corners A, B, C (as in sixteen_circles; the example has a right angle at B), check the page's exception with the real core: at a right angle the orthocenter lands on that vertex, so triangles ABH and BCH collapse and only ABC and CAH remain — eight circles, four of them distinct because the two surviving triangles coincide. Reports the collapse, the surviving triangles, circle counts and all six claims; the example shows that the tangency geometry still holds even though the page's 'sixteen' and distinct-circle checks read false.",
      args: '{"A":[0,0],"B":[0,100],"C":[100,100]}',
      run: (args) => {
        const C = core();
        const { s, m } = living(C, args, ALL_ON);
        const vertex = rightAngleVertex(C, s, m);
        const flat = C.allCircles(m);
        const tol = 1e-6 * Math.max(1, m.npc!.r);
        const tangenciesHold = flat.every((e) => {
          const d = C.distance(m.npc!.c, e.circle.c);
          const expected = e.internal ? m.npc!.r - e.circle.r : m.npc!.r + e.circle.r;
          return Number.isFinite(d) && Math.abs(d - expected) <= tol;
        });
        const r = reading(C, s, m) as Json;
        const survivors = m.triangles.map((t) => t.key);
        const collapsed = TRIANGLES.filter((key) => !survivors.includes(key));
        return {
          ...r,
          rightAngleVertex: vertex,
          survivingTriangles: survivors,
          collapsedTriangles: collapsed,
          eightCircleException: vertex !== null && m.totalCircles === 8 &&
            C.distinctCircles(m).length === 4,
          tangenciesStillHold: tangenciesHold,
          tolerance: round(tol, 9),
          note: vertex !== null
            ? `The angle at ${vertex} is right, so H coincides with ${vertex}: triangles ${collapsed.join(" and ")} collapse, and the two survivors ${survivors.join(" and ")} are the same triangle. That leaves ${m.totalCircles} drawn circles but only ${C.distinctCircles(m).length} distinct ones, so sixteenCircles is false. ${tangenciesHold ? "Each drawn circle still touches the nine-point circle, but the core's feuerbachTangency and tangencyPoints flags read false because they additionally require 16 circles." : "The drawn circles no longer all touch the nine-point circle."}`
            : "This triangle has no right angle at a corner, so all four triangles survive; use sixteen_circles to read its full nine-point-circle picture.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Feuerbach Treasure state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state)
    ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(C, src, ALL_OFF);
  } catch {
    savedReadable = false;
    s = C.start({}) as unknown as State;
  }

  const m = C.measurements(s);
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    show: { ...s.show }, names: s.names, result: C.result(src),
  };
  if (!savedReadable && !m.npc) {
    return {
      ...src,
      stateVersion, savedReadable, saved,
      valid: false,
      note: "The saved position could not be read and the fallback opening corners do not make a triangle; the core cannot draw a nine-point circle here.",
    };
  }
  if (savedReadable && !m.npc) {
    return {
      ...src,
      stateVersion, savedReadable, saved,
      valid: false,
      note: "The saved corners are collinear or coincident, so there is no nine-point circle to measure. Drag a corner apart and look again.",
    };
  }

  const r = reading(C, s, m) as Json;
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    orthocenter: r.orthocenter,
    ninePointCircle: r.ninePointCircle,
    circles: r.circles,
    degenerate: r.degenerate,
    claims: r.claims,
    allClaimsHold: r.allClaimsHold,
    core: r,
    note: (savedReadable
      ? "Track.state saved the three draggable corners, the four triangle checkboxes and the names switch. "
      : "The saved fields could not be read, so the applet's opening picture is used; the core reading below comes from those opening corners. ") +
      `The core rebuilds H, the shared nine-point circle (centre ${JSON.stringify((r.ninePointCircle as Json).centre)}, radius ${(r.ninePointCircle as Json).radius}), ${(r.circles as Json).total} circles and all six claims at ${savedReadable ? "exactly this position" : "the opening position"}. ` +
      (m.degenerate
        ? "A right angle has collapsed two of the four triangles, so this is the eight-circle exception rather than sixteen. "
        : "All four triangles are present, so one circle touches all sixteen others. ") +
      "This is an illustration with no win or loss; the tracker records exploration.",
  };
}
