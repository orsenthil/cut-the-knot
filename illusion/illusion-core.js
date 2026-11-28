"use strict";

/*
 * Illusion — Alexander Bogomolny's Poggendorff illusion applet
 * (cut-the-knot.org/Curriculum/Geometry/Illusion.shtml).
 *
 * The page's exact claim: "Parallel lines appear to break the transversals
 * off. The closer the inclination of the lines in the two families, the more
 * pronounced is the effect." The geometric substrate is two families of
 * perfectly straight lines. IllusionCanvas.DrawLines draws diagonal
 * transversals with slope -tan(angle), repeated every Dist/sin(angle) in x;
 * DrawOcclusion then paints vertical bars over them, Space apart and
 * 2*trunc(Width/2) wide. Nothing is bent or shifted: the pieces hidden by a
 * bar continue the same line. Whether the eye *sees* a break, and whether it
 * looks stronger as the two inclinations come closer, are statements about
 * perception and cannot be computed from coordinates.
 *
 * No document, no window, no storage: one global IllusionCore. The position
 * is plain data; every function takes a position and returns a new one.
 */
const IllusionCore = (() => {
  /** The live page embeds the applet at WIDTH=400 HEIGHT=300. */
  const VIEW = { width: 400, height: 300 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };

  /** The live page's <param>s; the constructors' catch uses lightGray/black. */
  const PAGE_PARAMS = { fcolor: "000000", bcolor: "ffffff" };
  const FALLBACK_COLORS = { background: 0xc0c0c0, foreground: 0x000000 };

  /**
   * IllusionPanel's four Scrollbar(HORIZONTAL, value, visible, min, max)
   * constructors: Dist 20/5/5/50, Angle 60/5/15/90, Space 50/5/20/100,
   * Width 30/5/5/90. The canvas fields start at exactly those four values.
   */
  const LIMITS = {
    dist: [5, 50],
    angle: [15, 90],
    space: [20, 100],
    width: [5, 90],
  };
  const SCROLLBARS = {
    dist: { value: 20, visible: 5, min: 5, max: 50 },
    angle: { value: 60, visible: 5, min: 15, max: 90 },
    space: { value: 50, visible: 5, min: 20, max: 100 },
    width: { value: 30, visible: 5, min: 5, max: 90 },
  };
  const START = { dist: 20, angle: 60, space: 50, width: 30 };

  /** Angle handle rides a circle round the centre; spacing handle sits midway. */
  const HANDLE_RADIUS = 90;
  const PAGE_CLAIM = "Parallel lines appear to break the transversals off. " +
    "The closer the inclination of the lines in the two families, the more pronounced is the effect.";

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v) => typeof v === "number" && Number.isFinite(v);

  /** Java's Integer.parseInt(s, 16), or the constructor's fallback. */
  function hexColor(value, fallback) {
    const n = parseInt(value, 16);
    return Number.isFinite(n) ? n : fallback;
  }

  function pageColors(params) {
    const p = params || {};
    return {
      background: hexColor(p.bcolor, FALLBACK_COLORS.background),
      foreground: hexColor(p.fcolor, FALLBACK_COLORS.foreground),
    };
  }

  /** A real AWT scrollbar's fields, straight from its five constructor ints. */
  function scrollbar(args) {
    return { value: args[1], visible: args[2], min: args[3], max: args[4] };
  }

  /** Integer scrollbar values only; bad or missing input keeps the old value. */
  function clampParam(name, value) {
    const lim = LIMITS[name];
    if (!lim || !finite(Number(value))) return null;
    return clamp(Math.trunc(Number(value)), lim[0], lim[1]);
  }

  function start(options) {
    const o = options || {};
    const state = { ...START, reveal: false, touches: 0 };
    for (const name of ["dist", "angle", "space", "width"]) {
      if (o[name] !== undefined) {
        const v = clampParam(name, o[name]);
        if (v !== null) state[name] = v;
      }
    }
    if (o.reveal !== undefined) state.reveal = Boolean(o.reveal);
    return state;
  }

  /** One option changes; the old position is not touched. */
  function setParam(state, name, value) {
    const v = clampParam(name, value);
    if (v === null || !(name in state) || state[name] === v) return state;
    return { ...state, [name]: v, touches: state.touches + 1 };
  }

  function setReveal(state, on) {
    const reveal = Boolean(on);
    if (state.reveal === reveal) return state;
    return { ...state, reveal, touches: state.touches + 1 };
  }

  /** An illustration has no win and no loss. */
  function result() {
    return null;
  }

  const theta = (state) => (state.angle * Math.PI) / 180;

  /**
   * One call to DrawLine(g, px, dx, cy, dy, bounds), offsets 0-38:
   *   p = (px + dx, cy - dy + 1), q = (px - dx, cy + dy + 1).
   * The midpoint is (px, cy + 1) and the slope is -dy/dx = -tan(angle).
   */
  function transversal(state, px, cy) {
    const th = theta(state);
    const t = state.dist / Math.tan(th);
    const dx = t * Math.cos(th);
    const dy = t * Math.sin(th);
    return {
      p: { x: px + dx, y: cy - dy + 1 },
      q: { x: px - dx, y: cy + dy + 1 },
    };
  }

  /**
   * DoubLine.Draw with a bounds rectangle (offsets 51-364): an infinite line
   * clipped to the board. Vertical lines use the rounded x; shallow lines are
   * clipped left/right; steep ones (including |slope| = 1) top/bottom.
   */
  function clipToBoard(p, q) {
    const rect = { x: 0, y: 0, width: VIEW.width, height: VIEW.height };
    if (Math.abs(p.x - q.x) < 0.1) {
      const x = Math.round(p.x);
      return [{ x, y: rect.y }, { x, y: rect.y + rect.height }];
    }
    const slope = (q.y - p.y) / (q.x - p.x);
    if (Math.abs(slope) < 1) {
      const y0 = Math.round(p.y + slope * (rect.x - p.x));
      const y1 = Math.round(p.y + slope * (rect.x + rect.width - p.x));
      return [{ x: rect.x, y: y0 }, { x: rect.x + rect.width, y: y1 }];
    }
    const x0 = Math.round(p.x + (rect.y - p.y) / slope);
    const x1 = Math.round(p.x + (rect.y + rect.height - p.y) / slope);
    return [{ x: x0, y: rect.y }, { x: x1, y: rect.y + rect.height }];
  }

  const slope = (p, q) => (q.y - p.y) / (q.x - p.x);

  /**
   * DrawOcclusion: fillRect(x - Width/2, 0, 2*(Width/2), H) for x from
   * -Space/2 while x < W + Space, stepping by Space. Java's int division
   * truncates toward zero, so both halves use Math.trunc.
   */
  function bars(state) {
    const half = Math.trunc(state.width / 2);
    const out = [];
    for (let x = Math.trunc(-state.space / 2); x < VIEW.width + state.space; x += state.space) {
      out.push({ x: x - half, y: 0, width: 2 * half, height: VIEW.height });
    }
    return out;
  }

  /** The entire picture, in board units, exactly as the two canvas methods draw it. */
  function geometry(state) {
    const th = theta(state);
    const stepX = state.dist / Math.sin(th);
    const t = state.dist / Math.tan(th);
    const dx = t * Math.cos(th);
    const dy = t * Math.sin(th);
    const lines = [];
    for (let x = -2 * VIEW.width; x <= 2 * VIEW.width; x += stepX) {
      // The loop draws three calls: x, then x+1 twice (the last one a pixel lower).
      const calls = [
        [x, VIEW.height / 2],
        [x + 1, VIEW.height / 2],
        [x + 1, VIEW.height / 2 + 1],
      ];
      for (const [px, cy] of calls) {
        const seg = transversal(state, px, cy);
        lines.push({ x: px, cy, p: seg.p, q: seg.q, clipped: clipToBoard(seg.p, seg.q) });
      }
    }
    return {
      theta: th,
      stepX,
      halfLength: t,
      halfWidth: dx,
      halfHeight: dy,
      slope: -Math.tan(th),
      lines,
      bars: bars(state),
      // The red bars are vertical: their inclination differs from a
      // transversal's by |90 - angle| degrees.
      inclinationGap: Math.abs(90 - state.angle),
    };
  }

  /** Pool sizes for the SVG UI: the scrollbars' most crowded configurations. */
  function maxLineCount() {
    const step = LIMITS.dist[0] / Math.sin(Math.PI / 2);
    return 3 * (Math.ceil((4 * VIEW.width) / step) + 2);
  }
  function maxBarCount() {
    const space = LIMITS.space[0];
    return Math.ceil((VIEW.width + 2 * space) / space) + 2;
  }

  /** One representative transversal through the centre, sampled across the board. */
  function samples(state, count) {
    const n = count === undefined ? 400 : Math.max(3, Math.trunc(count));
    const m = -Math.tan(theta(state));
    const bs = bars(state);
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = (VIEW.width * i) / (n - 1);
      const y = CENTER.y + m * (x - CENTER.x);
      out.push({ x, y, hidden: bs.some((b) => x >= b.x && x <= b.x + b.width) });
    }
    return out;
  }

  /** Points on the representative line at a given x (for the collinearity test). */
  function lineY(state, x) {
    return CENTER.y - Math.tan(theta(state)) * (x - CENTER.x);
  }

  /** What the page claims, split into what coordinates can check and what not. */
  function claims(state) {
    const g = geometry(state);
    const sp = samples(state, 400);
    const ideal = g.slope;
    const parallel = g.lines.every((l) => Math.abs(l.p.x - l.q.x) < 0.1 ||
      Math.abs(slope(l.p, l.q) - ideal) <= 1e-9 * Math.max(1, Math.abs(ideal)));
    // Every clipped end is the rounded intersection of the SAME infinite line
    // with a board edge. Java's Math.round allows half a board unit either way.
    const clippedStraight = g.lines.every((l) => {
      const a = l.clipped[0], b = l.clipped[1], p = l.p, q = l.q;
      const rounded = (v) => Math.abs(v - Math.round(v)) <= 0.500000001;
      if (Math.abs(p.x - q.x) < 0.1) {
        return a.x === b.x && rounded(p.x - a.x) && a.y === 0 && b.y === VIEW.height;
      }
      const m = (q.y - p.y) / (q.x - p.x);
      if (Math.abs(m) < 1) {
        return a.x === 0 && b.x === VIEW.width &&
          rounded(p.y + m * (a.x - p.x) - a.y) &&
          rounded(p.y + m * (b.x - p.x) - b.y);
      }
      return a.y === 0 && b.y === VIEW.height &&
        rounded(p.x + (a.y - p.y) / m - a.x) &&
        rounded(p.x + (b.y - p.y) / m - b.x);
    });
    const verticalBars = g.bars.every((b) => b.y === 0 && b.height === VIEW.height &&
      b.x + b.width > b.x);
    const onOneLine = sp.every((s) => Math.abs(s.y - lineY(state, s.x)) < 1e-9);
    return {
      parallel,
      clippedStraight,
      verticalBars,
      onOneLine,
      hiddenCount: sp.filter((s) => s.hidden).length,
      visibleCount: sp.filter((s) => !s.hidden).length,
      inclinationGap: g.inclinationGap,
      // "more pronounced" is a claim about how the picture looks, not about
      // coordinates, so the test does not pretend to measure it.
      perceivedStrength: null,
      pageClaim: PAGE_CLAIM,
    };
  }

  /* -------------------------------------- accessible draggable points (UI) */

  const angleHandle = (state) => ({
    x: CENTER.x + HANDLE_RADIUS * Math.cos(theta(state)),
    y: CENTER.y - HANDLE_RADIUS * Math.sin(theta(state)),
  });

  const spacingHandle = (state) => ({
    x: CENTER.x + state.dist / Math.sin(theta(state)) / 2,
    y: CENTER.y,
  });

  function angleFromPoint(p) {
    const deg = (Math.atan2(CENTER.y - p.y, p.x - CENTER.x) * 180) / Math.PI;
    return clamp(Math.round(deg), LIMITS.angle[0], LIMITS.angle[1]);
  }

  function distFromPoint(state, p) {
    const step = 2 * (p.x - CENTER.x);
    return clamp(Math.round(step * Math.sin(theta(state))), LIMITS.dist[0], LIMITS.dist[1]);
  }

  function clampAngleHandle(p) {
    const a = angleHandle({ angle: angleFromPoint(p) });
    return a;
  }

  function clampSpacingHandle(state, p) {
    return spacingHandle({ angle: state.angle, dist: distFromPoint(state, p) });
  }

  function handles(state) {
    return [
      { name: "angle", point: angleHandle(state) },
      { name: "spacing", point: spacingHandle(state) },
    ];
  }

  function paramFromHandle(state, name, p) {
    if (name === "angle") return { name: "angle", value: angleFromPoint(p) };
    if (name === "spacing") return { name: "dist", value: distFromPoint(state, p) };
    return null;
  }

  return {
    VIEW, CENTER, PAGE_PARAMS, FALLBACK_COLORS, LIMITS, SCROLLBARS, START,
    HANDLE_RADIUS, PAGE_CLAIM,
    clamp, hexColor, pageColors, scrollbar, clampParam,
    start, setParam, setReveal, result,
    theta, transversal, clipToBoard, slope, bars, geometry, maxLineCount, maxBarCount,
    samples, lineY, claims,
    angleHandle, spacingHandle, angleFromPoint, distFromPoint,
    clampAngleHandle, clampSpacingHandle, handles, paramFromHandle,
  };
})();
