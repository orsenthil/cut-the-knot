/*
 * run_game_logic actions and saved-position reader for Grebe.
 *
 * The real core is grebe/grebe-core.js, copied into src/generated/cores/ at
 * build time. It transcribes the applet's FormSquare(), DrawGrebe(), DrawOK(),
 * DrawKO(), ComputeLemoine() and GeoSDoub's geometry. Drag ABC, put a (Vecten)
 * square on each side, and extend the far sides of the squares: they meet in
 * A′B′C′. Grebe's theorem says AA′, BB′ and CC′ concur at the Lemoine (symmedian)
 * point K, and A′B′C′ is homothetic to ABC from K with factor
 *
 *   r = (D - S) / D,  S = a² + b² + c²,  D = twice the signed area,
 *
 * which is 1 + S/(2·area) when the squares lie outside (D < 0 in these board
 * coordinates, y down). K has barycentrics a²:b²:c² and its distances to the
 * sides are proportional to the sides. This is the *forward* construction:
 * From Grebe drags A′B′C′ and rebuilds ABC with the inverse factor 1/r.
 * The other two applet modes are van Lamoen's O–K friendship: lines from K
 * through the circumcentres of the flanks, and from O through their Lemoine
 * points. All coordinates are in the illustration's 600 x 550 viewBox.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["grebe"].GrebeCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Options = { names: boolean; mode: string };

/** The six far square corners, named after the applet's fields. */
type Corners = { CA: Point; CB: Point; AB: Point; AC: Point; BC: Point; BA: Point };

/** The core's construct() result; valid is false when a line is parallel. */
type Geometry = {
  valid: boolean;
  A: Point; B: Point; C: Point;
  corners: Corners;
  K: Point; O: Point;
  outer: Point[];
  primes: Point[];
  centreLines: Point[];
  flankCentres: Point[];
  flankK: Point[];
};

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a: Point, b: Point, p: Point): number =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
/** Perpendicular distance from p to the line through a and b. */
const onLine = (p: Point, a: Point, b: Point): number =>
  Math.abs(cross(a, b, p)) / Math.max(1, dist(a, b));
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept both the page's saved {x, y} and short [x, y] arguments. */
function asPoint(raw: unknown, label: string, fallback?: Point): Point {
  if (raw === undefined || raw === null) {
    if (fallback) return fallback;
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`${label} must be [x, y] or {x, y}, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} is not a finite point`);
  return { x, y };
}

/** The applet's Show names checkbox and three-way mode, either nested or flat. */
function readOptions(C: Core, args: Json): Options {
  const raw = args.options !== undefined && args.options !== null && typeof args.options === "object"
    ? args.options as Json : args;
  let names = false;
  if (raw.names !== undefined && raw.names !== null) {
    if (typeof raw.names !== "boolean") throw new Error('"names" must be a boolean');
    names = raw.names;
  }
  let mode = "grebe";
  if (raw.mode !== undefined && raw.mode !== null) {
    if (typeof raw.mode !== "string" || !(C.MODES as string[]).includes(raw.mode)) {
      throw new Error(`"mode" must be one of ${(C.MODES as string[]).join(", ")}`);
    }
    mode = raw.mode;
  }
  return { names, mode };
}

/** Omit a corner to keep the applet's opening triangle. */
function readTriangle(C: Core, args: Json): Triangle {
  const seed = C.start({}) as Triangle;
  return {
    A: asPoint(args.A, 'argument "A"', seed.A),
    B: asPoint(args.B, 'argument "B"', seed.B),
    C: asPoint(args.C, 'argument "C"', seed.C),
  };
}

/** The forward Grebe construction and every claim the page makes about it. */
function reading(C: Core, s: Triangle, opts: Options) {
  const g = C.construct(s.A, s.B, s.C) as unknown as Geometry;
  const triangle = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  if (!g || g.valid !== true || !g.K || !g.primes || !g.corners || !g.outer || !g.flankCentres || !g.flankK) {
    return {
      valid: false as const,
      triangle,
      options: opts,
      status: C.label(g as never, opts.mode),
      note:
        "Two corners are too close together, or a pair of square sides is parallel, so the core stops drawing: there is no finite K, A′B′C′ or homothety to report. Move the corners apart so ABC is a proper triangle.",
    };
  }

  const T = [g.A, g.B, g.C];
  const a2 = C.sideSquares(g.B, g.C);
  const b2 = C.sideSquares(g.C, g.A);
  const c2 = C.sideSquares(g.A, g.B);
  const S = a2 + b2 + c2;
  const D = C.twiceArea(g.A, g.B, g.C);
  const r = C.factor(g.A, g.B, g.C);
  const scale = Math.max(1, ...T.map((p) => dist(g.K, p)));

  // K is the symmedian point: reflected medians agree with a²:b²:c².
  const bary = C.barycentric(g.K, g.A, g.B, g.C) as number[] | null;
  const expected = S !== 0 ? [a2 / S, b2 / S, c2 / S] : null;
  const baryError = bary && expected
    ? Math.max(...bary.map((w, i) => Math.abs(w - expected[i]))) : null;
  const closed = C.lemoineClosed(g.A, g.B, g.C) as Point;
  const closedError = dist(g.K, closed);

  // "For K the distances to the sides are proportional to the sides."
  const sides = [dist(g.B, g.C), dist(g.C, g.A), dist(g.A, g.B)];
  const distances = [
    C.distanceToSide(g.K, g.B, g.C),
    C.distanceToSide(g.K, g.C, g.A),
    C.distanceToSide(g.K, g.A, g.B),
  ];
  const ratios = distances.map((d, i) => d / sides[i]);
  const ratioSpread = Math.max(...ratios) - Math.min(...ratios);

  // AA′, BB′ and CC′: pairwise crossings and the distance of K to each line.
  const cevians = T.map((p, i) =>
    C.intersect(p, g.primes[i], T[(i + 1) % 3], g.primes[(i + 1) % 3]) as Point);
  const cevianSpread = Math.max(
    dist(cevians[0], cevians[1]),
    dist(cevians[1], cevians[2]),
    dist(cevians[2], cevians[0]),
  );
  const cevianOffset = Math.max(...T.map((p, i) => onLine(g.K, p, g.primes[i])));

  // Forward homothety A′ = K + r(A − K); From Grebe inverts it with 1/r.
  const forward = T.map((p) => ({
    x: g.K.x + r * (p.x - g.K.x),
    y: g.K.y + r * (p.y - g.K.y),
  }));
  const homothetyError = Math.max(...forward.map((p, i) => dist(p, g.primes[i])));
  const inverseFactor = r !== 0 ? 1 / r : null;
  const inverse = inverseFactor === null ? null : g.primes.map((p) => ({
    x: g.K.x + inverseFactor * (p.x - g.K.x),
    y: g.K.y + inverseFactor * (p.y - g.K.y),
  }));
  const inverseError = inverse
    ? Math.max(...inverse.map((p, i) => dist(p, T[i]))) : null;

  const checks = {
    ceviansConcur: cevianSpread / scale < 1e-6 && cevianOffset / scale < 1e-6,
    KIsSymmedian: baryError !== null && baryError < 1e-6 && closedError / scale < 1e-6,
    distancesProportional: ratioSpread < 1e-6,
    homothetic: homothetyError / scale < 1e-6,
    inverseMatchesFromGrebe: inverseError !== null && inverseError / scale < 1e-6,
    squaresOutside: D < 0 && r > 1,
  };
  const failed = Object.keys(checks).filter((k) => !checks[k as keyof typeof checks]);

  return {
    valid: true as const,
    triangle,
    options: opts,
    status: C.label(g as never, opts.mode),
    squareCorners: {
      onAB: [pt(g.corners.CA), pt(g.corners.CB)],
      onBC: [pt(g.corners.AB), pt(g.corners.AC)],
      onCA: [pt(g.corners.BC), pt(g.corners.BA)],
    },
    outerIntersections: g.outer.map(pt),
    K: pt(g.K),
    sideSquares: { a2: r6(a2), b2: r6(b2), c2: r6(c2), sum: r6(S) },
    barycentric: {
      ofK: bary ? bary.map(maybe) : null,
      fromSides: expected ? expected.map(maybe) : null,
      maxDifference: maybe(baryError),
      closedFormK: pt(closed),
      closedFormDifference: r6(closedError),
    },
    distances: {
      sides: sides.map(r6),
      fromK: distances.map(r6),
      overSide: ratios.map(r6),
      spread: r6(ratioSpread),
    },
    concurrence: {
      crossings: cevians.map(pt),
      spread: r6(cevianSpread),
      KOffLines: r6(cevianOffset),
    },
    homothety: {
      factor: r6(r),
      twiceSignedArea: r6(D),
      fromScale: forward.map(pt),
      constructed: g.primes.map(pt),
      maxDifference: r6(homothetyError),
      squaresOutside: D < 0,
      factorExterior: r6(1 + S / Math.abs(D)),
    },
    fromGrebeInverse: {
      factor: maybe(inverseFactor),
      fromPrimes: inverse ? inverse.map(pt) : null,
      maxDifference: maybe(inverseError),
      note:
        "From Grebe's applet drags A′B′C′ instead: it recovers ABC with the inverse scale 1/r, which lies between 0 and 1 for exterior squares. This is the same pair of triangles read in the other direction, not a second theorem.",
    },
    checks,
    allHold: failed.length === 0,
    failed,
    note:
      "The far sides of the three Vecten squares meet in A′B′C′; AA′, BB′ and CC′ pass through K, whose barycentrics are a²:b²:c² and whose distances to the sides are proportional to those sides. A′B′C′ is ABC scaled about K by r = (D−S)/D, equal to 1 + S/(2·area) when the squares lie outside (D < 0 here, y down); dragging C across AB makes D positive and r negative.",
  };
}

/** The van Lamoen friendship modes, from the same core construct(). */
function friendship(C: Core, s: Triangle, opts: Options) {
  const base = reading(C, s, opts);
  const triangle = base.triangle;
  if (!base.valid) {
    return {
      valid: false as const,
      triangle,
      options: opts,
      note: base.note,
    };
  }
  const g = C.construct(s.A, s.B, s.C) as unknown as Geometry;
  const T = [g.A, g.B, g.C];
  const co = g.corners;
  const flanks = [
    { name: "A CA BA", points: [g.A, co.CA, co.BA] as [Point, Point, Point] },
    { name: "B CB AB", points: [g.B, co.CB, co.AB] as [Point, Point, Point] },
    { name: "C AC BC", points: [g.C, co.AC, co.BC] as [Point, Point, Point] },
  ];
  const centres = flanks.map((f, i) => {
    const computed = C.circumcenter(f.points[0], f.points[1], f.points[2]) as Point;
    const drawn = g.flankCentres[i];
    return {
      flank: f.name,
      label: (C.CENTRES as string[])[i],
      circumcentre: pt(computed),
      drawn: pt(drawn),
      difference: r6(dist(computed, drawn)),
    };
  });

  // (OK): O_a O_b O_c is homothetic to ABC from K with factor (1+r)/2,
  // and A–O_a, B–O_b, C–O_c all pass through K.
  const f = (1 + C.factor(g.A, g.B, g.C)) / 2;
  const ok = T.map((p, i) => {
    const target = g.flankCentres[i];
    const scaled = { x: g.K.x + f * (p.x - g.K.x), y: g.K.y + f * (p.y - g.K.y) };
    return {
      line: `${(C.NAMES as string[])[i]}–${(C.CENTRES as string[])[i]}`,
      from: pt(p),
      to: pt(target),
      KOffLine: r6(onLine(g.K, p, target)),
      passesThroughK: onLine(g.K, p, target) < 1e-6,
      scaledFromK: pt(scaled),
      homothetyDifference: r6(dist(scaled, target)),
    };
  });

  // (KO): A–K_a, B–K_b, C–K_c pass through the circumcentre O of ABC.
  const ko = T.map((p, i) => ({
    line: `${(C.NAMES as string[])[i]}–${(C.FLANKS as string[])[i]}`,
    from: pt(p),
    to: pt(g.flankK[i]),
    OOffLine: r6(onLine(g.O, p, g.flankK[i])),
    passesThroughO: onLine(g.O, p, g.flankK[i]) < 1e-6,
  }));

  const checks = {
    centresAreFlankCircumcentres: centres.every((c) => c.difference !== null && c.difference < 1e-6),
    okLinesThroughK: ok.every((line) => line.passesThroughK),
    okTriangleHomothetic: ok.every((line) => line.homothetyDifference !== null && line.homothetyDifference < 1e-6),
    koLinesThroughO: ko.every((line) => line.passesThroughO),
  };
  const failed = Object.keys(checks).filter((k) => !checks[k as keyof typeof checks]);

  return {
    valid: true as const,
    triangle,
    options: opts,
    K: pt(g.K),
    O: pt(g.O),
    ok: {
      homothetyFactor: r6(f),
      flankCircumcentres: centres,
      lines: ok,
    },
    ko: {
      flankLemoinePoints: g.flankK.map((p, i) => ({
        label: (C.FLANKS as string[])[i], point: pt(p),
      })),
      lines: ko,
    },
    checks,
    allHold: failed.length === 0,
    failed,
    statusOK: C.label(g as never, "OK"),
    statusKO: C.label(g as never, "KO"),
    note:
      "In the (OK) view, O_a, O_b, O_c are the circumcentres of the three flanks A CA BA, B CB AB and C AC BC; their triangle is ABC scaled about K by (1+r)/2 and A–O_a, B–O_b, C–O_c pass through K. In the (KO) view, K_a, K_b, K_c are those flanks' Lemoine points and A–K_a, B–K_b, C–K_c pass through O: the friendship of O and K is symmetric.",
  };
}

const EXAMPLE = '{ "A": [205, 285], "B": [300, 285], "C": [225, 211.69872981077808] }';

export function actions(): GameActions {
  return {
    grebe: {
      describe:
        "The forward Grebe construction: for triangle ABC (corners [x, y] or {x, y} in the 600 x 550 viewBox, y down; omit a corner to keep the opening triangle), build a Vecten square on each side and extend its far sides to A′, B′ and C′. Reports the square corners, the meeting point K (the Lemoine/symmedian point), its a²:b²:c² barycentrics, the distances from K to the sides divided by those sides, the cevians AA′,BB′,CC′ and their crossing spread, and the homothety A′ = K + r(A−K) with r = (D−S)/D = 1 + S/(2·area) for exterior squares. The fromGrebeInverse field is the opposite reading: From Grebe starts at A′B′C′ and recovers ABC with the inverse factor 1/r. names and mode (grebe, OK, KO) may be given at the top level or in options; mode only changes the status line.",
      args: EXAMPLE,
      run: (args) => {
        const C = core();
        return reading(C, readTriangle(C, args), readOptions(C, args));
      },
    },
    friendship: {
      describe:
        "van Lamoen's O–K friendship theorem on the same draggable triangle ABC (corners [x, y] or {x, y}; omit any to keep the opening triangle). Reports the circumcentre O of ABC, the circumcentres O_a,O_b,O_c of the three flanks and whether A–O_a, B–O_b, C–O_c pass through K while O_aO_bO_c is homothetic to ABC from K with factor (1+r)/2; then reports the symmetric (KO) view where A–K_a, B–K_b, C–K_c pass through O, with K_a,K_b,K_c the flanks' Lemoine points. Returns a boolean for each check plus the two status lines. names and mode may be given at the top level or in options.",
      args: EXAMPLE,
      run: (args) => {
        const C = core();
        return friendship(C, readTriangle(C, args), readOptions(C, args));
      },
    },
  };
}

/** The saved corners, names/mode and drawn K, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Grebe state version ${stateVersion}`);
  const C = core();
  const opts = readOptions(C, state);
  const seed = C.start({}) as Triangle;
  const s: Triangle = {
    A: asPoint(state.A, "state.A", seed.A),
    B: asPoint(state.B, "state.B", seed.B),
    C: asPoint(state.C, "state.C", seed.C),
  };
  const r = reading(C, s, opts);
  const savedK = state.K === undefined || state.K === null
    ? null : asPoint(state.K, "state.K", s.A);
  const kGap = savedK && r.valid && r.K ? dist(savedK, r.K) : null;

  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    options: { names: opts.names, mode: opts.mode },
    K: savedK ? pt(savedK) : null,
    reading: r,
    savedKDistance: maybe(kGap),
    savedKMatchesCore: kGap !== null && kGap < 1e-6,
    stateIsIllustration: C.result() === null,
    note:
      "Track.state saves the three dragged corners A,B,C, the Show names checkbox, the selected view (grebe, OK or KO) and the Lemoine point K drawn on the page. The reading rebuilds the squares, A′B′C′, the homothety and the friendship points from those corners with the same core; savedKDistance should be 0. This is an illustration, so there is no win or loss.",
  };
}
