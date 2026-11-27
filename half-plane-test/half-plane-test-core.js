"use strict";

/*
 * Half Plane Test, from Alexander Bogomolny's applet HalfPlaneTest.
 *
 * Every draggable line keeps the side for which GeoSDoub.FindOrientation(P1,
 * P2, point) is +1. The picture shades the common part of those sides, clipped
 * to the drawing rectangle. Intersecting half planes one at a time keeps the
 * region convex: the same argument as the applet page's induction proof.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, HalfPlaneTestCore, so the page loads it with
 * a plain <script> and porting/check-half-plane-test.mjs loads it in Node.
 * Positions are plain data and can be handed to Track.state as they are.
 */
const HalfPlaneTestCore = (() => {
  // HalfPlaneTestCanvas starts with N = 1; HalfPlaneTestPanel spins 1..20.
  const WIDTH = 400;
  const HEIGHT = 300;
  const BAND = 40; // Reset puts P1 in the top 40 rows, P2 in the bottom 40.
  const MIN_LINES = 1;
  const MAX_LINES = 20;
  const HIT_RADIUS = 5; // MoveableLineAdvanced.Inside: a hit within 5 pixels.
  const BOUNDS = Object.freeze({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.FindOrientation: the determinant, +1 when positive, -1 otherwise. */
  function orientation(a, b, p) {
    const z = a.x * (b.y - p.y) + b.x * (p.y - a.y) + p.x * (a.y - b.y);
    return z > 0 ? 1 : -1;
  }

  /** HalfPlane2D.contains: the kept side of the directed line P1 -> P2. */
  function contains(line, p) {
    return orientation(line.p1, line.p2, p) === 1;
  }

  /** GeoSDoub.Intersect of two lines, written in its implicit form. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // the applet's tolerance
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  /**
   * MoveableLineAdvanced.SqueezeIn: put the two ends on the border of the
   * drawing rectangle, without changing which side of the line is kept.
   */
  function squeeze(line, bounds) {
    const box = bounds || BOUNDS;
    const p1 = line.p1, p2 = line.p2;
    if (Math.abs(p2.x - p1.x) < 0.1) {
      const a = { x: p2.x, y: box.y - 5 };
      const b = { x: p2.x, y: box.y + box.height + 5 };
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      return orientation(a, b, centre) === orientation(p1, p2, centre)
        ? { p1: a, p2: b }
        : { p1: b, p2: a };
    }
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    let lo = -Infinity, hi = Infinity;
    for (const [start, delta, min, max] of [
      [p1.x, dx, box.x, box.x + box.width],
      [p1.y, dy, box.y, box.y + box.height],
    ]) {
      if (delta === 0) {
        if (start < min || start > max) return { p1: copy(p1), p2: copy(p2) };
      } else {
        let t = (min - start) / delta, u = (max - start) / delta;
        if (t > u) { const tmp = t; t = u; u = tmp; }
        lo = Math.max(lo, t);
        hi = Math.min(hi, u);
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) {
      return { p1: copy(p1), p2: copy(p2) };
    }
    let a = { x: p1.x + dx * lo, y: p1.y + dy * lo };
    let b = { x: p1.x + dx * hi, y: p1.y + dy * hi };
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (orientation(a, b, centre) !== orientation(p1, p2, centre)) {
      const tmp = a; a = b; b = tmp;
    }
    return { p1: a, p2: b };
  }

  /** HalfPlaneTestCanvas.Reset: random lines from the top and bottom bands. */
  function randomLine(rng, bounds) {
    const box = bounds || BOUNDS;
    const rand = rng || Math.random;
    const raw = {
      p1: { x: rand() * box.width, y: box.y + rand() * BAND },
      p2: { x: rand() * box.width, y: box.y + box.height - BAND + rand() * BAND },
    };
    return squeeze(raw, box);
  }

  /** The position a new run starts from. `options.rng` may be a seeded PRNG. */
  function start(options) {
    const o = options || {};
    const n = clamp(Math.round(Number(o.n) || MIN_LINES), MIN_LINES, MAX_LINES);
    const lines = [];
    for (let i = 0; i < n; i++) lines.push(randomLine(o.rng));
    return {
      n,
      lines,
      showIntersection: false,
      selected: 0,
      slide: false,
      moves: 0,
      explored: { lines: false, options: false },
    };
  }

  /** HalfPlaneTestPanel's spin: remove from the end, or add fresh lines. */
  function setCount(state, n, rng) {
    const count = clamp(Math.round(Number(n)), MIN_LINES, MAX_LINES);
    if (!Number.isFinite(count) || count === state.n) return state;
    const lines = state.lines.slice(0, count);
    for (let i = lines.length; i < count; i++) lines.push(randomLine(rng));
    return {
      ...state,
      n: count,
      lines,
      selected: Math.min(state.selected, count - 1),
      moves: state.moves + 1,
      explored: { ...state.explored, options: true },
    };
  }

  /** MoveableLineAdvanced.Inside: which end swings, or whether both slide. */
  function hitMotion(line, p) {
    const a = line.p1, b = line.p2;
    const dx = a.x - b.x, dy = a.y - b.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return null;
    const ux = a.x - p.x, uy = a.y - p.y;
    const t = ((b.x - a.x) * -ux + (b.y - a.y) * -uy) / len2;
    const projection = ux * dx + uy * dy;
    const dist2 = ux * ux + uy * uy - (projection * projection) / len2;
    if (Math.sqrt(Math.max(0, dist2)) >= HIT_RADIUS) return null;
    if (t < 0.1) return "rotate1";
    if (t > 0.9) return "rotate2";
    return "translate";
  }

  function clampPoint(p, bounds) {
    const box = bounds || BOUNDS;
    return {
      x: clamp(p.x, box.x, box.x + box.width),
      y: clamp(p.y, box.y, box.y + box.height),
    };
  }

  function replaceLine(state, index, line) {
    if (index < 0 || index >= state.lines.length) return state;
    const lines = state.lines.slice();
    lines[index] = line;
    return {
      ...state,
      lines,
      selected: index,
      moves: state.moves + 1,
      explored: { ...state.explored, lines: true },
    };
  }

  /** Swing one end around the other, as a drag near a border does. */
  function moveEnd(state, index, which, p, bounds) {
    const line = state.lines[index];
    if (!line) return state;
    const q = clampPoint(p, bounds);
    const next = which === "p2"
      ? { p1: line.p1, p2: q }
      : { p1: q, p2: line.p2 };
    return replaceLine(state, index, squeeze(next, bounds));
  }

  /** Slide the line parallel to itself, keeping the same kept side. */
  function translate(state, index, dx, dy, bounds) {
    const line = state.lines[index];
    if (!line) return state;
    const raw = {
      p1: clampPoint({ x: line.p1.x + dx, y: line.p1.y + dy }, bounds),
      p2: clampPoint({ x: line.p2.x + dx, y: line.p2.y + dy }, bounds),
    };
    return replaceLine(state, index, squeeze(raw, bounds));
  }

  /** A pointer drag on the line itself: rotate at an end, slide in the middle. */
  function dragAt(state, index, p) {
    const line = state.lines[index];
    if (!line) return null;
    const motion = hitMotion(line, p);
    if (!motion) return null;
    if (motion === "rotate1") return moveEnd(state, index, "p1", p);
    if (motion === "rotate2") return moveEnd(state, index, "p2", p);
    return translate(state, index, 0, 0); // the pointer handler supplies the delta
  }

  /** Sutherland-Hodgman: keep the part of a polygon inside one half plane. */
  function clipHalfPlane(polygon, line) {
    if (polygon.length === 0) return [];
    const out = [];
    for (let i = 0; i < polygon.length; i++) {
      const cur = polygon[i], next = polygon[(i + 1) % polygon.length];
      const inCur = contains(line, cur), inNext = contains(line, next);
      if (inCur) out.push(cur);
      if (inCur !== inNext) {
        const hit = intersect(cur, next, line.p1, line.p2);
        if (Number.isFinite(hit.x) && Number.isFinite(hit.y)) out.push(hit);
      }
    }
    return out;
  }

  /** The common part of all the kept sides, clipped to the drawing rectangle. */
  function intersection(lines, bounds) {
    const box = bounds || BOUNDS;
    let poly = [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      { x: box.x, y: box.y + box.height },
    ];
    for (const line of lines.slice(0, Math.min(lines.length, MAX_LINES))) {
      poly = clipHalfPlane(poly, line);
      if (poly.length === 0) break;
    }
    return poly.filter((p, i) => {
      const q = poly[(i + 1) % poly.length];
      return Math.hypot(p.x - q.x, p.y - q.y) > EPS;
    });
  }

  /** Shoelace area, with the sign dropped (zero for a point or a segment). */
  function area(polygon) {
    let sum = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }

  /** A polygon is convex when all its turns have the same sign. */
  function isConvex(polygon) {
    let sign = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], c = polygon[(i + 2) % polygon.length];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-7) continue;
      const now = cross > 0 ? 1 : -1;
      if (sign && now !== sign) return false;
      sign = now;
    }
    return true;
  }

  function inPolygon(polygon, p) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function containsAll(lines, p) {
    return lines.every((line) => contains(line, p));
  }

  /** The demo ends once the visitor has moved a line and changed an option. */
  function result(state) {
    return state && state.explored.lines && state.explored.options ? "done" : null;
  }

  /** Dispatch used by the page's controls. */
  function move(state, m) {
    if (!state || !m) return state;
    switch (m.type) {
      case "new": {
        const fresh = start({ n: state.n, rng: m.rng });
        return { ...fresh, showIntersection: state.showIntersection, slide: state.slide,
          explored: { ...state.explored } };
      }
      case "count": return setCount(state, m.value, m.rng);
      case "show": return { ...state, showIntersection: !!m.value, moves: state.moves + 1,
        explored: { ...state.explored, options: true } };
      case "select": {
        const i = ((Math.round(m.value) % state.n) + state.n) % state.n;
        return { ...state, selected: i };
      }
      case "slide": return { ...state, slide: !!m.value };
      case "end": return moveEnd(state, m.index === undefined ? state.selected : m.index, m.which, m.point, m.bounds);
      case "translate": return translate(state, m.index === undefined ? state.selected : m.index, m.dx, m.dy, m.bounds);
      case "squeeze": {
        const i = m.index === undefined ? state.selected : m.index;
        return state.lines[i] ? replaceLine(state, i, squeeze(state.lines[i], m.bounds)) : state;
      }
      default: return state;
    }
  }

  return {
    WIDTH, HEIGHT, BAND, MIN_LINES, MAX_LINES, HIT_RADIUS, BOUNDS,
    copy, clamp, clampPoint, orientation, contains, intersect, squeeze, randomLine,
    start, setCount, hitMotion, moveEnd, translate, dragAt,
    clipHalfPlane, intersection, area, isConvex, inPolygon, containsAll,
    result, move,
  };
})();
