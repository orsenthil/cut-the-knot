"use strict";

/*
 * Barlotti — the Napoleon–Barlotti theorem, from Alexander Bogomolny's applet.
 *
 * The applet draws a regular N-gon Q (dashed), stretches it by the matrix
 *   M = [[a, b], [c, d]]      (the four scrollbars, each value / 100)
 * to get an affine-regular N-gon P, then erects a regular N-gon on every side
 * of P. Their centres, rounded to whole pixels by the applet, make another
 * regular N-gon. That is the theorem on the cut-the-knot page.
 *
 * The one idea the code relies on: write points as complex numbers. With
 * eta = exp(2 pi i / N), Q_j = O + r e^{i rotation} eta^j and
 *   P_j - O = u eta^j + v eta^{-j},
 *   u = (r/2)((a+d) + i(c-b)) e^{i rotation}.
 * Erecting a regular N-gon on side P_j P_{j+1} means turning each edge by
 * eta^{-1}; its centroid works out to
 *   C_j = O + u (1 + eta) eta^j.
 * The v term cancels exactly, so the centres are a genuine regular N-gon for
 * every matrix, with radius r * hypot(a+d, c-b) * cos(pi/N). If u = 0 (a reflection
 * composed with a scaling), all centres pile up at O.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BarlottiCore, so the page loads it with a plain
 * <script> and porting/check-barlotti.mjs loads it in Node. Positions are plain
 * data; functions take a position and return new objects, never changing it.
 */
const BarlottiCore = (() => {
  const TAU = 2 * Math.PI;
  const TWO_PI_OVER = (n) => TAU / n;

  // BarlottiCanvas: N=6, A=0.4, B=0.6, C=-0.5, D=0.5; width=400, height=300.
  const LIMITS = {
    n: [3, 30],       // CTKNumberCanvas.SetRange(3, 30), increment 1
    a: [-1, 1.05],    // Scrollbar(-100, 105) / 100, four parameters
    b: [-1, 1.05],
    c: [-1, 1.05],
    d: [-1, 1.05],
  };
  const DEFAULTS = { n: 6, a: 0.4, b: 0.6, c: -0.5, d: 0.5, rotation: 0 };
  const CENTER = { x: 200, y: 150 };
  const RADIUS = 75; // min(400, 300) / 4, as in BarlottiCanvas.Reset()

  const clamp = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
  const pt = (x, y) => ({ x, y });
  const copyPoint = (p) => ({ x: p.x, y: p.y });

  /** GeoSDoub.Rotate(P, Q, angle, orientation), straight from its bytecode. */
  function rotate(about, point, angle, orientation) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: about.x + cs * (point.x - about.x) - orientation * sn * (point.y - about.y),
      y: about.y + orientation * sn * (point.x - about.x) + cs * (point.y - about.y),
    };
  }

  /** The position a new illustration starts from. Options are clamped. */
  function start(options) {
    const o = options || {};
    const s = { ...DEFAULTS, center: copyPoint(o.center || CENTER), radius: o.radius === undefined ? RADIUS : o.radius };
    for (const name of ["a", "b", "c", "d"]) {
      s[name] = o[name] === undefined ? DEFAULTS[name] : clamp(o[name], ...LIMITS[name]);
    }
    s.n = Math.round(clamp(o.n === undefined ? DEFAULTS.n : o.n, ...LIMITS.n));
    s.rotation = Number.isFinite(o.rotation) ? o.rotation : 0;
    return s;
  }

  /** Changing one control, with the applet's ranges and Reset's fresh Q. */
  function withOption(state, name, value) {
    const next = { ...state, center: copyPoint(state.center) };
    if (name === "n") {
      next.n = Math.round(clamp(value, ...LIMITS.n));
      next.rotation = 0; // Reset() rebuilds Q from angle 0
    } else if (Object.prototype.hasOwnProperty.call(LIMITS, name)) {
      next[name] = clamp(value, ...LIMITS[name]);
    }
    return next;
  }

  /** Drag a vertex of the dashed polygon: turn the whole regular polygon. */
  function withVertex(state, index, point) {
    const i = Math.max(0, Math.min(state.n - 1, Math.floor(index)));
    const angle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
    return { ...state, center: copyPoint(state.center), rotation: angle - TWO_PI_OVER(state.n) * i };
  }

  /** The regular N-gon Q, before the affine map (dashed in the applet). */
  function regularPolygon(state) {
    const out = [];
    for (let i = 0; i < state.n; i++) {
      const theta = state.rotation + TWO_PI_OVER(state.n) * i;
      out.push(pt(state.center.x + state.radius * Math.cos(theta),
                  state.center.y + state.radius * Math.sin(theta)));
    }
    return out;
  }

  /** BarlottiCanvas.AffineTransform: O + M (Q - O). */
  function affineTransform(state, q) {
    const x = q.x - state.center.x, y = q.y - state.center.y;
    return pt(state.center.x + state.a * x + state.b * y,
              state.center.y + state.c * x + state.d * y);
  }

  /** The affine-regular N-gon P (thick boundary in the applet). */
  function affinePolygon(state) {
    return regularPolygon(state).map((q) => affineTransform(state, q));
  }

  /**
   * The regular N-gon erected on side P[i] P[i+1], as ComputePolys builds it:
   * start with the side, then rotate the previous vertex about the current one
   * by pi - 2pi/N (orientation +1) until there are N vertices.
   */
  function erectedPolygon(state, i) {
    const p = affinePolygon(state);
    const angle = Math.PI - TWO_PI_OVER(state.n);
    const start = p[i], next = p[(i + 1) % state.n];
    const vertices = [copyPoint(start), copyPoint(next)];
    let previous = start, current = next;
    for (let j = 0; j < state.n - 2; j++) {
      const fresh = rotate(current, previous, angle, 1);
      vertices.push(fresh);
      previous = current;
      current = fresh;
    }
    return vertices;
  }

  /**
   * Centres of the erected polygons. ComputePolys adds the N vertices of each
   * one and divides by N, then the applet rounds each coordinate to a pixel.
   * The literal accumulation order is kept here so the check can compare the
   * two transcriptions exactly.
   */
  function centers(state, rounded) {
    const p = affinePolygon(state);
    const angle = Math.PI - TWO_PI_OVER(state.n);
    const out = [];
    for (let i = 0; i < state.n; i++) {
      let previous = p[i], current = p[(i + 1) % state.n];
      let sx = previous.x + current.x, sy = previous.y + current.y;
      for (let j = 0; j < state.n - 2; j++) {
        const fresh = rotate(current, previous, angle, 1);
        sx += fresh.x;
        sy += fresh.y;
        previous = current;
        current = fresh;
      }
      const x = sx / state.n, y = sy / state.n;
      out.push(rounded ? pt(Math.round(x), Math.round(y)) : pt(x, y));
    }
    return out;
  }

  /** The closed form C_j = O + u (1+eta) eta^j, from the complex-number proof. */
  function centerPolygon(state) {
    const etaAngle = TWO_PI_OVER(state.n);
    const u = {
      re: (state.radius / 2) * ((state.a + state.d) * Math.cos(state.rotation)
            - (state.c - state.b) * Math.sin(state.rotation)),
      im: (state.radius / 2) * ((state.a + state.d) * Math.sin(state.rotation)
            + (state.c - state.b) * Math.cos(state.rotation)),
    };
    // Multiply u by (1 + eta), then by eta^j.
    const w = {
      re: u.re * (1 + Math.cos(etaAngle)) - u.im * Math.sin(etaAngle),
      im: u.re * Math.sin(etaAngle) + u.im * (1 + Math.cos(etaAngle)),
    };
    const out = [];
    let re = w.re, im = w.im;
    for (let j = 0; j < state.n; j++) {
      out.push(pt(state.center.x + re, state.center.y + im));
      const nre = re * Math.cos(etaAngle) - im * Math.sin(etaAngle);
      im = re * Math.sin(etaAngle) + im * Math.cos(etaAngle);
      re = nre;
    }
    return out;
  }

  /** Predicted circumradius of the centre polygon: r |a+d + i(c-b)| cos(pi/N). */
  function centerRadius(state) {
    return state.radius * Math.hypot(state.a + state.d, state.c - state.b) * Math.cos(Math.PI / state.n);
  }

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** Are these points the vertices of a regular n-gon, in order? */
  function isRegularPolygon(points, tolerance) {
    const n = points.length;
    if (n < 3) return false;
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= n; cy /= n;
    const radius = dist(points[0], pt(cx, cy));
    if (!(radius > tolerance)) return points.every((p) => dist(p, pt(cx, cy)) <= tolerance);
    const step = TWO_PI_OVER(n);
    const angles = points.map((p) => Math.atan2(p.y - cy, p.x - cx));
    const principal = (v) => {
      while (v <= -Math.PI) v += TAU;
      while (v > Math.PI) v -= TAU;
      return v;
    };
    const turn = principal(angles[1] - angles[0]);
    if (Math.abs(Math.abs(turn) - step) > tolerance / radius) return false;
    const direction = Math.sign(turn);
    for (let i = 1; i < n; i++) {
      if (Math.abs(principal(angles[i] - angles[i - 1]) - direction * step) > tolerance / radius) return false;
    }
    if (Math.abs(principal(angles[0] - angles[n - 1]) - direction * step) > tolerance / radius) return false;
    return points.every((p) => Math.abs(dist(p, pt(cx, cy)) - radius) <= tolerance);
  }

  /** Each claim on the cut-the-knot page, measured at this configuration. */
  function claims(state) {
    const scale = Math.max(state.radius, 1);
    const tol = 1e-7 * scale;
    const q = regularPolygon(state);
    const p = affinePolygon(state);
    const erected = [];
    let erectedRegular = true;
    for (let i = 0; i < state.n; i++) {
      const vertices = erectedPolygon(state, i);
      erected.push(vertices);
      if (vertices.length !== state.n || !isRegularPolygon(vertices, tol)) erectedRegular = false;
    }
    const c = centers(state, false);
    const formula = centerPolygon(state);
    let formulaMatches = c.length === formula.length;
    for (let i = 0; i < c.length && formulaMatches; i++) {
      if (dist(c[i], formula[i]) > tol) formulaMatches = false;
    }
    let radiusMatches = Math.abs(dist(c[0], pt(state.center.x, state.center.y)) - centerRadius(state)) <= tol;
    // The reflection case (u = 0) collapses all centres onto O.
    const similarity = Math.hypot(state.a + state.d, state.c - state.b) < 1e-12;
    const collapsed = similarity && c.every((z) => dist(z, state.center) <= tol);
    return {
      baseRegular: isRegularPolygon(q, tol),
      erectedRegular,
      affineRegular: p.length === state.n && p.every((z, i) =>
        dist(z, affineTransform(state, q[i])) <= tol),
      centersRegular: isRegularPolygon(c, tol) || collapsed,
      centerFormula: formulaMatches,
      radiusFormula: radiusMatches,
      collapseRule: similarity ? collapsed : !collapsed,
    };
  }

  /** Nothing is won or lost: this is an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    LIMITS, DEFAULTS, CENTER, RADIUS, TAU, rotate, start, withOption, withVertex,
    regularPolygon, affineTransform, affinePolygon, erectedPolygon, centers,
    centerPolygon, centerRadius, isRegularPolygon, claims, result, dist,
  };
})();
