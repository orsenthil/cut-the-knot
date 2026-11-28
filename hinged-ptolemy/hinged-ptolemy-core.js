"use strict";

/*
 * Hinged Ptolemy — Alexander Bogomolny's applet HingedPtolemy.
 *
 * Four points A, B, P, C lie on one circle, in that order round it. The
 * applet swings triangle ACP about A, through the signed angle from AC to AB:
 * C goes to C' on the ray AB and P goes to P'. The swivelled side C'P' is
 * parallel to BP, which makes two similar triangles and proves
 *
 *     AC·BP + AB·CP = AP·BC.                                   (Ptolemy)
 *
 * Everything here is geometry, transcribed from HingedPtolemyCanvas.Compute
 * and its helpers in GeoSDoub: ComputeSignedAngle, Rotate and Intersect.
 * The "Rotation" scrollbar runs from 0 to 105 and is divided by 100, so the
 * diagram can be paused mid-turn and even swung 5% past the full turn.
 * There is no win, loss or computer player: the picture is an illustration.
 *
 * No document, no window, no storage: this file defines one global,
 * HingedPtolemyCore. Positions are plain data and can be handed to the tutor.
 */
const HingedPtolemyCore = (() => {
  const PI = Math.PI;
  const CENTER = { x: 200, y: 160 };
  const RADIUS = 100;
  /* HingedPtolemyCanvas.init: the four starting angles, in screen radians. */
  const START_ANGLES = {
    A: 2.748893571891069, // 157.5 degrees
    B: PI / 4,            //  45  degrees
    C: -PI / 3,           // -60  degrees
    P: -PI / 6,           // -30  degrees
  };
  /* HingedPtolemyPanel: new Scrollbar(HORIZONTAL, 0, 5, 0, 105), /100. */
  const MIN_ROTATION = 0;
  const MAX_ROTATION = 105;

  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const copy = (p) => ({ x: p.x, y: p.y });

  /* GeoSDoub.FindOrientation, in the applet's own screen coordinates:
     q.x*(o.y-p.y) + q.y*(p.x-o.x) + o.x*p.y - p.x*o.y, positive or -1. */
  function orientation(o, p, q) {
    const c = q.x * (o.y - p.y) + q.y * (p.x - o.x) + o.x * p.y - p.x * o.y;
    return c > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeSignedAngle(o, p, q): no clamping — Math.acos of a value
     outside [-1, 1] gives NaN in Java just as it does in JavaScript. */
  function signedAngle(o, p, q) {
    const top = sqDist(o, p) + sqDist(o, q) - sqDist(p, q);
    const value = top / 2 / dist(o, p) / dist(o, q);
    return orientation(o, p, q) === 1 ? Math.acos(value) : -Math.acos(value);
  }

  /* GeoSDoub.Rotate(centre, point, angle, direction). The applet passes 1. */
  function rotate(o, p, angle, direction) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const d = direction;
    return {
      x: o.x + c * (p.x - o.x) - d * s * (p.y - o.y),
      y: o.y + d * s * (p.x - o.x) + c * (p.y - o.y),
    };
  }

  /* GeoSDoub.Intersect(a, b, c, d), line in the form r*x + s*y = t.
     Its determinant test is |det| >= 1, not merely != 0: nearly parallel
     lines get NaN coordinates in the applet too. */
  function intersect(a, b, c, d) {
    const r1 = a.y - b.y;
    const s1 = b.x - a.x;
    const t1 = a.x * b.y - a.y * b.x;
    const r2 = c.y - d.y;
    const s2 = d.x - c.x;
    const t2 = c.x * d.y - c.y * d.x;
    const det = r1 * s2 - r2 * s1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (s1 * t2 - s2 * t1) / det, y: (t1 * r2 - t2 * r1) / det };
  }

  /** The applet's PointOnCircle: centre + radius times the polar unit vector. */
  function pointOnCircle(center, radius, angle) {
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  }

  /** BetterMover snaps a dragged point radially onto its circle. */
  function projectToCircle(center, radius, p) {
    const d = dist(center, p);
    if (!Number.isFinite(d) || d < 1e-12) return null;
    return {
      x: center.x + ((p.x - center.x) * radius) / d,
      y: center.y + ((p.y - center.y) * radius) / d,
    };
  }

  const clampRotation = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return MIN_ROTATION;
    return Math.max(MIN_ROTATION, Math.min(MAX_ROTATION, Math.round(n)));
  };

  /** The picture a newly opened applet shows: rotation 0, names hidden. */
  function start(options) {
    const o = options || {};
    const center = o.center ? copy(o.center) : copy(CENTER);
    const radius = Number.isFinite(o.radius) ? o.radius : RADIUS;
    const angles = o.angles || START_ANGLES;
    return {
      center: center,
      radius: radius,
      A: pointOnCircle(center, radius, angles.A === undefined ? START_ANGLES.A : angles.A),
      B: pointOnCircle(center, radius, angles.B === undefined ? START_ANGLES.B : angles.B),
      C: pointOnCircle(center, radius, angles.C === undefined ? START_ANGLES.C : angles.C),
      P: pointOnCircle(center, radius, angles.P === undefined ? START_ANGLES.P : angles.P),
      rotation: clampRotation(o.rotation === undefined ? 0 : o.rotation),
      showNames: !!o.showNames,
    };
  }

  /** Move A, B, C or P; a drop on the centre leaves the point where it was. */
  function withPoint(state, name, p) {
    if (["A", "B", "C", "P"].indexOf(name) < 0) return state;
    const snapped = projectToCircle(state.center, state.radius, p);
    if (!snapped) return state;
    return { ...state, [name]: snapped };
  }

  function setRotation(state, value) {
    return { ...state, rotation: clampRotation(value) };
  }

  function setShowNames(state, on) {
    return { ...state, showNames: !!on };
  }

  /** HingedPtolemyCanvas.Compute, with the fraction from the scrollbar. */
  function compute(state) {
    const angle = signedAngle(state.A, state.C, state.B);
    const turned = (angle * state.rotation) / 100;
    const Cp = rotate(state.A, state.C, turned, 1);
    const Pp = rotate(state.A, state.P, turned, 1);
    const Pq = intersect(state.A, Pp, state.B, state.P);
    return { angle: angle, turned: turned, Cp: Cp, Pp: Pp, Pq: Pq };
  }

  /** Lengths and the two relations the proof on the page uses. */
  function measure(state, geometry) {
    const g = geometry || compute(state);
    const d = (p, q) => dist(p, q);
    const AB = d(state.A, state.B);
    const BP = d(state.B, state.P);
    const CP = d(state.C, state.P);
    const AP = d(state.A, state.P);
    const BC = d(state.B, state.C);
    const AC = d(state.A, state.C);
    return {
      AB: AB, BP: BP, CP: CP, AP: AP, BC: BC, AC: AC,
      CpPp: d(g.Cp, g.Pp),
      BPq: d(state.B, g.Pq),
      PPq: d(state.P, g.Pq),
      left: AC * BP + AB * CP,
      right: AP * BC,
      gap: AC * BP + AB * CP - AP * BC,
      parallelCross: cross(sub(g.Pp, g.Cp), sub(state.P, state.B)),
      bpqCross: cross(sub(g.Pq, state.B), sub(state.P, state.B)),
      cpqCross: cross(sub(g.Cp, state.A), sub(state.B, state.A)),
    };
  }

  /** An illustration has no result to report. */
  function result(state) {
    return null;
  }

  /** The line under the picture: what the current slider position means. */
  function describe(state, geometry, m) {
    const g = geometry || compute(state);
    const q = m || measure(state, g);
    const degrees = (g.angle * 180) / PI;
    const identity = `AC\u00b7BP + AB\u00b7CP = ${q.left.toFixed(1)}, AP\u00b7BC = ${q.right.toFixed(1)}`;
    if (state.rotation === 0) {
      return `${identity}. Turn C and P about A with Rotation: the swinging side starts as CP.`;
    }
    if (state.rotation < 100) {
      return `${identity}. Rotation ${state.rotation}% of ${degrees.toFixed(1)}\u00b0: C'P' is still turning; it is not parallel to BP yet.`;
    }
    if (state.rotation === 100) {
      return `${identity}. Full turn: C' is on AB, C'P' is parallel to BP, and BP'' + PP'' = AP\u00b7BC / AC.`;
    }
    return `${identity}. Rotation ${state.rotation}% passes the full turn: C' is beyond B, so the hinge no longer lines up.`;
  }

  return {
    MIN_ROTATION: MIN_ROTATION,
    MAX_ROTATION: MAX_ROTATION,
    CENTER: CENTER,
    RADIUS: RADIUS,
    START_ANGLES: START_ANGLES,
    start: start,
    withPoint: withPoint,
    setRotation: setRotation,
    setShowNames: setShowNames,
    compute: compute,
    measure: measure,
    projectToCircle: projectToCircle,
    pointOnCircle: pointOnCircle,
    signedAngle: signedAngle,
    orientation: orientation,
    rotate: rotate,
    intersect: intersect,
    dist: dist,
    sqDist: sqDist,
    result: result,
    describe: describe,
  };
})();
