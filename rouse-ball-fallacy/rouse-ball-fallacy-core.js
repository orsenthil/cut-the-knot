"use strict";

/*
 * Rouse Ball's Fallacy, from Bogomolny's applet GeoFallacy.
 *
 * Build a right angle ADC and an obtuse angle DAE with DC = AE. The
 * perpendicular bisectors of EC and DA meet at O, so CO = EO and DO = AO;
 * with DC = AE the triangles OCD and OEA are congruent, which "proves" that
 * the obtuse angle DAE is right. The error is in the subtraction of angles:
 * in the real figure the ray EO lies outside the quadrilateral ADCE, so the
 * angle difference is not the angle ADC.
 *
 * The key idea is that all the congruences are true, but the angle subtraction
 * is only valid in the deliberately shortened, misleading drawing. The logic
 * test checks the distances and the position of EO.
 *
 * No document, no window, no storage: one global, RouseBallFallacyCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const RouseBallFallacyCore = (() => {
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => scale(add(a, b), 0.5);

  function intersect(p, d, q, e) {
    const den = cross(d, e);
    if (Math.abs(den) < 1e-12) return { x: NaN, y: NaN };
    const t = cross(sub(q, p), e) / den;
    return add(p, scale(d, t));
  }

  function start() {
    // D below A, C to the right of D, and E almost straight up from A so that
    // DAE is obtuse and AE is about as long as DC. The applet shortens AE by
    // 4% to make the misleading ray EO pass through the quadrilateral.
    return {
      D: { x: 120, y: 300 },
      A: { x: 120, y: 180 },
      C: { x: 240, y: 300 },
      E: { x: 97, y: 62 },
      shorten: 0.96,
    };
  }

  function geometry(state) {
    const { D, A, C } = state;
    const E = add(A, scale(sub(state.E, A), state.shorten));
    const K = mid(E, C);
    const H = mid(D, A);
    // Perpendicular bisector of EC through K, and of DA through H.
    const O = intersect(K, { x: -(C.y - E.y), y: C.x - E.x }, H, { x: -(A.y - D.y), y: A.x - D.x });
    // Is the ray EO inside the quadrilateral A-D-C-E? Test the side of each
    // edge of the quadrilateral for the midpoint of EO.
    const probe = mid(E, O);
    const quad = [A, D, C, E];
    let inside = true;
    const signs = [];
    for (let i = 0; i < quad.length; i++) {
      const p = quad[i];
      const q = quad[(i + 1) % quad.length];
      const s = Math.sign(cross(sub(q, p), sub(probe, p)));
      signs.push(s);
    }
    const pos = signs.filter((s) => s > 0).length;
    const neg = signs.filter((s) => s < 0).length;
    if (pos > 0 && neg > 0) inside = false;

    return {
      E, K, H, O, inside, probe,
      co: dist(C, O), eo: dist(E, O),
      do_: dist(D, O), ao: dist(A, O),
      dc: dist(D, C), ae: dist(A, E),
      angleDAE: angleAt(A, D, E),
      angleADC: angleAt(D, A, C),
      // The four angles in the fake proof, for display.
      proofAngles: {
        CDO: angleAt(O, C, D),
        EAO: angleAt(O, A, E),
        ADO: angleAt(O, A, D),
        DAO: angleAt(O, D, A),
      },
    };
  }

  function angleAt(vertex, p, q) {
    const a = sub(p, vertex);
    const b = sub(q, vertex);
    const cos = (a.x * b.x + a.y * b.y) / (dist(vertex, p) * dist(vertex, q));
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }

  function setPoint(state, which, p) {
    return { ...state, [which]: { x: p.x, y: p.y } };
  }

  return { start, geometry, angleAt, intersect, dist, setPoint };
})();
