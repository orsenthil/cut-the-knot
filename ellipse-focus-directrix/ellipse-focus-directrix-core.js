"use strict";

/*
 * Focus and Directrix of Ellipse — Alexander Bogomolny's EllipseFocusDirectrix.
 *
 * The Java canvas kept four draggable rectangle corners and a point P pinned
 * to the inscribed ellipse (CTKEllipse.KeepOnEllipse). Every repaint it ran
 * Compute(): take the two foci, choose the one on the longer axis, put the
 * matching directrix at a/e from the centre, drop P's perpendicular to it and
 * build a small right triangle whose red leg is PF, whose grey hypotenuse is
 * PD and whose blue leg is sqrt(PD^2 - PF^2). The page claims PF / PD is a
 * fixed number below 1, that each ellipse has two focus/directrix pairs, and
 * that the foci line is the symmetry axis, perpendicular to both directrices.
 * The sibling EllipseFocal claims instead that PF + PF' is constant; both are
 * true of the same ellipse, but this applet chooses the ratio picture.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, EllipseFocusDirectrixCore, and every
 * function returns a new plain-data position. Positions are saved for the
 * tutor as they are. There is no win and no loss: this is an illustration.
 */
const EllipseFocusDirectrixCore = (() => {
  /* Applet parameters: WIDTH (400 will do), HEIGHT (300 will do), Margin = 20. */
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 20;
  const NEAR_CENTER = 10; // PointIsGood refuses a corner within 10 px of centre
  const EARLY_RETURN = 1; // Compute returns if |2a - 2b| < 1 pixel

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const copy = (p) => ({ x: p.x, y: p.y });
  const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

  /** The initial rectangle of EllipseFocusDirectrixCanvas.init(). */
  function start(options) {
    const o = options || {};
    const width = Math.max(40, num(o.width, WIDTH));
    const height = Math.max(40, num(o.height, HEIGHT));
    const margin = clamp(num(o.margin, MARGIN), 0, Math.min(width, height) / 2 - 1);
    const center = { x: width / 2, y: height / 2 };
    const hw = width / 4; // m_Rect.width / 4
    const hh = height / 6; // m_Rect.height / 6
    return {
      width: width,
      height: height,
      margin: margin,
      center: center,
      corners: [
        { x: center.x - hw, y: center.y + hh },
        { x: center.x + hw, y: center.y + hh },
        { x: center.x + hw, y: center.y - hh },
        { x: center.x - hw, y: center.y - hh },
      ],
      theta: -Math.PI / 4, // EllipseAt(-pi/4)
      showOther: false,
    };
  }

  /** CTKEllipse.EllipseUpdated(): A and B from the axis-aligned rectangle. */
  function halfAxes(state) {
    const V = state.corners;
    return { a: (V[1].x - V[0].x) / 2, b: (V[0].y - V[2].y) / 2 };
  }

  /** CTKEllipse.EllipseAt(t): the point with parameter t on the ellipse. */
  function ellipseAt(state, t) {
    const h = halfAxes(state);
    return {
      x: state.center.x + h.a * Math.cos(t),
      y: state.center.y + h.b * Math.sin(t),
    };
  }

  /** P is always the point at the stored parameter. */
  function pointAt(state) {
    return ellipseAt(state, state.theta);
  }

  /*
   * GeoSDoub.ComputeSignedAngle(center, Inf, q), where CTKEllipse sets
   * Inf = (center.x + 200, center.y). The law of cosines gives the size, and
   * FindOrientation gives the sign. Math.acos is clamped only against
   * round-off outside [-1, 1], which Java would also turn into NaN.
   */
  function angleTo(state, q) {
    if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return state.theta;
    const o = state.center;
    const inf = { x: o.x + 200, y: o.y };
    const s1 = (o.x - inf.x) ** 2 + (o.y - inf.y) ** 2;
    const s2 = (o.x - q.x) ** 2 + (o.y - q.y) ** 2;
    const s3 = (inf.x - q.x) ** 2 + (inf.y - q.y) ** 2;
    const cosine = clamp((s1 + s2 - s3) / (2 * Math.sqrt(s1) * Math.sqrt(s2)), -1, 1);
    const orient = q.x * (o.y - inf.y) + q.y * (inf.x - o.x) + (o.x * inf.y - inf.x * o.y);
    return orient > 0 ? Math.acos(cosine) : -Math.acos(cosine);
  }

  /** CTKEllipse.KeepOnEllipse: store an angle, not a free point. */
  function setPoint(state, q) {
    if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return state;
    const t = angleTo(state, q);
    if (!Number.isFinite(t)) return state;
    return Object.assign({}, state, { theta: t });
  }

  /*
   * CTKEllipse.MaintainRect after BetterMover.UpdateLocation: the centre
   * never moves; the opposite corners mirror the dragged one. The applet's
   * PointIsGood refuses a drag whose pointer is within 10 px of the centre in
   * both coordinates, so the ellipse cannot collapse to a point.
   */
  function moveCorner(state, index, q) {
    if (!Number.isInteger(index) || index < 0 || index > 3) return state;
    if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return state;
    const o = state.center;
    if (Math.abs(q.x - state.width / 2) <= NEAR_CENTER &&
        Math.abs(q.y - state.height / 2) <= NEAR_CENTER) return state;
    const dx = o.x - q.x;
    const dy = o.y - q.y;
    const V = state.corners.map(copy);
    if (index === 0) {
      V[1] = { x: o.x + dx, y: o.y - dy };
      V[2] = { x: o.x + dx, y: o.y + dy };
      V[3] = { x: o.x - dx, y: o.y + dy };
    } else if (index === 1) {
      V[0] = { x: o.x + dx, y: o.y - dy };
      V[2] = { x: o.x - dx, y: o.y + dy };
      V[3] = { x: o.x + dx, y: o.y + dy };
    } else if (index === 2) {
      V[0] = { x: o.x + dx, y: o.y + dy };
      V[1] = { x: o.x - dx, y: o.y + dy };
      V[3] = { x: o.x + dx, y: o.y - dy };
    } else {
      V[0] = { x: o.x - dx, y: o.y + dy };
      V[1] = { x: o.x + dx, y: o.y + dy };
      V[2] = { x: o.x + dx, y: o.y - dy };
    }
    V[index] = copy(q);
    return Object.assign({}, state, { corners: V });
  }

  /* A button-sized version of the same rectangle: convenient keyboard presets. */
  function resize(state, a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return state;
    const o = state.center;
    const corners = [
      { x: o.x - a, y: o.y + b },
      { x: o.x + a, y: o.y + b },
      { x: o.x + a, y: o.y - b },
      { x: o.x - a, y: o.y - b },
    ];
    return Object.assign({}, state, { corners: corners });
  }

  /** CTKEllipse.Foci, in the applet's own order and with its NaN guard. */
  function foci(state) {
    const h = halfAxes(state);
    const A = Math.abs(h.a), B = Math.abs(h.b);
    const big = Math.max(A, B), small = Math.min(A, B);
    const horizontal = A > B;
    const c = Math.sqrt(big * big - small * small);
    if (Number.isNaN(c)) return null;
    const o = state.center;
    return horizontal
      ? [{ x: o.x - c, y: o.y }, { x: o.x + c, y: o.y }]
      : [{ x: o.x, y: o.y - c }, { x: o.x, y: o.y + c }];
  }

  /** Both focus/directrix pairs named on the page, with their common ratio. */
  function pairs(state) {
    const h = halfAxes(state);
    const A = Math.abs(h.a), B = Math.abs(h.b);
    const big = Math.max(A, B), small = Math.min(A, B);
    const c = Math.sqrt(big * big - small * small);
    if (!Number.isFinite(c) || c === 0) return [];
    const o = state.center;
    const e = c / big;
    if (A > B) {
      const d = big * big / c; // a/e, measured from the centre
      return [
        { focus: { x: o.x - c, y: o.y }, directrix: [{ x: o.x - d, y: 0 }, { x: o.x - d, y: state.height }], e: e },
        { focus: { x: o.x + c, y: o.y }, directrix: [{ x: o.x + d, y: 0 }, { x: o.x + d, y: state.height }], e: e },
      ];
    }
    const d = big * big / c; // b/e for a vertical major axis
    return [
      { focus: { x: o.x, y: o.y - c }, directrix: [{ x: 0, y: o.y - d }, { x: state.width, y: o.y - d }], e: e },
      { focus: { x: o.x, y: o.y + c }, directrix: [{ x: 0, y: o.y + d }, { x: state.width, y: o.y + d }], e: e },
    ];
  }

  /** GeoSDoub.NearestPoint(P, line through m1,m2), used for the foot N. */
  function nearestOnLine(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.1) return copy(a);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /*
   * The canvas's Compute(), transcribed branch for branch. When |2a-2b| < 1
   * the original returns before touching the focus, directrix or triangle
   * fields, so we return null and the page keeps the last picture. The
   * focus array itself has already been refreshed before that early return.
   */
  function compute(state) {
    const V = state.corners;
    const w = Math.abs(V[1].x - V[0].x); // 2a
    const h = Math.abs(V[0].y - V[3].y); // 2b
    if (Math.abs(w - h) < EARLY_RETURN) return null;
    const F = foci(state);
    if (!F) return null;
    const hx = halfAxes(state);
    const vertical = h >= w; // bytecode: if h >= w jump to the vertical branch
    const orientation = vertical ? "vertical" : "horizontal";
    const big = vertical ? Math.abs(hx.b) : Math.abs(hx.a);
    const c = (vertical ? Math.sqrt(Math.max(0, h * h - w * w))
      : Math.sqrt(Math.max(0, w * w - h * h))) / 2;
    if (c === 0) return null;
    const e = c / big;
    const d = big * big / c; // L9 = (2*big) / ((2*c)/(2*big)) / 2
    const o = state.center;
    const focus = vertical ? copy(F[1]) : copy(F[0]);
    const line = vertical
      ? [{ x: 100, y: o.y + d }, { x: 200, y: o.y + d }]
      : [{ x: o.x - d, y: 100 }, { x: o.x - d, y: 200 }];
    const P = pointAt(state);
    const N = nearestOnLine(P, line[0], line[1]);
    const focusDist = dist(focus, P);
    const directDist = dist(N, P);
    const leg = Math.sqrt(Math.max(0, directDist * directDist - focusDist * focusDist));
    /* S, A and B are the applet's little measuring triangle near a corner.
       Its vertical branch uses min(V0.x, V1.y)/2, oddly mixed coordinates;
       that quirk is kept so the drawn triangle matches the original. */
    const S = vertical
      ? { x: state.width - state.margin, y: Math.min(V[0].x, V[1].y) / 2 }
      : { x: (Math.max(V[0].x, V[1].x) + state.width) / 2 - state.margin, y: state.height - state.margin };
    const Apt = vertical
      ? { x: S.x, y: S.y + focusDist }
      : { x: S.x - focusDist, y: S.y };
    const Bpt = vertical
      ? { x: Apt.x - leg, y: Apt.y }
      : { x: Apt.x, y: Apt.y - leg };
    return {
      orientation: orientation,
      foci: F,
      focus: focus,
      directrix: line,
      foot: N,
      P: P,
      focusDist: focusDist,
      directDist: directDist,
      ratio: focusDist / directDist,
      eccentricity: e,
      c: c,
      halfMajor: big,
      halfMinor: Math.min(Math.abs(hx.a), Math.abs(hx.b)),
      leg: leg,
      S: S,
      A: Apt,
      B: Bpt,
      box: V.map(copy),
      ellipse: { center: copy(o), a: hx.a, b: hx.b },
    };
  }

  /** The four presets used by the page; no new rules, only ellipse shapes. */
  function preset(state, name) {
    if (name === "wide") return resize(state, 100, 50);
    if (name === "tall") return resize(state, 45, 100);
    if (name === "circle") return resize(state, 60.4, 60); // |2a-2b| = 0.8
    if (name === "initial") {
      const s = start({ width: state.width, height: state.height, margin: state.margin });
      return Object.assign({}, s, { showOther: state.showOther });
    }
    return state;
  }

  function toggleOther(state) {
    return Object.assign({}, state, { showOther: !state.showOther });
  }

  /** A short status line; the algebra stays in the "Look for the math" box. */
  function describe(state, result) {
    const r = result || compute(state);
    const h = halfAxes(state);
    if (!r) {
      return {
        title: "Almost a circle",
        text: "The two half-widths differ by less than one pixel: the Java applet stops recomputing its focus and directrix here.",
      };
    }
    const axis = r.orientation === "horizontal" ? "left to right" : "up and down";
    return {
      title: r.orientation === "horizontal" ? "Focus and directrix, across the ellipse"
        : "Focus and directrix, down the ellipse",
      text: `PF is ${r.focusDist.toFixed(1)}, PD is ${r.directDist.toFixed(1)}, and PF / PD is ${r.ratio.toFixed(3)}. ` +
        `The foci line runs ${axis}; the directrix is at a right angle to it. ` +
        `The ellipse is ${(2 * Math.abs(h.a)).toFixed(0)} by ${(2 * Math.abs(h.b)).toFixed(0)} pixels.`,
    };
  }

  /** There is nothing to win or lose: this is an illustration. */
  function result() {
    return null;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, MARGIN: MARGIN,
    NEAR_CENTER: NEAR_CENTER, EARLY_RETURN: EARLY_RETURN,
    start: start, halfAxes: halfAxes, ellipseAt: ellipseAt, pointAt: pointAt,
    angleTo: angleTo, setPoint: setPoint, moveCorner: moveCorner,
    resize: resize, foci: foci, pairs: pairs, nearestOnLine: nearestOnLine,
    compute: compute, preset: preset, toggleOther: toggleOther,
    describe: describe, result: result, dist: dist,
  };
})();
