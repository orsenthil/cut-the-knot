/*
 * run_game_logic actions and saved-position reader for Malfatti Zoom.
 *
 * The picture is Steiner's construction of the three Malfatti circles: let I be
 * the incenter of A1 A2 A3, inscribe a circle in each triangle I Ai Aj, take the
 * *second* internal tangents of those small circles (they meet at L and cut
 * the sides at D_k), and inscribe a circle in each quadrilateral Ai Dj L Dk.
 * Hart proved those three circles touch one another and two sides each in
 * every configuration; the zoom exists to inspect faraway intersections. Two
 * honest caveats are reported below: the applet's one-pixel tangent test can
 * choose the common tangent instead, so the drawn circles then miss, and
 * Malfatti's original marble problem (largest total area) is a different
 * question from this touching construction.
 *
 * Every number comes from malfatti-zoom/malfatti-zoom-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are the page's 360 x 360
 * SVG viewBox units, y downward. This is a picture with no win or loss.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type Line = { a: Pt; b: Pt };
type Zoom = { key: string; label: string; a: number };
type Transform = { a: number; b: number; c: number };
type State = {
  width: number; height: number; A: Pt[];
  showNames: boolean; showBisectors: boolean; showIncircles: boolean;
  showSecondTangents: boolean; zoom: string;
};
type Geometry = {
  A: Pt[]; I: Pt; main: Circle; incircles: Circle[];
  firstTangents: (Line | null)[]; D: Pt[]; L: Pt; DE: Line[];
  circles: Circle[]; P: Pt[]; B: Pt[]; C: Pt[];
  E: (Pt | null)[]; F: Pt[]; G: Pt[];
};
type Core = {
  ZOOMS: Zoom[];
  start(options?: Json): State;
  moveVertex(state: State, index: number, point: Pt): State;
  zoom(state: State): Transform;
  transformPoint(p: Pt, t: Transform): Pt;
  untransformPoint(p: Pt, t: Transform): Pt;
  transformCircle(c: Circle, t: Transform): Circle;
  geometry(state: State): Geometry | null;
  distance(p: Pt, q: Pt): number;
  distToLine(p: Pt, a: Pt, b: Pt): number;
  position(state: State): Json;
  result(state: State): null;
};
const core = (): Core => cores["malfatti-zoom"].MalfattiZoomCore as unknown as Core;

/* Tidy only what we print; the core's own floats drive every verdict. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2)) : r6(v);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const maybePt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? pt(p) : null;
const circleShape = (c: Circle | null | undefined): Json | null =>
  c && Number.isFinite(c.center.x) && Number.isFinite(c.center.y) && Number.isFinite(c.radius)
    ? { center: pt(c.center), radius: r6(c.radius) } : null;
const lineShape = (l: Line | null | undefined): Json | null => (l ? { a: pt(l.a), b: pt(l.b) } : null);
const copyPt = (p: Pt): Pt => ({ x: p.x, y: p.y });
const cross = (a: Pt, b: Pt, p: Pt): number =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const samePoint = (a: Pt, b: Pt, tol: number): boolean =>
  Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;

const CONSTRUCTION_NOTE =
  "Steiner's construction with Hart's proof puts the k-th circle in quadrilateral Ai Dj L Dk: " +
  "its centre is the mean of four angle-bisector candidates and its radius the mean of the four " +
  "distances to the quadrilateral's sides. The residuals below check exact pairwise tangency, " +
  "tangency to the two sides at each vertex, to the two lines L D, concurrence of the second " +
  "tangents at L, and that P_k is the contact point of the other two circles.";
const QUIRK_NOTE =
  "The applet picks a second internal tangent only if it lies more than one pixel from I; " +
  "otherwise it falls back to the common tangent of the two small incircles, and the displayed " +
  "circles no longer touch exactly. Zoom is a similarity about the board centre, applied after " +
  "the construction, so it only changes the view and cannot repair that fallback.";
const MARBLE_NOTE =
  "This is the touching construction, not Malfatti's marble problem of maximizing the total " +
  "circle area: in an equilateral triangle the incircle plus two corner circles packs more area.";

function asArgs(args: unknown): Json {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be a JSON object with A, zoom and optional layers or width/height");
  }
  return args as Json;
}

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readTriangle(raw: unknown, label: string, fallback: Pt[]): Pt[] {
  if (raw === undefined || raw === null) return fallback.map(copyPt);
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error(`argument "${label}" must be an array of three [x, y] or { x, y } points`);
  }
  return raw.map((v, i) => readPoint(v, `${label}[${i}]`));
}

/** Accept a zoom key ("4") or its scale (2, 4, 6, 8); refuse anything else. */
function readZoom(C: Core, raw: unknown, label: string, fallback: string): string {
  if (raw === undefined || raw === null) return fallback;
  const byKey = C.ZOOMS.find((z) => z.key === String(raw));
  if (byKey) return byKey.key;
  if (typeof raw === "number") {
    const byScale = C.ZOOMS.find((z) => z.a === raw);
    if (byScale) return byScale.key;
  }
  throw new Error(
    `argument "${label}" must be one of ${C.ZOOMS.map((z) => `${z.key} (${z.label})`).join(", ")}`,
  );
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return raw;
}

function readSize(args: Json, key: string, fallback: number): number {
  const v = num(args, key, fallback);
  if (v < 120 || v > 2000) throw new Error(`argument "${key}" must be between 120 and 2000`);
  return v;
}

/** The applet's opening picture with the requested drags and options applied. */
function buildState(C: Core, args: Json): State {
  const seed = C.start({});
  const zoom = readZoom(C, args.zoom, "zoom", seed.zoom);
  let s = C.start({
    width: readSize(args, "width", seed.width),
    height: readSize(args, "height", seed.height),
    zoom,
    showNames: readBool(args, "names", seed.showNames),
    showBisectors: readBool(args, "bisectors", seed.showBisectors),
    showIncircles: readBool(args, "incircles", seed.showIncircles),
    showSecondTangents: readBool(args, "tangents", seed.showSecondTangents),
  });
  const A = readTriangle(args.A, "A", s.A);
  for (let i = 0; i < 3; i++) s = C.moveVertex(s, i, A[i]);
  return s;
}

/** Largest gap between the three Malfatti circles, from actual core circles. */
function pairGap(C: Core, circles: Circle[]): number {
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      worst = Math.max(worst, Math.abs(
        C.distance(circles[i].center, circles[j].center) - circles[i].radius - circles[j].radius,
      ));
    }
  }
  return worst;
}

/** One core geometry call, reported in board units with residuals. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  if (!g) return null;
  let sideGap = 0, quadGap = 0, concurGap = 0, bisectorGap = 0, homothetyGap = 0;
  for (let k = 0; k < 3; k++) {
    const i = (k + 1) % 3, j = (k + 2) % 3;
    const c = g.circles[k];
    sideGap = Math.max(sideGap,
      Math.abs(C.distToLine(c.center, g.A[k], g.A[i]) - c.radius),
      Math.abs(C.distToLine(c.center, g.A[j], g.A[k]) - c.radius));
    quadGap = Math.max(quadGap,
      Math.abs(C.distToLine(c.center, g.L, g.D[i]) - c.radius),
      Math.abs(C.distToLine(c.center, g.L, g.D[j]) - c.radius));
    const tangent = g.firstTangents[k];
    if (tangent) concurGap = Math.max(concurGap, C.distToLine(g.L, tangent.a, tangent.b));
    const small = g.incircles[k];
    bisectorGap = Math.max(bisectorGap,
      Math.abs(C.distToLine(small.center, g.I, g.A[i]) - small.radius),
      Math.abs(C.distToLine(small.center, g.I, g.A[j]) - small.radius));
    const a = g.circles[i], b = g.circles[j];
    homothetyGap = Math.max(homothetyGap,
      Math.abs(C.distance(g.P[k], a.center) - a.radius),
      Math.abs(C.distance(g.P[k], b.center) - b.radius));
  }
  const tangents = g.firstTangents.map((t, k) => ({
    chosenTangentFound: Boolean(t),
    distanceFromI: t ? sig(C.distToLine(g.I, t.a, t.b)) : null,
    distanceToDk: t ? sig(C.distToLine(g.D[k], t.a, t.b)) : null,
    onePixelFallback: !t || C.distToLine(g.I, t.a, t.b) <= 1,
  }));
  // Hart's two configurations: E_i and E_j both on the side opposite A_k, or not.
  const sameSide = [0, 1, 2].map((k) => {
    const i = (k + 1) % 3, j = (k + 2) % 3;
    const ei = g.E[i], ej = g.E[j];
    return Boolean(ei && ej && Math.abs(cross(g.A[i], g.A[j], ei)) < 1e-4
      && Math.abs(cross(g.A[i], g.A[j], ej)) < 1e-4);
  });
  const status = sideGap < 1e-6
    ? "The three blue circles touch each other and two sides each."
    : sideGap < 1
      ? `The circles touch to within ${sideGap.toFixed(3)} units.`
      : `Here the one-pixel tangent test chose a bisector, so the circles miss by ${sideGap.toFixed(1)} units.`;
  return {
    vertices: g.A.map(pt),
    incenter: pt(g.I),
    incircle: circleShape(g.main),
    smallIncircles: g.incircles.map(circleShape),
    L: pt(g.L),
    sideFeet: g.D.map(pt),
    contactPoints: g.P.map(pt),
    malfattiCircles: g.circles.map(circleShape),
    secondTangents: g.firstTangents.map(lineShape),
    auxiliaryPoints: { E: g.E.map(maybePt), F: g.F.map(pt), G: g.G.map(pt) },
    residuals: {
      circlePair: sig(pairGap(C, g.circles)),
      sides: sig(sideGap), quadrilateral: sig(quadGap),
      concurrencyAtL: sig(concurGap), incircleBisectors: sig(bisectorGap),
      contactAtP: sig(homothetyGap),
    },
    tangentChoice: tangents,
    configurations: {
      ePairOnSideOppositeVertex: sameSide,
      sameSideCount: sameSide.filter(Boolean).length,
      splitCount: sameSide.filter((v) => !v).length,
    },
    result: C.result(s),
    status,
  };
}

const FIXTURE_ARGS = '{"A":[[62,300],[300,300],[240,16.08]]}';

export function actions(): GameActions {
  return {
    malfatti_circles: {
      describe:
        "Run the real Steiner/Hart construction on triangle A (three [x,y] or {x,y} points; omit A for the opening triangle) and report the incenter, the three small incircles, their second tangents meeting at L, the D/E/F/G points and the three Malfatti circles, with residuals for pairwise tangency, the two sides, the quadrilaterals, concurrence at L and the contact points P. Optional zoom key 1/2/4/6/8, width/height and the four display flags change only the view; Hart's proof covers both E configurations, and this touching construction is not Malfatti's marble problem of maximizing total area.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const s = buildState(C, a);
        const r = reading(C, s);
        if (!r) {
          throw new Error(
            "the core's construction needs a proper, non-flat triangle (its geometry() returned null); " +
            "move a vertex away from a straight line and try again",
          );
        }
        const t = C.zoom(s);
        return {
          state: { width: s.width, height: s.height, zoom: s.zoom, A: s.A.map(pt) },
          layers: {
            names: s.showNames, bisectors: s.showBisectors,
            incircles: s.showIncircles, tangents: s.showSecondTangents,
          },
          reading: r,
          view: { a: t.a, b: r6(t.b), c: r6(t.c), fixedCentre: pt(C.transformPoint(
            { x: s.width / 2, y: s.height / 2 }, t,
          )) },
          note: CONSTRUCTION_NOTE + " " + QUIRK_NOTE + " " + MARBLE_NOTE,
        };
      },
    },

    zoom_and_tangent_quirk: {
      describe:
        "Sweep the real core's zoom similarity T(p) = a*p + (b,c) over the requested zoom keys (default all of 1/2/4/6/8) for triangle A, showing that the board centre stays fixed and each tangency residual merely scales with a, so zoom never changes the construction. The same action reports the applet's one-pixel second-tangent test: which tangents fell back to the common tangent of the small incircles, how far they lie from I and from their D_k, and the resulting worst miss against the status line.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const s = buildState(C, a);
        const g = C.geometry(s);
        if (!g) throw new Error("the core cannot draw this triangle; move a vertex and try again");
        const keys = a.zooms === undefined || a.zooms === null
          ? C.ZOOMS.map((z) => z.key)
          : (Array.isArray(a.zooms) && a.zooms.length > 0
            ? a.zooms.map((v, i) => readZoom(C, v, `zooms[${i}]`, "1"))
            : []);
        if (keys.length === 0) throw new Error('argument "zooms" must be a nonempty array of zoom keys');
        const boardGap = pairGap(C, g.circles);
        const centre = { x: s.width / 2, y: s.height / 2 };
        const sample = { x: s.width / 3, y: s.height / 4 };
        const views = keys.map((key) => {
          const z = C.ZOOMS.find((v) => v.key === key)!;
          const t = C.zoom({ ...s, zoom: key });
          const shown = g.circles.map((c) => C.transformCircle(c, t));
          const shownGap = pairGap(C, shown);
          return {
            key: z.key, label: z.label, a: z.a,
            b: r6(t.b), c: r6(t.c),
            fixedCentre: samePoint(C.transformPoint(centre, t), centre, 1e-9),
            roundTripError: sig(C.distance(C.untransformPoint(C.transformPoint(sample, t), t), sample)),
            vertices: g.A.map((p) => pt(C.transformPoint(p, t))),
            circles: shown.map(circleShape),
            pairGap: sig(shownGap),
            expectedPairGap: sig(z.a * boardGap),
            scalesExactly: Math.abs(shownGap - z.a * boardGap) < 1e-6 * Math.max(1, z.a * boardGap),
          };
        });
        const fallbacks = g.firstTangents
          .map((t, k) => ({ k, fallback: !t || C.distToLine(g.I, t.a, t.b) <= 1 }))
          .filter((v) => v.fallback).map((v) => v.k);
        return {
          triangle: g.A.map(pt),
          boardPairGap: sig(boardGap),
          views,
          onePixelFallbacks: fallbacks,
          anyFallback: fallbacks.length > 0,
          verdict: fallbacks.length === 0
            ? "Every second tangent was more than one pixel from I, so the construction is exact."
            : `The one-pixel test fell back to a common tangent for circle${fallbacks.length === 1 ? "" : "s"} ` +
              fallbacks.map((k) => `c_${k + 1}`).join(", ") + "; the displayed circles can miss there.",
          note: QUIRK_NOTE + " " + CONSTRUCTION_NOTE + " " + MARBLE_NOTE,
        };
      },
    },
  };
}

/** Tolerant rebuild of a saved position: bad fields keep the opening picture. */
function savedState(C: Core, state: Json): { s: State; readable: boolean } {
  const seed = C.start({});
  let readable = true;
  const A = seed.A.map(copyPt);
  if (!Array.isArray(state.A) || state.A.length !== 3) {
    readable = false;
  } else {
    for (let i = 0; i < 3; i++) {
      try { A[i] = readPoint(state.A[i], `saved A[${i}]`); }
      catch { readable = false; }
    }
  }
  let zoom = seed.zoom;
  try { zoom = readZoom(C, state.view, "saved view", seed.zoom); }
  catch { readable = false; }
  const raw = state.layers && typeof state.layers === "object" && !Array.isArray(state.layers)
    ? state.layers as Json : {};
  const layers = {
    names: seed.showNames, bisectors: seed.showBisectors,
    incircles: seed.showIncircles, tangents: seed.showSecondTangents,
  };
  for (const key of Object.keys(layers) as (keyof typeof layers)[]) {
    if (raw[key] === undefined || raw[key] === null) continue;
    if (typeof raw[key] !== "boolean") { readable = false; continue; }
    layers[key] = raw[key] as boolean;
  }
  let s = C.start({
    width: seed.width, height: seed.height, zoom,
    showNames: layers.names, showBisectors: layers.bisectors,
    showIncircles: layers.incircles, showSecondTangents: layers.tangents,
  });
  for (let i = 0; i < 3; i++) s = C.moveVertex(s, i, A[i]);
  return { s, readable };
}

/** Echo Track.state's fields plus a fresh core reading at that triangle. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Malfatti Zoom state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Malfatti Zoom position must be an object");
  }
  const C = core();
  const { s, readable } = savedState(C, state);
  const canonical = C.position(s);
  const saved = {
    A: s.A.map(pt),
    view: s.zoom,
    layers: canonical.layers as Json,
  };
  const savedCorners: unknown = canonical.A;
  const savedMatchesCore = readable
    && Array.isArray(savedCorners) && savedCorners.length === 3
    && s.A.every((p, i) => samePoint(p, savedCorners[i] as Pt, 0.011));
  const r = reading(C, s);
  const t = C.zoom(s);
  return {
    ...state,
    stateVersion,
    saved,
    savedReadable: readable,
    savedMatchesCore,
    corePosition: canonical,
    valid: r !== null,
    reading: r,
    zoomView: { key: s.zoom, a: t.a, b: r6(t.b), c: r6(t.c) },
    result: C.result(s),
    note:
      (readable
        ? "Track.state saved the three board-unit corners A, the zoom view and the four display flags; " +
          "the core rebuilds Steiner's construction from those corners. "
        : "Some saved fields could not be read, so the opening picture was used for those; ") +
      "The saved corners are rounded to two decimals, so residuals can differ in the last digits. " +
      "Display flags and zoom change only what is drawn, not the geometry. " +
      (r ? r.status + " " : "The saved triangle is degenerate, so the core draws no construction. ") +
      CONSTRUCTION_NOTE + " " + QUIRK_NOTE + " " + MARBLE_NOTE,
  };
}
