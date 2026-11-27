"use strict";

/*
 * Edge Illusion (Kanizsa Triangle), from Alexander Bogomolny's applet
 * EdgeIllusion. The cut-the-knot page asks whether we see an edgeless triangle
 * (or square) that looks brighter than its background, and says that the brain
 * supplies the edges of a recognizable shape, but that the shape becomes less
 * prominent once edges are used elsewhere.
 *
 * The one idea the code relies on: the applet never draws a side of the central
 * shape. It draws rings of shrinking filled circles at the three (or four)
 * corners, then covers their inner halves with a polygon painted in the background
 * colour. "Show edges" adds short detached radial strokes; "Extra shapes" adds
 * small corner pieces. All geometry below is transcribed from the applet's
 * EdgeIllusionCanvas.init(), DrawShape(), DrawEdges() and DrawExtra(), keeping
 * Java's integer division and Math.round so a second transcription can check it.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, EdgeIllusionCore, so the page loads it with a plain
 * <script> and porting/check-edge-illusion.mjs loads it in Node. The position is
 * plain data, and every function returns a new object without changing its input.
 */
const EdgeIllusionCore = (() => {
  // EdgeIllusionPanel: Scrollbar(0, 2, 1, 1, 11) and Scrollbar(0, 50, 5, 0, 105).
  // An AWT scrollbar's usable values stop at maximum - visibleAmount.
  const MIN_N = 1, MAX_N = 10, START_N = 2;
  const MIN_PART = 0, MAX_PART = 100, START_PART = 50;
  const TRIANGLE = 0, SQUARE = 1;
  const MODES = ["plain", "edges", "fill", "paint"];
  // The page embeds the applet at WIDTH=460 HEIGHT=440 with fcolor=000000 and
  // bcolor=ffffff. The modern square board is 360 x 320; its ruler sits below.
  const WIDTH = 360, HEIGHT = 320;
  const COLOUR_COUNT = 7; // Colors[] in the applet: blue, red, dark cyan, ...

  // EdgeIllusionCanvas constructor's PointAngles and SpreadAngles tables.
  const POINT_ANGLES = [
    [Math.PI / 2, (2 * Math.PI) / 3],
    [Math.PI / 4, Math.PI / 2],
  ];
  const SPREAD_ANGLES = [
    [[-60, 300], [60, 300], [-180, 300]],
    [[-90, 270], [0, 270], [90, 270], [-180, 270]],
  ];

  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || 0)));
  const clampN = (v) => clampInt(v, MIN_N, MAX_N);
  const clampPart = (v) => clampInt(v, MIN_PART, MAX_PART);
  /** Java Math.round(double): floor(x + 0.5) for the values used here. */
  const jround = (x) => Math.floor(x + 0.5);

  /** The position a new illustration starts from, matching the applet. */
  function start(options) {
    const o = options || {};
    const which = o.which === undefined ? TRIANGLE :
      (o.which === "square" || o.which === SQUARE ? SQUARE : TRIANGLE);
    const mode = MODES.indexOf(o.mode) >= 0 ? o.mode : "plain";
    return {
      which: which,
      n: o.n === undefined ? START_N : clampN(o.n),
      part: o.part === undefined ? START_PART : clampPart(o.part),
      mode: mode,
      swapped: !!(o.swapped === undefined ? false : o.swapped),
      extra: !!(o.extra === undefined ? false : o.extra),
      width: o.width === undefined ? WIDTH : Math.max(30, Math.trunc(Number(o.width) || WIDTH)),
      height: o.height === undefined ? HEIGHT : Math.max(30, Math.trunc(Number(o.height) || HEIGHT)),
    };
  }

  /** A new position with one option changed; scrollbar values clamp as AWT does. */
  function withOption(state, key, value) {
    const next = { ...state };
    if (key === "which") next.which = (value === "square" || value === SQUARE) ? SQUARE : TRIANGLE;
    else if (key === "n") next.n = clampN(value);
    else if (key === "part") next.part = clampPart(value);
    else if (key === "mode") next.mode = MODES.indexOf(value) >= 0 ? value : "plain";
    else if (key === "swapped") next.swapped = !!value;
    else if (key === "extra") next.extra = !!value;
    else if (key === "width" || key === "height") next[key] = Math.max(30, Math.trunc(Number(value) || 30));
    else return { ...state };
    return next;
  }

  /** The checkbox the applet calls "Switch colors": background and ink trade places. */
  function switchColors(state) {
    return { ...state, swapped: !state.swapped };
  }

  /**
   * EdgeIllusionCanvas.init(): the corner points and the distance used as the
   * ruler for every other length. S2 = min(width,height)/3, S3/S4 = the centre,
   * and the triangle's centre sits S4/12 pixels lower, as in the bytecode.
   */
  function layout(state) {
    const s = start(state);
    const radius = Math.trunc(Math.min(s.width, s.height) / 3);
    const cx = Math.trunc(s.width / 2);
    const cy = Math.trunc(s.height / 2);
    const points = [];
    for (let w = 0; w < 2; w++) {
      const count = w === TRIANGLE ? 3 : 4;
      const ring = [];
      for (let i = 0; i < count; i++) {
        const angle = POINT_ANGLES[w][0] + i * POINT_ANGLES[w][1];
        const y0 = w === TRIANGLE ? cy + Math.trunc(cy / 12) : cy;
        ring.push({
          x: cx + jround(radius * Math.cos(angle)),
          y: y0 - jround(radius * Math.sin(angle)),
        });
      }
      points.push(ring);
    }
    // Distance() truncates Math.sqrt to an int before storing it in Dist[].
    const dist = points.map((ring) => {
      const dx = ring[1].x - ring[0].x, dy = ring[1].y - ring[0].y;
      return Math.trunc(Math.sqrt(dx * dx + dy * dy));
    });
    const d = dist[s.which];
    // DrawShape() and DrawEdges() use the same double step.
    const step = (d * s.part) / 100 / (2 * s.n - 1) / 2;
    return {
      width: s.width, height: s.height, radius, cx, cy,
      which: s.which, n: s.n, part: s.part, mode: s.mode,
      swapped: s.swapped, extra: s.extra,
      points: points, dist: dist, step: step,
    };
  }

  /** The corner piece between neighbouring vertices, from FromTo/DrawExtraShape. */
  function extraShape(g, index) {
    const ring = g.points[g.which];
    const count = ring.length;
    const p = ring[index], q = ring[(index + 1) % count];
    const d = g.dist[g.which];
    const gap = (d * (100 - g.part)) / 100 / 2.8;
    const t = gap / (d / 2);
    const mid = {
      x: Math.trunc((p.x + q.x) / 2),
      y: Math.trunc((p.y + q.y) / 2),
    };
    const fromTo = (corner) => ({
      x: jround(mid.x + t * (corner.x - mid.x)),
      y: jround(mid.y + t * (corner.y - mid.y)),
    });
    const a = fromTo(p), b = fromTo(q);
    const factor = g.which === TRIANGLE ? Math.sqrt(3) / 2 : 0.5;
    const apex = {
      x: jround(mid.x + factor * (b.y - a.y)),
      y: jround(mid.y - factor * (b.x - a.x)),
    };
    const filled = g.mode === "fill" || g.mode === "paint";
    return {
      a: a, apex: apex, b: b, mid: mid, factor: factor,
      filled: filled,
      colour: g.mode === "paint" ? "c0" : "ink",
      // DrawExtra draws the base line only when Edges is set and neither
      // FillColor nor Paint is, i.e. in the "Show edges" mode.
      base: g.mode === "edges",
    };
  }

  /**
   * Everything the applet paints, in the order it paints it: field and frame,
   * the rings of circles, the background-coloured mask, the detached edge
   * strokes and then the extra shapes. Colours are role names: the UI maps
   * "ink"/"paper" through the site's theme tokens and c0..c6 through its own
   * palette; "Switch colors" swaps the roles but never the seven paint colours.
   */
  function scene(state) {
    const g = layout(state);
    const ring = g.points[g.which];
    const count = ring.length;
    const circles = [];
    const edges = [];
    const extras = [];
    const last = 2 * g.n - 1;

    for (let i = 0; i < count; i++) {
      const vertex = ring[i];
      for (let j = 0; j < last; j++) {
        circles.push({
          x: vertex.x, y: vertex.y,
          r: jround((2 * g.n - j - 1) * g.step),
          colour: g.mode === "paint" ? (j % 2 === 0 ? "c" + (Math.trunc(j / 2) % COLOUR_COUNT) : "paper")
            : g.mode === "fill" ? (j % 2 === 0 ? "ink" : "paper") : "ink",
          filled: g.mode === "fill" || g.mode === "paint",
        });
      }
    }

    if (g.mode === "edges") {
      for (let i = 0; i < count; i++) {
        const vertex = ring[i];
        const spread = SPREAD_ANGLES[g.which][i];
        for (let j = 0; j < last; j += 2) {
          const near = jround((j + 1) * g.step);
          const far = jround(j * g.step);
          for (let k = 0; k < 2; k++) {
            const degrees = spread[0] + (k === 1 ? spread[1] : 0);
            const a = (degrees * Math.PI) / 180;
            edges.push({
              x1: jround(vertex.x + near * Math.cos(a)),
              y1: jround(vertex.y - near * Math.sin(a)),
              x2: jround(vertex.x + far * Math.cos(a)),
              y2: jround(vertex.y - far * Math.sin(a)),
              vertex: i,
              degrees: degrees,
            });
          }
        }
      }
    }

    if (g.extra) for (let i = 0; i < count; i++) extras.push(extraShape(g, i));

    return {
      layout: g,
      field: { x: 0, y: 0, width: g.width, height: g.height },
      frame: { x: 0.5, y: 0.5, width: g.width - 1, height: g.height - 1 },
      mask: ring,
      maskColour: "paper",   // the AWT polygon is filled with getBackground()
      fieldColour: "paper",
      circles: circles,
      edges: edges,
      extras: extras,
      order: ["field", "frame", "circles", "mask", "edges", "extras"],
      ink: "ink",
      paper: "paper",
      palette: ["c0", "c1", "c2", "c3", "c4", "c5", "c6"],
    };
  }

  /**
   * The page's two perceptual claims reduced to what the drawing determines:
   * the default picture draws no side of the central shape and fills its middle
   * with the field colour, while "Show edges" lays detached dashes along those
   * very sides. Whether the viewer actually sees a brighter shape is a fact
   * about eyes, not about these pixels.
   */
  function claims(state) {
    const s = scene(state);
    let onSides = 0;
    for (const e of s.edges) {
      const p = s.mask[e.vertex];
      const a = (e.degrees * Math.PI) / 180;
      const dx = Math.cos(a), dy = -Math.sin(a);
      const off = (q) => Math.abs((q.x - p.x) * dy - (q.y - p.y) * dx);
      // Java rounds both ends of each stroke, so allow half a pixel either way.
      if (off({ x: e.x1, y: e.y1 }) <= 0.75 && off({ x: e.x2, y: e.y2 }) <= 0.75) onSides++;
    }
    return {
      noDrawnSides: s.edges.length === 0,
      allEdgesOnSides: s.edges.length > 0 && onSides === s.edges.length,
      maskIsBackground: s.maskColour === s.fieldColour,
      edgeStrokes: s.edges.length,
      extraPieces: s.extras.length,
    };
  }

  return {
    MIN_N, MAX_N, START_N, MIN_PART, MAX_PART, START_PART, TRIANGLE, SQUARE,
    MODES, WIDTH, HEIGHT, COLOUR_COUNT, POINT_ANGLES, SPREAD_ANGLES,
    clampN, clampPart, jround, start, withOption, switchColors, layout,
    extraShape, scene, claims,
  };
})();
