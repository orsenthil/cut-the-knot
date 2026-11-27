/*
 * run_game_logic actions and saved-position reader for Cube Counting Ambiguity
 * (Cube7Cube8).
 *
 * The real core is cube7-cube8/cube7-cube8-core.js, copied into
 * src/generated/cores/ at build time. Its faces() is the applet's Draw loop:
 * a fixed set of 33 rhombi, painted in a fixed order. The three sliders change
 * only the view (slant, scale, opacity), never that set, so the same ink can be
 * grouped into seven cubes or into eight. In particular rhombus 16 is a side
 * face shared by two different diamonds. Everything below is measured by that
 * core; see _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

/** The applet's suggested canvas; faces() is measured at this size throughout. */
const W = 400;
const H = 300;

type Pt = [number, number];
type Range = { min: number; max: number; initial: number };
interface Settings { angle: number; n: number; trans: number }
interface Metrics { cx: number; cy: number; w: number; h: number; pixel: number; theta: number }
interface Colour { grey: number; alpha: number }
interface Face { pts: Pt[]; fill: Colour; nearEdge: Colour | null; farEdge: Colour | null }

/** The core is plain JS; name its shape here so all readings stay type-checked. */
interface Cube7Cube8 {
  RANGES: { angle: Range; n: Range; trans: Range };
  start(options?: Partial<Settings>): Settings;
  clamp(key: keyof Settings, value: unknown, fallback: number): number;
  withOption(state: Settings, key: keyof Settings, value: number): Settings;
  palette(trans: number): Record<string, Colour>;
  metrics(state: Settings, width: number, height: number): Metrics;
  faces(state: Settings, width: number, height: number): Face[];
  position(state: Settings): Settings;
}

const core = (): Cube7Cube8 =>
  cores["cube7-cube8"].Cube7Cube8Core as unknown as Cube7Cube8;

const round = (v: number, dp = 4): number => {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
};

/** A settings object may be omitted; every supplied slider must be a finite number. */
function settingsFrom(src: Json, fallback: Settings): Settings {
  return {
    angle: num(src, "angle", fallback.angle),
    n: num(src, "n", fallback.n),
    trans: num(src, "trans", fallback.trans),
  };
}

function asObject(v: unknown): Json {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}

const metricOut = (m: Metrics) => ({
  cx: m.cx,
  cy: m.cy,
  w: round(m.w),
  h: round(m.h),
  pixel: round(m.pixel),
  thetaDeg: round((m.theta * 180) / Math.PI, 2),
});

/**
 * Classify the core's 33 faces the way the logic test does: a rhombus whose two
 * edges out of its first corner are both unit diagonal steps is a diamond (a
 * top or bottom); the others are side faces. Lattice keys then find the side
 * face that is shared by two diamonds in different readings of the pile.
 */
function geometryReading(C: Cube7Cube8, s: Settings) {
  const fs = C.faces(s, W, H);
  const m = C.metrics(s, W, H);
  const unit = (p: Pt): Pt => [
    Math.round(((p[0] - m.cx) / m.w) * 2),
    Math.round(((p[1] - m.cy) / m.h) * 2),
  ];
  const setKey = (pts: Pt[]): string =>
    pts.map(unit).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((p) => p.join(",")).join("|");

  const diamonds: number[] = [];
  const sides: number[] = [];
  fs.forEach((f, i) => {
    const [a, b, , c] = f.pts;
    const ab: Pt = [(b[0] - a[0]) / m.w, (b[1] - a[1]) / m.h];
    const ac: Pt = [(c[0] - a[0]) / m.w, (c[1] - a[1]) / m.h];
    const near = (v: number): boolean => Math.abs(Math.abs(v) - 1) < 0.01;
    if (near(ab[0]) && near(ab[1]) && near(ac[0]) && near(ac[1])) diamonds.push(i);
    else sides.push(i);
  });

  const sideKeys = new Map<string, number>();
  for (const i of sides) sideKeys.set(setKey(fs[i].pts), i);
  const diamondAt = (i: number): Pt => {
    const [a, , d] = fs[i].pts;
    return [
      Math.round(((a[0] + d[0]) / 2 - m.cx) / m.w),
      Math.round(((a[1] + d[1]) / 2 - m.cy) / m.h),
    ];
  };
  const ptAt = (x: number, y: number): Pt => [m.cx + x * m.w, m.cy + y * m.h];
  const leftBelow = (u: number, v: number) =>
    setKey([ptAt(u - 1, v), ptAt(u, v + 1), ptAt(u, v + 3), ptAt(u - 1, v + 2)]);
  const rightAbove = (u: number, v: number) =>
    setKey([ptAt(u + 1, v), ptAt(u, v - 1), ptAt(u, v - 3), ptAt(u + 1, v - 2)]);

  const below = sideKeys.get(leftBelow(-1, 4));
  const above = sideKeys.get(rightAbove(-2, 7));
  const belowDiamond = diamonds.find((i) => diamondAt(i).join() === "-1,4");
  const aboveDiamond = diamonds.find((i) => diamondAt(i).join() === "-2,7");
  const shared = below !== undefined ? fs[below] : null;

  return {
    faceCount: fs.length,
    diamondCount: diamonds.length,
    sideCount: sides.length,
    metrics: metricOut(m),
    sharedFace: {
      index: below ?? null,
      agreesWithSecondReading: below !== undefined && below === above,
      points: shared ? shared.pts.map((p) => [round(p[0]), round(p[1])]) : null,
      latticePoints: shared ? shared.pts.map(unit) : null,
      readingBelow: {
        rhombus: below ?? null,
        diamondIndex: belowDiamond ?? null,
        diamondCentre: belowDiamond !== undefined ? diamondAt(belowDiamond) : null,
        say: "a left side face hanging below the diamond centred at lattice (-1, 4)",
      },
      readingAbove: {
        rhombus: above ?? null,
        diamondIndex: aboveDiamond ?? null,
        diamondCentre: aboveDiamond !== undefined ? diamondAt(aboveDiamond) : null,
        say: "a right side face rising above the diamond centred at lattice (-2, 7)",
      },
    },
  };
}

export function actions(): GameActions {
  const DEFAULTS: Settings = { angle: 45, n: 2, trans: 0 };
  return {
    picture: {
      describe:
        "Draw the fixed pile of cubes with the applet's three sliders: slant `angle` (15..60 degrees), `n` cube widths across (2..10) and fading `trans` (-127..127). Reports the 33 rhombi the core paints, how many are diamonds (tops or bottoms) and sides, and the shared rhombus 16 that is a side face of two different diamonds (the ones centred at lattice (-1,4) and (-2,7)) — grouping it one way gives one cube, the other shifts the cubes and changes the count by one. Omitted sliders use the opening view 45/2/0; the core clamps values outside the ranges.",
      args: '{ "angle": 45, "n": 2, "trans": 0 }',
      run: (args) => {
        const C = core();
        const requested = settingsFrom(args, DEFAULTS);
        const s = C.start(requested);
        return {
          requested,
          settings: s,
          canvas: { width: W, height: H },
          slidersWereClamped:
            requested.angle !== s.angle || requested.n !== s.n || requested.trans !== s.trans,
          ...geometryReading(C, s),
          note: "The core always paints the same 33 rhombi in the same order. A rhombus can belong to two different cubes depending on which diamond you group it with, which is why this one drawing can be counted as seven or eight.",
        };
      },
    },
    compare_views: {
      describe:
        "Compare two slider settings to see what the three sliders do. Each of `from` and `to` is an optional {angle, n, trans} object (defaults 45/2/0). Reports the projection width, height and scale, the face alphas, and checks that both settings draw the same 33 rhombi in the same order with the same greys: slant, size and fading change the view, never the face count or the answer.",
      args: '{ "from": { "angle": 45, "n": 2, "trans": 0 }, "to": { "angle": 60, "n": 10, "trans": 127 } }',
      run: (args) => {
        const C = core();
        const from = C.start(settingsFrom(asObject(args.from), DEFAULTS));
        const to = C.start(settingsFrom(asObject(args.to), DEFAULTS));
        const fa = C.faces(from, W, H);
        const ta = C.faces(to, W, H);
        const sameOrder =
          fa.length === ta.length &&
          fa.every((f, i) => f.fill.grey === ta[i].fill.grey);
        const sameCoordinates =
          fa.length === ta.length &&
          fa.every((f, i) => f.pts.every((p, j) => p[0] === ta[i].pts[j][0] && p[1] === ta[i].pts[j][1]));
        const alphaChanges = fa.length === ta.length
          ? fa.map((f, i) => ({ grey: f.fill.grey, from: round(f.fill.alpha / 255, 3), to: round(ta[i].fill.alpha / 255, 3) }))
              .filter((a) => a.from !== a.to)
          : [];
        return {
          from,
          to,
          metrics: { from: metricOut(C.metrics(from, W, H)), to: metricOut(C.metrics(to, W, H)) },
          faceCount: { from: fa.length, to: ta.length },
          sameFaceCount: fa.length === ta.length,
          sameGreyOrder: sameOrder,
          sameCoordinates,
          alphaChanges,
          note: "A larger slant narrows and steepens the faces, larger n shrinks the scale, and fading changes only opacities. None of them adds, removes or reorders a rhombus, so the number of cubes you see is a choice of reading, not a change in the drawing.",
        };
      },
    },
  };
}

/** The three slider values Track.state saved, re-read with the same core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Cube 7/Cube 8 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Cube 7/Cube 8 position must be an object");
  }
  const C = core();
  const saved: Settings = {
    angle: num(state, "angle", C.RANGES.angle.initial),
    n: num(state, "n", C.RANGES.n.initial),
    trans: num(state, "trans", C.RANGES.trans.initial),
  };
  const s = C.start(saved);
  return {
    stateVersion,
    saved,
    effective: s,
    savedMatchesCore: saved.angle === s.angle && saved.n === s.n && saved.trans === s.trans,
    coreReading: geometryReading(C, s),
    note: "Track.state saves the three slider values only. The core rebuilds the same 33-rhombus picture from them, so the reading shows the projection metrics and finds the rhombus that carries the two cube counts even when nothing on the page is won or lost.",
  };
}
