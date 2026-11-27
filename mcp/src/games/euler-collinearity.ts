/*
 * run_game_logic actions and saved-position reader for Euler Collinearity.
 *
 * The real core is euler-collinearity/euler-collinearity-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's Compute():
 * the midpoint Mk of the side opposite Vk is first scaled about the centroid G
 * by -1/2, then about P by the slider factor t, giving Mtk = P + t(Mk - P).
 * The three cevians Vk Mtk concur at a point whose position is
 *
 *   S(t) = (2(1 - t)P + 3tG) / (2 + t),
 *
 * which lies on the line GP (a homothety product has its center on the line of
 * the two centers). At t = 0 this is P, at t = 1 it is G, and as t grows it
 * tends to 3G - 2P. When P is the circumcenter O that line is the Euler line
 * and the limit is the orthocenter H = 3G - 2O (so GH = 2GO). At t = -2 the
 * product is a translation and the cevians are parallel, so there is no S.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["euler-collinearity"].EulerCollinearityCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Position = { V: Point[]; P: Point; Q: Point; t: number; showHint: boolean; showNames: boolean };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Non-finite / missing measurements (a collapsed picture) are reported as null. */
const maybe = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept both the page's saved {x, y} and short [x, y] arguments. */
function asPoint(raw: unknown, label: string, fallback: Point): Point {
  if (raw === undefined || raw === null) return fallback;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`${label} must be [x, y] or {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} is not a finite point`);
  return { x, y };
}
const pointArg = (args: Json, key: string, fallback: Point): Point =>
  asPoint(args[key], `argument "${key}"`, fallback);

/** The three corners must be a genuine triple; each one may be omitted. */
function verticesArg(args: Json, fallback: Point[]): Point[] {
  const raw = args.V;
  if (raw === undefined || raw === null) return fallback;
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error('argument "V" must be an array of three [x, y] or {x, y} points');
  }
  return raw.map((v, i) => asPoint(v, `V[${i}]`, fallback[i]));
}

function readPosition(C: Core, args: Json): Position {
  const seed = C.start();
  return {
    V: verticesArg(args, seed.V),
    P: pointArg(args, "P", seed.P),
    Q: pointArg(args, "Q", seed.Q),
    t: num(args, "t", seed.t),
    showHint: args.showHint === true,
    showNames: args.showNames === true,
  };
}

/** Everything the core says about one triangle, point P and slider factor t. */
function reading(C: Core, s: Position) {
  const c = C.compute(s);
  const G = c.G;
  const formula = C.claimPoint(s.P, G, s.t);
  const limit = C.limitPoint(s.P, G);
  const O = C.circumcenter(s.V);
  const onEuler = Boolean(O && C.distance(O, s.P) < 0.5);
  const agree = c.S && formula ? C.distance(c.S, formula) : null;
  const parallel = formula === null; // exactly t = -2: the two scalings compose to a slide

  const note = parallel
    ? "At t = -2 the product of the two scalings is a translation, so the three cevians are parallel and the formula has a zero denominator: there is no meeting point. The applet's slider never reaches this value."
    : !c.S
      ? "Two cevians are less than one pixel from parallel, so the applet skips their meeting point, although the formula still gives a finite one."
      : onEuler
        ? "P is the circumcenter O, so the locus line GP is the Euler line: S travels from O at t = 0 through G at t = 1 towards the orthocenter H = 3G - 2O as t grows."
        : "The three cevians meet at S on the line through P and G; the intersections drawn by the applet and the homothety formula agree to numerical precision.";

  return {
    triangle: { V0: pt(s.V[0]), V1: pt(s.V[1]), V2: pt(s.V[2]) },
    P: pt(s.P),
    t: round(s.t),
    centroid: pt(G),
    midpoints: c.M.map(pt),
    scaledMidpoints: c.Mt.map(pt),
    concurrence: {
      drawn: pt(c.S),
      formula: pt(formula),
      agreement: maybe(agree),
      intersections: { V0V1: pt(c.i01), V1V2: pt(c.i12), V2V0: pt(c.i20) },
      parallel,
    },
    locus: {
      lineGP: { p: pt(s.P), q: pt(G) },
      U: pt(c.U),
      limit3Gminus2P: pt(limit),
    },
    euler: {
      circumcenter: pt(O),
      PIsCircumcenter: onEuler,
      isEulerLine: onEuler,
    },
    note,
  };
}

export function actions(): GameActions {
  return {
    concurrence: {
      describe:
        "For a triangle V0, V1, V2 and a point P (each {x, y} or [x, y] in page coordinates, y downward; omit any to keep the page's starting value) with slider factor t (default 1.5), report the centroid G, the three side midpoints and their scaled copies Mtk = P + t(Mk - P), and where the three cevians meet: both the point the applet draws and the formula S(t) = (2(1-t)P + 3tG)/(2+t), plus their agreement. Also report the locus line GP, the marked point U = P + t(G-P), the limit 3G-2P, and whether P is the circumcenter O (making GP the Euler line). At t = -2 the cevians are parallel and there is no meeting point.",
      args: '{ "V": [[254, 83.3333], [394.3376, 333.3333], [105.6624, 333.3333]], "P": [350, 230], "t": 1.5 }',
      run: (args) => {
        const C = core();
        return reading(C, readPosition(C, args));
      },
    },
    euler_line: {
      describe:
        "For a triangle V0, V1, V2 (each {x, y} or [x, y]; omit to keep the page's starting triangle), put P at the circumcenter O so the locus of the concurrence point becomes the Euler line. Report O, the centroid G and the orthocenter H = 3G-2O, their cross product (zero when collinear) and the ratio GH/GO = 2, and sample the meeting point S(t) for t = -2, 0, 0.5, 1, 1.5, 3, 10, 100 using both the applet's intersections and the formula. S goes from O through G and tends to H as t grows; at t = -2 no point exists. A collapsed (collinear) triangle has no circumcenter.",
      args: '{ "V": [[254, 83.3333], [394.3376, 333.3333], [105.6624, 333.3333]] }',
      run: (args) => {
        const C = core();
        const s = readPosition(C, args);
        const O = C.circumcenter(s.V);
        const G = C.barycenter(s.V[0], s.V[1], s.V[2]);
        if (!O) {
          return {
            triangle: { V0: pt(s.V[0]), V1: pt(s.V[1]), V2: pt(s.V[2]) },
            centroid: pt(G),
            circumcenter: null,
            orthocenter: null,
            note: "The corners are collinear, so there is no circumcenter: the Euler line is not defined for this picture.",
          };
        }
        const H = C.orthocenter(s.V);
        const cross = C.cross(C.sub(G, O), C.sub(H!, O));
        const go = C.distance(G, O);
        const samples = [-2, 0, 0.5, 1, 1.5, 3, 10, 100].map((t) => {
          const c = C.compute({ ...s, P: O, t });
          return { t, formula: pt(C.claimPoint(O, G, t)), drawn: pt(c.S) };
        });
        return {
          triangle: { V0: pt(s.V[0]), V1: pt(s.V[1]), V2: pt(s.V[2]) },
          circumcenter: pt(O),
          centroid: pt(G),
          orthocenter: pt(H),
          collinear: {
            crossProductOGH: maybe(cross),
            GO: maybe(go),
            GH: maybe(H ? C.distance(G, H) : null),
            GHoverGO: maybe(H ? C.distance(G, H) / go : null),
          },
          samples,
          note:
            "O, G and H lie on one line with GH = 2GO, the Euler line. With P = O the concurrence point starts at O (t = 0), passes through G (t = 1) and approaches H; at t = -2 it has no finite position.",
        };
      },
    },
  };
}

/** The page's saved picture, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readPosition(C, state);
  return {
    stateVersion,
    saved: {
      V: s.V.map(pt),
      P: pt(s.P),
      Q: pt(s.Q),
      t: round(s.t),
      showHint: s.showHint,
      showNames: s.showNames,
    },
    reading: reading(C, s),
    isIllustration: true,
    note:
      "Track.state saves the three dragged corners, the point P, the unused leftover Q, the slider factor t and the two checkboxes. The reading recomputes the concurrence point, its locus line GP and, when P is the circumcenter, the Euler line with the page's own core. This is an illustration: there is no win or loss.",
  };
}
