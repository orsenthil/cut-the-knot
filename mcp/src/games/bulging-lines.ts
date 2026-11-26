/*
 * run_game_logic actions and saved-position reader for Bulging Lines.
 *
 * The core lives in bulging-lines/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * This is an illustration, not a game: there is no win or loss. What can be
 * measured is the geometry — the eight upright and eight flat grid lines are
 * straight segments spaced one square apart, and the top picture is the bottom
 * picture translated by whole canvas units. The original page's claim that the
 * lines bulge away from the centre with GLWB and towards it with GLBW is a
 * claim about what people see; both orders have the same lines here.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bulging-lines"].BulgingLinesCore;

/** The page's drawing canvas: 320 x 320, placed at (40, 20) in its 400 x 360 SVG. */
const PAGE_CANVAS = { width: 320, height: 320 };

type Settings = { order: string; radius: number; offset: { x: number; y: number } };
type Canvas = { width: number; height: number };
type CoreSquare = { i: number; j: number; x: number; y: number; size: number; color: number };
type CoreDot = { i: number; j: number; x: number; y: number; r: number; color: number; bit: number };
type CoreLine = { i: number; dir: string; x1: number; y1: number; x2: number; y2: number; color: number };
type CoreLayer = { dx: number; dy: number; squares: CoreSquare[]; dots: CoreDot[]; lines: CoreLine[] };
type CoreLayout = {
  width: number; height: number; n: number; side: number; x0: number; y0: number;
  radius: number; twoR: number; k: number; palette: number[]; layers: CoreLayer[];
};
type Claims = {
  straight: boolean; perpendicular: boolean; equalSpacing: boolean; translation: boolean;
  checkerboard: boolean; dotsOnIntersections: boolean; halfTransparent: boolean;
  baseAtOrigin: boolean; topAtOffset: boolean;
  counts: { squares: number; dots: number; lines: number };
};

const PERCEPTION_NOTE =
  "An upright line is drawn from one fixed x to the same x, and a flat line from one fixed y to the same y; the gaps between neighbours are all Side = floor(min(width, height) / 10) pixels. The top picture is the same picture moved by the integer offset, painted with half-transparent colours (alpha 128 instead of 255). Changing the colour order never moves or bends a line. The apparent bulge — outward with GLWB, inward with GLBW — is what the eye reports, not a curve the program can measure; only the geometry behind the illusion is checked here.";

const colourName = (index: number): string => {
  const names = core().COLOR_NAMES as readonly string[];
  return names[index] ?? String(index);
};

const lineView = (ln: CoreLine) => ({
  i: ln.i,
  dir: ln.dir === "v" ? "vertical" : "horizontal",
  x1: ln.x1, y1: ln.y1, x2: ln.x2, y2: ln.y2,
  colour: colourName(ln.color),
});

function readOrder(args: Json, key: string, fallback: string): string {
  const v = args[key] === undefined || args[key] === null ? fallback : String(args[key]);
  if (!(core().ORDERS as readonly string[]).includes(v)) {
    throw new Error(`${key} must be one of the 24 colour orders (GLWB, GLBW, …, WGLB), got ${JSON.stringify(args[key])}`);
  }
  return v;
}

function whole(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const n = num(args, key, fallback);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`${key} must be a whole number from ${lo} to ${hi}, got ${JSON.stringify(args[key])}`);
  }
  return n;
}

function readOffset(args: Json): { x: number; y: number } {
  const v = args.offset;
  if (v === undefined || v === null) return { x: 0, y: 0 };
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`offset must be an object with whole-number x and y, got ${JSON.stringify(v)}`);
  }
  const o = v as Json;
  return {
    x: whole(o, "x", 0, -10000, 10000),
    y: whole(o, "y", 0, -10000, 10000),
  };
}

function readSettings(args: Json): Settings {
  const C = core();
  return {
    order: readOrder(args, "order", C.DEFAULTS.order),
    radius: whole(args, "radius", C.DEFAULTS.radius, C.RADIUS_MIN, C.RADIUS_MAX),
    offset: readOffset(args),
  };
}

function readCanvas(args: Json): Canvas {
  return {
    width: whole(args, "width", PAGE_CANVAS.width, 1, 2000),
    height: whole(args, "height", PAGE_CANVAS.height, 1, 2000),
  };
}

const layout = (s: Settings, canvas: Canvas): CoreLayout =>
  core().layout(s, canvas) as unknown as CoreLayout;
const claims = (s: Settings, canvas: Canvas): Claims =>
  core().claims(s, canvas) as unknown as Claims;

/** The geometry the core can state about one picture, with no opinion about what is seen. */
function reading(s: Settings, canvas: Canvas) {
  const C = core();
  const L = layout(s, canvas);
  const cl = claims(s, canvas);
  return {
    settings: s,
    canvas,
    metrics: {
      width: L.width, height: L.height, n: L.n, side: L.side,
      x0: L.x0, y0: L.y0, radius: L.radius, twoR: L.twoR, k: L.k,
    },
    palette: L.palette.map(colourName),
    colours: L.palette.map((i) => {
      const c = C.COLORS[i];
      return { name: colourName(i), rgb: c.rgb, alpha: c.alpha, topAlpha: c.topAlpha };
    }),
    layers: L.layers.map((layer) => ({
      dx: layer.dx, dy: layer.dy,
      squares: layer.squares.length, dots: layer.dots.length,
      lines: layer.lines.map(lineView),
    })),
    counts: cl.counts,
    geometry: cl,
  };
}

/** Only the endpoints matter for the shared grid: order never moves a line. */
function lineGeometry(lines: CoreLine[]): string {
  return JSON.stringify(lines.map((ln) => [ln.dir, ln.x1, ln.y1, ln.x2, ln.y2]));
}

export function actions(): GameActions {
  return {
    lines: {
      describe:
        "The exact picture the page draws for one colour order (one of the 24, e.g. GLWB), dot radius (2..19) and top-layer offset {x, y} in whole canvas pixels; omitted values take the applet's defaults (GLWB, 10, {0,0}). Optional width and height (default 320 by 320, the page's own canvas) set the board. Reports the 16 grid-line endpoints in both layers, the side and centre offsets, the palette and the core's geometry checks: every line is straight and equally spaced, and the top layer is the bottom one translated by the offset.",
      args: '{ "order": "GLWB", "radius": 10, "offset": { "x": 32, "y": 0 } }',
      run: (args) => {
        const s = readSettings(args);
        const canvas = readCanvas(args);
        return { ...reading(s, canvas), note: PERCEPTION_NOTE };
      },
    },
    orders: {
      describe:
        "Compares two colour orders, by default GLWB and GLBW (the two the original page says bulge outward and inward); set otherOrder to any of the 24 orders. Takes the same radius, offset and width/height as lines. Reports that the line endpoints never change — for GLWB against GLBW the line colours and checkerboard match too, and only the circles swap black and white — and that all 24 orders share the same straight-line geometry. The reported bulge is perception, not a difference in the drawing.",
      args: '{ "order": "GLWB", "otherOrder": "GLBW", "radius": 10, "offset": { "x": 0, "y": 0 } }',
      run: (args) => {
        const s = readSettings(args);
        const other = readOrder(args, "otherOrder", "GLBW");
        const canvas = readCanvas(args);
        const C = core();
        const A = layout(s, canvas);
        const B = layout(C.withSetting(s, "order", other) as Settings, canvas);
        const endpoints = (L: CoreLayout) => lineGeometry(L.layers[0].lines);
        const allOrdersMatch = (C.ORDERS as readonly string[]).every((o) =>
          endpoints(layout(C.withSetting(s, "order", o) as Settings, canvas)) === endpoints(A));

        const shape = (sq: CoreSquare) => [sq.x, sq.y, sq.size, sq.color];
        const dotShape = (d: CoreDot) => [d.x, d.y, d.r];
        const changes: Record<string, number> = {};
        A.layers[0].dots.forEach((dot, i) => {
          const key = `${colourName(dot.color)} -> ${colourName(B.layers[0].dots[i].color)}`;
          changes[key] = (changes[key] ?? 0) + 1;
        });

        return {
          order: s.order,
          otherOrder: other,
          settings: s,
          canvas,
          lineGeometryIdentical: endpoints(A) === endpoints(B),
          lineGeometryIdenticalInAll24Orders: allOrdersMatch,
          lineColourIdentical: JSON.stringify(A.layers[0].lines.map((ln) => ln.color)) ===
            JSON.stringify(B.layers[0].lines.map((ln) => ln.color)),
          squarePatternIdentical: JSON.stringify(A.layers[0].squares.map(shape)) ===
            JSON.stringify(B.layers[0].squares.map(shape)),
          dotPositionsIdentical: JSON.stringify(A.layers[0].dots.map(dotShape)) ===
            JSON.stringify(B.layers[0].dots.map(dotShape)),
          dotColourChanges: changes,
          lines: A.layers[0].lines.map(lineView),
          translatedTopLayer: {
            dx: A.layers[1].dx, dy: A.layers[1].dy,
            lines: A.layers[1].lines.map(lineView),
          },
          geometry: claims(s, canvas),
          note: PERCEPTION_NOTE,
        };
      },
    },
  };
}

/** What the core says about the picture the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Bulging Lines state version ${stateVersion}`);
  const s = readSettings(state);
  return {
    ...s,
    saved: s,
    stateVersion,
    illustration: true,
    outcome: core().result(),
    ...reading(s, PAGE_CANVAS),
    note: PERCEPTION_NOTE,
  };
}
