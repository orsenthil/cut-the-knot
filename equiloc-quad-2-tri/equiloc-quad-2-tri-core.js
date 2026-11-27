"use strict";

/*
 * Equiloc Quad 2Tri — Alexander Bogomolny's applet EquilocQuad2Tri.
 *
 * A, B and S sit on one circle. C slides on the line B-S and D on the line
 * A-S; dragging either one sets the common length AD = BC. The applet then
 * takes four midpoints: K of AC, L of BD, M of AB and N of CD. Because KM and
 * LN are midlines parallel to BC, and ML and NK are midlines parallel to AD,
 * KMLN is a rhombus even when the angle between AD and BC is not 60 degrees.
 * In the equilic case (60 degrees) its short diagonal splits it into two
 * equilateral triangles.
 *
 * This file is geometry and state only: no document, no window, no storage.
 * It defines one global, EquilocQuad2TriCore, so a page loads it with a plain
 * <script> and porting/check-equiloc-quad-2-tri.mjs loads it in Node. Every
 * point is plain data in the SVG's 400 by 300 viewBox, and every function
 * returns a new state rather than changing the one it was given.
 */

const EquilocQuad2TriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 12;
  const TAU = 2 * Math.PI;
  /* applet init(): centre (w/2, 11h/20), radius min(w,h)/2.7. */
  const CIRCLE = {
    c: { x: VIEW.width / 2, y: (11 * VIEW.height) / 20 },
    r: Math.min(VIEW.width, VIEW.height) / 2.7,
  };
  const A_ANGLE = 2.6179938779914944; // 150 degrees
  const B_ANGLE = 0.5235987755982988; // 30 degrees
  const S_ANGLE = 5.711986642890533;  // 20*pi/11

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const mid = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const clamp = (p) => point(
    Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
    Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
  );

  /** Applet FromCircle: centre + radius (cos angle, sin angle). */
  function fromCircle(angle) {
    return point(CIRCLE.c.x + CIRCLE.r * Math.cos(angle),
      CIRCLE.c.y + CIRCLE.r * Math.sin(angle));
  }

  /** Applet LocatePoint: walk `length` from p towards q (negative = away). */
  function locate(length, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const n = Math.hypot(dx, dy);
    if (!(n > 0)) return point(NaN, NaN);
    return point(p.x + (length * dx) / n, p.y + (length * dy) / n);
  }

  /** InsideTest.IsInside(a,b,c): true when the angle at a is at least 90°. */
  function inside(a, b, c) {
    return dot(sub(a, b), sub(a, c)) <= 0;
  }

  /** GeoSDoub.NearestPoint(p,a,b), including its 0.1 squared-distance guard. */
  function nearestOnLine(p, a, b) {
    if (dot(sub(p, a), sub(p, a)) < 0.1) return point(p.x, p.y);
    const dx = b.x - a.x, dy = b.y - a.y;
    const n2 = dx * dx + dy * dy;
    if (!(n2 > 0)) return point(p.x, p.y);
    const t = dot(sub(p, a), point(dx, dy)) / n2;
    return point(a.x + t * dx, a.y + t * dy);
  }

  /** Keep a dragged S on the circle, exactly as RestrictToCircle does. */
  function onCircle(p) {
    const n = dist(p, CIRCLE.c);
    if (!(n > 0)) return null;
    const k = CIRCLE.r / n;
    return point(CIRCLE.c.x + (p.x - CIRCLE.c.x) * k,
      CIRCLE.c.y + (p.y - CIRCLE.c.y) * k);
  }

  /** The position a new diagram starts from (the applet's init()). */
  function start(options) {
    const o = options || {};
    const A = fromCircle(A_ANGLE), B = fromCircle(B_ANGLE), S = fromCircle(S_ANGLE);
    const length = Math.min(dist(A, S), dist(B, S)) / 2;
    return {
      A, B, S,
      C: locate(length, B, S),
      D: locate(length, A, S),
      length,
      circle: { c: point(CIRCLE.c.x, CIRCLE.c.y), r: CIRCLE.r },
      options: {
        names: o.names === undefined ? true : !!o.names,
        construction: o.construction === undefined ? false : !!o.construction,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /**
   * Move one of the three draggable points. S stays on the circle; C and D
   * slide on the two secants. Dragging C or D also sets the signed common
   * length used for both, just as UpgradeDistance() does.
   */
  function move(state, name, p) {
    if (!p || !finite(p) || (name !== "S" && name !== "C" && name !== "D")) return state;
    if (name === "S") {
      const s = onCircle(p);
      if (!s || !finite(s)) return state;
      /* Within a unit of A or B the secant collapses and the applet's
       * LocatePoint divides by (almost) zero; keep the last good picture. */
      if (dist(s, state.A) < 1 || dist(s, state.B) < 1) return state;
      return Object.assign({}, state, {
        S: s,
        C: locate(state.length, state.B, s),
        D: locate(state.length, state.A, s),
        explored: true,
      });
    }
    if (name === "C") {
      const c = nearestOnLine(p, state.B, state.S);
      if (!finite(c)) return state;
      const signed = (inside(state.B, c, state.S) ? -1 : 1) * dist(state.B, c);
      return Object.assign({}, state, {
        C: c, length: signed,
        D: locate(signed, state.A, state.S),
        explored: true,
      });
    }
    const d = nearestOnLine(p, state.A, state.S);
    if (!finite(d)) return state;
    const signed = (inside(state.A, d, state.S) ? -1 : 1) * dist(state.A, d);
    return Object.assign({}, state, {
      D: d, length: signed,
      C: locate(signed, state.B, state.S),
      explored: true,
    });
  }

  function setOption(state, name, on) {
    if (name !== "names" && name !== "construction" && name !== "hint") return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  function legalMoves() {
    return ["S", "C", "D"];
  }

  /**
   * Applet Compute(): AdjustC/AdjustD, then the four midpoints K, L, M, N and
   * the four rhombus sides KM, LM, LN, NK. The moved handles are already
   * projected, so repeating the adjustment keeps the drawing consistent.
   */
  function compute(state) {
    const { A, B, S } = state;
    if (![A, B, S, state.C, state.D].every(finite)
      || !finite(state.circle.c) || !Number.isFinite(state.circle.r)) return null;
    if (!(state.circle.r > 0) || !Number.isFinite(state.length)) return null;
    if (dist(state.C, S) < 1 || dist(state.D, S) < 1) return null;
    const C = locate(state.length, B, S), D = locate(state.length, A, S);
    if (!finite(C) || !finite(D)) return null;

    /* Bytecode: K = mid(A,C), L = mid(B,D), M = mid(A,B), N = mid(C,D). */
    const K = mid(A, C), L = mid(B, D), M = mid(A, B), N = mid(C, D);
    const sides = { KM: [K, M], ML: [M, L], LN: [L, N], NK: [N, K] };
    if (![K, L, M, N].every(finite)) return null;

    const sideLengths = {
      KM: dist(K, M), ML: dist(M, L), LN: dist(L, N), NK: dist(N, K),
    };
    const ad = dist(A, D), bc = dist(B, C);
    const scale = Math.max(1, ad, bc, dist(A, B), dist(C, D),
      sideLengths.KM, sideLengths.ML, sideLengths.LN, sideLengths.NK);
    const tol = 1e-9 * scale;
    const par = (p, q, r, s) => Math.abs(cross(sub(q, p), sub(s, r))) / (dist(r, s) || 1);

    /* Midlines of triangles ABC, ABD, BCD and ACD. */
    const measures = {
      kmVsBC: Math.abs(sideLengths.KM - bc / 2),
      mlVsAD: Math.abs(sideLengths.ML - ad / 2),
      lnVsBC: Math.abs(sideLengths.LN - bc / 2),
      nkVsAD: Math.abs(sideLengths.NK - ad / 2),
      kmDir: par(K, M, B, C),
      mlDir: par(M, L, A, D),
      lnDir: par(L, N, B, C),
      nkDir: par(N, K, A, D),
      sideSpread: Math.max(sideLengths.KM, sideLengths.ML,
        sideLengths.LN, sideLengths.NK)
        - Math.min(sideLengths.KM, sideLengths.ML, sideLengths.LN, sideLengths.NK),
      adbcError: Math.abs(ad - bc),
      ad, bc, kl: dist(K, L), mn: dist(M, N), side: sideLengths.KM,
    };

    /* The angle between the two equal opposite sides AD and BC. */
    const uAD = sub(D, A), uBC = sub(C, B);
    const cosine = ad > 0 && bc > 0
      ? Math.max(-1, Math.min(1, dot(uAD, uBC) / (ad * bc))) : NaN;
    const angle = Number.isFinite(cosine) ? (Math.acos(Math.abs(cosine)) * 180) / Math.PI : NaN;
    measures.angle = angle;
    measures.angleError = Number.isFinite(cosine)
      ? Math.min(Math.abs(Math.abs(cosine) - 0.5), Math.abs(Math.abs(cosine) - 1)) : NaN;

    const rhombus = measures.kmVsBC <= tol && measures.mlVsAD <= tol
      && measures.lnVsBC <= tol && measures.nkVsAD <= tol
      && measures.kmDir <= tol && measures.mlDir <= tol
      && measures.lnDir <= tol && measures.nkDir <= tol
      && measures.sideSpread <= tol;
    /* Equilic (60 degrees): the shorter diagonal cuts the rhombus in two
     * equilateral triangles. At 120 degrees it is the other diagonal. */
    const equilic = measures.adbcError <= tol && Math.abs(Math.abs(cosine) - 0.5) <= 1e-7;
    const equilateralKML = equilic && Math.abs(measures.kl - measures.side) <= tol;
    const equilateralKNL = equilic && Math.abs(measures.kl - sideLengths.LN) <= tol;
    const equilateralKMN = equilic && Math.abs(measures.mn - measures.side) <= tol;
    const equilateralLMN = equilic && Math.abs(measures.mn - sideLengths.ML) <= tol;
    const claims = {
      rhombus,
      adEqualsBC: measures.adbcError <= tol,
      midlinesEqual: measures.kmVsBC <= tol && measures.mlVsAD <= tol
        && measures.lnVsBC <= tol && measures.nkVsAD <= tol,
      oppositeParallel: measures.kmDir <= tol && measures.mlDir <= tol
        && measures.lnDir <= tol && measures.nkDir <= tol,
      equilic,
      equilateralKML, equilateralKNL,
      equilateralKMN, equilateralLMN,
    };

    /* The applet's Show construction box: four pairs of midlines plus BC, AD. */
    const construction = [
      [A, K], [K, C], [B, L], [L, D],
      [C, N], [D, N], [A, M], [M, B],
      [B, C], [A, D],
    ];
    return {
      A, B, C, D, S, K, L, M, N, sides, sideLengths,
      measures, claims, construction, circle: state.circle,
    };
  }

  function geometry(state) {
    return compute(state);
  }

  /* This is a picture, not a game: there is nothing to win or lose. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move S, C or D so the four points stay apart from the handles.";
    const m = g.measures;
    let line = `AD and BC are both ${m.ad.toFixed(1)} long, so KMLN is a rhombus.`;
    if (g.claims.equilic && (g.claims.equilateralKML || g.claims.equilateralKMN)) {
      line += " The angle between them is 60 degrees, so a diagonal cuts the rhombus into two equilateral triangles.";
    } else {
      line += ` The angle between them is ${m.angle.toFixed(0)} degrees; it need not be 60.`;
    }
    return line;
  }

  return {
    VIEW, PAD, CIRCLE, A_ANGLE, B_ANGLE, S_ANGLE, TAU,
    point, add, sub, mul, dot, cross, dist, finite, mid, clamp,
    fromCircle, locate, inside, nearestOnLine, onCircle,
    start, reset, move, setOption, legalMoves, compute, geometry,
    result, describe,
  };
})();
