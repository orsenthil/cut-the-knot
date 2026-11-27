/*
 * run_game_logic actions and saved-position reader for Ellipse Focal.
 *
 * The real core is ellipse-focal/ellipse-focal-core.js, copied into
 * src/generated/cores/ at build time. It keeps four draggable rectangle
 * corners and a point P on the inscribed ellipse. Its Compute (analyse) puts
 * the two foci at c = sqrt(a^2 - b^2) from the centre on the longer axis and
 * lays out a broken bar whose two pieces have exactly the lengths PF and PF'.
 * This module only measures that core: the constancy of PF + PF', the foci,
 * and the circle case a = b where the foci coincide. The sibling Ellipse
 * Focus & Directrix measures PF / PD against a directrix line instead.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Geometry = { center: Point; A: number; B: number };
type Bar = { start: Point; join: Point; end: Point };
type Analysis = {
  g: Geometry; foci: Point[]; d1: number; d2: number; sum: number;
  horizontal: boolean; bar: Bar; constant: number;
};
type State = { corners: Point[]; p: Point };

interface EllipseFocal {
  WIDTH: number; HEIGHT: number; MARGIN: number; REACH: number;
  start(): State;
  geometry(state: State): Geometry;
  ellipseAt(g: Geometry, t: number): Point;
  foci(g: Geometry): Point[] | null;
  analyse(state: State): Analysis | null;
  describe(state: State): string;
  dist(p: Point, q: Point): number;
}

const core = (): EllipseFocal =>
  cores["ellipse-focal"].EllipseFocalCore as unknown as EllipseFocal;
const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

/** A board point, either [x, y] or { x, y }, with finite coordinates. */
function readPoint(value: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Positive half-axes, defaulting to the applet's opening 100 by 75 rectangle. */
function readAxes(args: Json): { a: number; b: number } {
  const g = core().geometry(core().start());
  const a = num(args, "a", Math.abs(g.A));
  const b = num(args, "b", Math.abs(g.B));
  if (!(a > 0) || !(b > 0)) throw new Error('"a" and "b" must be positive half-axes');
  return { a, b };
}

/** The four corners of the axis-aligned rectangle whose inscribed ellipse this is. */
function rectangle(cx: number, cy: number, a: number, b: number): Point[] {
  return [
    { x: cx - a, y: cy + b }, { x: cx + a, y: cy + b },
    { x: cx + a, y: cy - b }, { x: cx - a, y: cy - b },
  ];
}

function stateFor(cx: number, cy: number, a: number, b: number, p: Point): State {
  return { corners: rectangle(cx, cy, a, b), p };
}

/** A list of (a,b) half-axis pairs, accepting [a,b] or { a, b } entries. */
function readPairs(args: Json): Array<[number, number]> {
  const raw = args.pairs;
  if (raw === undefined || raw === null) return [[96, 75], [75, 96], [80, 80]];
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) {
    throw new Error('"pairs" must be an array of 1 to 8 half-axis pairs');
  }
  return raw.map((entry, i) => {
    let a = NaN, b = NaN;
    if (Array.isArray(entry) && entry.length === 2) {
      a = Number(entry[0]); b = Number(entry[1]);
    } else if (entry && typeof entry === "object") {
      const o = entry as Json;
      a = Number(o.a); b = Number(o.b);
    }
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      throw new Error(`pairs[${i}] must be positive [a, b] or { "a": ..., "b": ... }`);
    }
    return [a, b] as [number, number];
  });
}

export function actions(): GameActions {
  return {
    focal_sum: {
      describe:
        "For an ellipse with positive half-axes a and b in a rectangle centred at (cx, cy), sample P equally often around the curve and run the core's Foci and Compute at each point. Reports PF, PF', their sum against the constant 2*max(a,b), and the broken bar whose two coloured pieces have exactly those lengths. This is the two-foci picture; the sibling Ellipse Focus & Directrix instead measures the ratio PF/PD to a directrix line.",
      args: '{ "a": 96, "b": 75, "samples": 6 }',
      run: (args) => {
        const C = core();
        const { a, b } = readAxes(args);
        const g0 = C.geometry(C.start());
        const cx = num(args, "cx", g0.center.x);
        const cy = num(args, "cy", g0.center.y);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
          throw new Error('"cx" and "cy" must be finite');
        }
        const samples = Math.trunc(num(args, "samples", 6));
        if (samples < 2 || samples > 64) throw new Error('"samples" must be a whole number from 2 to 64');

        const corners = rectangle(cx, cy, a, b);
        const g = C.geometry({ corners, p: { x: cx + a, y: cy } });
        const f = C.foci(g);
        if (!f) throw new Error("the core could not place the foci for these axes");
        const constant = 2 * Math.max(Math.abs(g.A), Math.abs(g.B));
        const rows: Array<Record<string, unknown>> = [];
        let worst = 0;
        let firstBar: Bar | null = null;
        for (let i = 0; i < samples; i++) {
          const t = (2 * Math.PI * i) / samples;
          const p = C.ellipseAt(g, t);
          const m = C.analyse({ corners, p });
          if (!m) throw new Error("the core could not measure a sampled point");
          worst = Math.max(worst, Math.abs(m.sum - constant));
          if (i === 0) firstBar = m.bar;
          rows.push({
            degrees: round((t * 180) / Math.PI),
            P: pt(p),
            PF: round(m.d1),
            PFprime: round(m.d2),
            sum: round(m.sum),
          });
        }
        return {
          a, b, center: pt(g.center),
          foci: f.map(pt),
          c: round(C.dist(f[0], g.center)),
          longerAxis: Math.abs(g.A) > Math.abs(g.B) ? "horizontal"
            : Math.abs(g.B) > Math.abs(g.A) ? "vertical" : "circle (a = b)",
          constant: round(constant),
          sampledPoints: rows,
          brokenBar: firstBar
            ? { start: pt(firstBar.start), join: pt(firstBar.join), end: pt(firstBar.end) }
            : null,
          maxSumError: Number(worst.toExponential(3)),
          sumIsConstant: worst < 1e-7,
          note:
            "Ellipse Focal is the sum picture: the two foci sit c = sqrt(a^2 - b^2) from the centre on the longer axis, and the core's broken bar repeats PF and PF' as its two pieces. As P moves round the curve the sum stays at 2*max(a,b). Its sibling Ellipse Focus & Directrix draws a directrix line and fixes PF/PD = e < 1 instead; both describe the same ellipse, but this applet measures the sum of the two focal distances.",
        };
      },
    },

    foci_and_circle: {
      describe:
        "For one or more (a,b) half-axis pairs, use the core's Foci to place the two focal points and report c = sqrt(a^2 - b^2), the axis they lie on, and the constant focal sum. When a = b the foci coincide at the centre, the curve is a circle and the sum is its diameter 2a. Accepts pairs as [a,b] or { a, b }, up to eight of them.",
      args: '{ "pairs": [[96, 75], [75, 96], [80, 80]] }',
      run: (args) => {
        const C = core();
        const pairs = readPairs(args);
        const g0 = C.geometry(C.start());
        const rows = pairs.map(([a, b]) => {
          const corners = rectangle(g0.center.x, g0.center.y, a, b);
          const g = C.geometry({ corners, p: { x: g0.center.x + a, y: g0.center.y } });
          const f = C.foci(g);
          const circle = a === b;
          return {
            a, b,
            c: round(Math.sqrt(Math.abs(a * a - b * b))),
            foci: f ? f.map(pt) : null,
            axis: a > b ? "horizontal" : b > a ? "vertical" : "coincident at the centre",
            circleCase: circle,
            focalSum: round(2 * Math.max(a, b)),
            meaning: circle
              ? "circle of radius a: both foci are the centre, so PF + PF' = 2a, the diameter"
              : `ellipse with focal distance c = sqrt(a^2 - b^2) and focal sum ${round(2 * Math.max(a, b))}`,
          };
        });
        return {
          pairs: rows,
          note:
            "The foci always lie on the longer half-axis, at distance c = sqrt(a^2 - b^2) from the centre (sqrt(b^2 - a^2) when b > a). As a approaches b, c approaches zero: the two foci merge, the ellipse becomes a circle, and the two-foci sum degenerates to the diameter. This is the focus-sum characterisation used on this page, not the focus-directrix ratio of the sibling applet.",
        };
      },
    },
  };
}

/** The saved corners and P, plus a fresh reading of the core on that position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Ellipse Focal state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Ellipse Focal position must be an object");
  }
  const C = core();
  try {
    const raw = state.corners;
    if (!Array.isArray(raw) || raw.length !== 4) {
      throw new Error('"corners" must be an array of four points');
    }
    const corners = raw.map((p, i) => readPoint(p, `corners[${i}]`));
    const p = readPoint(state.p, "p");
    const here: State = { corners, p };

    const g = C.geometry(here);
    const f = C.foci(g);
    const a = C.analyse(here);
    return {
      stateVersion,
      valid: true,
      saved: { corners: corners.map(pt), p: pt(p) },
      geometry: { center: pt(g.center), A: round(g.A), B: round(g.B) },
      foci: a ? a.foci.map(pt) : f ? f.map(pt) : null,
      c: f ? round(C.dist(f[0], g.center)) : null,
      focalDistances: a
        ? { PF: round(a.d1), PFprime: round(a.d2), sum: round(a.sum), constant: round(a.constant) }
        : null,
      sumMatchesConstant: a ? Math.abs(a.sum - a.constant) < 1e-6 : null,
      bar: a
        ? { start: pt(a.bar.start), join: pt(a.bar.join), end: pt(a.bar.end), horizontal: a.horizontal }
        : null,
      circleCase: Math.abs(Math.abs(g.A) - Math.abs(g.B)) < 1e-9,
      status: C.describe(here),
      note: a
        ? "Track.state saved the four rectangle corners and the point P. The core rebuilds the centre and half-axes from those corners, places the foci at c = sqrt(a^2 - b^2) on the longer axis, and measures PF + PF'; for a point on the curve the sum equals 2*max(a,b), so the broken bar's two pieces always total the same length."
        : "The saved rectangle is too small for the core to place usable foci; the focal distances cannot be measured here.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs four finite rectangle corners and a finite point P.",
    };
  }
}
