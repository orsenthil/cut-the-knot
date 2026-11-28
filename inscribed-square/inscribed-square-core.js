"use strict";

/*
 * Inscribed Square — Alexander Bogomolny's InscribedSquare Java applet.
 *
 * The triangle keeps a horizontal base AB; C is free. Pick P on AB, erect the
 * perpendicular to AB at P until it reaches the line AC at a point p, and use
 * the length |Pp| as a square's side: P, q (along AB), r (above q) and p form a
 * square with three vertices on the triangle's sides and one dangling free.
 * The ray A->r meets BC at the corner of the *inscribed* square. The applet
 * opens three little "eyes" when the free corner r is less than one pixel from
 * BC. There is no win or loss: this is a construction to explore.
 *
 * The drawing routine is a direct transcription of InscribedSquareCanvas
 * .DrawSquare: GeoSDoub.Intersect (including its |determinant| > 1 test),
 * FindOrientation, NearestPoint and GetParallelTo. The mouse constraints come
 * from UpdatePoints: dragging A or B makes the base horizontal again, and
 * dragging P puts it on the midline of AB.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, InscribedSquareCore, so the page loads it
 * with a plain <script> and porting/check-inscribed-square.mjs loads it in
 * Node. Positions are plain data and every function returns a new position.
 */
const InscribedSquareCore = (() => {
  // The applet was embedded at 600 x 450 on the original page. Its init()
  // uses integer division for the four starting points.
  const WIDTH = 600;
  const HEIGHT = 450;
  const START_A = { x: Math.trunc(WIDTH / 3), y: Math.trunc((HEIGHT * 2) / 3) };
  const START_B = { x: Math.trunc((WIDTH * 2) / 3), y: Math.trunc((HEIGHT * 2) / 3) };
  const START_C = { x: Math.trunc((WIDTH * 3) / 5), y: Math.trunc(HEIGHT / 3) };
  const START_P = { x: Math.trunc((WIDTH * 2) / 5), y: Math.trunc((HEIGHT * 2) / 3) };

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

  /* GeoSDoub.FindOrientation: the applet's sign test, +1 or -1. */
  function orientation(a, b, c) {
    const s = c.x * (b.y - a.y) + c.y * (a.x - b.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /* GeoSDoub.Intersect(p,q,r,s): NaN when the determinant is at most 1. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const xn = b1 * c2 - b2 * c1;
    const yn = a2 * c1 - a1 * c2;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) > 1) return { x: xn / den, y: yn / den };
    return { x: NaN, y: NaN };
  }

  /* GeoSDoub.NearestPoint(p,a,b): the foot on the line, not the segment. */
  function nearestPoint(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return copy(p);
    const t = (vx * (p.x - a.x) + vy * (p.y - a.y)) / (vx * vx + vy * vy);
    return { x: a.x + vx * t, y: a.y + vy * t };
  }

  /* GeoSDoub.GetParallelTo(a,b,c): a plus 100 times b-c. */
  function parallel(a, b, c) {
    return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
  }

  /** The starting picture, with the four points the applet creates in init(). */
  function start(options) {
    const o = options || {};
    return {
      A: copy(o.A || START_A),
      B: copy(o.B || START_B),
      C: copy(o.C || START_C),
      P: copy(o.P || START_P),
      showNames: o.showNames === undefined ? true : !!o.showNames,
    };
  }

  /* UpdatePoints, run after each drag or release in the Java listener. */
  function constrain(state, selected) {
    const next = {
      A: copy(state.A), B: copy(state.B), C: copy(state.C), P: copy(state.P),
      showNames: state.showNames,
    };
    if (selected === "A") next.A.y = next.B.y;
    else if (selected === "B") next.B.y = next.A.y;
    else if (selected === "P") next.P.y = (next.A.y + next.B.y) / 2;
    return next;
  }

  /** Move one of the four draggable points, then apply UpdatePoints. */
  function move(state, name, point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return state;
    if (!["A", "B", "C", "P"].includes(name)) return state;
    const next = {
      A: copy(state.A), B: copy(state.B), C: copy(state.C), P: copy(state.P),
      showNames: state.showNames,
    };
    next[name] = { x: clamp(point.x, 0, WIDTH), y: clamp(point.y, 0, HEIGHT) };
    return constrain(next, name);
  }

  /** Put P a fraction t along the line AB (the slider's job in the UI).
   *  The applet lets P go past either end, so t is deliberately not clamped. */
  function setFraction(state, t) {
    if (!Number.isFinite(t)) return state;
    return Object.assign({}, state, {
      P: {
        x: state.A.x + t * (state.B.x - state.A.x),
        y: (state.A.y + state.B.y) / 2,
      },
    });
  }

  function fraction(state) {
    const dx = state.B.x - state.A.x;
    if (!dx) return 0;
    return (state.P.x - state.A.x) / dx;
  }

  function setShowNames(state, on) {
    return Object.assign({}, state, { showNames: !!on });
  }

  /**
   * DrawSquare, line for line. `gap` is the distance the applet compares with
   * 1 pixel to decide whether its three eyes open. The extra `target` field
   * traces the page's construction: the ray A->r meets BC at the corner of
   * the true inscribed square, from which the other three corners follow.
   */
  function geometry(state) {
    const { A, B, C, P } = state;
    const empty = {
      active: false, fallback: false, open: false, gap: Infinity, side: 0,
      P: copy(P), p: null, q: null, r: null, target: null, lines: [], sign: 0,
    };
    if (dist(A, P) < 2) return empty;

    // The dangling corner on AC: P plus the 90-degree turn of AB.
    const perpendicular = {
      x: P.x + (B.y - A.y),
      y: P.y - (B.x - A.x),
    };
    let p = intersect(P, perpendicular, A, C);
    let q, r, side, gap, sign = 0, fallback = false, lines = [];

    if (!finite(p)) {
      // The Java applet's parallel-line branch: a smaller square near A.
      fallback = true;
      q = { x: A.x, y: A.y - (P.x - A.x) };
      p = { x: P.x, y: q.y };
      side = dist(p, nearestPoint(p, B, C));
      gap = side;
      lines = [[P, A], [q, A], [P, p], [q, p]];
    } else {
      sign = orientation(A, P, p) * orientation(A, P, C);
      side = dist(p, P);
      const ab = dist(A, B);
      q = { x: P.x + ((B.x - A.x) * sign * side) / ab, y: (A.y + B.y) / 2 };
      const up = parallel(q, P, p);
      const across = parallel(p, A, B);
      r = intersect(q, up, p, across);
      gap = dist(r, nearestPoint(r, B, C));
      lines = [[q, B], [P, A], [p, r], [P, p], [q, r], [A, p], [A, r]];
    }

    let target = null;
    if (r && finite(r)) {
      const hit = intersect(A, r, B, C);
      if (finite(hit)) {
        const foot1 = nearestPoint(hit, A, B);
        const along = intersect(hit, { x: hit.x + B.x - A.x, y: hit.y + B.y - A.y }, A, C);
        const foot2 = finite(along) ? nearestPoint(along, A, B) : null;
        if (finite(along) && foot2) {
          target = { hit, foot1, foot2, top: along };
        }
      }
    }

    return {
      active: true, fallback, open: gap < 1, gap, side, sign,
      P: copy(P), p: copy(p), q: q && finite(q) ? copy(q) : q,
      r: r && finite(r) ? copy(r) : r, target,
      lines: lines.map(([a, b]) => [copy(a), copy(b)]),
    };
  }

  /**
   * The fraction of AB where the trial square's free corner lands on BC.
   * dot(e,d) / (|cross(d,e)| + |e|^2), with e = B-A and d = C-A.
   */
  function solutionFraction(state) {
    const ex = state.B.x - state.A.x, ey = state.B.y - state.A.y;
    const dx = state.C.x - state.A.x, dy = state.C.y - state.A.y;
    const den = Math.abs(dx * ey - dy * ex) + ex * ex + ey * ey;
    if (!den) return null;
    return (ex * dx + ey * dy) / den;
  }

  /** Side of that inscribed square: (height of C above AB) * AB / (height + AB). */
  function inscribedSide(state) {
    const ux = state.B.x - state.A.x, uy = state.B.y - state.A.y;
    const dx = state.C.x - state.A.x, dy = state.C.y - state.A.y;
    const u = Math.hypot(ux, uy);
    const height = Math.abs(dx * uy - dy * ux) / u;
    if (!u) return null;
    return (height * u) / (height + u);
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT,
    START_A: START_A, START_B: START_B, START_C: START_C, START_P: START_P,
    copy: copy, dist: dist, sqDist: sqDist, clamp: clamp, finite: finite,
    orientation: orientation, intersect: intersect,
    nearestPoint: nearestPoint, parallel: parallel,
    start: start, move: move, constrain: constrain, setFraction: setFraction,
    fraction: fraction, setShowNames: setShowNames,
    geometry: geometry, solutionFraction: solutionFraction,
    inscribedSide: inscribedSide,
  };
})();
