/*
 * run_game_logic actions and saved-position reader for Inradius Semiperimeter.
 *
 * The real core is inradius-semiperimeter/inradius-semiperimeter-core.js, copied
 * into src/generated/cores/ at build time. Every number below comes from it.
 * Joining the incenter O to the three touch points D, E, F cuts the triangle
 * into six right triangles; "Move them" swings them into an s by r rectangle,
 * so K = s·r. Coordinates are the applet's 500 x 360 board units, y down.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt;
  hint?: boolean; progress?: number; explored?: boolean; moves?: number;
};
type Measure = {
  degenerate: boolean; shortcut: boolean;
  A: Pt; B: Pt; C: Pt; O: Pt; D: Pt; E: Pt; F: Pt;
  a: number; b: number; c: number; s: number; r: number; area: number;
  radiusFromCenter: number[]; tangentLengths: number[]; mode: number;
  pieces: unknown[];
};
type Core = {
  W: number; H: number; GAP: number; NSTEPS: number;
  pt(x: number, y: number): Pt;
  dist(p: Pt, q: Pt): number;
  sqDist(p: Pt, q: Pt): number;
  measurements(s: State): Measure;
  nearestPoint(p: Pt, u: Pt, v: Pt): Pt;
  piecesAt(m: Measure, t: number): Pt[][];
  start(options?: Json): State;
  move(state: State, m: Json): State | null;
  result(state: State): string | null;
};

const core = (): Core =>
  cores["inradius-semiperimeter"].InradiusSemiperimeterCore as unknown as Core;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e8) / 1e8 : NaN);
const asPt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });

/** Tool args may use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" must have finite x and y`);
  }
  return { x, y };
}

function agree(area: number, rectangle: number): boolean {
  return Math.abs(area - rectangle) <= Math.max(1e-6, Math.abs(area) * 1e-9);
}

export function actions(): GameActions {
  return {
    dissection: {
      describe:
        "For a triangle with corners A, B, C (board units), measure its sides, semiperimeter s and inradius r, and check that the six right triangles from the incenter to the touch points swing into an s by r rectangle, so the area is s·r. A Heronian triangle such as the 3-4-5 example has integer area and rational s and r.",
      args: '{ "A": [0, 0], "B": [4, 0], "C": [0, 3] }',
      run: (args) => {
        const C = core();
        const A = readPoint(args.A, "A"), B = readPoint(args.B, "B"), Cc = readPoint(args.C, "C");
        const m = C.measurements({ A, B, C: Cc });
        if (m.degenerate) {
          throw new Error("those corners do not make a triangle the core can measure; move them apart");
        }
        const rectangleArea = m.s * m.r;
        return {
          A: asPt(A), B: asPt(B), C: asPt(Cc),
          incenter: asPt(m.O),
          touchPoints: { D: asPt(m.D), E: asPt(m.E), F: asPt(m.F) },
          sides: { a_BC: round(m.a), b_CA: round(m.b), c_AB: round(m.c) },
          semiperimeter: round(m.s),
          inradius: round(m.r),
          triangleArea: round(m.area),
          rectangle: { width: round(m.s), height: round(m.r), area: round(rectangleArea) },
          areaEqualsSr: agree(m.area, rectangleArea),
          radiusFromCenter: m.radiusFromCenter.map(round),
          tangentLengths: m.tangentLengths.map(round),
          nearVertexShortcut: m.shortcut,
          swingMode: m.mode,
          pieceCount: m.pieces.length,
          note:
            `The core makes s = ${round(m.s)} and r = ${round(m.r)}; the ${m.pieces.length} swinging pieces fill a ` +
            `${round(m.s)} by ${round(m.r)} rectangle, whose area ${round(rectangleArea)} equals the triangle's ${round(m.area)}. ` +
            "The two tangent segments from each corner are equal, which is why the rectangle's width is exactly s. " +
            "For a Heronian triangle (integer sides and integer area) s and r are rational — here s = 6, r = 1 and K = 6.",
        };
      },
    },
    nearest_point: {
      describe:
        "Drop a perpendicular from p to the line through u and v with the core's GeoSDoub.NearestPoint and compare it with the ordinary orthogonal projection. When p is within sqrt(0.1) ≈ 0.316 units of u the applet returns p itself instead of the foot — a quirk that makes the dissection unreliable for a near-vertex triangle.",
      args: '{ "p": [0.1, 0.05], "u": [0, 0], "v": [4, 0] }',
      run: (args) => {
        const C = core();
        const p = readPoint(args.p, "p"), u = readPoint(args.u, "u"), v = readPoint(args.v, "v");
        if (C.sqDist(u, v) < 1e-12) throw new Error("u and v must be different points");
        const foot = C.nearestPoint(p, u, v);
        const dx = v.x - u.x, dy = v.y - u.y;
        const t = ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy);
        const projection = { x: u.x + dx * t, y: u.y + dy * t };
        const shortcut = C.sqDist(p, u) < 0.1;
        return {
          p: asPt(p), u: asPt(u), v: asPt(v),
          distanceToU: round(C.dist(p, u)),
          shortcutThreshold: round(Math.sqrt(0.1)),
          nearVertexShortcut: shortcut,
          coreFoot: asPt(foot),
          orthogonalProjection: asPt(projection),
          t: round(t),
          note: shortcut
            ? "p is within sqrt(0.1) of u, so the core returns p unchanged instead of the perpendicular foot; the page flags such a triangle as too thin."
            : "p is farther than sqrt(0.1) from u, so the core returns the ordinary perpendicular foot and the touch point is trustworthy.",
        };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Inradius Semiperimeter state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let readable = true;
  let A: Pt, B: Pt, Cc: Pt;
  try {
    A = readPoint(src.A, "A"); B = readPoint(src.B, "B"); Cc = readPoint(src.C, "C");
  } catch {
    readable = false;
    const fallback = C.start({});
    A = fallback.A; B = fallback.B; Cc = fallback.C;
  }
  const saved = { A: asPt(A), B: asPt(B), C: asPt(Cc) };
  const echo = {
    ...src,
    stateVersion,
    savedReadable: readable,
    saved,
    hint: src.hint === true,
    progress: num(src, "progress", 0),
    explored: src.explored === true,
    moves: num(src, "moves", 0),
  };
  const m = C.measurements({ A, B, C: Cc });
  if (m.degenerate) {
    return {
      ...echo, valid: false,
      note: "The saved corners are coincident or too thin for the core to construct an incenter. Drag a corner apart.",
    };
  }
  const rectangleArea = m.s * m.r;
  return {
    ...echo,
    valid: true,
    reading: {
      incenter: asPt(m.O),
      touchPoints: { D: asPt(m.D), E: asPt(m.E), F: asPt(m.F) },
      sides: { a_BC: round(m.a), b_CA: round(m.b), c_AB: round(m.c) },
      semiperimeter: round(m.s),
      inradius: round(m.r),
      triangleArea: round(m.area),
      rectangleArea: round(rectangleArea),
      areaEqualsSr: agree(m.area, rectangleArea),
      nearVertexShortcut: m.shortcut,
      swingMode: m.mode,
      pieceCount: m.pieces.length,
    },
    note:
      `Track.state saved the three corners, hint and animation progress. The core reads s ≈ ${round(m.s)}, ` +
      `r ≈ ${round(m.r)} and area ≈ ${round(m.area)}, and the s by r rectangle has area ≈ ${round(rectangleArea)} ` +
      `${agree(m.area, rectangleArea) ? "— they agree" : "— they differ here"}. ` +
      `The dissection is ${round(num(src, "progress", 0)) * 100}% of the way across. This is a demo: there is no win or loss.`,
  };
}
