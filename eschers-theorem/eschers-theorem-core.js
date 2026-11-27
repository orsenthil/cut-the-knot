"use strict";

/*
 * Escher's theorem, from Alexander Bogomolny's applet EschersTheorem.
 *
 * Aq, Bq, Cq are the fixed vertices of an equilateral triangle (they are the
 * centroids of the three Napoleon triangles on the moving triangle ABC).
 * Drag any one of A, B, C and the other two are rebuilt with 120-degree
 * rotations about the fixed triangle, exactly as the applet's UseAToAdjust,
 * UseBToAdjust and UseCToAdjust do. The derived Napoleon apices and the
 * concurrence point come from Compute(); the coloured hexagons come from
 * HexagonForRotation.Recreate().
 *
 * No document, no window, no storage: one global, plain data in and out.
 */

const EschersTheoremCore = (() => {
  const WIDTH = 640;
  const HEIGHT = 420;
  const CENTER = { x: 320, y: 210 };
  // The applet's own sizing rule: floor(min(w, h) / 2.3) - 2 * 60.
  const R = Math.floor(Math.min(WIDTH / 2.3, HEIGHT / 2.3)) - 120;
  const B_RADIUS = R + 10;
  const THIRD_TURN = 2 * Math.PI / 3;      // 120 degrees
  const NAPOLEON_TURN = Math.PI / 3;       // 60 degrees
  const PATTERNS = ["1351", "3513", "5135"];
  const EPS = 1e-8;

  const pointOn = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  const copy = (p) => ({ x: p.x, y: p.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** GeoSDoub.Rotate(pivot, point, angle, sign): turn point about pivot. */
  function rotate(pivot, point, angle, sign) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    return {
      x: pivot.x + co * dx - sign * si * dy,
      y: pivot.y + sign * si * dx + co * dy,
    };
  }

  /** GeoSDoub.Intersect: the two lines a-b and c-d; NaN for parallel lines. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** CTKGeometryPlus.Barycenter: the ordinary average of three points. */
  function barycenter(a, b, c) {
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }

  /** The smaller angle at v between v->p and v->q, in radians. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (la < EPS || lb < EPS) return NaN;
    const t = Math.max(-1, Math.min(1, dot(a, b) / (la * lb)));
    return Math.acos(t);
  }

  /** True when p lies (within tol) on the infinite line through a and b. */
  function onLine(p, a, b, tol) {
    const d = sub(b, a);
    if (Math.hypot(d.x, d.y) < EPS) return false;
    return Math.abs(cross(sub(p, a), d)) / Math.hypot(d.x, d.y) <= (tol === undefined ? 1e-6 : tol);
  }

  function clampToBoard(p) {
    return {
      x: Math.max(16, Math.min(WIDTH - 16, p.x)),
      y: Math.max(16, Math.min(HEIGHT - 16, p.y)),
    };
  }

  /* The three UseXToAdjust methods, transcribed method by method. */
  function adjustPoints(s, name, p) {
    const q = copy(p);
    if (name === "A") {
      return {
        A: q,
        B: rotate(s.Cq, q, THIRD_TURN, 1),
        C: rotate(s.Bq, q, THIRD_TURN, -1),
      };
    }
    if (name === "B") {
      return {
        A: rotate(s.Cq, q, THIRD_TURN, -1),
        B: q,
        C: rotate(s.Aq, q, THIRD_TURN, 1),
      };
    }
    return {
      A: rotate(s.Bq, q, THIRD_TURN, 1),
      B: rotate(s.Aq, q, THIRD_TURN, -1),
      C: q,
    };
  }

  /* Compute(): apices of the three equilateral triangles and the Kiepert point. */
  function derive(s) {
    const Ap = rotate(s.B, s.C, NAPOLEON_TURN, 1);
    const Bp = rotate(s.C, s.A, NAPOLEON_TURN, 1);
    const Cp = rotate(s.A, s.B, NAPOLEON_TURN, 1);
    const p = intersect(s.A, s.Aq, s.B, s.Bq);
    const q = intersect(s.B, s.Bq, s.C, s.Cq);
    const r = intersect(s.C, s.Cq, s.A, s.Aq);
    return { Ap: Ap, Bp: Bp, Cp: Cp, F: barycenter(p, q, r), crosses: [p, q, r] };
  }

  /** Carry the old Ap: Compute() returns early when A is within 2 of it. */
  function refresh(s) {
    if (s.Ap && dist(s.A, s.Ap) < 2) return {};
    return derive(s);
  }

  /** The state after dragging A, B or C to p (p is in board units). */
  function adjust(state, name, p) {
    const next = Object.assign({}, state, adjustPoints(state, name, clampToBoard(p)));
    return Object.assign(next, refresh(next));
  }

  /** The opening picture: B on its circle, then the applet's UseBToAdjust. */
  function start(options) {
    const o = options || {};
    const a0 = pointOn(CENTER, R, Math.PI / 2);
    const b0 = pointOn(CENTER, R, -Math.PI / 6);
    const c0 = pointOn(CENTER, R, -5 * Math.PI / 6);
    const b = pointOn(CENTER, B_RADIUS, 3 * Math.PI / 4);
    let s = {
      A: copy(b), B: copy(b), C: copy(b),
      Aq: a0, Bq: b0, Cq: c0,
      Ap: null, Bp: null, Cp: null, F: null, crosses: null,
      options: {
        names: !!o.names,
        angles: !!o.angles,
        concurrency: !!o.concurrency,
        tessellation: !!o.tessellation,
        hint: !!o.hint,
      },
    };
    s = adjust(s, "B", b);
    return s;
  }

  /** HexagonForRotation: the base hexagon and its Recreate() descendants. */
  function copies(state) {
    const base = [state.A, state.Cq, state.B, state.Aq, state.C, state.Bq];
    const out = [];
    function put(hex) { out.push(hex.map(copy)); }
    function recreate(hex, sequence) {
      if (!sequence.length) { put(hex); return; }
      const pivot = Number(sequence.charAt(0));
      const rest = sequence.slice(1);
      next(hex, rest, pivot, 1);
      next(hex, rest, pivot, -1);
    }
    function next(hex, sequence, pivot, sign) {
      const w = [];
      for (let k = 0; k < 6; k++) {
        w.push(k === pivot ? hex[pivot] : rotate(hex[pivot], hex[k], THIRD_TURN, sign));
      }
      put(w);
      recreate(w, sequence);
    }
    for (const pattern of PATTERNS) recreate(base, pattern);
    return out;
  }

  /** The centre a Recreate() hexagon gets when it is painted. */
  function hexCentre(hex) { return barycenter(hex[0], hex[2], hex[4]); }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, CENTER: CENTER, R: R,
    THIRD_TURN: THIRD_TURN, NAPOLEON_TURN: NAPOLEON_TURN, PATTERNS: PATTERNS,
    pointOn: pointOn, copy: copy, add: add, sub: sub, mul: mul, dot: dot,
    cross: cross, dist: dist, rotate: rotate, intersect: intersect,
    barycenter: barycenter, angleAt: angleAt, onLine: onLine,
    clampToBoard: clampToBoard, adjustPoints: adjustPoints, derive: derive,
    refresh: refresh, adjust: adjust, start: start, copies: copies,
    hexCentre: hexCentre,
  };
})();
