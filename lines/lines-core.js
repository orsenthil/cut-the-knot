"use strict";

/*
 * Disappearing lines — Bogomolny's "lines" applet (cut-the-knot.org/pythagoras/lines.shtml).
 *
 * Two right triangles face each other along the same diagonal. Each one has
 * N vertical strokes drawn in it. Slide the upper triangle one notch (s pixels)
 * to the right and one notch up: the N strokes line up into only N-1 strokes,
 * yet every stroke is now one notch longer, so the total of their lengths is
 * unchanged. The eyes at the top of the applet open when the upper triangle
 * reaches exactly (lower.x + s, lower.y - s).
 *
 * Transcribed from the archived classes/lines.zip bytecode (LinesPanel,
 * LinesCanvas, straighter and the shared mouseTracker). Canvas 400x350,
 * mouse coordinates snapped to multiples of 2, N from 5 to 25 (10 at start).
 * All of the geometry below is in the applet's own pixel coordinates; there is
 * no document, no window and no storage here — just one global, LinesCore.
 */

const LinesCore = (() => {
  const MIN_N = 5;
  const MAX_N = 25;
  const DEFAULT_N = 10;
  const MOUSE_STEP = 2;
  const WIDTH = 400;
  const HEIGHT = 350;
  const EYE_RECTS = [
    { x: 30, y: 20, w: 40, h: 20 },
    { x: 350, y: 40, w: 40, h: 20 },
    { x: 200, y: 10, w: 60, h: 30 },
  ];

  /** Java's (int) cast of a double: truncate toward zero, NaN becomes 0. */
  const jint = (v) => (Number.isFinite(v) ? Math.trunc(v) : 0);
  /** LinesCanvas.mouseDragged: x / mouseStep * mouseStep (int arithmetic). */
  const snap = (v) => Math.trunc(jint(v) / MOUSE_STEP) * MOUSE_STEP;
  /** LinesPanel's "<" and ">" clamp the field to 5..25 before resetting. */
  const clampN = (n) => {
    const v = jint(Number(n));
    return Math.min(MAX_N, Math.max(MIN_N, v === 0 ? DEFAULT_N : v));
  };

  function start(options = {}) {
    return { n: clampN(options.n === undefined ? DEFAULT_N : options.n), dx: 0, dy: 0 };
  }

  function setN(state, n) {
    return start({ n });
  }

  function stepN(state, delta) {
    return setN(state, state.n + delta);
  }

  /** straighter.reset(int): s, the square side, the lower rectangle and ratio. */
  function geometry(state, width = WIDTH, height = HEIGHT) {
    const n = clampN(state.n);
    let s = Math.ceil(width / (2 * n + 1) + 0.5);
    s = jint(s / MOUSE_STEP) * MOUSE_STEP;
    const margin = s;
    const side = s * (n + 1);
    const rect = {
      x: jint((width - side) / 2),
      y: jint((height - side) / 2) + 40,
      w: side,
      h: side,
    };
    const ratio = side / side; // m_H / m_W; the applet's square is always 1
    const ul = { x: rect.x + state.dx, y: rect.y + state.dy };
    return { n, s, margin, side, rect, ratio, ul, width, height };
  }

  /** The two outlines, as Polygon.addPoint called them in the bytecode. */
  function polygons(g) {
    const r = g.rect;
    const u = g.ul;
    return {
      lower: [
        { x: r.x, y: r.y + g.side },
        { x: r.x + g.side, y: r.y },
        { x: r.x + g.side, y: r.y + g.side },
        { x: r.x, y: r.y + g.side },
      ],
      upper: [
        { x: u.x, y: u.y },
        { x: u.x + g.side, y: u.y },
        { x: u.x, y: u.y + g.side },
        { x: u.x, y: u.y },
      ],
    };
  }

  /** yAtXUpper / yAtXLower, keeping the (int)(ratio * ...) truncation. */
  function yAtX(g, x, upper) {
    const base = upper ? g.ul : { x: g.rect.x, y: g.rect.y };
    return base.y + jint(g.ratio * (base.x + g.side - x));
  }

  /** Every drawLine call of DrawLowerPart (first) and DrawUpperPart (second). */
  function segments(g) {
    const out = [];
    for (let i = 0; i < g.n; i++) {
      const x = g.rect.x + (i + 1) * g.s;
      out.push({ part: "lower", i, x, y0: g.rect.y + g.rect.h - g.margin, y1: yAtX(g, x, false) });
    }
    for (let i = 0; i < g.n; i++) {
      const x = g.ul.x + (i + 1) * g.s;
      out.push({ part: "upper", i, x, y0: g.ul.y + g.margin, y1: yAtX(g, x, true) });
    }
    return out;
  }

  /** Lines a person sees: vertical strokes at the same x that touch are one line. */
  function visibleLines(g) {
    const byX = new Map();
    for (const seg of segments(g)) {
      if (!byX.has(seg.x)) byX.set(seg.x, []);
      byX.get(seg.x).push([Math.min(seg.y0, seg.y1), Math.max(seg.y0, seg.y1)]);
    }
    const lines = [];
    for (const [x, spans] of byX) {
      spans.sort((a, b) => a[0] - b[0]);
      let lo = spans[0][0];
      let hi = spans[0][1];
      for (let i = 1; i < spans.length; i++) {
        if (spans[i][0] <= hi) hi = Math.max(hi, spans[i][1]);
        else {
          lines.push({ x, y0: lo, y1: hi });
          lo = spans[i][0];
          hi = spans[i][1];
        }
      }
      lines.push({ x, y0: lo, y1: hi });
    }
    lines.sort((a, b) => a.x - b.x);
    return lines;
  }

  const countLines = (g) => visibleLines(g).filter((l) => l.y1 > l.y0).length;

  /** The sum of the drawn strokes; meaningless zero-length strokes add nothing. */
  function totalLength(g) {
    return segments(g).reduce((sum, seg) => sum + Math.abs(seg.y1 - seg.y0), 0);
  }

  /** straighter.UpdatePos: the three eyes open at this exact upper-left corner. */
  function finished(state) {
    const g = geometry(state);
    return g.ul.x === g.rect.x + g.s && g.ul.y === g.rect.y - g.s;
  }

  /** The "slide one notch" shortcut: the position the applet's eyes reward. */
  function slide(state) {
    const g = geometry(state);
    return { n: g.n, dx: g.s, dy: -g.s };
  }

  /** A point inside the moving triangle, used as the draggable handle. */
  function handleRest(state) {
    const g = geometry(state);
    return {
      x: g.rect.x + Math.round(g.side / 4),
      y: g.rect.y + Math.round(g.side / 4),
    };
  }

  function handlePoint(state) {
    const p = handleRest(state);
    return { x: p.x + state.dx, y: p.y + state.dy };
  }

  /** Convert a dragged point into the snapped offset kept in the position. */
  function dragTo(state, point) {
    const p = handleRest(state);
    return { n: state.n, dx: snap(point.x - p.x), dy: snap(point.y - p.y) };
  }

  function nudge(state, ddx, ddy) {
    return { n: state.n, dx: state.dx + snap(ddx), dy: state.dy + snap(ddy) };
  }

  /** mouseTracker.drawEye, with the mouse at the handle point. */
  function eyes(state) {
    const point = handlePoint(state);
    const full = finished(state);
    return EYE_RECTS.map((r) => {
      const eyeR = Math.floor(Math.min(r.w, r.h) / 2);
      const irisR = Math.floor(eyeR / 2);
      const left = { x: r.x + eyeR, y: r.y + eyeR };
      const right = { x: r.x + r.w - eyeR, y: r.y + eyeR };
      const center = (c) => {
        const vx = point.x - c.x;
        const vy = point.y - c.y;
        const d = Math.sqrt(vx * vx + vy * vy);
        if (full || d === 0) return { x: c.x, y: c.y };
        return {
          x: c.x + jint(jint(vx / d) * (eyeR - irisR)),
          y: c.y + jint(jint(vy / d) * (eyeR - irisR)),
        };
      };
      return { rect: r, eyeR, irisR, left, right, irisLeft: center(left), irisRight: center(right), full };
    });
  }

  function status(state) {
    const g = geometry(state);
    return {
      n: g.n,
      s: g.s,
      count: countLines(g),
      length: totalLength(g),
      finished: finished(state),
    };
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, MOUSE_STEP, WIDTH, HEIGHT, EYE_RECTS,
    start, setN, stepN, geometry, polygons, yAtX, segments, visibleLines,
    countLines, totalLength, finished, slide, handleRest, handlePoint,
    dragTo, nudge, eyes, status,
  };
})();
