"use strict";

/*
 * Equiangular Poly, from Alexander Bogomolny's Java applet EquiangularPoly.
 *
 * The applet starts with a regular N-gon drawn as N infinite side lines:
 * each line touches a circle of radius min(width, height) / 4 about the
 * centre. Dragging a thick point moves its whole side line parallel to
 * itself, so the angles stay equal but the side lengths change. A blue dot P
 * can be dragged anywhere; with "Show hint" ticked the applet also draws a
 * regular N-gon whose sides are parallel to the polygon's, two units farther
 * out than a regular polygon with the current longest side.
 *
 * The claim on the page is a generalization of Viviani's theorem: the sum of
 * the distances from P to the side lines does not depend on P. The key idea
 * is that the inward normals of an equiangular polygon add to zero, so a
 * change of P by some vector changes the sum of signed distances by its
 * scalar product with that zero vector. For P inside every side line the
 * signed distances are the ordinary distances.
 *
 * Every line is stored as its outward unit normal n and its signed distance
 * t from the centre: the line is {x : dot(x - centre, n) = t}. Reset gives
 * t = r for every side. This is plain data and this file has no DOM at all.
 */
const EquiangularPolyCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 360;
  const MIN_N = 3;
  const MAX_N = 15;
  const STEP_N = 1;
  const INITIAL_N = 5;
  const EPS = 1e-9;
  const TAU = 2 * Math.PI;

  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const centreOf = (state) => ({
    x: Math.floor(state.width / 2),
    y: Math.floor(state.height / 2),
  });

  /** GeoSDoub.Intersect(a,b,c,d): NaN coordinates when the lines are parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, a2 = b.x - a.x, a3 = a.x * b.y - a.y * b.x;
    const b1 = c.y - d.y, b2 = d.x - c.x, b3 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - b1 * a2;
    const x = (a2 * b3 - b2 * a3) / den;
    const y = (a3 * b1 - b3 * a1) / den;
    // The applet tests |den| < 1, not merely zero, and returns NaN then.
    return Math.abs(den) < 1 ? { x: NaN, y: NaN } : { x, y };
  }

  /** GeoSDoub.NearestPoint(p, line ab): the perpendicular foot, or p if close to a. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const k = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * k, y: a.y + dy * k };
  }

  /** The N side lines of the opening regular polygon (the applet's Reset). */
  function resetLines(N, width, height) {
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    const r = Math.min(width, height) / 4;
    const lines = [];
    for (let k = 0; k < N; k++) {
      const angle = (TAU / N) * k;
      lines.push({ n: { x: Math.cos(angle), y: Math.sin(angle) }, t: r });
    }
    return lines;
  }

  function clampN(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return INITIAL_N;
    const k = Math.round(n / STEP_N) * STEP_N;
    return Math.max(MIN_N, Math.min(MAX_N, k));
  }

  /** The opening picture: a regular 5-gon, P at the centre, hint unticked. */
  function start(options) {
    const o = options || {};
    const width = Number.isFinite(o.width) ? o.width : WIDTH;
    const height = Number.isFinite(o.height) ? o.height : HEIGHT;
    const N = clampN(o.N === undefined ? INITIAL_N : o.N);
    const centre = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const lines = resetLines(N, width, height);
    if (Array.isArray(o.t) && o.t.length === N) {
      for (let i = 0; i < N; i++) {
        if (Number.isFinite(o.t[i])) lines[i].t = o.t[i];
      }
    }
    return {
      width, height, N,
      showHint: o.showHint === true,
      P: o.P ? { x: o.P.x, y: o.P.y } : centre,
      lines,
    };
  }

  /** Two endpoints on side i, as MoveableLineAdvanced stores them. */
  function linePoints(line, c, r) {
    const tangent = add(c, mul(line.n, line.t));
    const side = { x: -line.n.y * r, y: line.n.x * r };
    return { a: add(tangent, side), b: sub(tangent, side) };
  }

  /** An illegal move changes nothing; a legal one returns a fresh position. */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") {
      return start({
        width: state.width, height: state.height, N: state.N,
        showHint: state.showHint,
      });
    }
    if (m.type === "option") {
      if (m.key !== "showHint" || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { showHint: m.value });
    }
    if (m.type === "N") {
      if (typeof m.value !== "number" || !Number.isFinite(m.value)) return null;
      // The spinner's ActionListener sets N and calls Reset(), which puts P
      // back at the centre and makes the polygon regular again.
      return start({
        width: state.width, height: state.height, N: m.value,
        showHint: state.showHint,
      });
    }
    if (m.type === "point") {
      const p = m.point;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      return Object.assign({}, state, {
        P: {
          x: Math.max(0, Math.min(state.width, p.x)),
          y: Math.max(0, Math.min(state.height, p.y)),
        },
      });
    }
    if (m.type === "line") {
      const i = m.index, p = m.point;
      if (!Number.isInteger(i) || i < 0 || i >= state.N) return null;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      const c = centreOf(state);
      const r = Math.min(state.width, state.height) / 4;
      const line = state.lines[i];
      // Dragging a line translates it: only its component along the normal
      // matters. The applet squeezes the endpoints back into the canvas,
      // which here means keeping the centre inside every half-plane.
      const t = dot(sub(p, c), line.n);
      const clamped = Math.max(0.4 * r, Math.min(1.6 * r, t));
      const lines = state.lines.slice();
      lines[i] = { n: line.n, t: clamped };
      return Object.assign({}, state, { lines });
    }
    return null;
  }

  /** The signed distance from P to line i, positive on the polygon's inside. */
  function signedDistance(state, i) {
    const c = centreOf(state);
    const n = state.lines[i].n;
    return state.lines[i].t - dot(sub(state.P, c), n);
  }

  /** The applet's Compute() plus the sum of distances the page talks about. */
  function compute(state) {
    const N = state.N;
    const c = centreOf(state);
    const r = Math.min(state.width, state.height) / 4;
    const pts = state.lines.map((line) => linePoints(line, c, r));
    const V = [], F = [];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      V.push(intersect(pts[i].a, pts[i].b, pts[j].a, pts[j].b));
      F.push(nearestPoint(state.P, pts[i].a, pts[i].b));
    }

    // The applet uses a strict ">" when looking for the longest side. Two
    // opposite sides can be equal to within rounding, so keep the first one
    // within 1e-7 of the maximum: that makes the choice stable without
    // changing it except for a numerical tie.
    let longest = -Infinity, imax = -1, jmax = -1;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const len = distance(V[i], V[j]);
      if (len > longest + 1e-7) { longest = len; imax = i; jmax = j; }
    }

    const tan = Math.tan(Math.PI / N);
    const R = longest / 2 / tan + 2;
    const mx = (V[imax].x + V[jmax].x) / 2;
    const my = (V[imax].y + V[jmax].y) / 2;
    // Centre of the regular polygon whose side is the longest side, moved
    // two units out: C = midpoint + (half side)/tan times the inward normal.
    const C = {
      x: mx - (V[jmax].y - V[imax].y) / 2 / tan,
      y: my + (V[jmax].x - V[imax].x) / 2 / tan,
    };

    // The applet calls these G and then overwrites G with the feet of P.
    const circle = [], rim = [], U = [], feet = [];
    for (let k = 0; k < N; k++) {
      const angle = (TAU / N) * k;
      circle.push({ x: C.x + R * Math.cos(angle), y: C.y + R * Math.sin(angle) });
    }
    for (let k = 0; k < N; k++) {
      const g = circle[k];
      rim.push({ x: g.x + C.y - g.y, y: g.y - C.x + g.x });
    }
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      U.push(intersect(circle[k], rim[k], circle[j], rim[j]));
    }
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      feet.push(nearestPoint(state.P, U[k], U[j]));
    }

    const signed = [], unsigned = [];
    let sumSigned = 0, sumUnsigned = 0, sumOffsets = 0;
    for (let i = 0; i < N; i++) {
      const d = signedDistance(state, i);
      signed.push(d);
      unsigned.push(Math.abs(d));
      sumSigned += d;
      sumUnsigned += Math.abs(d);
      sumOffsets += state.lines[i].t;
    }
    const sideLengths = V.map((v, i) => distance(v, V[(i + 1) % N]));
    // Every side line turns by 2*pi/N, so the interior angle is pi - 2*pi/N.
    const interiorAngle = Math.PI - TAU / N;
    // The applet's note warns that the picture is only an equiangular
    // *polygon* while it is simple (here, convex). That is exactly when every
    // vertex lies inside all the other side half-planes; a translated line can
    // otherwise make the traced V sequence fold back on itself.
    let convex = V.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    for (const v of V) {
      for (let k = 0; k < N && convex; k++) {
        const d = state.lines[k].t - dot(sub(v, c), state.lines[k].n);
        if (d < -1e-6) convex = false;
      }
    }
    return {
      N, V, F, P: state.P, lines: state.lines, c, r,
      longest, imax, jmax, R, C, circle, rim, U, feet,
      signed, unsigned, sumSigned, sumUnsigned, sumOffsets,
      sideLengths, interiorAngle, convex,
      inside: signed.every((d) => d >= -EPS),
    };
  }

  /** The page's claims, as booleans the logic test can hammer. */
  function claims(g) {
    let regularComparison = UisRegular(g);
    let containsPolygon = true;
    for (const v of g.V) {
      for (let k = 0; k < g.N; k++) {
        const radial = sub(g.circle[k], g.C);
        const len = Math.hypot(radial.x, radial.y);
        const gap = g.R - dot(sub(v, g.C), { x: radial.x / len, y: radial.y / len });
        if (!Number.isFinite(gap) || gap < 1.5) containsPolygon = false;
      }
    }
    let feetRight = true;
    for (let k = 0; k < g.N; k++) {
      const j = (k + 1) % g.N;
      const e = sub(g.U[j], g.U[k]);
      const len = Math.hypot(e.x, e.y);
      if (Math.abs(cross(e, sub(g.feet[k], g.U[k]))) / len > 1e-6 ||
          Math.abs(dot(sub(g.P, g.feet[k]), e)) / len > 1e-6) feetRight = false;
    }
    return {
      // Signed distances: the invariant for every position of P.
      sumIsOffsets: close(g.sumSigned, g.sumOffsets),
      // Ordinary distances agree with it when P is inside every side line.
      unsignedWhenInside: !g.inside || close(g.sumUnsigned, g.sumSigned),
      convex: g.convex,
      equiangular: g.sideLengths.every((s) => Number.isFinite(s) && s > 0) &&
        g.V.every((v, i) => {
          const a = sub(v, g.V[(i + 1) % g.N]);
          const b = sub(g.V[(i + 2) % g.N], g.V[(i + 1) % g.N]);
          const ang = Math.acos(Math.max(-1, Math.min(1,
            dot(a, b) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)))));
          return close(ang, g.interiorAngle, 1e-6);
        }),
      regularComparison,
      containsPolygon,
      feetRight,
    };
  }

  function UisRegular(g) {
    for (let k = 0; k < g.N; k++) {
      const j = (k + 1) % g.N;
      const radial = sub(g.circle[k], g.C);
      const len = Math.hypot(radial.x, radial.y);
      if (!close(len, g.R, 1e-6)) return false;
      // A tangent line at G[k] is dot(x - C, radial) = R; U[k] is where the
      // tangents at G[k] and G[j] meet.
      if (!close(dot(sub(g.U[k], g.C), radial), g.R * g.R, 1e-5)) return false;
      const next = sub(g.circle[j], g.C);
      if (!close(dot(sub(g.U[k], g.C), next), g.R * g.R, 1e-5)) return false;
      if (!close(distance(g.U[k], g.C), g.R / Math.cos(Math.PI / g.N), 1e-6)) return false;
      if (!close(distance(g.U[k], g.U[j]), 2 * g.R * Math.tan(Math.PI / g.N), 1e-6)) return false;
    }
    return true;
  }

  return {
    WIDTH, HEIGHT, MIN_N, MAX_N, STEP_N, INITIAL_N, EPS, TAU,
    sub, add, mul, dot, cross, distance, close, centreOf,
    intersect, nearestPoint, resetLines, clampN, start, move,
    linePoints, signedDistance, compute, claims,
  };
})();
