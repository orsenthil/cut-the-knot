/*
 * run_game_logic actions and saved-position reader for Euler 60.
 *
 * The real core is euler-60/euler-60-core.js, copied into src/generated/cores/
 * at build time. It transcribes GeoSDoub from the original Euler60 bytecode:
 * the centroid, circumcenter and orthocenter of a triangle, the Euler line
 * through O and H, and the check that an angle is within 0.01 radians of 60°.
 *
 * The facts the page teaches are all measured here, never asserted from a
 * formula: when a corner reads 60°, the Euler line crosses the two sides at
 * BP = BQ = PQ = (sum of those two sides)/3, the resulting triangle is
 * equilateral and the line is perpendicular to the angle's bisector; and
 * AP + CQ = PQ holds on the segments exactly when the two sides differ by no
 * more than a factor of two (1/2 <= ratio <= 2). The original page's Solution
 * 1 prints the slope of AH as 1/√1 where its own coordinates give 1/√3, which
 * is what makes AH perpendicular to BC. Coordinates are the applet's 400x300
 * board units, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["euler-60"].Euler60Core;

type Pt = { x: number; y: number };
type Corner = "A" | "B" | "C";
type Tri = Record<Corner, Pt>;

const DEG = 180 / Math.PI;
const NOTE =
  "At a 60° corner the Euler line (O to H) meets the two sides at equal distances t = (sum of those two sides)/3, so BP = BQ = PQ and triangle PBQ is equilateral, with the line perpendicular to the angle bisector. AP + CQ = PQ holds on the segments exactly when the two sides at that corner differ by no more than a factor of two (1/2 <= ratio <= 2). The original page's Solution 1 prints the slope of AH as 1/√1, but its own coordinates give 1/√3 — the value that makes AH perpendicular to BC.";

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const fin = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: any): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const deg = (rad: number): number => rad * DEG;
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function objectArgs(args: Json): Json {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object");
  }
  return args;
}

/** Tool arguments may give [x, y]; the page saves points as { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** Omit a corner to fall back to the applet's opening triangle. */
function readTriangle(C: any, args: Json): Tri {
  const seed = C.start({}) as Tri;
  return {
    A: args.A === undefined ? seed.A : readPoint(args.A, "A"),
    B: args.B === undefined ? seed.B : readPoint(args.B, "B"),
    C: args.C === undefined ? seed.C : readPoint(args.C, "C"),
  };
}

function readVertex(args: Json): Corner {
  const v = args.vertex === undefined ? "B" : String(args.vertex).toUpperCase();
  if (v !== "A" && v !== "B" && v !== "C") {
    throw new Error('"vertex" must be one of "A", "B" or "C"');
  }
  return v;
}

function readRatio(args: Json, key = "ratio", fallback = 1.2): number {
  const r = num(args, key, fallback);
  if (!(r > 0) || r > 1000) {
    throw new Error(`"${key}" must be a positive side ratio no greater than 1000`);
  }
  return r;
}

function readRatios(args: Json): number[] {
  const v = args.ratios;
  if (v === undefined || v === null) return [0.4, 0.5, 0.8, 1, 1.2, 2, 2.5];
  if (!Array.isArray(v) || v.length === 0 || v.length > 50) {
    throw new Error('"ratios" must be an array of 1 to 50 positive numbers');
  }
  return v.map((x, i) => {
    const n = Number(x);
    if (!Number.isFinite(n) || !(n > 0) || n > 1000) {
      throw new Error(`ratios[${i}] must be a positive number no greater than 1000`);
    }
    return n;
  });
}

/** Normalised dot of the Euler line with the bisector: ~0 means perpendicular. */
function bisectorDot(C: any, s: Tri, g: any): number | null {
  if (!g.lineVisible || !g.line || !g.sixty) return null;
  const name: Corner = g.sixty.name;
  const S = s[name];
  const keys = (["A", "B", "C"] as const).filter((k) => k !== name);
  const T = s[keys[0]], U = s[keys[1]];
  const dt = C.dist(S, T), du = C.dist(S, U);
  if (!(dt > 0) || !(du > 0)) return null;
  let bx = (T.x - S.x) / dt + (U.x - S.x) / du;
  let by = (T.y - S.y) / dt + (U.y - S.y) / du;
  const bl = Math.hypot(bx, by);
  const dx = g.line.q.x - g.line.p.x, dy = g.line.q.y - g.line.p.y;
  const dl = Math.hypot(dx, dy);
  if (!(bl > 0) || !(dl > 0)) return null;
  bx /= bl; by /= bl;
  return r6((dx * bx + dy * by) / dl);
}

/** Everything the core can say about one triangle. */
function reading(C: any, s: Tri) {
  const g = C.geometry(s);
  const c = g.finished ? C.cut(s, g.sixty.name) as any : null;
  const dot = bisectorDot(C, s, g);
  const sides: [number, number] | null = c && Number.isFinite(c.sides[0]) && Number.isFinite(c.sides[1])
    ? [c.sides[0], c.sides[1]] : null;
  const ratio = sides && sides[0] > 0 ? sides[1] / sides[0] : null;
  const shownRatio = fin(ratio);
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: {
      AB: fin(C.dist(s.A, s.B)),
      BC: fin(C.dist(s.B, s.C)),
      CA: fin(C.dist(s.C, s.A)),
    },
    anglesDeg: {
      A: fin(deg(g.angles.A)), B: fin(deg(g.angles.B)), C: fin(deg(g.angles.C)),
    },
    finished: g.finished === true,
    sixtyCorner: g.sixty
      ? { name: g.sixty.name, radians: fin(g.sixty.value), degrees: fin(deg(g.sixty.value)) }
      : null,
    centres: { centroid: pt(g.G), circumcenter: pt(g.O), orthocenter: pt(g.H) },
    eulerLine: {
      visible: g.lineVisible === true,
      from: pt(g.line && g.line.p),
      to: pt(g.line && g.line.q),
      bisectorDot: dot,
      perpendicularToBisector: dot === null ? null : near(dot, 0),
    },
    cut: c ? {
      at: c.name,
      P: pt(c.P), Q: pt(c.Q),
      BP: fin(c.BP), BQ: fin(c.BQ), PQ: fin(c.PQ),
      BP_eq_BQ_eq_PQ: near(c.BP, c.BQ) && near(c.BP, c.PQ),
      formula: "t = (sum of the two sides at the 60° corner) / 3",
      AP: fin(c.AP), CQ: fin(c.CQ),
      AP_plus_CQ: fin(c.AP + c.CQ),
      AP_plus_CQ_eq_PQ: near(c.AP + c.CQ, c.PQ),
      onSegments: c.onSegments === true,
      sidesFromCorner: sides ? sides.map(fin) : null,
      ratio: shownRatio,
      inDomain: shownRatio === null ? null : shownRatio >= 0.5 && shownRatio <= 2,
    } : null,
  };
}

export function actions(): GameActions {
  return {
    euler_line_cut: {
      describe:
        "Inspect a triangle for Euler 60. Pass corners A, B, C (each [x, y] or {x, y} on the 400x300 board, y down), or omit them to build one with a 60 degree corner at 'vertex' (A/B/C, default B) and 'ratio' (other side / fixed side, default 1.2). Reports the three angles, centroid/circumcenter/orthocenter, the Euler line and whether it is perpendicular to the angle bisector; at a 60 degree corner it reports BP = BQ = PQ = (sum of the two sides)/3, AP, CQ, whether AP + CQ = PQ, and whether the side ratio lies in 1/2 <= ratio <= 2. Notes the page's slope typo (1/√1 printed, 1/√3 correct).",
      args: '{ "vertex": "B", "ratio": 1.2 }',
      run: (args) => {
        const a = objectArgs(args);
        const C = core();
        const explicit = a.A !== undefined || a.B !== undefined || a.C !== undefined;
        const s = explicit
          ? readTriangle(C, a)
          : C.withSixty(C.start({}), readVertex(a), readRatio(a)) as Tri;
        return {
          builtFrom: explicit ? "given corners" : "60 degree preset",
          reading: reading(C, s),
          note: NOTE,
        };
      },
    },

    ratio_domain: {
      describe:
        "Sweep side ratios at a 60 degree corner to show where AP + CQ = PQ holds. For each ratio in 'ratios' (default [0.4, 0.5, 0.8, 1, 1.2, 2, 2.5]) the core builds a triangle with a 60 degree angle at 'vertex' (default B) and reports the cut t = (sum of the two sides)/3, AP, CQ, whether the cut points land on the segments, whether AP + CQ = PQ, and whether the Euler line is perpendicular to the bisector. The equality holds exactly for ratios in [1/2, 2]; at ratio 1 the triangle is equilateral and O = H, so there is no Euler line.",
      args: '{ "vertex": "B", "ratios": [0.4, 0.5, 1, 1.2, 2, 2.5] }',
      run: (args) => {
        const a = objectArgs(args);
        const C = core();
        const vertex = readVertex(a);
        const rows = readRatios(a).map((r) => {
          const s = C.withSixty(C.start({}), vertex, r) as Tri;
          const rd = reading(C, s);
          return {
            ratio: r6(r),
            cut: rd.cut,
            eulerLine: rd.eulerLine,
            AP_plus_CQ_eq_PQ: rd.cut ? rd.cut.AP_plus_CQ_eq_PQ : null,
            inDomain: rd.cut ? rd.cut.inDomain : null,
          };
        });
        return {
          vertex,
          domain: "1/2 <= ratio <= 2",
          ratios: rows,
          note: NOTE,
        };
      },
    },
  };
}

/** Track.state saves the three corners, the centre checkboxes and the board size. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Euler 60 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Euler 60 position must be an object");
  }
  const C = core();
  const s: Tri = {
    A: readPoint(state.A, "A"),
    B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"),
  };
  const rawShow = state.show && typeof state.show === "object" ? state.show as Json : {};
  return {
    stateVersion,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C),
      show: {
        centroid: rawShow.centroid === true,
        circumcenter: rawShow.circumcenter === true,
        orthocenter: rawShow.orthocenter === true,
      },
      width: fin(num(state, "width", 400)),
      height: fin(num(state, "height", 300)),
    },
    reading: reading(C, s),
    note:
      "Track.state saved the three corners, the three centre checkboxes and the 400 x 300 board. The core rebuilds the centroid, circumcenter and orthocenter, the three angles and the Euler line; when a corner reads 60 degrees it also reports where that line cuts the two sides and checks AP + CQ = PQ. " + NOTE,
  };
}
