"use strict";

/*
 * Given Common Chord, from Alexander Bogomolny's applet GivenCommonChord
 * (cut-the-knot.org, after Yaglom, Geometric Transformations I, problem 7(a)).
 *
 * Two circles meet at P and Q. A separate horizontal segment of length a sits
 * at the top of the board. We want a line through P whose other crossings with
 * the circles, M1 and M2, are exactly a apart. Drop perpendiculars from the two
 * centres onto that line: their feet are the midpoints of PM1 and PM2, so the
 * feet are a/2 apart. Translating that little segment to start at O1 puts its
 * other end at a point T on the circle with diameter O1O2 and distance a/2
 * from O1. One such T means one line, two mean two, none means no solution.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, GivenCommonChordCore, so the page loads it with a
 * plain <script> and porting/check-given-common-chord.mjs loads it in Node.
 * Its position is plain data, so it can be saved and handed to the tutor.
 *
 * The geometry helpers follow the applet's own GeoSDoub bytecode, including
 * its choice of an X-branch or a Y-branch for circle/line intersections and
 * its "second point at least one unit away" rule for the other intersection.
 * The applet keeps the length as an integer and uses floor(L/2) as the radius
 * of the auxiliary circle, so an odd L cuts a chord of L-1, not L: that quirk
 * is kept and reported by the logic test.
 */
const GivenCommonChordCore = (() => {
  const WIDTH = 640;
  const HEIGHT = 460;
  const MARGIN = 14;
  const ROW = HEIGHT / 8;              // the length segment slides on this row
  const L0 = 260;
  const MIN_LENGTH = 2;
  const MIN_RADIUS = 2;
  const HANDLES = ["A", "B", "C1", "R1", "C3", "R3"];
  const OPTIONS = ["showHint", "showNames"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** GeoSDoub.GetParallelTo(p, a, b) = p + 100 * (a - b). */
  const parallelTo = (p, a, b) => ({
    x: p.x + 100 * (a.x - b.x),
    y: p.y + 100 * (a.y - b.y),
  });

  /** GeoSDoub.IntersectCirclesX / Y, dispatched exactly as the applet does. */
  function intersectCirclesX(c0, c1) {
    const m = -(c0.y - c1.y) / (c0.x - c1.x);
    const b = (
      c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.x - c1.x);
    const h = b - c0.x, a = m * m + 1, k = m * h - c0.y;
    const c = h * h + c0.y * c0.y - c0.r * c0.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  function intersectCirclesY(c0, c1) {
    const m = -(c0.x - c1.x) / (c0.y - c1.y);
    const b = (
      c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.y - c1.y);
    const h = b - c0.y, a = m * m + 1, k = m * h - c0.x;
    const c = h * h + c0.x * c0.x - c0.r * c0.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / a, x2 = (-k - root) / a;
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }

  function intersectCircles(c0, c1) {
    if (!c0 || !c1 || !finite(c0) || !finite(c1) ||
        !Number.isFinite(c0.r) || !Number.isFinite(c1.r)) return null;
    if (Math.abs(c0.x - c1.x) > 1) return intersectCirclesX(c0, c1);
    if (Math.abs(c0.y - c1.y) > 1) return intersectCirclesY(c0, c1);
    return [copy(c0), copy(c0)];
  }

  /** GeoSDoub.Intersect(DoubLine, DoubCircle), via IntersectX and IntersectY. */
  function intersectX(line, circle) {
    const p = line.p, q = line.q;
    const m = (p.x - q.x) / (p.y - q.y);
    const b = q.x - m * q.y;
    const a = m * m + 1;
    const k = m * (b - circle.x) - circle.y;
    const c = circle.y * circle.y + (b - circle.x) ** 2 - circle.r * circle.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  function intersectY(line, circle) {
    const p = line.p, q = line.q;
    const m = (p.y - q.y) / (p.x - q.x);
    const b = q.y - m * q.x;
    const a = m * m + 1;
    const k = m * (b - circle.y) - circle.x;
    const c = circle.x * circle.x + (b - circle.y) ** 2 - circle.r * circle.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / a, x2 = (-k - root) / a;
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }

  function intersectLineCircle(line, circle) {
    if (!line || !circle || !finite(line.p) || !finite(line.q) ||
        !finite(circle) || !Number.isFinite(circle.r)) return null;
    if (Math.abs(line.p.y - line.q.y) > 1) return intersectX(line, circle);
    if (Math.abs(line.p.x - line.q.x) > 1) return intersectY(line, circle);
    return null;
  }

  /** Canvas.Other: the crossing at least one unit from P, otherwise the first. */
  function other(hits, p) {
    if (!hits || !hits.length) return null;
    if (dist(hits[0], p) < 1) return hits[1] || null;
    return hits[0];
  }

  /** GeoSDoub.NearestPoint(p, a, b), the foot of the perpendicular. */
  function nearestPoint(p, a, b) {
    if (!finite(p)) return null;
    if (sqDist(p, a) < 0.1) return copy(p);
    const vx = b.x - a.x, vy = b.y - a.y;
    const len = vx * vx + vy * vy;
    if (!(len > 0)) return copy(a);
    const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len;
    return { x: a.x + t * vx, y: a.y + t * vy };
  }

  function defaultStart() {
    return {
      A: { x: WIDTH / 2, y: ROW },
      B: { x: WIDTH / 2 + L0, y: ROW },
      C1: { x: WIDTH * 2 / 10 + 100, y: HEIGHT / 2 + HEIGHT / 5 },
      R1: { x: WIDTH * 2 / 10 + 100 - 100 - 50, y: HEIGHT / 2 + HEIGHT / 5 },
      C3: { x: WIDTH * 6 / 10, y: HEIGHT / 2 + HEIGHT / 5 },
      R3: { x: WIDTH * 6 / 10 + 120, y: HEIGHT / 2 + HEIGHT / 5 },
    };
  }

  /** The opening drawing. Individual handles may be overridden by a test. */
  function start(options) {
    const o = options || {}, d = defaultStart();
    const s = {
      L: L0, whichLine: 0, showHint: false, showNames: false,
      moves: 0, explored: false,
    };
    for (const key of HANDLES) s[key] = o[key] && finite(o[key]) ? copy(o[key]) : copy(d[key]);
    s.A.y = ROW;                        // MoveablePoint.Fix(2): A and B slide
    s.B.y = ROW;                        // horizontally only, on the top row.
    s.L = Math.floor(Math.abs(s.B.x - s.A.x));
    if (Number.isInteger(o.whichLine) && o.whichLine >= 0 && o.whichLine <= 2) {
      s.whichLine = o.whichLine;
    }
    for (const key of OPTIONS) s[key] = o[key] === undefined ? false : !!o[key];
    return s;
  }

  function legalMoves() {
    return HANDLES.slice();
  }

  /** Drag one handle. A and B keep their row and set L = floor(|xB - xA|). */
  function movePoint(s, name, p) {
    if (HANDLES.indexOf(name) < 0 || !p || !finite(p)) return s;
    const q = clampToBoard(p);
    const next = Object.assign({}, s);
    if (name === "A" || name === "B") {
      next[name] = { x: q.x, y: ROW };
      next.L = Math.floor(Math.abs(next.B.x - next.A.x));
    } else {
      next[name] = q;
    }
    next.moves = s.moves + 1;
    next.explored = true;
    return next;
  }

  /** Drag a whole circle: its centre and its rim handle travel together. */
  function translateCircle(s, which, dx, dy) {
    if (which !== 1 && which !== 2) return s;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return s;
    const cKey = which === 1 ? "C1" : "C3";
    const rKey = which === 1 ? "R1" : "R3";
    const c = s[cKey], r = s[rKey];
    const ddx = clamp(dx, MARGIN - Math.min(c.x, r.x), WIDTH - MARGIN - Math.max(c.x, r.x));
    const ddy = clamp(dy, MARGIN - Math.min(c.y, r.y), HEIGHT - MARGIN - Math.max(c.y, r.y));
    if (ddx === 0 && ddy === 0) return s;
    const next = Object.assign({}, s);
    next[cKey] = { x: c.x + ddx, y: c.y + ddy };
    next[rKey] = { x: r.x + ddx, y: r.y + ddy };
    next.moves = s.moves + 1;
    next.explored = true;
    return next;
  }

  /** The radio group and the two checkboxes of the applet's bottom panel. */
  function setWhichLine(s, n) {
    if (!Number.isInteger(n) || n < 0 || n > 2) return s;
    return Object.assign({}, s, { whichLine: n, explored: true });
  }

  function setOption(s, key, value) {
    if (OPTIONS.indexOf(key) < 0) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Back to the opening drawing, keeping the panel's choices. */
  function reset(s) {
    return start({
      whichLine: s.whichLine, showHint: s.showHint, showNames: s.showNames,
    });
  }

  /** Everything the page draws, recomputed from the position. */
  function compute(s) {
    const base = {
      A: s.A, B: s.B, C1: s.C1, R1: s.R1, C3: s.C3, R3: s.R3,
      L: s.L, whichLine: s.whichLine, half: Math.floor(s.L / 2),
      r1: NaN, r2: NaN, d: NaN,
      c1: null, c2: null, cOO: null, cL: null,
      P: null, Q: null, T: [], lines: [], M: [null, null], N: [null, null],
      feet: [null, null], chord1: NaN, chord2: NaN,
      solutionCount: 0, noDraw: false, noSolution: false, degenerate: true,
    };
    const r1 = dist(s.C1, s.R1), r2 = dist(s.C3, s.R3);
    const d = dist(s.C1, s.C3);
    const half = Math.floor(s.L / 2);
    if (s.L < MIN_LENGTH || r1 < MIN_RADIUS || r2 < MIN_RADIUS) {
      return Object.assign(base, { r1, r2, d, half, noDraw: true });
    }
    const c1 = { x: s.C1.x, y: s.C1.y, r: r1 };
    const c2 = { x: s.C3.x, y: s.C3.y, r: r2 };
    const cOO = { x: midpoint(s.C1, s.C3).x, y: midpoint(s.C1, s.C3).y, r: d / 2 };
    const cL = { x: s.C1.x, y: s.C1.y, r: half };
    const hits = intersectCircles(c1, c2);
    if (!hits) {
      return Object.assign(base, {
        r1, r2, d, half, c1, c2, cOO, cL, noSolution: true,
      });
    }
    const Q = hits[0], P = hits[1] || hits[0];
    if (half > d) {
      return Object.assign(base, {
        r1, r2, d, half, c1, c2, cOO, cL, P, Q, noSolution: true,
      });
    }
    /* GeoSDoub.Intersect(CircleOO, CircleL) always returns two entries here;
       a tangency gives the same point twice, hence a single distinct line. */
    const T = intersectCircles(cOO, cL) || [];
    if (!T.length || !finite(T[0]) || !finite(T[1])) {
      return Object.assign(base, {
        r1, r2, d, half, c1, c2, cOO, cL, P, Q, T, noSolution: true,
      });
    }
    const lines = T.map((t) => ({ p: P, q: parallelTo(P, s.C1, t) }));
    const M = [
      other(intersectLineCircle(lines[0], c1), P),
      other(intersectLineCircle(lines[0], c2), P),
    ];
    const N = [
      other(intersectLineCircle(lines[1], c1), P),
      other(intersectLineCircle(lines[1], c2), P),
    ];
    let feet = [null, null];
    if (s.whichLine === 0 || s.whichLine === 1) {
      const line = lines[s.whichLine];
      feet = [nearestPoint(s.C1, line.p, line.q), nearestPoint(s.C3, line.p, line.q)];
    }
    const chord1 = finite(M[0]) && finite(M[1]) ? dist(M[0], M[1]) : NaN;
    const chord2 = finite(N[0]) && finite(N[1]) ? dist(N[0], N[1]) : NaN;
    const one = dist(T[0], T[1]) < 1e-6;
    return Object.assign(base, {
      r1, r2, d, half, c1, c2, cOO, cL, P, Q, T, lines, M, N, feet,
      chord1, chord2,
      solutionCount: one ? 1 : 2,
      degenerate: !finite(P) || !finite(M[0]) || !finite(M[1]) ||
        !finite(N[0]) || !finite(N[1]),
    });
  }

  /** The status line. This is a drawing, so there is no winner to announce. */
  function describe(s) {
    const g = compute(s);
    if (g.noDraw) {
      return "Make the top segment at least 2 units long and both circles at least 2 units wide.";
    }
    if (g.noSolution) {
      if (!g.P) return "The two circles have to meet before a common chord can be drawn.";
      return "The circle centres are too close for a chord that long: move them apart or shorten the top segment.";
    }
    const chord = g.solutionCount === 1 ? g.chord1 : (g.whichLine === 1 ? g.chord2 : g.chord1);
    const len = Number.isFinite(chord) ? Math.round(chord) : g.L;
    if (g.solutionCount === 1) {
      return `One line through P works; it cuts a ${len} unit chord.`;
    }
    if (g.whichLine === 2) {
      return `Two lines through P work; either cuts a ${len} unit chord.`;
    }
    return `Two lines through P work; line ${g.whichLine + 1} cuts a ${len} unit chord.`;
  }

  function result() {
    return null;                       // an illustration: nobody wins or loses
  }

  return {
    WIDTH, HEIGHT, MARGIN, ROW, L0, MIN_LENGTH, MIN_RADIUS, HANDLES, OPTIONS,
    copy, finite, clamp, clampToBoard, sqDist, dist, midpoint,
    parallelTo, intersectCirclesX, intersectCirclesY, intersectCircles,
    intersectX, intersectY, intersectLineCircle, other, nearestPoint,
    start, legalMoves, movePoint, translateCircle, setWhichLine, setOption,
    reset, compute, describe, result,
  };
})();
