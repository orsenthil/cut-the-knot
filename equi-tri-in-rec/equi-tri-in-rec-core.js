"use strict";

/*
 * Equi Tri In Rec, from Alexander Bogomolny's applet EquiTriInRec.
 *
 * The four corners A, B, C, D of a parallelogram can be dragged. On the
 * sides BC and CD we erect two equilateral triangles BCY and CDX with the
 * same orientation; AX meets the line BC at P and AY meets the line CD at Q.
 * The surprising claim is that APQ is equilateral whatever the parallelogram.
 * The code follows the applet's own construction: EquilateralT builds an apex
 * from two 60-degree rotations and a line intersection, and Compute then
 * intersects AX with BC and AY with CD. It is DOM-free and defines one global.
 *
 * The position is plain data, so it can be saved and handed to the tutor.
 * Every function returns a new position; nothing mutates what it is given.
 */
const EquiTriInRecCore = (() => {
  // The Java applet was embedded at 400 x 400; init() puts the rectangle at
  // (width/2, height/2 - 20) with half-width width/5 and half-height height/6.
  const WIDTH = 400;
  const HEIGHT = 400;
  const MIN_SIDE = 2; // Compute() gives up when AD < 2 or AB < 2
  const CORNERS = ["A", "B", "C", "D"];
  const SWITCHES = ["names", "statement", "premise", "hint"];
  const ANGLE = Math.PI / 3; // 1.0471975511965976 in the bytecode

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.Dist: sqrt(dx*dx + dy*dy). */
  function dist(p, q) {
    return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  }

  /** PointIsEligible in the canvas: keep the dragged corner inside the panel. */
  function limit(name, q) {
    if (!CORNERS.includes(name) || !q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return null;
    return { x: clamp(q.x, 3, WIDTH - 3), y: clamp(q.y, 1, HEIGHT - 3) };
  }

  /** The opening rectangle, and the four unchecked boxes, as in the applet. */
  function start() {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 - 20;
    const dx = Math.trunc(WIDTH / 5);
    const dy = Math.trunc(HEIGHT / 6);
    return {
      A: { x: cx - dx, y: cy - dy },
      B: { x: cx - dx, y: cy + dy },
      C: { x: cx + dx, y: cy + dy },
      D: { x: cx + dx, y: cy - dy },
      names: false,
      statement: false,
      premise: false,
      hint: false,
      moves: 0,
      explored: false,
    };
  }

  function legalMoves(state) {
    if (!state) return [];
    const moves = CORNERS.map((name) => ({ type: "point", name }));
    for (const key of SWITCHES) moves.push({ type: key, value: !state[key] });
    moves.push({ type: "reset" });
    return moves;
  }

  /*
   * UpgradePoints, transcribed from the bytecode. After the selected corner
   * has been moved, its opposite neighbour in x and its neighbour in y are
   * adjusted, so A + C = B + D and the top and bottom sides stay horizontal.
   */
  function upgrade(s, name) {
    if (name === "A") {
      s.B.x = s.A.x + s.C.x - s.D.x;
      s.D.y = s.A.y;
    } else if (name === "B") {
      s.A.x = s.B.x + s.D.x - s.C.x;
      s.C.y = s.B.y;
    } else if (name === "C") {
      s.A.x = s.B.x + s.D.x - s.C.x;
      s.B.y = s.C.y;
    } else if (name === "D") {
      s.B.x = s.A.x + s.C.x - s.D.x;
      s.A.y = s.D.y;
    }
  }

  /** Apply a move, or return null when it is not one the applet allows. */
  function move(state, m) {
    if (!state || !m || typeof m !== "object") return null;
    if (m.type === "reset") return start();
    if (m.type === "point") {
      const q = limit(m.name, m.x === undefined ? m : { x: m.x, y: m.y });
      if (!q) return null;
      const next = {
        A: { ...state.A }, B: { ...state.B }, C: { ...state.C }, D: { ...state.D },
        names: state.names, statement: state.statement,
        premise: state.premise, hint: state.hint,
        moves: state.moves + 1, explored: true,
      };
      next[m.name] = q;
      upgrade(next, m.name);
      return next;
    }
    if (SWITCHES.includes(m.type) && typeof m.value === "boolean") {
      const next = {
        A: { ...state.A }, B: { ...state.B }, C: { ...state.C }, D: { ...state.D },
        names: state.names, statement: state.statement,
        premise: state.premise, hint: state.hint,
        moves: state.moves + 1, explored: true,
      };
      next[m.type] = m.value;
      return next;
    }
    return null;
  }

  /** A picture is finished once it has been explored; there is no win or loss. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ------------------------------------------------ the applet's geometry */

  /** GeoSDoub.Rotate(P, Q, angle, sign): rotate Q about P. */
  function rotate(P, Q, angle, sign) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: P.x + c * (Q.x - P.x) - sign * s * (Q.y - P.y),
      y: P.y + sign * s * (Q.x - P.x) + c * (Q.y - P.y),
    };
  }

  /** GeoSDoub.Intersect of two lines given by two points each. */
  function intersect(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /** EquiTriInRecCanvas.EquilateralT: the apex on the side p -> q. */
  function equilateral(p, q) {
    const S3 = rotate(p, q, ANGLE, -1);
    const S4 = rotate(q, p, ANGLE, 1);
    return intersect(p, S3, q, S4);
  }

  /**
   * Compute(): X on CD, Y on BC, P = AX ∩ BC, Q = AY ∩ CD.
   * Returns null when the applet's own guard refuses a very small side.
   */
  function construct(state) {
    if (!state) return null;
    const { A, B, C, D } = state;
    if (dist(A, D) < MIN_SIDE || dist(A, B) < MIN_SIDE) return null;
    const X = equilateral(C, D);
    const Y = equilateral(B, C);
    const P = intersect(A, X, B, C);
    const Q = intersect(A, Y, C, D);
    return { A, B, C, D, X, Y, P, Q };
  }

  /** The status line: the three sides of the orange triangle. */
  function status(state) {
    const g = construct(state);
    if (!g) return "Move the corners apart to build the two equilateral triangles.";
    if (!Number.isFinite(g.P.x) || !Number.isFinite(g.Q.x)) {
      return "These lines are parallel; move a corner to draw the triangle.";
    }
    const f = (n) => n.toFixed(1);
    return `Triangle APQ: AP ${f(dist(g.A, g.P))}, AQ ${f(dist(g.A, g.Q))}, PQ ${f(dist(g.P, g.Q))} — all three sides match.`;
  }

  return {
    WIDTH, HEIGHT, MIN_SIDE, CORNERS, SWITCHES,
    dist, limit, start, legalMoves, move, result,
    rotate, intersect, equilateral, construct, status,
  };
})();
