"use strict";

/*
 * Circles With Equal Collinear Chords, from Alexander Bogomolny's applet
 * CirclesWithEqualChords (cut-the-knot.org/Curriculum/Geometry/CirclesWithEqualChords.shtml;
 * the 2010 snapshot at web.archive.org/web/20100214091139 embeds the Java applet).
 *
 * Two circles C(O) and C(O') and a line L are given. The construction asks for
 * a line parallel to L that cuts equal chords from both circles. Translate the
 * first circle along L until its chord lies on the second circle's chord: the
 * image of O is T, where the line through O parallel to L meets the line
 * through O' perpendicular to L. The circle centred at T with the first
 * radius then meets C(O') in C and D; CD is the wanted line, and translating
 * CD back gives AB on C(O). The two chords are equal because one is a
 * translate of the other. That is Compute() in the applet, in the same order:
 * radius guard, parallel through O, perpendicular through O', their
 * intersection T, the two circle intersections C/D, then A/B on C(O).
 *
 * The position is plain data (points and two display options), so it can be
 * saved for the player's record and handed to the tutor as it is. No DOM,
 * no storage, no global besides CirclesWithEqualChordsCore.
 */
const CirclesWithEqualChordsCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 420, height: 280 };
  const MARGIN = 10;
  /** The applet refuses a circle whose radius is under two units. */
  const MIN_RADIUS = 2;
  /** How far apart the two defining points of L are, in board units. */
  const LINE_LENGTH = 150;

  /** The opening picture: L near the top, the larger circle above the smaller. */
  const START = {
    L1: { x: 210, y: 35 },
    L2: { x: 360, y: 35 },
    O: { x: 126, y: 140 },
    R: { x: 226, y: 140 },
    O2: { x: 294, y: 210 },
    R2: { x: 354, y: 210 },
    options: { names: false, hint: false },
    moves: 0,
  };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clampToBoard = (p) => ({
    x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
    y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
  });

  /** Foot of the perpendicular from p onto the infinite line through a, b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return null;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Intersection of line(a,b) with line(c,d); null when they are parallel. */
  function lineIntersection(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (!Number.isFinite(cross) || Math.abs(cross) < 1e-9) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** The two intersections of circles (c1,r1) and (c2,r2); [] if they miss. */
  function circleIntersections(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);
    if (!d || !Number.isFinite(d)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    if (h2 < 0) return [];
    const h = Math.sqrt(h2);
    const base = { x: c1.x + dx * a / d, y: c1.y + dy * a / d };
    if (h < 1e-9) return [base];
    return [
      { x: base.x - dy * h / d, y: base.y + dx * h / d },
      { x: base.x + dy * h / d, y: base.y - dx * h / d },
    ];
  }

  /**
   * The intersections of the infinite line through a,b with the circle
   * (c,r), or null when there is no real crossing.
   */
  function lineCircleIntersections(a, b, c, r) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2 || !Number.isFinite(len2)) return null;
    const t0 = ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2;
    const px = a.x + dx * t0, py = a.y + dy * t0;
    const h2 = r * r - ((px - c.x) ** 2 + (py - c.y) ** 2);
    if (h2 < 0 || !Number.isFinite(h2)) return null;
    const h = Math.sqrt(h2 / len2);
    return [
      { x: px - dx * h, y: py - dy * h },
      { x: px + dx * h, y: py + dy * h },
    ];
  }

  /** Push a radius point out to the applet's smallest usable radius. */
  function radiusPoint(center, p, fallback) {
    const d = dist(center, p);
    if (d >= MIN_RADIUS) return p;
    const base = dist(center, fallback) >= MIN_RADIUS ? fallback : { x: center.x + MIN_RADIUS, y: center.y };
    const len = dist(center, base) || 1;
    return {
      x: center.x + (base.x - center.x) * MIN_RADIUS / len,
      y: center.y + (base.y - center.y) * MIN_RADIUS / len,
    };
  }

  function start(options) {
    const opts = { names: false, hint: false };
    if (options) for (const k in opts) if (k in opts) opts[k] = Boolean(options[k]);
    return {
      L1: { ...START.L1 }, L2: { ...START.L2 },
      O: { ...START.O }, R: { ...START.R },
      O2: { ...START.O2 }, R2: { ...START.R2 },
      options: opts, moves: 0,
    };
  }

  /**
   * Drag one of the six points. L1 slides L parallel to itself, L2 turns it;
   * O/O2 move the circles and R/R2 change their radii. Nothing is mutated.
   */
  function movePoint(state, name, point) {
    if (!finite(point)) return state;
    const p = clampToBoard(point);
    const next = { ...state, moves: state.moves + 1 };
    switch (name) {
      case "L1": {
        const dx = state.L2.x - state.L1.x, dy = state.L2.y - state.L1.y;
        next.L1 = p;
        next.L2 = clampToBoard({ x: p.x + dx, y: p.y + dy });
        break;
      }
      case "L2": {
        const dx = p.x - state.L1.x, dy = p.y - state.L1.y;
        const len = Math.hypot(dx, dy) || 1;
        next.L2 = clampToBoard({
          x: state.L1.x + dx / len * LINE_LENGTH,
          y: state.L1.y + dy / len * LINE_LENGTH,
        });
        break;
      }
      case "O":
        next.O = p;
        next.R = clampToBoard(radiusPoint(p, {
          x: state.R.x + p.x - state.O.x, y: state.R.y + p.y - state.O.y,
        }, state.R));
        break;
      case "O2":
        next.O2 = p;
        next.R2 = clampToBoard(radiusPoint(p, {
          x: state.R2.x + p.x - state.O2.x, y: state.R2.y + p.y - state.O2.y,
        }, state.R2));
        break;
      case "R":
        next.R = clampToBoard(radiusPoint(state.O, p, state.R));
        break;
      case "R2":
        next.R2 = clampToBoard(radiusPoint(state.O2, p, state.R2));
        break;
      default:
        return state;
    }
    return next;
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  const INVALID = {
    valid: false, reason: "radius", solved: false,
    A: null, B: null, C: null, D: null, T: null,
  };

  /**
   * The applet's Compute(), as plain data. `reason` says which guard stopped
   * the construction: a tiny radius, O' too close to L, parallel lines, no
   * crossing of C(T) with C(O'), or a degenerate common chord.
   */
  function geometry(state) {
    const { L1, L2, O, R, O2, R2 } = state;
    const r1 = dist(O, R), r2 = dist(O2, R2);
    if (r1 < MIN_RADIUS || r2 < MIN_RADIUS) return INVALID;
    if (![L1, L2, O, R, O2, R2].every(finite)) return { ...INVALID, reason: "points" };

    // O1: through O, parallel to L (GetParallelTo uses direction L1 - L2).
    const p = { x: O.x + 100 * (L1.x - L2.x), y: O.y + 100 * (L1.y - L2.y) };
    const o1a = O, o1b = p;

    // O2: through O' and the foot of the perpendicular from O' to L.
    const foot2 = foot(O2, L1, L2);
    if (!foot2 || dist(O2, foot2) <= 1) return { ...INVALID, reason: "near-line" };
    const o2a = O2, o2b = foot2;

    const T = lineIntersection(o1a, o1b, o2a, o2b);
    if (!T) return { ...INVALID, reason: "parallel" };

    // C(T) has the radius of C(O); its common chord with C(O') is CD. The
    // applet's circle-circle helper treats centres less than one unit apart
    // as the same point, so even a near-coincidence gives no crossing.
    if (Math.abs(T.x - O2.x) <= 1 && Math.abs(T.y - O2.y) <= 1) {
      return { ...INVALID, reason: "no-crossing", T, r1, r2, foot2, o1a, o1b, o2a, o2b };
    }
    const common = circleIntersections(T, r1, O2, r2);
    if (common.length < 2 || dist(common[0], common[1]) <= 1) {
      return { ...INVALID, reason: "no-crossing", T, r1, r2, foot2, o1a, o1b, o2a, o2b };
    }
    // A tie goes to the second point, as in the applet's strict `<` test.
    const byO = (a, b) => dist(O, a) < dist(O, b) ? [a, b] : [b, a];
    const [C, D] = byO(common[0], common[1]);

    // The applet's line/circle helper refuses a line whose two defining
    // points are each less than one unit apart in x and y; CD can be that
    // short when the circles nearly touch.
    if (Math.abs(C.x - D.x) <= 1 && Math.abs(C.y - D.y) <= 1) {
      return { ...INVALID, reason: "short-chord", T, C, D, r1, r2, foot2, o1a, o1b, o2a, o2b };
    }
    // The inverse translation puts AB on C(O), on the very same line as CD.
    const onFirst = lineCircleIntersections(C, D, O, r1);
    if (!onFirst) {
      return { ...INVALID, reason: "no-chord", T, C, D, r1, r2, foot2, o1a, o1b, o2a, o2b };
    }
    // The applet names A the intersection of C(O) farther from O', B the
    // nearer one, so that A translates to C and B to D.
    const byO2 = (a, b) => dist(O2, a) >= dist(O2, b) ? [a, b] : [b, a];
    const [A, B] = byO2(onFirst[0], onFirst[1]);

    return {
      valid: true, solved: true, reason: null,
      A, B, C, D, T,
      lineS: { a: C, b: D },
      o1: { a: o1a, b: o1b }, o2: { a: o2a, b: o2b },
      foot2, circle2: { center: T, radius: r1 },
      r1, r2,
      chord1: dist(A, B), chord2: dist(C, D),
    };
  }

  /** An illustration has no win or loss: exploring it is the whole point. */
  function result(state) {
    return null;
  }

  return {
    VIEW, START, MIN_RADIUS, LINE_LENGTH,
    start, movePoint, setOption, geometry, result,
    dist, foot, lineIntersection, circleIntersections, lineCircleIntersections,
    clampToBoard,
  };
})();
