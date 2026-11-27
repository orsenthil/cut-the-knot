/*
 * run_game_logic actions and saved-position reader for Four Incircles.
 *
 * The real core is four-incircles/four-incircles-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Apex A stands above a horizontal base holding B, C, D, E in that order. The
 * cevians AC and AD cut triangle ABE into three level-1 triangles (ABC, ACD,
 * ADE), while pairs of base points give the two level-2 triangles (ABD, ACE)
 * and the whole triangle ABE at level 3. With g(X) = (AX + signed offset of X
 * from the foot of the altitude)/h, the core's Heron inradius of A,X,Y is
 * h/2 * (1 - g(X)/g(Y)). Hence both equalities in Tabov's Five Incircles
 * Theorem reduce to the single numerator g_C*g_D - g_B*g_E, so the outer
 * level-1 circles match exactly when the two level-2 circles do.
 *
 * The board is the page's 400 x 300 view (y down); coordinates are board units.
 * This is the cevian fan, NOT the unrelated applet FourIncirclesInTriangle,
 * an equilateral sangaku with answer l = x(sqrt(21) - 3)/4. It is an
 * illustration (kind: demo): no win or loss, only exploration. Track.state
 * saves the apex, the four base points, the two level radii and a matched flag.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type State = {
  n: number; width: number; height: number; left: number; right: number; baseY: number;
  apex: Pt; points: Pt[]; showNames: boolean;
};
type Core = {
  N: number; NAMES: string[]; MATCH: number; WIDTH: number; HEIGHT: number;
  distance(p: Pt, q: Pt): number;
  clamp(v: number, lo: number, hi: number): number;
  foot(p: Pt, a: Pt, b: Pt): Pt;
  incircle(a: Pt, b: Pt, c: Pt): Circle;
  start(options?: Json): State;
  circles(s: State, level: number): Circle[];
  radii(s: State, level: number): number[];
  spread(values: number[]): number;
  matched(s: State, tolerance?: number): boolean;
  visibleLevels(s: State): number[];
  makeEqual(s: State, ratio: number): State;
  position(s: State): Json;
};

const core = (): Core =>
  cores["four-incircles"].FourIncirclesCore as unknown as Core;

const EPS = 1e-10;
const TOL = 1e-7;
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Keep the sign and size of a near-zero residual rather than printing 0. */
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : round(v, 9);
const ptOut = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) } : null;
const close = (a: number, b: number, scale = 1): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= TOL * Math.max(1, scale);

/** A point as [x, y] or { x, y } with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/**
 * A base point: a bare number is its board x on the base line; [x, y] and
 * { x, y } are accepted too, with y ignored just as the page projects a drag
 * onto the base line.
 */
function readBaseX(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "number" || typeof raw === "string") {
    const x = Number(raw);
    if (!Number.isFinite(x)) throw new Error(`argument "${label}" must be a finite board x`);
    return x;
  }
  return readPoint(raw, label, { x: fallback, y: 0 }).x;
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

function readTolerance(C: Core, args: Json): number {
  const t = num(args, "tolerance", C.MATCH);
  if (t < 0) throw new Error('argument "tolerance" must be non-negative');
  return t;
}

/** A real core state: board, apex and four ordered base points, as the page draws them. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with apex A and base points B, C, D, E");
  }
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width >= 40) || !(width <= 2000) || !(height >= 40) || !(height <= 2000)) {
    throw new Error("width and height must be between 40 and 2000 board units");
  }
  let s = C.start({ width, height, showNames: readBool(args, "showNames", false) });
  const apex = readPoint(args.A, "A", s.apex);
  s = {
    ...s,
    apex: { x: C.clamp(apex.x, 3, s.width - 3), y: C.clamp(apex.y, 3, s.height - 3) },
  };
  const xs = C.NAMES.map((name, i) =>
    C.clamp(readBaseX(args[name], name, s.points[i].x), 3, s.width - 3));
  for (let i = 1; i < xs.length; i++) {
    if (!(xs[i] > xs[i - 1])) {
      throw new Error(
        `base points must be strictly in order B < C < D < E; ${C.NAMES[i]} (x=${xs[i]}) ` +
        `is not to the right of ${C.NAMES[i - 1]} (x=${xs[i - 1]})`,
      );
    }
  }
  s = { ...s, points: xs.map((x) => ({ x, y: s.baseY })) };
  if (!(s.baseY - s.apex.y > EPS)) {
    throw new Error("apex A must be above the base (h = baseY - A.y > 0) for the inradius formula");
  }
  if (args.ratio !== undefined && args.ratio !== null) {
    const ratio = num(args, "ratio");
    if (!(ratio > 0)) throw new Error('argument "ratio" must be positive');
    // The page's "Make outer circles match" button, run by the real core.
    s = C.makeEqual(s, ratio);
  }
  return s;
}

type Reading = ReturnType<typeof measure>;

/** Every circle, semiperimeter residual and equality test, measured on the core. */
function measure(C: Core, s: State, tolerance: number) {
  const h = s.baseY - s.apex.y;
  const footP = C.foot(s.apex, { x: s.left, y: s.baseY }, { x: s.right, y: s.baseY });
  const g = s.points.map((p) => (C.distance(s.apex, p) + (p.x - footP.x)) / h);
  const scale = Math.max(1, h, ...s.points.map((p) => C.distance(s.apex, p)));

  const specs: Array<{ level: number; labels: string[]; spans: Array<[number, number]> }> = [
    { level: 1, labels: ["ABC", "ACD", "ADE"], spans: [[0, 1], [1, 2], [2, 3]] },
    { level: 2, labels: ["ABD", "ACE"], spans: [[0, 2], [1, 3]] },
    { level: 3, labels: ["ABE"], spans: [[0, 3]] },
  ];
  const residuals: number[] = [];
  const circles = specs.map((spec) => {
    const drawn = C.circles(s, spec.level);
    return spec.labels.map((label, k) => {
      const [i, j] = spec.spans[k];
      const formula = h / 2 * (1 - g[i] / g[j]);
      residuals.push(drawn[k].radius - formula);
      return {
        triangle: label,
        base: `${C.NAMES[i]}${C.NAMES[j]}`,
        level: spec.level,
        center: ptOut(drawn[k].center),
        radius: round(drawn[k].radius),
        formulaRadius: round(formula),
        formulaResidual: sig(drawn[k].radius - formula),
        gLeft: round(g[i], 9),
        gRight: round(g[j], 9),
      };
    });
  });

  const r1 = C.radii(s, 1), r2 = C.radii(s, 2), r3 = C.radii(s, 3);
  const outerDiff = r1[0] - r1[2];             // r(ABC) - r(ADE)
  const innerDiff = r2[0] - r2[1];             // r(ABD) - r(ACE)
  const numerator = g[1] * g[2] - g[0] * g[3]; // g_C*g_D - g_B*g_E, shared by both tests
  const predictedOuter = h / 2 * numerator / (g[1] * g[3]);
  const predictedInner = h / 2 * numerator / (g[2] * g[3]);
  const outerEqual = close(outerDiff, 0, scale);
  const innerEqual = close(innerDiff, 0, scale);
  const allLevel1Equal = close(r1[0], r1[1], scale) && close(r1[1], r1[2], scale);
  const gRatios = [g[1] / g[0], g[2] / g[1], g[3] / g[2]];
  const gpSpread = Math.max(...gRatios.map((q) => Math.abs(q - gRatios[0])));

  return {
    board: { width: s.width, height: s.height },
    apex: ptOut(s.apex),
    altitudeFoot: ptOut(footP),
    height: round(h),
    basePoints: C.NAMES.map((name, i) => ({ name, x: round(s.points[i].x), y: round(s.points[i].y) })),
    g: g.map((v) => round(v, 9)),
    gRatios: gRatios.map((v) => round(v, 9)),
    circles: {
      level1: circles[0],
      level2: circles[1],
      level3: circles[2],
    },
    radii: {
      level1: r1.map((v) => round(v)),
      level2: r2.map((v) => round(v)),
      level3: r3.map((v) => round(v)),
    },
    semiperimeter: {
      identity: "r(A,X,Y) = h/2 * (1 - g(X)/g(Y)),  g(X) = (AX + signed offset from the foot)/h",
      residuals: residuals.map(sig),
      maxResidual: sig(Math.max(...residuals.map(Math.abs))),
      holds: residuals.every((e) => Math.abs(e) <= TOL * scale),
    },
    theorem: {
      statement: "r(ABC) = r(ADE)  iff  r(ABD) = r(ACE)  (Tabov's Five Incircles Theorem)",
      outer: {
        pair: ["ABC", "ADE"], radii: [round(r1[0]), round(r1[2])],
        difference: sig(outerDiff),
        differenceIdentity: "h/2 * (g_C*g_D - g_B*g_E) / (g_C*g_E)",
        predicted: sig(predictedOuter), equal: outerEqual,
      },
      inner: {
        pair: ["ABD", "ACE"], radii: [round(r2[0]), round(r2[1])],
        difference: sig(innerDiff),
        differenceIdentity: "h/2 * (g_C*g_D - g_B*g_E) / (g_D*g_E)",
        predicted: sig(predictedInner), equal: innerEqual,
      },
      sharedNumerator: sig(numerator),
      sharedNumeratorIdentity: "g_C*g_D - g_B*g_E",
      iffHolds: outerEqual === innerEqual,
      demirB: {
        statement: "all three level-1 circles equal => the two level-2 circles equal",
        allLevel1Equal,
        geometricProgression: close(gpSpread, 0, scale),
        gRatioSpread: sig(gpSpread),
        holds: !allLevel1Equal || innerEqual,
      },
      appletMatched: C.matched(s, tolerance),
      visibleLevels: C.visibleLevels(s),
      tolerance,
    },
  };
}

export function actions(): GameActions {
  return {
    cevian_incircles: {
      describe:
        "Place apex A as [x, y] (default (133, 60)) and the four base points B, C, D, E in order, each as [x, y], { x, y } or a bare board x (y is forced onto the base line); omit any for the opening diagram. Optional ratio runs the core's 'Make outer circles match' placement, and width/height/showNames/tolerance set the 400 x 300 board, labels and the applet's one-pixel tolerance. Runs the real core and reports all six incircles (ABC, ACD, ADE at level 1; ABD, ACE at level 2; ABE at level 3) with centres and radii, the g values, and each radius checked against the semiperimeter identity r = h/2 (1 - g(left)/g(right)); base points must be strictly in order and A above the base. This is the cevian fan of the Five Incircles Theorem, not the unrelated FourIncirclesInTriangle equilateral sangaku.",
      args: '{ "A": [133, 60], "B": 55, "C": 154.33333333333331, "D": 255.66666666666666, "E": 349 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const m = measure(C, s, readTolerance(C, args));
        return {
          ...m,
          note:
            `With A at (${m.apex!.x}, ${m.apex!.y}), h = ${m.height} and altitude foot ` +
            `(${m.altitudeFoot!.x}, ${m.altitudeFoot!.y}), the core's Heron radii are ABC ${m.radii.level1[0]}, ` +
            `ACD ${m.radii.level1[1]}, ADE ${m.radii.level1[2]}, ABD ${m.radii.level2[0]}, ` +
            `ACE ${m.radii.level2[1]} and ABE ${m.radii.level3[0]}. The g values at B, C, D, E are ` +
            `${m.g.join(", ")}, and every radius matches h/2 (1 - g_left/g_right) with maximum residual ` +
            `${m.semiperimeter.maxResidual}. These are the cevian-triangle incircles; the applet ` +
            `FourIncirclesInTriangle is a different equilateral sangaku, not this picture.`,
        };
      },
    },

    five_incircles_theorem: {
      describe:
        "For the same fan and arguments as cevian_incircles (pass ratio = 1.6 to see the matched configuration the 'Make outer circles match' button makes), test Tabov's Five Incircles Theorem: the outer level-1 incircles of ABC and ADE are equal if and only if the level-2 incircles of ABD and ACE are. Both radius differences reduce to the same numerator g_C*g_D - g_B*g_E over positive denominators g_C*g_E and g_D*g_E, so they vanish together; Demir's statement (B), that three equal level-1 circles force the level-2 pair to match, is checked as well. The applet's one-pixel matched flag is reported separately from the exact equalities.",
      args: '{ "ratio": 1.6 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const m = measure(C, s, readTolerance(C, args));
        const t = m.theorem;
        return {
          board: m.board, apex: m.apex, basePoints: m.basePoints, g: m.g,
          circles: m.circles, radii: m.radii, theorem: t,
          note:
            `r(ABC) - r(ADE) = ${t.outer.difference} and r(ABD) - r(ACE) = ${t.inner.difference}. ` +
            `The first is h/2 * N/(g_C*g_E) and the second h/2 * N/(g_D*g_E) with the same numerator ` +
            `N = g_C*g_D - g_B*g_E = ${t.sharedNumerator}, which is why the two equalities hold together ` +
            `(outer ${t.outer.equal}, inner ${t.inner.equal}, iff ${t.iffHolds}). Here all three level-1 ` +
            `circles are ${t.demirB.allLevel1Equal ? "equal" : "not all equal"}; Demir's (B) holds: ` +
            `${t.demirB.holds}, and the applet's one-pixel matched flag is ${t.appletMatched}. ` +
            `This is an illustration, so there is no win or loss.`,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Incircles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Incircles position must be an object");
  }
  const C = core();
  const seed = C.start({});
  const saved: Json = {
    apex: ptOut(state.apex === undefined || state.apex === null
      ? null : readPoint(state.apex, "saved apex")),
    points: Array.isArray(state.points)
      ? state.points.map((p) => ptOut(readPoint(p, "saved base point"))) : null,
    level1: Array.isArray(state.level1) ? state.level1.map((v) => Number(v)) : null,
    level2: Array.isArray(state.level2) ? state.level2.map((v) => Number(v)) : null,
    matched: typeof state.matched === "boolean" ? state.matched : null,
  };

  // The saved apex and base points are authoritative; the board is the page's
  // fixed viewBox (400 x 300), so the core's opening state supplies the rest.
  let s: State = seed;
  let savedReadable = true;
  try {
    const apex = readPoint(state.apex, "saved apex", seed.apex);
    if (!Array.isArray(state.points) || state.points.length !== C.N) {
      throw new Error("saved points must be an array of four base points");
    }
    const points = state.points.map((p, i) => {
      const q = readPoint(p, `saved point ${i}`, seed.points[i]);
      return {
        x: C.clamp(q.x, 3, seed.width - 3),
        y: seed.baseY, // the page always saves base points on the base line
      };
    });
    s = {
      ...seed,
      apex: { x: C.clamp(apex.x, 3, seed.width - 3), y: C.clamp(apex.y, 3, seed.height - 3) },
      points,
    };
  } catch {
    savedReadable = false;
  }

  if (!savedReadable || !(s.baseY - s.apex.y > EPS)) {
    return {
      ...state,
      stateVersion, saved, savedReadable,
      valid: false,
      note: !savedReadable
        ? "The saved apex or base points could not be read as five board points, so no circles can be measured."
        : "The saved apex is not above the base line (h <= 0), where the g-based inradius formula does not apply.",
    };
  }

  const m = measure(C, s, C.MATCH);
  const differences: Array<{ field: string; saved: number; core: number; diff: number }> = [];
  const compare = (field: string, a: unknown, b: number): void => {
    const n = Number(a);
    if (a === undefined || a === null || !Number.isFinite(n)) return;
    differences.push({ field, saved: round(n), core: round(b), diff: sig(Math.abs(n - b)) });
  };
  for (let i = 0; i < m.radii.level1.length; i++) {
    compare(`level1[${i}]`, Array.isArray(state.level1) ? state.level1[i] : undefined, m.radii.level1[i]);
  }
  for (let i = 0; i < m.radii.level2.length; i++) {
    compare(`level2[${i}]`, Array.isArray(state.level2) ? state.level2[i] : undefined, m.radii.level2[i]);
  }
  const savedMatchesCore = differences.length > 0 &&
    differences.every((d) => Number(d.diff) <= TOL * Math.max(1, Math.abs(d.core))) &&
    (saved.matched === null || saved.matched === m.theorem.appletMatched);

  return {
    ...state,
    stateVersion,
    saved,
    savedReadable,
    savedMatchesCore,
    differences,
    reading: m,
    note:
      `Track.state saved the apex, the four base points, three level-1 radii, two level-2 radii and ` +
      `the applet's matched flag. The core rebuilds all six cevian-triangle incircles from those five ` +
      `points: the outer level-1 radii differ by ${m.theorem.outer.difference} and the level-2 pair by ` +
      `${m.theorem.inner.difference}, both driven by the same numerator ` +
      `${m.theorem.sharedNumeratorIdentity} = ${m.theorem.sharedNumerator}, so the two equalities hold ` +
      `together (iff ${m.theorem.iffHolds}). ${savedMatchesCore ? "The saved radii agree with the core's recomputation." : "Some saved radii differ from the core's recomputation; check whether they came from these points."} ` +
      `This is the cevian fan of the Five Incircles Theorem, not the unrelated FourIncirclesInTriangle ` +
      `sangaku, and it is an illustration with no win or loss.`,
  };
}
