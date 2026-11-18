"use strict";

/*
 * "All Triangles Are Isosceles", from Bogomolny's applet AllTrianglesIsosceles.
 *
 * The fake proof: take an acute triangle ABC, meet the bisector of angle C with
 * the perpendicular bisector of AB at P, drop perpendiculars PU and PV onto AC
 * and BC, then chase congruences to "prove" AC = BC. The catch is in the
 * picture: P always lies on the circumcircle of ABC, so one of the feet U, V
 * falls outside its side, and the segment addition AC = AU + CU is wrong.
 *
 * The core computes all the points and checks those claims. The UI can draw
 * either the applet's misleading "faulty" placement or the honest one.
 *
 * No document, no window, no storage: one global, IsoscelesFallacyCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const IsoscelesFallacyCore = (() => {
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const len = (a) => Math.hypot(a.x, a.y);
  const unit = (a) => scale(a, 1 / len(a));
  const midpoint = (a, b) => scale(add(a, b), 0.5);
  const dist = (a, b) => len(sub(a, b));

  function start() {
    return {
      A: { x: 80, y: 250 },
      B: { x: 320, y: 250 },
      C: { x: 215, y: 70 },
      mode: "faulty",
      showNames: true,
      showHint: false,
    };
  }

  /** Intersection of lines p + t*d and q + s*e, or NaN point if parallel. */
  function intersect(p, d, q, e) {
    const den = cross(d, e);
    if (Math.abs(den) < 1e-12) return { x: NaN, y: NaN };
    const t = cross(sub(q, p), e) / den;
    return add(p, scale(d, t));
  }

  /** Foot of the perpendicular from p onto the line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a);
    const t = dot(sub(p, a), d) / dot(d, d);
    return add(a, scale(d, t));
  }

  function onSegment(footPoint, a, b, eps = 1e-7) {
    const ab = sub(b, a);
    const t = dot(sub(footPoint, a), ab) / dot(ab, ab);
    return t >= -eps && t <= 1 + eps;
  }

  function circumcenter(A, B, C) {
    return intersect(midpoint(A, B), { x: -(B.y - A.y), y: B.x - A.x },
      midpoint(A, C), { x: -(C.y - A.y), y: C.x - A.x });
  }

  function geometry(state) {
    const { A, B, C } = state;
    const Mab = midpoint(A, B);
    // Internal bisector at C: sum of the unit vectors towards A and B.
    const bisDir = add(unit(sub(A, C)), unit(sub(B, C)));
    const perpDir = { x: -(B.y - A.y), y: B.x - A.x };
    let M = Mab;
    let L = add(C, bisDir);
    if (state.mode === "faulty") {
      // The applet nudges M and L towards one another to mislead the eye.
      M = midpoint(Mab, L);
      L = midpoint(Mab, M);
    }
    // The applet intersects the line C->L with the perpendicular through M;
    // in faulty mode both L and M have been nudged, so P is the fake point.
    const P = intersect(C, sub(L, C), M, perpDir);
    const U = foot(P, A, C);
    const V = foot(P, B, C);
    const O = circumcenter(A, B, C);
    const R = dist(O, A);
    const pOnCircle = Math.abs(dist(P, O) - R) < 1e-6 * Math.max(1, R);
    return {
      M, L, P, U, V, O, R,
      midpointAB: Mab,
      pOnCircle,
      uOnSide: onSegment(U, A, C),
      vOnSide: onSegment(V, B, C),
      ap: dist(A, P), bp: dist(B, P),
      cu: dist(C, U), cv: dist(C, V),
      pu: dist(P, U), pv: dist(P, V),
      ac: dist(A, C), bc: dist(B, C),
      drawable: Number.isFinite(P.x) && Number.isFinite(P.y),
    };
  }

  function moveVertex(state, which, point) {
    return { ...state, [which]: { x: point.x, y: point.y } };
  }

  function setMode(state, mode) {
    return { ...state, mode: mode === "right" ? "right" : "faulty" };
  }

  return { start, geometry, intersect, foot, onSegment, circumcenter, moveVertex, setMode, sub, add, dist };
})();
