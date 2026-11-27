"use strict";

/*
 * Crossed-Lines Construction of Shapes of Constant Width — the logic behind
 * Alexander Bogomolny's applet CWCrossedLines
 * (cut-the-knot.org/Curriculum/Geometry/CWCrossedLines.shtml).
 *
 * Three lines meet in the points A, B, C. A fourth control P slides on the
 * line BC. Swing P round B until it lands on the line BA; swing the new point
 * round A onto AC; round C onto CB; then round B, A and C once more. The
 * applet's Compute() does exactly these five swings, and the sixth (round C)
 * returns to the starting P. Each swing is a GeoSDoub.Rotate() through the
 * signed angle at the vertex, so it is an arc of a circle centred there.
 *
 * Writing p for the applet's coefP, P = p*B + (1-p)*C. A rotation round B
 * sends the vector C-B to A-B, so Q = B + p*(A-B); the next swings give
 * R = A + (1-p)*(C-A), P' = C + p*(B-C), Q' = B + (1-p)*(A-B),
 * R' = A + p*(C-A), and one more swing round C gives back P. That identity is
 * the closure the page claims, and it holds for every triangle and every p.
 * The six radii are |p|*BC, |1-p|*AB, |p|*CA, |1-p|*BC, |p|*AB, |1-p|*CA,
 * so six different values are possible (the page's "may be six"). When P is
 * outside the segment BC the curve is convex and has constant width; when P
 * is between B and C it is not, just as the page warns.
 *
 * No document, no window, no storage. The position is plain data.
 */
const CwCrossedLinesCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  // CreateBasePolygon() with the 400 by 250 size from getParameterInfo():
  // A = (w/2, h/2), B = (3w/5, h - h/4), C = (w - w/4, 2*h/4).
  const START_A = { x: 200, y: 125 };
  const START_B = { x: 240, y: 187.5 };
  const START_C = { x: 300, y: 125 };
  const START_COEF = -0.2; // applet's coefP: P = coefP*B + (1-coefP)*C
  const SPEED_MIN = 0;
  const SPEED_MAX = 20; // PVNumeric min 0, max 20, initial 10
  const DEFAULT_SPEED = 10;
  const COEF_MIN = -1.5; // range offered by this page's slider; the applet allows any point on the line
  const COEF_MAX = 2.5;
  const NAMES = ["A", "B", "C", "P"];
  const CENTRES = ["B", "A", "C", "B", "A", "C"];
  const SECONDS = ["C", "B", "A", "C", "B", "A"];
  const THIRDS = ["A", "C", "B", "A", "C", "B"];
  const RAD = Math.PI / 180;

  const copy = (p) => ({ x: p.x, y: p.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const along = (a, b, t) => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

  /** GeoSDoub.FindOrientation: +1 for a positive cross product, -1 otherwise (zero included). */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle, with zero-length sides guarded for the UI. */
  function signedAngle(a, b, c) {
    const d1 = dist(a, b), d2 = dist(a, c);
    if (!d1 || !d2) return 0;
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / (2 * d1 * d2);
    return orientation(a, b, c) * Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.Rotate(centre, point, angle, 1) — y grows down, so dir=1 turns clockwise on screen. */
  function rotate(centre, point, angle, dir) {
    const d = dir === undefined ? 1 : dir;
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - centre.x, dy = point.y - centre.y;
    return { x: centre.x + c * dx - d * s * dy, y: centre.y + d * s * dx + c * dy };
  }

  /** The applet's private Rotate(vertex, next, third, point). */
  function swing(vertex, next, third, point) {
    return rotate(vertex, point, signedAngle(vertex, next, third), 1);
  }

  /** The four controls, with P on the line BC at the applet's coefP. */
  function controls(state) {
    const { A, B, C, coefP } = state;
    return { A, B, C, P: along(B, C, 1 - coefP) };
  }

  /**
   * CWCrossedLinesRotation.Compute(): the five swung points and the sixth
   * (closing) point, with the centre, radius and angular sweep of each arc.
   */
  function compute(state) {
    const v = controls(state);
    const Q = swing(v.B, v.C, v.A, v.P);
    const R = swing(v.A, v.B, v.C, Q);
    const Pp = swing(v.C, v.A, v.B, R);
    const Qp = swing(v.B, v.C, v.A, Pp);
    const Rp = swing(v.A, v.B, v.C, Qp);
    const P6 = swing(v.C, v.A, v.B, Rp);
    const pts = { P: v.P, Q, R, Pp, Qp, Rp, P6 };
    const arcs = CENTRES.map((name, i) => {
      const centre = v[name], from = pts[[ "P", "Q", "R", "Pp", "Qp", "Rp" ][i]];
      const angle = signedAngle(centre, v[SECONDS[i]], v[THIRDS[i]]);
      return {
        centre, name, from, angle, radius: dist(centre, from),
        second: copy(v[SECONDS[i]]), third: copy(v[THIRDS[i]]),
      };
    });
    return {
      ...pts, arcs,
      radii: arcs.map((arc) => arc.radius),
      closureError: dist(v.P, P6),
    };
  }

  /** Points along the six arcs, for checking which way the curve bends. */
  function boundary(state, perArc) {
    const n = Math.max(2, perArc || 60);
    const out = [];
    for (const arc of compute(state).arcs) {
      for (let i = 0; i < n; i++) {
        out.push(rotate(arc.centre, arc.from, (arc.angle * i) / n, 1));
      }
    }
    return out;
  }

  const wrap = (x) => {
    const t = 2 * Math.PI;
    return ((x + Math.PI) % t + t) % t - Math.PI;
  };

  /** Exact support function: the furthest point of an arc in the direction theta. */
  function support(state, theta, arcs) {
    const ux = Math.cos(theta), uy = Math.sin(theta);
    let best = -Infinity;
    for (const arc of arcs || compute(state).arcs) {
      const end = rotate(arc.centre, arc.from, arc.angle, 1);
      best = Math.max(best, arc.from.x * ux + arc.from.y * uy, end.x * ux + end.y * uy);
      const a0 = Math.atan2(arc.from.y - arc.centre.y, arc.from.x - arc.centre.x);
      const d = wrap(Math.atan2(uy, ux) - a0);
      if (arc.angle >= 0 ? (d >= 0 && d <= arc.angle) : (d <= 0 && d >= arc.angle)) {
        best = Math.max(best, arc.centre.x * ux + arc.centre.y * uy + arc.radius);
      }
    }
    return best;
  }

  /** The distance between the two supporting lines at the angle theta. */
  function widthAt(state, theta, arcs) {
    const a = arcs || compute(state).arcs;
    return support(state, theta, a) + support(state, theta + Math.PI, a);
  }

  /** Width sampled all the way round; a constant-width curve has range zero. */
  function widthRange(state, samples) {
    const arcs = compute(state).arcs;
    const n = Math.max(8, samples || 360);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const w = widthAt(state, (2 * Math.PI * i) / n, arcs);
      if (w < lo) lo = w;
      if (w > hi) hi = w;
    }
    return { min: lo, max: hi, spread: hi - lo };
  }

  /** True when every turn of the traced curve bends the same way. */
  function isConvex(state, perArc) {
    const pts = boundary(state, perArc);
    let sign = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
      const z = cross(sub(b, a), sub(c, b));
      if (Math.abs(z) < 1e-7) continue;
      const s = Math.sign(z);
      if (sign && s !== sign) return false;
      sign = s;
    }
    return true;
  }

  /** A new position, or the options applied to one. */
  function start(options) {
    const o = options || {};
    const at = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
    return {
      A: copy(o.A || START_A), B: copy(o.B || START_B), C: copy(o.C || START_C),
      coefP: at(o.coefP, START_COEF),
      showLines: o.showLines === undefined ? true : !!o.showLines,
      showDots: o.showDots === undefined ? true : !!o.showDots,
      speed: Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.trunc(at(o.speed, DEFAULT_SPEED)))),
      running: false, arc: 0, done: 0, tracer: null,
      explored: { animated: false, controls: false },
      note: "", moves: 0,
    };
  }

  function clampCoef(t) {
    return Math.max(COEF_MIN, Math.min(COEF_MAX, t));
  }

  function clampBoard(p) {
    return {
      x: Math.max(4, Math.min(WIDTH - 4, p.x)),
      y: Math.max(4, Math.min(HEIGHT - 4, p.y)),
    };
  }

  /** The applet's UpgradePoints(): coefP is the projection of P on B-C. */
  function coefFromPoint(p, B, C) {
    const d = sqDist(B, C);
    if (!d) return 0;
    return ((p.x - C.x) * (B.x - C.x) + (p.y - C.y) * (B.y - C.y)) / d;
  }

  /** The point P is constrained to the line BC; this is that constraint. */
  function clampP(q, B, C) {
    const t = clampCoef(coefFromPoint(q, B, C));
    return along(B, C, 1 - t);
  }

  const validPoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Every move the page can make. Moves never change the state they are given. */
  function move(state, m) {
    if (!state || !m) return null;
    const next = { ...state, A: copy(state.A), B: copy(state.B), C: copy(state.C), explored: { ...state.explored } };
    let changed = false;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !validPoint(m.point)) return null;
      const q = clampBoard(m.point);
      if (m.name === "A") next.A = q;
      else if (m.name === "B") next.B = q;
      else if (m.name === "C") next.C = q;
      else next.coefP = clampCoef(coefFromPoint(q, next.B, next.C));
      next.tracer = null; next.arc = 0; next.done = 0;
      next.explored.controls = true;
      next.note = `${m.name} moved.`;
      changed = true;
    } else if (m.type === "coef") {
      if (!Number.isFinite(Number(m.value))) return null;
      next.coefP = clampCoef(Number(m.value));
      next.tracer = null; next.arc = 0; next.done = 0;
      next.explored.controls = true;
      next.note = "P moved along its line.";
      changed = true;
    } else if (m.type === "showLines" || m.type === "showDots") {
      next[m.type] = !!m.value;
      next.explored.controls = true;
      next.note = (m.type === "showLines" ? "Lines " : "Dots ") + (m.value ? "shown." : "hidden.");
      changed = true;
    } else if (m.type === "speed") {
      if (!Number.isFinite(Number(m.value))) return null;
      next.speed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.trunc(Number(m.value))));
      next.explored.controls = true;
      next.note = "Speed set to " + next.speed + ".";
      changed = true;
    } else if (m.type === "play") {
      next.running = m.value === undefined ? !state.running : !!m.value;
      next.explored.animated = next.explored.animated || next.running;
      if (next.running) {
        next.tracer = controls(state).P;
        next.arc = 0; next.done = 0;
      } else { next.arc = 0; next.done = 0; }
      next.note = next.running ? "The point swings round each vertex in turn." : "Stopped.";
      changed = true;
    } else if (m.type === "tick") {
      if (!state.running) return null;
      const arcs = compute(state).arcs;
      const arc = arcs[state.arc % arcs.length];
      const step = Math.max(0, state.speed) * RAD / 5; // applet's Rotate(): AngleIncrement*pi/180/5
      const amount = Math.min(step, Math.abs(arc.angle) - state.done);
      const from = state.tracer || controls(state).P;
      next.tracer = rotate(arc.centre, from, Math.sign(arc.angle) * amount, 1);
      next.done = state.done + amount;
      if (next.done >= Math.abs(arc.angle) - 1e-12) {
        next.arc = (state.arc + 1) % arcs.length;
        next.done = 0;
        if (next.arc === 0) next.note = "Six swings: the curve closes.";
      }
      changed = true;
    } else if (m.type === "reset") {
      return start({ showLines: state.showLines, showDots: state.showDots });
    }
    if (!changed) return null;
    return { ...next, moves: state.moves + 1 };
  }

  /** This is an illustration: "done" once the visitor has played and changed a control. */
  function result(state) {
    return state && state.explored.animated && state.explored.controls ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, START_A, START_B, START_C, START_COEF,
    SPEED_MIN, SPEED_MAX, DEFAULT_SPEED, COEF_MIN, COEF_MAX, NAMES, RAD,
    copy, sub, dot, cross, sqDist, dist, along, orientation, signedAngle, rotate, swing,
    controls, compute, boundary, support, widthAt, widthRange, isConvex,
    start, clampCoef, clampBoard, clampP, coefFromPoint, move, result,
  };
})();
