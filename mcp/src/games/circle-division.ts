/*
 * run_game_logic actions and saved-position reader for Circle Division.
 *
 * Two draggable points A and C on a circle determine a chord AC. With D the
 * centre, E is the circle point on DM nearest the chord's midpoint M (the
 * middle of the shorter arc AC), B is the circle point on the line through D
 * parallel to AC, and Z is the other circle point on the line through E
 * parallel to BC. Then EZ is parallel to BC, and the band Z-B-C-E has exactly
 * the area fraction f of the circle that the shorter arc AC has of a turn:
 * band area = f * pi * R^2. An inscribed regular n-gon side gives f = 1/n;
 * the opening equilateral triangle (n = 3) gives exactly one third. The
 * article's heptagon remark is about ruler-and-compass constructibility, not
 * this drawing: here dragging the points to 360/7 degrees reaches 1/7.
 *
 * Every geometric point and fraction below comes from the game's real core
 * (circle-division/circle-division-core.js), copied into src/generated/cores/
 * at build time. The band's area is measured independently from the core's
 * points, as in porting/check-circle-division.mjs. See _shared.ts for the
 * shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-division"].CircleDivisionCore as any;

type Point = { x: number; y: number };

const r4 = (v: number): number => Math.round(v * 10000) / 10000;
/** Round a core/saved point to four decimals, keeping plain JSON. */
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r4(p.x), y: r4(p.y) }
    : null;

/** Accept the page's saved { x, y } and the tutor's [x, y]; else the opening handle. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = num(o, "x"); y = num(o, "y");
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite x and y`);
  }
  return { x, y };
}

/** Project a handle aim onto the circle; the core cannot project the centre. */
function circlePoint(v: unknown, label: string, fallback: Point): Point {
  const C = core();
  const p = readPoint(v, label, fallback);
  const q = C.project(p);
  if (!q) throw new Error(`"${label}" aims at the centre D: give a point off the centre`);
  return { x: q.x, y: q.y };
}

/**
 * The core needs distinct, non-opposite points: for a diameter the midpoint M
 * falls on the centre D and Compute() leaves the picture unchanged.
 */
function build(args: Json) {
  const C = core();
  const home = C.start();
  const state = C.start({
    A: circlePoint(args.A, "A", home.A),
    C: circlePoint(args.C, "C", home.C),
    names: args.names === true,
    hint: args.hint === true,
  });
  const g = C.construct(state);
  if (!g) {
    throw new Error(
      "A and C must be distinct and not opposite on the circle: the applet leaves the picture unchanged when their chord midpoint is the centre (a diameter).",
    );
  }
  return { state, g };
}

/**
 * Area of the band between the parallel chords EZ and BC, from the two chord
 * half-planes. A circle cap cut by a line h from the centre has area
 * R^2 acos(h/R) - h sqrt(R^2 - h^2). This is a second reading of the geometry,
 * so it can be checked against the core's arc fraction rather than copying it.
 */
function bandAreaFraction(g: any): number {
  const C = core();
  const R = C.R;
  const dx = g.Z.x - g.E.x, dy = g.Z.y - g.E.y;
  const len = Math.hypot(dx, dy);
  if (!(len >= 1e-12)) throw new Error("E and Z coincide, so there is no chord EZ");
  const nx = -dy / len, ny = dx / len;
  const s1 = nx * (g.E.x - C.CX) + ny * (g.E.y - C.CY);
  const s2 = nx * (g.B.x - C.CX) + ny * (g.B.y - C.CY);
  const cap = (h: number): number => {
    const t = Math.min(1, Math.max(0, h / R));
    return R * R * Math.acos(t) - h * Math.sqrt(Math.max(0, R * R - h * h));
  };
  const h1 = Math.abs(s1), h2 = Math.abs(s2);
  const area = s1 * s2 >= 0
    ? Math.abs(cap(h1) - cap(h2))
    : Math.PI * R * R - cap(h1) - cap(h2);
  return area / (Math.PI * R * R);
}

/** One consistent reading of a rebuilt, non-degenerate picture. */
function reading(state: any, g: any) {
  const C = core();
  const arcFraction: number = C.fractionFor(state);
  const bandFraction = bandAreaFraction(g);
  const circleArea = Math.PI * C.R * C.R;
  const simple: Array<[number, number]> = [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [2, 3]];
  const hit = simple.find(([a, b]) => Math.abs(arcFraction - a / b) < 1e-6);
  return {
    points: {
      A: pt(state.A), C: pt(state.C), D: pt(g.D), M: pt(g.M),
      E: pt(g.E), B: pt(g.B), Z: pt(g.Z), K: pt(g.K),
    },
    arcDegrees: r4(g.arcDegrees),
    arcFraction,
    bandAreaFraction: bandFraction,
    bandArea: bandFraction * circleArea,
    circleArea,
    equalsBandArea: Math.abs(arcFraction - bandFraction) < 1e-6,
    simpleFraction: hit ? `${hit[0]}/${hit[1]}` : null,
    note: `The shorter arc AC is ${r4(g.arcDegrees)} degrees, or ${(arcFraction * 100).toFixed(2)}% of a turn. The parallel chords EZ and BC fence off a band of ${(bandFraction * 100).toFixed(2)}% of the circle: band area = f * pi * R^2.`,
  };
}

export function actions(): GameActions {
  return {
    regular_side_band: {
      describe:
        "Put A and C at two neighbouring corners of an inscribed regular n-gon (n from 3 to 24, default 3: the opening equilateral triangle, which cuts off exactly one third) on the page's 400 x 250 board. Report the core's arc-AC fraction of a turn and an independent measurement of the chord band's area fraction: both are 1/n. n = 2 is refused because a diameter puts the chord midpoint on the centre and the applet stops. The page's heptagon remark is about ruler-and-compass constructibility: here the 1/7 band is reached just by putting the points at that angle.",
      args: '{ "n": 3 }',
      run: (args) => {
        const C = core();
        const n = num(args, "n", 3);
        if (!Number.isInteger(n) || n < 3 || n > 24) {
          throw new Error(`"n" must be a whole number from 3 to 24 (a diameter, n = 2, stops the construction), got ${JSON.stringify(args.n)}`);
        }
        // The opening orientation: A at 180+180/n, C at 180-180/n degrees.
        const base = Math.PI;
        const state = C.start({
          A: C.pointAt(base + Math.PI / n),
          C: C.pointAt(base - Math.PI / n),
        });
        const g = C.construct(state);
        if (!g) throw new Error(`the regular ${n}-gon side gave a degenerate construction; try another n`);
        const r = reading(state, g);
        return {
          n,
          targetFraction: 1 / n,
          ...r,
          matchesOneOverN: Math.abs(r.arcFraction - 1 / n) < 1e-9 && Math.abs(r.bandAreaFraction - 1 / n) < 1e-6,
          note: `${r.note} A side of a regular ${n}-gon spans 360/${n} degrees, 1/${n} of a turn, so the band is 1/${n} of the area.${n === 7 ? " The heptagon cannot be built with ruler and compass alone, but nothing stops these points from being dragged to 360/7 degrees." : ""}`,
        };
      },
    },
    band_from_points: {
      describe:
        "Given the two draggable points A and C (as [x, y] or { x, y } on the page's 400 x 250 board; omitting them uses the opening), report the core's construction points M, E, B, Z and K, the arc-AC fraction of a turn, and the measured band area fraction; a simple fraction such as 1/3, 1/4, 1/5 or 1/7 is named when one is hit. The heptagon mention in the article is about constructibility with ruler and compass, not about this digital construction, which can show the 1/7 band directly.",
      args: '{ "A": [160.81131818530648, 51.83411165285622], "C": [158.5, 196.88010851410843] }',
      run: (args) => {
        const { state, g } = build(args);
        return reading(state, g);
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circle Division state version ${stateVersion}`);
  }
  const C = core();
  const home = C.start();
  const rebuilt = C.start({
    A: circlePoint(state.A, "A", home.A),
    C: circlePoint(state.C, "C", home.C),
    names: state.names === true,
    hint: state.hint === true,
  });
  const g = C.construct(rebuilt);
  const saved = {
    A: pt(state.A as Point | null),
    C: pt(state.C as Point | null),
    D: pt(state.D as Point | null),
    E: pt(state.E as Point | null),
    B: pt(state.B as Point | null),
    Z: pt(state.Z as Point | null),
    arcDegrees: typeof state.arcDegrees === "number" ? r4(state.arcDegrees) : null,
    fraction: typeof state.fraction === "number" ? state.fraction : null,
    names: state.names === true,
    hint: state.hint === true,
  };
  const r = g ? reading(rebuilt, g) : null;
  return {
    stateVersion,
    ...saved,
    valid: !!g,
    reading: r,
    savedFractionAgrees: !!r && saved.fraction !== null && Math.abs(saved.fraction - r.arcFraction) < 1e-6,
    note: r
      ? `${r.note} Rebuilding from the saved A and C reproduces the picture on screen.`
      : "The saved A and C are the same point or opposite ends of a diameter, so the construction stops: there is no arc or band to measure.",
  };
}
