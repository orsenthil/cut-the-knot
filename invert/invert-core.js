"use strict";

/*
 * "invert" — Alexander Bogomolny's Peaucellier-Lipkin linkage applet
 * (cut-the-knot.org/pythagoras/invert.shtml).
 *
 * The applet's peauc class has five rings the player can drag: O (the inversion
 * centre, where the two long rods meet), A (a rhombus vertex held on a circle
 * centred at P), B and D (the other two rhombus vertices), and P itself. The
 * fourth rhombus vertex C is the point that draws the line. FindPeauc solves
 * the rhombus from O and A and the two fixed rod lengths L = OB = OD and
 * s = AB = BC = CD = DA; each drag method projects a dragged point onto its
 * constraint and then calls FindPeauc again.
 *
 * The one idea the code relies on: C = O + ((L^2 - s^2)/|OA|^2) * (A - O), so
 * OA * OC = L^2 - s^2 is constant. As O and A both stay on P's circle through
 * O, inversion in O sends A's circle to a straight line traced by C.
 *
 * This file is the geometry and the state transitions only: no document, no
 * window, no storage. It defines one global, InvertCore. Positions are plain
 * data, so the player's record and the tutor can be given them as they are.
 */

const InvertCore = (() => {
  // The Java applet's own numbers: a 400 by 350 canvas, P = (width/2, 3*height/4),
  // a circle of radius 60, long rods of 80 and rhombus sides of 30. Its FindPeauc
  // refuses separations below 0.1, negative half-diagonal squares and drawing
  // points outside |x|,|y| <= 2000; those guards stay here unchanged.
  const WIDTH = 400;
  const HEIGHT = 350;
  const RADIUS = 60;
  const LONG = 80;
  const SIDE = 30;
  const MIN_SEPARATION = 0.1;
  const MAX_COORD = 2000;
  const PROJECT_EPS = 0.0001;
  const HANDLE_LIMIT = 2;
  const HANDLES = ["O", "A", "B", "C", "P"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const solved = (g) => !!g && g.ok !== false && finite(g.C);
  /** A refused FindPeauc still leaves its midpoint in the applet's m_Aux. */
  const refused = (state, g, patch) => ({
    ...state, ...patch, ...(g && g.M ? { M: g.M } : {}),
    failed: true, message: "The rods cannot close there.",
  });

  /** peauc.FindPeauc(): C on ray OA, B and D either side of the midpoint M.
   *  The bytecode writes M before its geometry guards, so a refused solve still
   *  reports that midpoint; `{ ok: false, M }` mirrors that mutation. */
  function solve(O, A, longOne, rombSide) {
    const d = Math.sqrt((O.x - A.x) * (O.x - A.x) + (O.y - A.y) * (O.y - A.y));
    if (d < MIN_SEPARATION) return null;
    const t = (longOne * longOne - rombSide * rombSide) / d;
    const f = t / d;
    const M = {
      x: (A.x + O.x + f * (A.x - O.x)) / 2,
      y: (A.y + O.y + f * (A.y - O.y)) / 2,
    };
    let h2 = rombSide * rombSide - ((t - d) / 2) * ((t - d) / 2);
    if (!(h2 > 0)) return { ok: false, M };
    const h = Math.sqrt(h2);
    let c, s;
    if (Math.abs(O.y - A.y) < 2) {
      c = 0;
      s = 1;
    } else {
      const m = -(O.x - A.x) / (O.y - A.y);
      const n = Math.sqrt(m * m + 1);
      c = 1 / n;
      s = m / n;
    }
    const C = { x: O.x + f * (A.x - O.x), y: O.y + f * (A.y - O.y) };
    if (Math.abs(C.x) > MAX_COORD || Math.abs(C.y) > MAX_COORD) return { ok: false, M };
    return {
      ok: true, M, C,
      B: { x: M.x - h * c, y: M.y - h * s },
      D: { x: M.x + h * c, y: M.y + h * s },
    };
  }

  /** The opening picture, straight from peauc(int,int,int,int,int). */
  function start(options) {
    const o = options || {};
    const width = Number.isFinite(o.width) ? o.width : WIDTH;
    const height = Number.isFinite(o.height) ? o.height : HEIGHT;
    const center = o.center ? copy(o.center) : {
      x: Math.trunc(width / 2),
      y: Math.trunc(height * 3 / 4),
    };
    const radius = Number.isFinite(o.radius) ? o.radius : RADIUS;
    const k = radius * Math.sqrt(2) / 2;
    const O = o.O ? copy(o.O) : { x: center.x - k, y: center.y - k };
    const A = o.A ? copy(o.A) : { x: center.x + k, y: center.y - k };
    const longOne = Number.isFinite(o.longOne) ? o.longOne : LONG;
    const rombSide = Number.isFinite(o.rombSide) ? o.rombSide : SIDE;
    const g = solve(O, A, longOne, rombSide);
    const good = solved(g);
    const s = {
      width, height, center, radius, longOne, rombSide,
      O, A,
      B: good ? g.B : { x: 0, y: 0 },
      C: good ? g.C : { x: 0, y: 0 },
      D: good ? g.D : { x: 0, y: 0 },
      M: g && g.M ? g.M : { x: 0, y: 0 },
      its: 9,
      newPeauc: false,
      trajectory: [],
      draw: good ? copy(g.C) : { x: 0, y: 0 },
      turn: 0,
      moves: 0,
      explored: false,
      failed: false,
      message: "",
      showNames: o.showNames !== false,
      showCircle: o.showCircle !== false,
    };
    return s;
  }

  /** Recompute B, C and D from O and A; the two rod lengths are unchanged. */
  function resolve(state) {
    if (!state) return null;
    const g = solve(state.O, state.A, state.longOne, state.rombSide);
    if (!solved(g)) return null;
    const { ok, ...geometry } = g;
    return { ...state, ...geometry };
  }

  /** peauc.CheckDoubPoint(): Manhattan distance <= 2, in this exact order. */
  function selectPoint(state, point) {
    if (!state || !point) return null;
    const p = { x: Math.round(point.x), y: Math.round(point.y) };
    for (const name of HANDLES) {
      const q = name === "P" ? state.center : state[name];
      if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) <= HANDLE_LIMIT) {
        return { ...state, its: ["O", "A", "B", "C", "P"].indexOf(name) };
      }
    }
    return { ...state, its: 9 };
  }

  /** The keyboard/touch counterpart of pressing a named ring. */
  function selectWhich(state, which) {
    if (!state || !HANDLES.includes(which)) return null;
    return { ...state, its: HANDLES.indexOf(which) };
  }

  /** The shared projection step of MoveFixedDoubPoint and MoveMovingDoubPoint. */
  function projectCircle(state, which, target) {
    const d = dist(state.center, target);
    if (!(d >= PROJECT_EPS)) return state; // applet: return before any change
    const k = state.radius / d;
    const proposed = {
      x: state.center.x + k * (target.x - state.center.x),
      y: state.center.y + k * (target.y - state.center.y),
    };
    const before = copy(state[which]);
    const next = { ...state, [which]: proposed };
    const g = solve(next.O, next.A, next.longOne, next.rombSide);
    if (!solved(g)) return refused(state, g, {});
    return { ...next, ...g, failed: false, message: "" };
  }

  /** peauc.MoveFixedDoubPoint — O is snapped back onto P's circle. */
  function moveFixed(state, target) {
    return projectCircle(state, "O", target);
  }

  /** peauc.MoveMovingDoubPoint — A is snapped back onto P's circle. */
  function moveMoving(state, target) {
    return projectCircle({ ...state, newPeauc: false }, "A", target);
  }

  /** peauc.MoveUpperDoubPoint — dragging B changes both rod lengths. */
  function moveUpper(state, target) {
    const next = {
      ...state,
      longOne: dist(target, state.O),
      rombSide: dist(target, state.A),
    };
    const g = solve(next.O, next.A, next.longOne, next.rombSide);
    if (!solved(g)) return refused(next, g, {});
    return { ...next, ...g, failed: false, message: "" };
  }

  /** peauc.MoveSideDoubPoint — dragging C changes the rhombus side. */
  function moveSide(state, target) {
    const OA = sub(state.A, state.O);
    const len2 = dot(OA, OA);
    if (!(len2 > 0)) return { ...state, failed: true, message: "Those rods cannot reach." };
    const t = dot(OA, sub(target, state.O)) / len2;
    const foot = { x: state.O.x + t * OA.x, y: state.O.y + t * OA.y };
    const helper = { x: (state.A.x + foot.x) / 2, y: (state.A.y + foot.y) / 2 };
    const square = state.longOne * state.longOne
      - dot(sub(state.O, helper), sub(state.O, helper))
      + dot(sub(state.A, helper), sub(state.A, helper));
    if (!(square > 0)) return refused(state, { M: helper }, {});
    const next = { ...state, rombSide: Math.sqrt(square) };
    const g = solve(next.O, next.A, next.longOne, next.rombSide);
    if (!solved(g)) return refused(next, g, {});
    return { ...next, ...g, failed: false, message: "" };
  }

  /** peauc.MoveCenter — P slides perpendicular to OA and the radius is rounded. */
  function moveCenter(state, target) {
    let c, s;
    if (Math.abs(state.O.y - state.A.y) < 2) {
      c = 0;
      s = 1;
    } else {
      const m = -(state.O.x - state.A.x) / (state.O.y - state.A.y);
      const n = Math.sqrt(m * m + 1);
      c = 1 / n;
      s = m / n;
    }
    const t = (c * (target.x - state.center.x) + s * (target.y - state.center.y)) /
      (c * c + s * s);
    const center = {
      x: state.center.x + t * c,
      y: state.center.y + t * s,
    };
    let next = { ...state, center, radius: Math.round(dist(center, state.A)), its: 0 };
    // The Java code calls move(DoubPoint(O)), which rounds O to integer pixels.
    next = moveFixed(next, { x: Math.round(next.O.x), y: Math.round(next.O.y) });
    const g = solve(next.O, next.A, next.longOne, next.rombSide);
    return { ...next, ...(g && g.M ? { M: g.M } : {}),
      ...(solved(g) ? g : {}), its: 4 };
  }

  /** The Java drawLine/CheckForBetweeness pair: only while A is being dragged. */
  function trace(state) {
    if (state.its !== 1) return state;
    const trajectory = state.trajectory.concat([copy(state.draw)]);
    const turn = (state.turn + 1) % 7;
    const n = trajectory.length;
    if (n >= 3 && turn !== 0) trajectory.splice(n - 2, 1);
    return { ...state, trajectory, draw: copy(state.C), turn };
  }

  /** peauc.move(Point): dispatch on m_Its, then collect the drawing while A moves. */
  function drag(state, target) {
    if (!state || !target) return null;
    const p = { x: Math.round(target.x), y: Math.round(target.y) };
    let next;
    switch (state.its) {
      case 0: next = moveFixed(state, p); break;
      case 1: next = moveMoving(state, p); break;
      case 2: next = moveUpper(state, p); break;
      case 3: next = moveSide(state, p); break;
      case 4: next = moveCenter(state, p); break;
      default: return state; // m_Its === 9: the applet ignores the drag
    }
    if (state.its === 1) next = trace(next);
    return { ...next, moves: state.moves + 1, explored: state.explored || !next.failed };
  }

  /** A move from a named handle, for pointer and keyboard input. */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "select") {
      return typeof m.which === "string" ? selectWhich(state, m.which) : selectPoint(state, m.point);
    }
    if (m.type === "release") {
      const next = state.its !== 1
        ? { ...state, newPeauc: true, trajectory: [], draw: copy(state.C), its: 9 }
        : { ...state, its: 9 };
      return next;
    }
    if (m.type === "clearTrail") {
      return { ...state, trajectory: [], draw: copy(state.C), explored: true, moves: state.moves + 1 };
    }
    if (m.type === "reset") {
      return { ...start({ width: state.width, height: state.height,
        showNames: state.showNames, showCircle: state.showCircle }),
        moves: state.moves + 1, explored: true };
    }
    if (m.type === "option") {
      if (m.key !== "showNames" && m.key !== "showCircle") return null;
      if (typeof m.value !== "boolean") return null;
      return { ...state, [m.key]: m.value, moves: state.moves + 1, explored: true };
    }
    if (m.type === "drag") {
      let s = state;
      if (m.which && HANDLES.includes(m.which) && s.its !== HANDLES.indexOf(m.which)) {
        s = selectWhich(s, m.which);
      }
      return drag(s, m.point);
    }
    return null;
  }

  function legalMoves() {
    return [
      ...HANDLES.map((which) => ({ type: "drag", which })),
      { type: "select" }, { type: "release" }, { type: "clearTrail" },
      { type: "option", key: "showNames" }, { type: "option", key: "showCircle" },
      { type: "reset" },
    ];
  }

  /** A demo: nothing is won; the first successful change counts as explored. */
  const result = (state) => (state && state.explored ? "done" : null);

  return {
    start, solve, resolve, selectPoint, selectWhich, drag, move,
    legalMoves, result,
    constants: { WIDTH, HEIGHT, RADIUS, LONG, SIDE, HANDLES },
  };
})();
