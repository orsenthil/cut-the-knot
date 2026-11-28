/*
 * run_game_logic actions and saved-position reader for Hart Circle.
 *
 * Three crossing circles carve the plane into eight curved triangles. Pick one
 * as the base: the circle inscribed in it and the three inscribed in the
 * neighbouring triangles (which share an arc with the base) all touch one more
 * circle, the Hart circle. Every circle here comes from the Apollonius solver
 * in hart-circle/hart-circle-core.js, copied into src/generated/cores/ at build
 * time; the Hart circle is the solution that also touches the green incircle.
 *
 * Two honest caveats are reported below. The theorem is exact, but the applet's
 * IsTangent test accepts a touch point within 2 pixels of a circle, so a small
 * gap can still read as tangent. And Hart Circle is not Hart's inversor: that
 * is a four-bar linkage turning circular motion into straight-line motion,
 * while this is a theorem about circles in curved triangles.
 *
 * Coordinates are the page's 400 x 300 SVG viewBox units, y downward. This is
 * a picture, so there is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = Pt & { r: number };
type Pair = { c: Pt; b: Pt };
type State = {
  circles: Pair[];
  variant: number;
  showAddOns: boolean;
  showTangency: boolean;
  explored: boolean;
};
type Geometry = {
  given: Circle[];
  base: Circle | null;
  extras: (Circle | null)[];
  hart: Circle | null;
  tangency: { p: Pt; kind: string }[];
  tangencyShown: boolean;
  degenerate: boolean;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  OPTIONS: string[];
  start(options?: { variant?: string | number; showAddOns?: boolean; showTangency?: boolean }): State;
  move(state: State, name: string, p: Pt): State;
  dist(a: Pt, b: Pt): number;
  point(x: number, y: number): Pt;
  computePoint(a: Circle, b: Circle): Pt;
  isTangent(a: Circle | null, b: Circle | null): boolean;
  tangent(a: Circle | null, b: Circle | null, tol?: number): boolean;
  geometry(state: State): Geometry;
  describe(state: State): string;
};
const core = (): Core => cores["hart-circle"].HartCircleCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : v);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const circleShape = (c: Circle | null): Json | null =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: pt(c), radius: r6(c.r) }
    : null;
const pairShape = (p: Pair): Json => ({ c: pt(p.c), b: pt(p.b) });
const clonePair = (p: Pair): Pair => ({ c: { ...p.c }, b: { ...p.b } });
const isCircle = (c: Circle | null): c is Circle => Boolean(c);

const REGION_NOTE =
  "Three crossing circles cut the plane into eight curved regions, named by the eight sign strings " +
  "+++, ++-, +-+, -++, +--, -+-, --+, ---. If c_i and c_j cross at A_k and A'_k the index rule is " +
  "i + j + k = 6, so, since 1, 2, 3 are distinct, c1 and c3 meet at A2 and A'_2.";
const TOLERANCE_NOTE =
  "The theorem is exact, but the applet's IsTangent test places the centre of similitude and accepts " +
  "it within 2 pixels of a circle's circumference, so a gap of about a pixel still reads as tangent. " +
  "exactTangent uses the core's independent distance test; appletTangentWithin2px uses the applet's test.";
const INVERSOR_NOTE =
  "Hart Circle is not Hart's inversor: that is a four-bar linkage converting circular motion into " +
  "straight-line motion, while this is a circle theorem about curved triangles.";

function asArgs(args: unknown): Json {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be a JSON object of circles, variant and display flags");
  }
  return args as Json;
}

/** A board point as [x, y] or { x, y }, checked for finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
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

/** A given circle is a centre and a boundary point, exactly as the page saves it. */
function readPair(raw: unknown, label: string, fallback?: Pair): Pair {
  if (raw === undefined || raw === null) {
    if (fallback) return clonePair(fallback);
    throw new Error(`missing required argument "${label}"`);
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`"${label}" must be { c: [x,y], b: [x,y] } (centre and boundary point)`);
  }
  const o = raw as Json;
  return {
    c: readPoint(o.c, `${label}.c`, fallback && fallback.c),
    b: readPoint(o.b, `${label}.b`, fallback && fallback.b),
  };
}

/** Strict for action arguments: three pairs, falling back to the opening picture. */
function readCircles(raw: unknown, defaults: Pair[]): Pair[] {
  if (raw === undefined || raw === null) return defaults.map(clonePair);
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error('"circles" must be an array of three { c, b } pairs');
  }
  return raw.map((v, i) => readPair(v, `circles[${i}]`, defaults[i]));
}

/** Tolerant for saved positions: a malformed saved pair keeps the opening one. */
function savedCircles(raw: unknown, defaults: Pair[]): { circles: Pair[]; readable: boolean } {
  let readable = true;
  if (raw === undefined || raw === null) return { circles: defaults.map(clonePair), readable };
  const circles = Array.isArray(raw) && raw.length === 3
    ? raw.map((v, i) => {
        try { return readPair(v, `circles[${i}]`, defaults[i]); }
        catch { readable = false; return clonePair(defaults[i]); }
      })
    : (readable = false, defaults.map(clonePair));
  return { circles, readable };
}

/** The dropdown takes one of the applet's eight sign strings or an index 0-7. */
function readVariant(C: Core, raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "string") {
    const i = C.OPTIONS.indexOf(raw);
    if (i < 0) throw new Error(`"variant" must be one of ${C.OPTIONS.join(", ")} or an index 0-7`);
    return i;
  }
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 7) return raw;
  throw new Error('"variant" must be one of the eight sign strings or an integer index 0-7');
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return raw;
}

/** Tolerance for the independent exact tangency test; positive and finite. */
function readTolerance(args: Json, key: string, fallback: number): number {
  const tol = num(args, key, fallback);
  if (!(tol > 0) || !Number.isFinite(tol)) throw new Error(`argument "${key}" must be a positive number`);
  return tol;
}

/** The three supplied pairs applied through the core's own move(), then the flags. */
function buildState(C: Core, raw: Json): State {
  const seed = C.start({});
  const circles = readCircles(raw.circles, seed.circles);
  let s = seed;
  for (let i = 0; i < 3; i++) {
    s = C.move(s, `c${i + 1}`, circles[i].c);
    s = C.move(s, `b${i + 1}`, circles[i].b);
  }
  const variant = readVariant(C, raw.variant, 0);
  const showAddOns = readBool(raw, "showAddOns", true);
  return {
    ...s,
    variant,
    showAddOns,
    // The applet disables the dots checkbox when the red circles are hidden.
    showTangency: readBool(raw, "showTangency", false) && showAddOns,
    explored: true,
  };
}

/** Compare the exact distance test with the applet's 2px test for one pair. */
function tangency(C: Core, hart: Circle, other: Circle, tol: number) {
  const d = C.dist(hart, other);
  const external = Math.abs(d - (hart.r + other.r));
  const internal = Math.abs(d - Math.abs(hart.r - other.r));
  return {
    radius: r6(other.r),
    centreDistance: r6(d),
    externalGap: r6(external),
    internalGap: r6(internal),
    residual: r6(Math.min(external, internal)),
    exactTangent: C.tangent(hart, other, tol),
    appletTangentWithin2px: C.isTangent(hart, other),
    appletTouchPoint: pt(C.computePoint(hart, other)),
  };
}

/** Compact per-region check of Hart's theorem for the same three circles. */
function allRegions(C: Core, s: State, tol: number) {
  return C.OPTIONS.map((name, v) => {
    const g = C.geometry({ ...s, variant: v, showAddOns: true, showTangency: false });
    const four = [g.base, ...g.extras].filter(isCircle);
    const checks = g.hart ? four.map((c) => tangency(C, g.hart!, c, tol)) : [];
    return {
      name, index: v,
      baseRadius: circleShape(g.base) ? (circleShape(g.base) as Json).radius : null,
      hartRadius: circleShape(g.hart) ? (circleShape(g.hart) as Json).radius : null,
      degenerate: g.degenerate,
      incirclesFound: four.length,
      maxExactResidual: checks.length ? r6(Math.max(...checks.map((c: { residual: number }) => c.residual))) : null,
      allFourExactTangent: checks.length === 4 && checks.every((c: { exactTangent: boolean }) => c.exactTangent),
      allFourAppletTangent: checks.length === 4 && checks.every((c: { appletTangentWithin2px: boolean }) => c.appletTangentWithin2px),
    };
  });
}

/** A circle for the tolerance action: { x, y, r } or { center: [x,y], r }. */
function readTangentCircle(raw: unknown, label: string, fallback: Circle): Circle {
  if (raw === undefined || raw === null) return { ...fallback };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`argument "${label}" must be { x, y, r } or { center: [x,y], r }`);
  }
  const o = raw as Json;
  const centre = readPoint(o.center !== undefined && o.center !== null ? o.center : o, `${label} centre`);
  const r = Number(o.r !== undefined ? o.r : o.radius);
  if (!Number.isFinite(r) || r <= 0) throw new Error(`argument "${label}" needs a positive radius`);
  return { x: centre.x, y: centre.y, r };
}

export function actions(): GameActions {
  return {
    hart_circle: {
      describe:
        "Run the real core on three given circles (each { c: [x,y], b: [x,y] }, centre and boundary point; omit 'circles' for the opening picture) and a base triangle 'variant' (one of the eight sign strings +++ ... --- or an index 0-7). Report the green base incircle, the three red associated incircles and the blue Hart circle, and check the Hart circle's tangency to all four with both the exact distance test and the applet's 2-pixel test, for the chosen base and for all eight regions. 'showAddOns' defaults to true and 'showTangency' to false; 'tolerance' (default 0.000001) sets the exact test.",
      args: '{"circles":[{"c":[200,200],"b":[255,200]},{"c":[243.30127018922195,125],"b":[318.30127018922195,125]},{"c":[156.69872981077808,125],"b":[256.6987298107781,125]}],"variant":"+++","showAddOns":true,"showTangency":true}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const tol = readTolerance(a, "tolerance", 1e-6);
        const s = buildState(C, a);
        const g = C.geometry(s);
        const four = [g.base, ...g.extras].filter(isCircle);
        const checks = g.hart ? four.map((c) => tangency(C, g.hart!, c, tol)) : [];
        return {
          view: C.VIEW,
          variant: C.OPTIONS[s.variant],
          variantIndex: s.variant,
          options: { showAddOns: s.showAddOns, showTangency: g.tangencyShown },
          given: g.given.map(circleShape),
          base: circleShape(g.base),
          extras: g.extras.map(circleShape),
          hart: circleShape(g.hart),
          degenerate: g.degenerate,
          hartTangency: checks,
          allFourExactTangent: checks.length === 4 && checks.every((c) => c.exactTangent),
          allFourAppletTangent: checks.length === 4 && checks.every((c) => c.appletTangentWithin2px),
          tangencyDotCount: g.tangency.length,
          allEightRegions: allRegions(C, s, tol),
          status: C.describe(s),
          note:
            (g.degenerate || !g.base
              ? "The three given circles are nearly collinear, so the core finds no incircle here; drag a centre or an edge point away from a straight line. "
              : "") +
            (!s.showAddOns
              ? "The red incircles and the Hart circle are only computed when 'showAddOns' is true. "
              : !g.hart
                ? "There is no Hart circle for this arrangement of the three given circles. "
                : `The blue Hart circle has radius ${r6(g.hart.r)} and touches the green incircle and all three red incircles.` +
                  ` The largest exact gap across the four is ${checks.length ? r6(Math.max(...checks.map((c) => c.residual))) : "n/a"} board units. `) +
            REGION_NOTE + " " + TOLERANCE_NOTE + " " + INVERSOR_NOTE,
        };
      },
    },

    tangency_tolerance: {
      describe:
        "Compare the applet's 2-pixel IsTangent test with the core's independent exact distance test on two given circles { x, y, r } (or { center: [x,y], r }). By default circle b has radius 30 and sits 'gap' pixels (default 1) beyond external tangency with a, which the applet accepts although exact tangency fails; 'tolerance' (default 0.000001) sets the exact test. This shows that the Hart-circle theorem is exact while the drawing's test is not.",
      args: '{"a":{"x":200,"y":150,"r":50},"gap":1,"tolerance":0.000001}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const tol = readTolerance(a, "tolerance", 1e-6);
        const gap = num(a, "gap", 1);
        if (!Number.isFinite(gap) || Math.abs(gap) > 500) {
          throw new Error('argument "gap" must be a finite pixel offset with |gap| <= 500');
        }
        const left = readTangentCircle(a.a, "a", { x: 200, y: 150, r: 50 });
        const right = readTangentCircle(a.b, "b", { x: left.x + left.r + 30 + gap, y: left.y, r: 30 });
        const d = C.dist(left, right);
        const external = Math.abs(d - (left.r + right.r));
        const internal = Math.abs(d - Math.abs(left.r - right.r));
        const q = C.computePoint(left, right);
        const pointError = Math.abs(C.dist(q, left) - left.r);
        const exact = C.tangent(left, right, tol);
        const applet = C.isTangent(left, right);
        return {
          a: circleShape(left),
          b: circleShape(right),
          gapBeyondExternalTangency: r6(gap),
          centreDistance: r6(d),
          externalTangencyDistance: r6(left.r + right.r),
          exactGap: r6(Math.min(external, internal)),
          appletTouchPoint: pt(q),
          appletPointErrorFromCircumference: r6(pointError),
          exactTangent: exact,
          appletTangentWithin2px: applet,
          verdict: exact
            ? "The two circles are tangent at the given tolerance."
            : applet
              ? "The applet calls these circles tangent (touch point within 2px) but they miss exact tangency."
              : "Even the applet's 2px test does not call these circles tangent.",
          note: TOLERANCE_NOTE + " " + INVERSOR_NOTE,
        };
      },
    },
  };
}

/** Echo the saved fields plus a fresh core reading, including the Hart circle. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Hart Circle state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hart Circle position must be an object");
  }
  const C = core();
  const seed = C.start({});
  const { circles, readable } = savedCircles(state.circles, seed.circles);
  const variant = readVariant(C, state.variant, 0);
  const showAddOns = state.showAddOns === true;
  const showTangency = state.showTangency === true && showAddOns;

  let s: State = seed;
  for (let i = 0; i < 3; i++) {
    s = C.move(s, `c${i + 1}`, circles[i].c);
    s = C.move(s, `b${i + 1}`, circles[i].b);
  }
  s = { ...s, variant, showAddOns, showTangency, explored: state.explored === true };

  const g = C.geometry(s);
  // The saved switches may hide the red circles; also read the full picture so
  // the tutor can still report the Hart circle at this saved arrangement.
  const full = C.geometry({ ...s, showAddOns: true });
  const four = [full.base, ...full.extras].filter(isCircle);
  const checks = full.hart ? four.map((c) => tangency(C, full.hart!, c, 1e-6)) : [];
  return {
    ...state,
    stateVersion,
    savedReadable: readable,
    saved: {
      circles: circles.map(pairShape),
      variant: C.OPTIONS[variant],
      variantIndex: variant,
      showAddOns: s.showAddOns,
      showTangency: s.showTangency,
      explored: s.explored,
    },
    view: C.VIEW,
    given: g.given.map(circleShape),
    base: circleShape(g.base),
    extras: g.extras.map(circleShape),
    hart: circleShape(full.hart),
    degenerate: g.degenerate,
    tangencyDotsShown: g.tangencyShown,
    tangencyDotCount: g.tangency.length,
    hartTangency: checks,
    allFourExactTangent: checks.length === 4 && checks.every((c) => c.exactTangent),
    status: C.describe(s),
    note:
      (!readable
        ? "Some saved circle pairs could not be read, so the core reading uses the opening circles for those. "
        : "Track.state saved the three centre/edge pairs, the base variant and the two display switches; the core rebuilds the four incircles and the Hart circle from them. ") +
      (showAddOns
        ? ""
        : "The saved switches hide the additional circles, so the reading below also computes them with 'showAddOns' on. ") +
      REGION_NOTE + " " + TOLERANCE_NOTE + " " + INVERSOR_NOTE,
  };
}
