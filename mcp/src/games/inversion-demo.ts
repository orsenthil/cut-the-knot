/*
 * run_game_logic actions and saved-position reader for Inversion Demo.
 *
 * The picture has a circle of inversion (centre O, through A) and a stack of
 * coloured circles, each stored as a centre C and a rim point B. The core
 * (inversion-demo/inversion-demo-core.js) inverts every circle to another
 * circle, or to a straight line when |OC^2 - r^2| <= 100: that cut-off is the
 * applet's drawing tolerance, not a theorem. Circles orthogonal to the circle
 * of inversion have OC^2 - r^2 = OA^2 and are fixed as sets. Every number
 * below is measured by that core, copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type CircleImage = { kind: "circle"; center: Pt; radius: number };
type LineImage = { kind: "line"; point: Pt | null; direction: Pt | null };
type ImageView = CircleImage | LineImage;
type Item = {
  index: number;
  color: string;
  source: Circle;
  d: number;
  orthogonal: boolean;
  image: CircleImage | LineImage;
};
type Geometry = { inversion: Circle; power: number; items: Item[] };
type SavedCircle = { C: Pt; B: Pt; color: string };
type State = { O: Pt; A: Pt; circles: SavedCircle[]; touches: number };
type Core = {
  VIEW: { width: number; height: number };
  EPS: number;
  COLORS: string[];
  START: { O: Pt; A: Pt };
  start(): State;
  dist(a: Pt, b: Pt): number;
  sqDist(a: Pt, b: Pt): number;
  invertPoint(center: Pt, power: number, p: Pt): Pt | null;
  invertCircle(center: Pt, power: number, target: Circle): CircleImage | LineImage;
  geometry(s: State): Geometry;
  status(s: State, g: Geometry): string;
};

const core = (): Core => cores["inversion-demo"].InversionDemoCore as unknown as Core;

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const rp = (p: Pt): Pt => ({ x: r4(p.x), y: r4(p.y) });
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Accept both the page's saved {x, y} and a tutor's [x, y]. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isObj(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** A coloured circle as centre/radius, or as the page's centre C and rim B. */
function readTarget(raw: unknown, label: string, C: Core): Circle {
  if (!isObj(raw)) {
    throw new Error(`"${label}" must be { "center": [x, y], "radius": r } or { "C": [x, y], "B": [x, y] }`);
  }
  if (raw.center !== undefined || raw.radius !== undefined) {
    if (raw.C !== undefined || raw.B !== undefined) {
      throw new Error(`"${label}" cannot mix center/radius with C/B`);
    }
    const center = readPoint(raw.center, `${label}.center`);
    const radius = num(raw, "radius");
    if (!(radius > 0)) throw new Error(`"${label}.radius" must be positive`);
    return { center, radius };
  }
  const center = readPoint(raw.C, `${label}.C`);
  const rim = readPoint(raw.B, `${label}.B`);
  const radius = C.dist(center, rim);
  if (!(radius > 0)) throw new Error(`"${label}": C and B must be different points`);
  return { center, radius };
}

function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be a whole number from ${lo} to ${hi}`);
  }
  return n;
}

/** O and A, or the page's opening handles, with the core's squared radius. */
function scene(args: Json, C: Core): { O: Pt; A: Pt; radius: number; power: number } {
  const home = C.start();
  const O = readPoint(args.O, "O", home.O);
  const A = readPoint(args.A, "A", home.A);
  const radius = C.dist(O, A);
  if (!(radius > 1e-12)) {
    throw new Error('"O" and "A" must be different points: the circle of inversion needs a positive radius');
  }
  return { O, A, radius, power: C.sqDist(O, A) };
}

/** The core's circle-or-line image, rounded for output. */
function imageView(image: CircleImage | LineImage): ImageView {
  if (image.kind === "circle") {
    return { kind: "circle", center: rp(image.center), radius: r6(image.radius) };
  }
  return {
    kind: "line",
    point: image.point ? rp(image.point) : null,
    direction: image.direction ? rp(image.direction) : null,
  };
}

/**
 * Points on a source circle, inverted with the core, checking both that
 * OP * OP' equals the power and that each image lies on the reported image.
 */
function checkSamples(C: Core, O: Pt, power: number, target: Circle, image: CircleImage | LineImage, n: number) {
  const examples: Json[] = [];
  let inverted = 0;
  let worstProduct = 0;
  let worstResidual = 0;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    const p = {
      x: target.center.x + target.radius * Math.cos(a),
      y: target.center.y + target.radius * Math.sin(a),
    };
    const q = C.invertPoint(O, power, p);
    if (!q) continue;
    inverted++;
    const product = C.dist(O, p) * C.dist(O, q);
    worstProduct = Math.max(worstProduct, Math.abs(product - power) / Math.max(1, power));
    // Measure against the core's unrounded image: the rounded view is only
    // for display and would itself add a residual of a few 1e-5.
    let residual = 0;
    if (image.kind === "circle") {
      residual = Math.abs(C.dist(q, image.center) - image.radius);
    } else if (image.point && image.direction) {
      const dir = Math.hypot(image.direction.x, image.direction.y);
      residual = dir > 0
        ? Math.abs((q.x - image.point.x) * image.direction.y - (q.y - image.point.y) * image.direction.x) / dir
        : Number.POSITIVE_INFINITY;
    }
    worstResidual = Math.max(worstResidual, residual);
    if (examples.length < 3) {
      examples.push({ point: rp(p), image: rp(q), product: r6(product) });
    }
  }
  return {
    tried: n,
    inverted,
    skipped: n - inverted,
    examples,
    worstProductRelativeError: r6(worstProduct),
    worstImageResidual: r6(worstResidual),
    agrees: inverted > 0 && worstProduct < 1e-8 && worstResidual < 1e-6,
  };
}

export function actions(): GameActions {
  return {
    invert_circle: {
      describe:
        "Invert a circle (give center and radius, or the page's centre C and rim B as [x, y] or {x, y}) in the circle of radius R = OA about O, reporting d = OC² − r², the image circle or straight line, and sample points whose products OP·OP′ equal R² and land on that image. The core draws a line when |d| ≤ 100, its applet's tolerance, and a circle with d = R² is orthogonal to the circle of inversion and inverts to itself; O and A default to the opening handles on the 600 x 450 board.",
      args: '{ "O": [176.43, 225], "A": [50, 225], "circle": { "center": [300, 150], "radius": 60 }, "samples": 12 }',
      run: (args) => {
        const C = core();
        const { O, A, radius, power } = scene(args, C);
        const target = readTarget(args.circle ?? args, "circle", C);
        const samples = intArg(args, "samples", 12, 4, 24);
        const d = C.sqDist(O, target.center) - target.radius * target.radius;
        const image = C.invertCircle(O, power, target);
        const view = imageView(image);
        const checked = checkSamples(C, O, power, target, image, samples);
        const orthogonal = Math.abs(d - power) < 1e-6;
        const imageIsItself = image.kind === "circle"
          && C.dist(image.center, target.center) < 1e-6
          && Math.abs(image.radius - target.radius) < 1e-6;

        return {
          O: rp(O), A: rp(A),
          inversionCircle: { center: rp(O), radius: r6(radius) },
          power: r6(power),
          source: { center: rp(target.center), radius: r6(target.radius) },
          d: r6(d),
          lineBranch: Math.abs(d) <= C.EPS,
          tolerance: C.EPS,
          image: view,
          sampledPoints: checked,
          orthogonal: { dEqualsPower: orthogonal, imageIsItself },
          note: view.kind === "line"
            ? `Here d = ${r6(d)} is within the applet's ±${C.EPS} drawing tolerance, so the core draws the image as a straight line: a circle through (or very near) O inverts to a line. The inverted sample points still obey OP·OP′ = R² = ${r6(power)}.`
            : orthogonal
              ? `Here d = R² = ${r6(power)}, so this circle is orthogonal to the circle of inversion and the core returns it unchanged: inversion fixes every such circle as a set while swapping points along each ray from O.`
              : `Here d = ${r6(d)} and the image is a circle of radius ${view.radius} centred at (${view.center.x}, ${view.center.y}). Inversion sends P along ray OP so that OP·OP′ = R² = ${r6(power)}, which is why every sampled image lies on the reported circle.`,
        };
      },
    },

    orthogonal_and_tolerance: {
      describe:
        "Build a circle orthogonal to the circle of inversion (radius R about O from O and A) centred at an optional P outside it, and check that the core reports d = OC² − r² = R² and sends it to itself while its points move in inverse pairs. The same action probes circles placed a small offset δ from passing through O and tabulates where the applet's |d| ≤ 100 drawing tolerance switches their image from a straight line to a circle, although only a circle through O truly inverts to a line.",
      args: '{ "O": [176.43, 225], "A": [50, 225], "P": [365.64, 225], "probeRadius": 60, "deltas": [0, 0.25, 0.5, 1, 2], "samples": 12 }',
      run: (args) => {
        const C = core();
        const { O, A, radius, power } = scene(args, C);
        const far = { x: O.x + 1.5 * radius, y: O.y };
        const P = readPoint(args.P, "P", far);
        const c = C.dist(O, P);
        if (!(c > radius)) {
          throw new Error('"P" must be farther from O than A is (outside the circle of inversion)');
        }
        const r = Math.sqrt(c * c - radius * radius);
        const target = { center: P, radius: r };
        const d = C.sqDist(O, P) - r * r;
        const image = C.invertCircle(O, power, target);
        const view = imageView(image);
        const samples = intArg(args, "samples", 12, 4, 24);
        const checked = checkSamples(C, O, power, target, image, samples);

        const probeRadius = num(args, "probeRadius", 60);
        if (!(probeRadius > 0) || !Number.isFinite(probeRadius)) {
          throw new Error('"probeRadius" must be a positive number');
        }
        const rawDeltas = args.deltas === undefined || args.deltas === null
          ? [0, 0.25, 0.5, 1, 2]
          : args.deltas;
        if (!Array.isArray(rawDeltas) || rawDeltas.length < 1 || rawDeltas.length > 8) {
          throw new Error('"deltas" must be an array of 1 to 8 offsets');
        }
        const rows = rawDeltas.map((raw, i) => {
          const delta = Number(raw);
          if (!Number.isFinite(delta) || delta < 0 || delta > 1000) {
            throw new Error(`"deltas[${i}]" must be a number from 0 to 1000`);
          }
          const center = { x: O.x + probeRadius + delta, y: O.y };
          const dd = C.sqDist(O, center) - probeRadius * probeRadius;
          const image = C.invertCircle(O, power, { center, radius: probeRadius });
          return {
            delta,
            distanceFromO: r6(probeRadius + delta),
            d: r6(dd),
            withinTolerance: Math.abs(dd) <= C.EPS,
            image: imageView(image),
          };
        });

        return {
          O: rp(O), A: rp(A),
          inversionCircle: { center: rp(O), radius: r6(radius) },
          power: r6(power),
          orthogonalCircle: {
            center: rp(P), radius: r6(r), d: r6(d),
            dEqualsPower: Math.abs(d - power) < 1e-6,
            image: view,
            imageIsItself: image.kind === "circle"
              && C.dist(image.center, P) < 1e-6
              && Math.abs(image.radius - r) < 1e-6,
            sampledPoints: checked,
          },
          tolerance: {
            eps: C.EPS, probeRadius: r6(probeRadius), rows,
            lineRows: rows.filter((row) => row.withinTolerance).length,
          },
          note:
            `OC² = r² + R² = ${r6(c * c)} = ${r6(r * r)} + ${r6(power)}, so this circle meets the circle of inversion at right angles and the core's image is itself; each sampled P still moves along OP with OP·OP′ = ${r6(power)}. ` +
            `The probe circles have d = (${r6(probeRadius)} + δ)² − ${r6(probeRadius)}², so even a circle that misses O by a little is drawn as a line whenever |d| ≤ ${C.EPS} — a drawing tolerance inherited from the applet, not an exact geometric fact.`,
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of the picture on screen. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Inversion Demo state version ${stateVersion}`);
  const C = core();
  const home = C.start();
  const O = readPoint(state.O, "O", home.O);
  const A = readPoint(state.A, "A", home.A);
  if (!(C.dist(O, A) > 1e-12)) {
    throw new Error('saved "O" and "A" coincide, so the circle of inversion has no radius');
  }
  let raw = state.circles;
  if (raw === undefined || raw === null) raw = [];
  if (!Array.isArray(raw)) throw new Error('saved "circles" must be an array');
  const circles: SavedCircle[] = raw.map((entry, i) => {
    if (!isObj(entry)) throw new Error(`saved "circles[${i}]" must be an object`);
    const center = readPoint(entry.C, `circles[${i}].C`);
    const rim = readPoint(entry.B, `circles[${i}].B`);
    if (!(C.dist(center, rim) > 1e-12)) {
      throw new Error(`saved "circles[${i}]" has C = B, so it has no radius`);
    }
    const color = typeof entry.color === "string" ? entry.color : C.COLORS[i % C.COLORS.length];
    return { C: center, B: rim, color };
  });
  const touches = num(state, "touches", 0);
  if (!Number.isInteger(touches) || touches < 0) {
    throw new Error('saved "touches" must be a non-negative whole number');
  }

  const built: State = { O, A, circles, touches };
  const g = C.geometry(built);
  const items = g.items.map((item) => {
    const source = item.source;
    const along = Math.hypot(source.center.x - O.x, source.center.y - O.y);
    const unit = along > 1e-12
      ? { x: (source.center.x - O.x) / along, y: (source.center.y - O.y) / along }
      : { x: 1, y: 0 };
    const p = {
      x: source.center.x + source.radius * unit.x,
      y: source.center.y + source.radius * unit.y,
    };
    const q = C.invertPoint(O, g.power, p);
    return {
      index: item.index,
      color: item.color,
      source: { center: rp(source.center), radius: r6(source.radius) },
      d: r6(item.d),
      orthogonal: item.orthogonal,
      image: imageView(item.image),
      sampleInverse: q
        ? {
            point: rp(p), image: rp(q),
            product: r6(C.dist(O, p) * C.dist(O, q)),
          }
        : null,
    };
  });

  return {
    // The fields the page saved with Track.state, with the same names.
    stateVersion,
    O: rp(O), A: rp(A),
    circles: circles.map((c) => ({ C: rp(c.C), B: rp(c.B), color: c.color })),
    touches,
    // What the core adds.
    inversionCircle: { center: rp(g.inversion.center), radius: r6(g.inversion.radius) },
    power: r6(g.power),
    items,
    imageCounts: {
      circles: items.filter((item) => item.image.kind === "circle").length,
      lines: items.filter((item) => item.image.kind === "line").length,
      orthogonal: items.filter((item) => item.orthogonal).length,
    },
    tolerance: C.EPS,
    status: C.status(built, g),
    note:
      `The saved picture inverts in the circle about (${rp(O).x}, ${rp(O).y}) of radius ${r6(g.inversion.radius)}; each dot travels along its ray from O so OP·OP′ = ${r6(g.power)}. ` +
      "An image drawn as a line means its circle lies within the applet's ±100 drawing tolerance of O; an orthogonal circle is fixed as a set. This is an illustration with no win or loss.",
  };
}
