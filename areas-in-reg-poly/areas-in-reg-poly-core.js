"use strict";

/*
 * Areas In Reg Poly, from Alexander Bogomolny's applet AreasInRegPoly.
 *
 * The applet draws a regular 2n-gon, joins a draggable point P to every
 * vertex, and colours the resulting triangles alternately. Its page claims
 * that the areas of the odd-numbered triangles and those of the
 * even-numbered ones add up to the same total when P lies inside the polygon.
 *
 * The key idea is that every side has the same length s, so triangle i has
 * area (s/2) times the distance from P to side i. The even side lines are
 * the sides of one regular n-gon and the odd side lines those of another;
 * both have the same apothem h as the 2n-gon. Viviani's theorem for an
 * equiangular polygon gives a distance sum of n*h in each, so both area
 * sums are (s/2)*n*h, half the polygon's area. With signed distances the
 * sums are equal for every P, because each set of outward normals sums to
 * zero; with ordinary (unsigned) distances the claim needs P inside.
 *
 * V, U, W and H are built exactly as Reset, Compute and the GeoSDoub calls
 * do in the applet: V[i] = centre + R*(cos, sin)(2*pi*i/N) with
 * R = min(width, height)/3.5, U and W are intersections of alternate side
 * lines, and H[i] is the foot of P on side i. Everything here is DOM-free
 * and takes and returns plain data.
 */
const AreasInRegPolyCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MIN_N = 4;
  const MAX_N = 30;
  const STEP_N = 2;
  const INITIAL_N = 6;
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

  /** GeoSDoub.Intersect: where line ab meets line cd, null when parallel. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < EPS) return null;
    return add(a, mul(r, cross(sub(c, a), s) / den));
  }

  /** GeoSDoub.NearestPoint: the foot of p on the infinite line ab. */
  function nearestPoint(p, a, b) {
    const r = sub(b, a);
    const len2 = dot(r, r);
    if (len2 < EPS) return { x: a.x, y: a.y };
    return add(a, mul(r, dot(sub(p, a), r) / len2));
  }

  /** The applet's Reset(): vertices and the two sets of extended side lines. */
  function resetGeometry(N, width, height) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const R = Math.min(width, height) / 3.5;
    const V = [];
    for (let i = 0; i < N; i++) {
      const angle = (TAU / N) * i;
      V.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
    }
    const U = [], W = [];
    for (let i = 0; i < N; i += 2) {
      const a = (i - 1 + N) % N, b = (i + 1) % N, c = (i + 2) % N;
      U.push(intersect(V[a], V[i], V[b], V[c]));
    }
    for (let i = 1; i < N; i += 2) {
      const a = (i - 1 + N) % N, b = (i + 1) % N, c = (i + 2) % N;
      W.push(intersect(V[a], V[i], V[b], V[c]));
    }
    return { cx, cy, R, V, U, W };
  }

  /** N on the spinner's lattice: integers from 4 to 30 stepping by 2. */
  function clampN(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return INITIAL_N;
    let k = Math.round(n / STEP_N) * STEP_N;
    k = Math.max(MIN_N, Math.min(MAX_N, k));
    return k;
  }

  /** The opening picture: P at the centre, N = 6, no hint. */
  function start(options) {
    const o = options || {};
    const width = Number.isFinite(o.width) ? o.width : WIDTH;
    const height = Number.isFinite(o.height) ? o.height : HEIGHT;
    const N = clampN(o.N === undefined ? INITIAL_N : o.N);
    const centre = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    return {
      width, height, N,
      showHint: o.showHint === true,
      P: o.P ? { x: o.P.x, y: o.P.y } : centre,
    };
  }

  /** An illegal move changes nothing; a legal one returns a fresh position. */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") {
      return start({ width: state.width, height: state.height });
    }
    if (m.type === "option") {
      if (m.key !== "showHint" || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { showHint: m.value });
    }
    if (m.type === "N") {
      if (typeof m.value !== "number" || !Number.isFinite(m.value)) return null;
      return Object.assign({}, state, { N: clampN(m.value) });
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
    return null;
  }

  /** A regular polygon is convex: P is in it iff every side turns the same way. */
  function insidePolygon(poly, p) {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
      const q = poly[(i + 1) % poly.length];
      const turn = cross(sub(q, poly[i]), sub(p, poly[i]));
      if (Math.abs(turn) < EPS) continue;
      const s = turn > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  /** Everything the picture needs: applet geometry plus the page's two sums. */
  function compute(state) {
    const N = clampN(state.N);
    const g = resetGeometry(N, state.width, state.height);
    const { V, U, W, cx, cy, R } = g;
    const P = state.P;
    const H = [], triangles = [];
    let evenArea = 0, oddArea = 0, evenSigned = 0, oddSigned = 0;
    let shoelace = 0, minTurn = Infinity, maxTurn = -Infinity;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      H.push(nearestPoint(P, V[i], V[j]));
      const edge = sub(V[j], V[i]);
      const turn = cross(edge, sub(P, V[i])); // twice the signed triangle area
      const area = Math.abs(turn) / 2;
      triangles.push(area);
      if (i % 2 === 0) { evenArea += area; evenSigned += turn / 2; }
      else { oddArea += area; oddSigned += turn / 2; }
      shoelace += cross(V[i], V[j]);
      minTurn = Math.min(minTurn, turn);
      maxTurn = Math.max(maxTurn, turn);
    }
    const apothem = R * Math.cos(Math.PI / N);
    const side = 2 * R * Math.sin(Math.PI / N);
    return {
      N, n: N / 2, V, U, W, H, triangles, P, cx, cy, R, apothem, side,
      evenArea, oddArea, evenSigned, oddSigned,
      polygonArea: Math.abs(shoelace) / 2,
      inside: insidePolygon(V, P),
      // The seams between the alternating triangles: signed turns of one sign
      // mean P is on the same side of every side line.
      allSameSide: minTurn >= -EPS || maxTurn <= EPS,
      halfPolygon: (evenArea + oddArea) / 2,
    };
  }

  /** The page's claims, each checked with a relative tolerance. */
  function claims(g) {
    return {
      // The stated theorem: for P inside, the two area sums agree and are
      // each half of the whole polygon.
      equalSums: close(g.evenArea, g.oddArea),
      sumsAreHalf: close(g.evenArea, g.halfPolygon) && close(g.oddArea, g.halfPolygon),
      // The stronger signed form holds wherever P is put.
      signedSumsEqual: close(g.evenSigned, g.oddSigned),
      signedSumsAreNH: close(g.evenSigned, (g.n * g.side * g.apothem) / 2) &&
        close(g.oddSigned, (g.n * g.side * g.apothem) / 2),
      isHalfPolygon: close(g.evenArea + g.oddArea, g.polygonArea),
    };
  }

  return {
    WIDTH, HEIGHT, MIN_N, MAX_N, STEP_N, INITIAL_N, EPS,
    sub, add, mul, dot, cross, distance, close,
    intersect, nearestPoint, resetGeometry, clampN, start, move,
    insidePolygon, compute, claims,
  };
})();
