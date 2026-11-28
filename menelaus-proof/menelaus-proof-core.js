"use strict";

/*
 * Menelaus Proof — the geometry behind Alexander Bogomolny's applet
 * MenelausProof (cut-the-knot.org/Curriculum/Geometry/MenelausProof.shtml,
 * "Two Proofs of Menelaus Theorem").
 *
 * Drag the triangle's corners A, B, C or the three marked points F on AB,
 * D on BC and E on CA. The three side points always stay on one straight
 * line, and the unsigned product AF/BF · BD/CD · CE/AE always stays 1 —
 * that is the Menelaus theorem. The applet offers a Plain view and three
 * proof views: a parallel through A (Proof 1), perpendiculars from the
 * vertices on the transversal (Proof 2), and a perpendicular through a
 * chosen point of the transversal (Proof 3).
 *
 * The one idea the code relies on is that the side points are constrained
 * to their sides and then re-intersected: after a corner moves, the point
 * on the corner's far side is projected back onto the new side and the
 * third side point is re-created as a line intersection. Collinearity —
 * and therefore the product — is preserved exactly as in the applet's
 * DrawMenelausProof method. Every helper below is transcribed from the
 * applet's bytecode (GeoSDoub.Intersect, NearestPoint, GetParallelTo,
 * FindAltitude, DoubLine.CreateMidPoint, CTKMoveableDoub.UpdateLocation).
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, MenelausProofCore, so the page loads it
 * with a plain <script> and porting/check-menelaus-proof.mjs loads it in
 * Node. Positions are plain data; functions never change what they are
 * given.
 */
const MenelausProofCore = (() => {
  const EPS = 1e-9;
  const TWO_PI = 6.283185307179586;
  const E_PARAM = 0.6666666666666666;
  const D_PARAM = 0.3333333333333333;
  // The applet canvas' own constants: UPDATE_D, UPDATE_E, UPDATE_F.
  const UPDATE_D = 1, UPDATE_E = 2, UPDATE_F = 3;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const copyPoint = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect: ax+by+c=0 form; |det| < 1 gives NaN, not null. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const divisor = a1 * b2 - a2 * b1;
    if (Math.abs(divisor) < 1) return { x: NaN, y: NaN };
    return {
      x: (b1 * c2 - b2 * c1) / divisor,
      y: (c1 * a2 - c2 * a1) / divisor,
    };
  }

  /** MoveableLinComb(a, b, t) = t*a + (1-t)*b (the applet's order). */
  function linComb(a, b, t) {
    return {
      x: t * a.x + (1 - t) * b.x,
      y: t * a.y + (1 - t) * b.y,
    };
  }

  /** GeoSDoub.NearestPoint(p, a, b): projection of p on line ab. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) < 0.1) return copyPoint(p);
    const den = dx * dx + dy * dy;
    if (Math.abs(den) < EPS) return copyPoint(p);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / den;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.GetParallelTo(p, q, r) = p + 100*(q-r). */
  function parallelPoint(p, q, r) {
    return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
  }

  /** GeoSDoub.FindAltitude(p, q, r): foot of the perpendicular p -> line qr. */
  function altitudeFoot(p, q, r) {
    const s = { x: p.x + r.y - q.y, y: p.y - r.x + q.x };
    return intersect(p, s, q, r);
  }

  /** The applet's InBetween(p, q, r): dot(p-q, r-q) < 0. */
  function inBetween(p, q, r) {
    return (p.x - q.x) * (r.x - q.x) + (p.y - q.y) * (r.y - q.y) < 0;
  }

  /** DoubLine.CreateMidPoint(t) = t*a + (1-t)*b. */
  function midPoint(a, b, t) {
    return { x: t * a.x + (1 - t) * b.x, y: t * a.y + (1 - t) * b.y };
  }

  /** MenelausProofCanvas.Perp(p, line through a,b). */
  function perpPoint(p, a, b) {
    return { x: p.x + a.y - b.y, y: p.y - a.x + b.x };
  }

  /** MenelausProofCanvas.GetPoint(i): the three starting corners. */
  function getPoint(i, width, height) {
    const radius = Math.trunc(Math.min(width, height) / 5);
    const angle = radius * Math.cos((TWO_PI * (i - 1)) / 3);
    const x = Math.trunc(width / 2) + Math.trunc(angle);
    let y = Math.trunc(height / 2) + Math.trunc(radius * Math.sin((TWO_PI * (i - 1)) / 3));
    if (i === 1) return { x: x + 100, y };
    if (i === 2) return { x: x - 110, y: height - 40 };
    return { x, y };
  }

  /** Clone a position, changing one named point. */
  function withPoint(s, name, p) {
    const next = {
      A: copyPoint(s.A), B: copyPoint(s.B), C: copyPoint(s.C),
      D: copyPoint(s.D), E: copyPoint(s.E), F: copyPoint(s.F),
      proof: s.proof, showNames: s.showNames, width: s.width, height: s.height,
    };
    if (next[name]) next[name] = copyPoint(p);
    return next;
  }

  function withOption(s, name, value) {
    const next = withPoint(s, "", s.A);
    if (name === "proof") next.proof = ((Math.trunc(value) % 4) + 4) % 4;
    if (name === "showNames") next.showNames = Boolean(value);
    return next;
  }

  /** Init(): corners from GetPoint, E on AC, D on BC, F = DE ∩ AB. */
  function construct(a, b, c) {
    const E = linComb(a, c, E_PARAM);
    const D = linComb(b, c, D_PARAM);
    const F = intersect(a, b, D, E);
    return { A: copyPoint(a), B: copyPoint(b), C: copyPoint(c), D, E, F };
  }

  /** The position a new diagram starts from (the page embeds 500 by 380). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 500 : o.width;
    const height = o.height === undefined ? 380 : o.height;
    let base;
    if (o.points) {
      base = construct(o.points.A, o.points.B, o.points.C);
    } else {
      base = construct(getPoint(0, width, height), getPoint(1, width, height), getPoint(2, width, height));
    }
    return {
      ...base,
      proof: o.proof === undefined ? 0 : ((Math.trunc(o.proof) % 4) + 4) % 4,
      showNames: o.showNames === undefined ? false : Boolean(o.showNames),
      width, height,
    };
  }

  /** Re-run Init on the current corners; Reset(int) itself only sets Proof. */
  function restart(s) {
    return start({
      width: s.width, height: s.height, proof: s.proof,
      showNames: s.showNames,
      points: { A: s.A, B: s.B, C: s.C },
    });
  }

  /**
   * The segment of the transversal the applet draws as TheLine. Its endpoints
   * come from the InBetween tests in DrawMenelausProof.
   */
  function theLine(s) {
    if (inBetween(s.D, s.E, s.F)) return { p: s.D, q: s.F, name: "DF" };
    if (inBetween(s.E, s.D, s.F)) return { p: s.E, q: s.F, name: "EF" };
    return { p: s.E, q: s.D, name: "ED" };
  }

  /** The six pale spokes drawn in DrawMenelausProof. */
  function spokes(s) {
    return [
      [s.A, s.E], [s.C, s.E], [s.B, s.F], [s.A, s.F], [s.B, s.D], [s.C, s.D],
    ];
  }

  /** The extra construction for the chosen proof mode, as AddProofN draws it. */
  function auxiliary(s) {
    const line = theLine(s);
    const out = { line, proof: s.proof };
    if (s.proof === 1) {
      // AddProof1: GetParallelTo(A,E,D), then P = BC ∩ that parallel.
      const helper = parallelPoint(s.A, s.E, s.D);
      out.helper = helper;
      out.P = intersect(s.B, s.C, s.A, helper);
    } else if (s.proof === 2) {
      // AddProof2: three altitudes from the vertices onto line DE.
      out.Ha = altitudeFoot(s.A, s.D, s.E);
      out.Hb = altitudeFoot(s.B, s.D, s.E);
      out.Hc = altitudeFoot(s.C, s.D, s.E);
    } else if (s.proof === 3) {
      // AddProof3: K at 0.6 along TheLine, the perpendicular there, and the
      // nearest points of the three vertices on that perpendicular.
      out.K = midPoint(line.p, line.q, 0.6);
      out.perpQ = perpPoint(out.K, line.p, line.q);
      out.Ka = nearestPoint(s.A, out.K, out.perpQ);
      out.Kb = nearestPoint(s.B, out.K, out.perpQ);
      out.Kc = nearestPoint(s.C, out.K, out.perpQ);
    }
    return out;
  }

  /** Signed position of p on the directed line x->y: p = x + t(y-x). */
  function param(p, x, y) {
    const dx = y.x - x.x, dy = y.y - x.y;
    if (Math.abs(dx) >= Math.abs(dy)) return (p.x - x.x) / dx;
    return (p.y - x.y) / dy;
  }

  /** Everything the page draws, and every number the maths section names. */
  function measurements(s) {
    const lens = {
      a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B),
    };
    const ratios = {
      AF_BF: distance(s.A, s.F) / distance(s.B, s.F),
      BD_CD: distance(s.B, s.D) / distance(s.C, s.D),
      CE_AE: distance(s.C, s.E) / distance(s.A, s.E),
    };
    const directed = {
      AF_FB: param(s.F, s.A, s.B),
      BD_DC: param(s.D, s.B, s.C),
      CE_EA: param(s.E, s.C, s.A),
    };
    const rAF = directed.AF_FB / (1 - directed.AF_FB);
    const rBD = directed.BD_DC / (1 - directed.BD_DC);
    const rCE = directed.CE_EA / (1 - directed.CE_EA);
    const scale = Math.max(lens.a, lens.b, lens.c, 1);
    const area = cross(s.A, s.B, s.C);
    return {
      A: s.A, B: s.B, C: s.C, D: s.D, E: s.E, F: s.F,
      sides: lens,
      ratios,
      product: ratios.AF_BF * ratios.BD_CD * ratios.CE_AE,
      directedProduct: rAF * rBD * rCE,
      collinearOffset: cross(s.D, s.E, s.F) / scale,
      collinear: Math.abs(cross(s.D, s.E, s.F)) <= 1e-7 * scale,
      degenerate: Math.abs(area) < 1e-9 * scale || Math.min(lens.a, lens.b, lens.c) < EPS,
      orientation: area >= 0 ? 1 : -1,
      showNames: s.showNames !== false,
      proof: s.proof,
      line: theLine(s),
      spokes: spokes(s),
      auxiliary: auxiliary(s),
    };
  }

  /**
   * Apply a drag of one named point to a target. Vertices are free; E, D, F
   * are projected onto AC, BC, AB. Then the dependent side point is put back
   * on the transversal by the exact intersection sequence of
   * DrawMenelausProof. Nothing passed in is changed.
   */
  function applyDrag(s, name, target) {
    if (!["A", "B", "C", "D", "E", "F"].includes(name)) return withPoint(s, "", s.A);
    let next = withPoint(s, "", s.A);
    let update = 0;
    let p = { x: target.x, y: target.y };

    if (name === "A") {
      next = withPoint(next, "A", p);
      update = UPDATE_F;
    } else if (name === "C") {
      next = withPoint(next, "C", p);
      update = UPDATE_E;
    }
    if (name === "B") {
      next = withPoint(next, "B", p);
      update = UPDATE_D;
    }

    // CTKMoveableDoub.UpdateLocation: a constrained point is re-projected on
    // its current glider line (which follows the corners by reference).
    if (name === "A") next = withPoint(next, "E", nearestPoint(next.E, next.A, next.C));
    if (name === "C") next = withPoint(next, "D", nearestPoint(next.D, next.B, next.C));
    if (name === "B") next = withPoint(next, "F", nearestPoint(next.F, next.A, next.B));
    if (name === "E") p = nearestPoint(p, next.A, next.C);
    if (name === "D") p = nearestPoint(p, next.B, next.C);
    if (name === "F") p = nearestPoint(p, next.A, next.B);
    if (next[name]) next = withPoint(next, name, p);

    if (name === "F" || update === UPDATE_E) {
      next = withPoint(next, "E", intersect(next.F, next.D, next.A, next.C));
    }
    if (name === "D" || update === UPDATE_F) {
      next = withPoint(next, "F", intersect(next.D, next.E, next.B, next.A));
    }
    if (name === "E" || update === UPDATE_D) {
      next = withPoint(next, "D", intersect(next.E, next.F, next.C, next.B));
    }
    return next;
  }

  /** A position is drawable when every point is finite and the triangle is real. */
  function valid(s) {
    return ["A", "B", "C", "D", "E", "F"].every((n) => finite(s[n])) && !measurements(s).degenerate;
  }

  /**
   * Each statement on the linked explanation, tested at this position:
   * collinearity, the product, the two proofs, and their converse.
   */
  function claims(s) {
    const m = measurements(s);
    const off = {
      fOnAB: false, dOnBC: false, eOnAC: false, collinear: false,
      productOne: false, directedProductMinusOne: false,
      proof1Parallel: false, proof1OnBC: false, proof1Ratios: false,
      proof2Perpendicular: false, proof2OnLine: false, proof2Ratios: false,
      proof3ThroughK: false, proof3Perpendicular: false, proof3Feet: false,
    };
    if (m.degenerate) return off;
    const tol = 1e-6 * Math.max(m.sides.a, m.sides.b, m.sides.c, 1);
    const close = (x, y, eps = 1e-6) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= eps;
    const onLine = (p, x, y) => finite(p) && Math.abs(cross(x, y, p)) <= tol;
    const { A, B, C, D, E, F } = s;
    // Check every proof construction, whichever mode is currently selected.
    const aux1 = auxiliary(withOption(s, "proof", 1));
    const aux2 = auxiliary(withOption(s, "proof", 2));
    const aux3 = auxiliary(withOption(s, "proof", 3));

    const eParamA = param(E, A, C);
    const dParam = param(D, B, C);
    const fParam = param(F, A, B);
    const fOnAB = onLine(F, A, B);
    const dOnBC = onLine(D, B, C);
    const eOnAC = onLine(E, A, C);
    const productOne = close(m.product, 1, 1e-7);
    const directedProductMinusOne = close(m.directedProduct, -1, 1e-7);

    // Proof 1: P is on BC and AP is parallel to ED; the two similar pairs
    // give AF/BF = PD/BD and AE/CE = PD/CD.
    let proof1Parallel = false, proof1OnBC = false, proof1Ratios = false;
    if (finite(aux1.P)) {
      proof1OnBC = onLine(aux1.P, B, C);
      const ap = { x: aux1.P.x - A.x, y: aux1.P.y - A.y };
      const ed = { x: D.x - E.x, y: D.y - E.y };
      proof1Parallel = Math.abs(ap.x * ed.y - ap.y * ed.x) <= tol;
      const pd = distance(aux1.P, D);
      proof1Ratios = close(m.ratios.AF_BF, pd / distance(B, D)) &&
        close(distance(A, E) / distance(C, E), pd / distance(C, D));
    }

    // Proof 2: the three altitudes land on line DE and their lengths have
    // the same ratios as the three side segments.
    let proof2Perpendicular = false, proof2OnLine = false, proof2Ratios = false;
    if (finite(aux2.Ha) && finite(aux2.Hb) && finite(aux2.Hc)) {
      const dirDE = { x: E.x - D.x, y: E.y - D.y };
      const perp = (v, footPoint) => Math.abs(dot({ x: v.x - footPoint.x, y: v.y - footPoint.y }, dirDE)) <= tol;
      proof2Perpendicular = perp(A, aux2.Ha) && perp(B, aux2.Hb) && perp(C, aux2.Hc);
      proof2OnLine = onLine(aux2.Ha, D, E) && onLine(aux2.Hb, D, E) && onLine(aux2.Hc, D, E);
      proof2Ratios = close(m.ratios.AF_BF, distance(A, aux2.Ha) / distance(B, aux2.Hb)) &&
        close(m.ratios.BD_CD, distance(B, aux2.Hb) / distance(C, aux2.Hc)) &&
        close(m.ratios.CE_AE, distance(C, aux2.Hc) / distance(A, aux2.Ha));
    }

    // Proof 3: K lies on the transversal, the drawn line through K is
    // perpendicular to it, and the K_a/K_b/K_c are its nearest points.
    let proof3ThroughK = false, proof3Perpendicular = false, proof3Feet = false;
    if (finite(aux3.K) && finite(aux3.perpQ) && finite(aux3.Ka) && finite(aux3.Kb) && finite(aux3.Kc)) {
      const dirT = { x: m.line.q.x - m.line.p.x, y: m.line.q.y - m.line.p.y };
      const dirP = { x: aux3.perpQ.x - aux3.K.x, y: aux3.perpQ.y - aux3.K.y };
      proof3ThroughK = onLine(aux3.K, m.line.p, m.line.q);
      proof3Perpendicular = param(aux3.K, m.line.p, m.line.q) >= -1e-6 &&
        param(aux3.K, m.line.p, m.line.q) <= 1 + 1e-6 &&
        Math.abs(dot(dirT, dirP)) / (Math.hypot(dirT.x, dirT.y) * Math.hypot(dirP.x, dirP.y) || 1) < 1e-9;
      const foot = (p, q) => Math.hypot(
        q.x - nearestPoint(p, aux3.K, aux3.perpQ).x,
        q.y - nearestPoint(p, aux3.K, aux3.perpQ).y,
      );
      proof3Feet = foot(A, aux3.Ka) < 1e-6 && foot(B, aux3.Kb) < 1e-6 && foot(C, aux3.Kc) < 1e-6;
    }

    return {
      fOnAB, dOnBC, eOnAC,
      collinear: m.collinear,
      productOne,
      directedProductMinusOne,
      proof1Parallel, proof1OnBC, proof1Ratios,
      proof2Perpendicular, proof2OnLine, proof2Ratios,
      proof3ThroughK, proof3Perpendicular, proof3Feet,
      params: { eParamA, dParam, fParam },
    };
  }

  /** An illustration has no win, loss or end. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, TWO_PI, E_PARAM, D_PARAM, UPDATE_D, UPDATE_E, UPDATE_F,
    distance, dot, cross, finite, intersect, linComb, nearestPoint,
    parallelPoint, altitudeFoot, inBetween, midPoint, perpPoint, getPoint,
    withPoint, withOption, construct, start, restart, theLine, spokes,
    auxiliary, param, measurements, applyDrag, valid, claims, result,
  };
})();
