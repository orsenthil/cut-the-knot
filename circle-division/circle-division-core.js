"use strict";

/*
 * Circle Division, from Alexander Bogomolny's CircleDivision applet.
 *
 * The cut-the-knot page "Circle Division by Euclid and Leonardo" (verified to
 * embed CODE="CircleDivision" in the archived 2007 copy of
 * /Curriculum/Geometry/CircleDivision.shtml) asks for two parallel chords that
 * cut off a given fraction of a circle. A and C are draggable points on the
 * circle, held there by the applet's RestrictToCircle. Copying Compute():
 *
 *   M  = foot of the perpendicular from the centre D to the chord AC
 *        (= the midpoint of AC, since D is the centre),
 *   E  = the intersection of circle and line DM nearer to M
 *        (the midpoint of the shorter arc AC),
 *   B  = the intersection of circle and the line through D parallel to AC,
 *   Z  = the other intersection of circle and the line through E parallel to BC.
 *
 * Then EZ is parallel to BC. If the shorter arc AC is a fraction f of the
 * whole turn, the band ZBCE has area f of the circle: for the opening
 * equilateral triangle AC (120 degrees) that is exactly one third, and an
 * inscribed square or pentagon side would give 1/4 or 1/5. The logic test
 * checks this over many configurations, against a second transcription of
 * Compute() and GeoSDoub's line/circle intersection methods.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CircleDivisionCore. The position is plain data.
 */
const CircleDivisionCore = (() => {
  const WIDTH = 400;    // the applet's getParameterInfo: "(400 seems optimal)"
  const HEIGHT = 250;   // "(250 seems optimal)"
  const CX = WIDTH / 2; // the centre D of the circle
  const CY = HEIGHT / 2;
  // Reset(): min(w / 3, h / 3) with Java's integer division.
  const R = Math.min(Math.floor(WIDTH / 3), Math.floor(HEIGHT / 3));
  const TURN = 2 * Math.PI;
  const THIRD = TURN / 3; // the 2.0943951023931953d in Reset()

  const O = { x: CX, y: CY };
  const pointAt = (angle) => ({ x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) });
  const START_C = pointAt(THIRD);      // C first: angle 120 degrees
  const START_A = pointAt(2 * THIRD);  // A second: angle 240 degrees
  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const unit = (v) => {
    const len = Math.hypot(v.x, v.y);
    return len > 0 ? { x: v.x / len, y: v.y / len } : null;
  };

  /** Project a board point radially onto the circle, as UpdateLocation does. */
  function project(q) {
    const x = Number(q && q.x), y = Number(q && q.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const vx = x - CX, vy = y - CY;
    const len = Math.hypot(vx, vy);
    if (len < 1e-12) return null;
    return { x: CX + (R * vx) / len, y: CY + (R * vy) / len };
  }

  /** The opening picture. Options may override the two draggable points. */
  function start(options) {
    const o = options || {};
    const state = {
      A: copy(START_A), C: copy(START_C),
      names: false, hint: false, moves: 0, explored: false,
    };
    if (o.A) { const p = project(o.A); if (p) state.A = p; }
    if (o.C) { const p = project(o.C); if (p) state.C = p; }
    if (o.names === true) state.names = true;
    if (o.hint === true) state.hint = true;
    return state;
  }

  /** The moves: drag A or C around the circle, tick a box, reset. */
  function legalMoves() {
    return [
      { type: "point", name: "A", x: START_A.x, y: START_A.y },
      { type: "point", name: "C", x: START_C.x, y: START_C.y },
      { type: "names", value: true }, { type: "hint", value: true },
      { type: "reset" },
    ];
  }

  /** The position after a move, or null when the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (m.name !== "A" && m.name !== "C") return null;
      const p = project({ x: m.x, y: m.y });
      if (!p) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "names" || m.type === "hint") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, [m.type]: m.value };
    } else if (m.type === "reset") {
      // Reset() restores the picture; the panel's two checkboxes stay as they were.
      return { ...start(), names: state.names, hint: state.hint };
    } else {
      return null;
    }
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A demo: no win or loss; "done" once the player has changed the picture. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /*
   * GeoSDoub.Intersect(DoubLine, DoubCircle) picks IntersectX when the line's
   * y-difference exceeds 1, otherwise IntersectY when the x-difference does.
   * For a line through the centre that fixes which of the two circle points is
   * returned first. This helper reproduces that ordering without rebuilding
   * the quadratic; the logic test compares it with the literal bytecode method.
   */
  function firstOnCircle(p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) return null;
    if (Math.abs(dy) > 1) {
      return { x: p.x + (R * dx * Math.sign(dy)) / len, y: p.y + (R * Math.abs(dy)) / len };
    }
    if (Math.abs(dx) > 1) {
      return { x: p.x + (R * Math.abs(dx)) / len, y: p.y + (R * dy * Math.sign(dx)) / len };
    }
    return null;
  }

  const opposite = (p) => ({ x: 2 * CX - p.x, y: 2 * CY - p.y });

  /** GeoSDoub.Intersect of two lines, with the applet's |det| < 1 test. */
  function lineCross(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (!(Math.abs(det) >= 1)) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /**
   * The whole construction, matching Compute(). Returns null in the same
   * degenerate cases where the applet leaves its picture unchanged.
   */
  function construct(state) {
    if (!state) return null;
    const A = state.A, C = state.C;
    if (!(dist(A, C) >= 1)) return null;

    // M = NearestPoint(D, A, C); with D the centre this is the chord midpoint.
    const M = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
    if (!(dist(O, M) >= 1)) return null;

    // E: the intersection of DM with the circle nearer to M.
    const pE = firstOnCircle(O, { x: CX + 100 * (M.x - CX), y: CY + 100 * (M.y - CY) });
    if (!pE) return null;
    const E = dist(M, pE) < dist(M, opposite(pE)) ? pE : opposite(pE);

    // B: the circle point on the line through D parallel to AC, away from A.
    const pB = firstOnCircle(O, { x: CX + 100 * (A.x - C.x), y: CY + 100 * (A.y - C.y) });
    if (!pB) return null;
    const B = dist(A, pB) >= 1 ? pB : opposite(pB);

    // Z: the other circle point on the line through E parallel to BC.
    const v = unit({ x: B.x - C.x, y: B.y - C.y });
    if (!v) return null;
    const rel = { x: E.x - CX, y: E.y - CY };
    const t = -2 * (rel.x * v.x + rel.y * v.y);
    if (!(Math.abs(t) >= 1)) return null;
    const Z = { x: E.x + t * v.x, y: E.y + t * v.y };

    const K = lineCross(A, B, E, Z); // only drawn when "hint" is ticked
    let delta = Math.abs(Math.atan2(A.y - CY, A.x - CX) - Math.atan2(C.y - CY, C.x - CX)) % TURN;
    if (delta > Math.PI) delta = TURN - delta;
    return {
      A: copy(A), C: copy(C), D: copy(O), M, E, B, Z, K,
      lines: { BD: [B, O], AC: [A, C], EZ: [E, Z], BC: [B, C] },
      arcDegrees: (delta * 180) / Math.PI,
      fraction: delta / TURN,
    };
  }

  /** The fraction of the circle cut off: the fraction of a turn taken by arc AC. */
  function fractionFor(state) {
    const g = construct(state);
    return g ? g.fraction : null;
  }

  return {
    WIDTH, HEIGHT, CX, CY, R, TURN,
    START_A, START_C,
    pointAt, project, start, legalMoves, move, result,
    firstOnCircle, lineCross, construct, fractionFor,
  };
})();
