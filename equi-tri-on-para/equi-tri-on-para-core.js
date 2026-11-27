"use strict";

/*
 * EquiTriOnPara — Alexander Bogomolny's applet "Equilateral Triangles On
 * Sides of a Parallelogram" from cut-the-knot.org.
 *
 * Equilateral triangles ABX, BCY, CDZ, DAW are built on the sides of a
 * parallelogram, all with the same turn. Their free tips X,Y,Z,W form another
 * parallelogram. Building equilateral triangles XYP, YZQ, ZWR, WXS with the
 * opposite turn gives P,Q,R,S, and the page's claim is that this second
 * parallelogram is the original one: P=D, Q=A, R=B, S=C.
 *
 * The code follows EquiTriOnParaCanvas.java: Draw() calls GeoSDoub.Rotate with
 * angle pi/3 and direction -1 for the first four tips and +1 for the last
 * four, and mouseDragged() calls UpkeepParallelogram so the corner opposite
 * the dragged one is recomputed. Points are plain {x,y} data in SVG units;
 * this file has no document, no window and no storage, and defines one global.
 */
const EquiTriOnParaCore = (() => {
  /* The Java canvas was 500x500; the same square layout scales on a phone. */
  const VIEW = { x: 0, y: 0, width: 480, height: 480 };
  const PAD = 14;
  /* Draw(): 1.0471975511965976d = pi/3, passed to GeoSDoub.Rotate. */
  const ANGLE = 1.0471975511965976;
  const BASE = ["A", "B", "C", "D"];
  const MID = ["X", "Y", "Z", "W"];
  const LAST = ["P", "Q", "R", "S"];
  const OPTION_KEYS = ["names", "first", "second"];

  /* mouseDragged(): dragging A recomputes D, B recomputes A, and so on. */
  const MOVED = { A: "D", B: "A", C: "B", D: "C" };

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Keep a handle, with its visible radius, inside the board. */
  function clampPoint(p) {
    if (!finite(p)) return point(VIEW.width / 2, VIEW.height / 2);
    return point(
      clamp(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD),
      clamp(p.y, VIEW.y + PAD, VIEW.y + VIEW.height - PAD),
    );
  }

  /*
   * GeoSDoub.Rotate(center, point, angle, dir):
   *   x' = cx + cos(a)*(x-cx) - dir*sin(a)*(y-cy)
   *   y' = cy + dir*sin(a)*(x-cx) + cos(a)*(y-cy)
   * The Java screen has y growing down, so dir=-1 is the first construction
   * and dir=+1 the opposite one used for P,Q,R,S.
   */
  function rotate(center, p, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle) * dir;
    const dx = p.x - center.x, dy = p.y - center.y;
    return point(center.x + c * dx - s * dy, center.y + s * dx + c * dy);
  }

  /** init(): the four starting corners, straight from the Java arithmetic. */
  function startPositions(width, height) {
    const halfW = Math.trunc(width / 2), halfH = Math.trunc(height / 2);
    const wy = height / 2, wx = width / 2;
    const A = point(halfW / 2 + wx / 6, halfH + wy / 3);
    const B = point(halfW / 2 + (wx * 15) / 36, halfH - wy / 3);
    const C = point(halfW / 2 + (wx * 15) / 16, Math.trunc((halfH * 9) / 10));
    const D = add(C, sub(A, B)); // UpkeepParallelogram(D, A, B, C)
    return { A: A, B: B, C: C, D: D };
  }

  /** A new diagram; `show` is the archived applet's "show" parameter. */
  function start(options) {
    const o = options || {};
    const pts = startPositions(VIEW.width, VIEW.height);
    const s = Object.assign({}, pts, {
      options: {
        names: o.show === "1" || o.show === true,
        first: false,
        second: false,
      },
      explored: false,
    });
    return s;
  }

  function reset(state) {
    const s = start({ show: state.options.names ? "1" : "0" });
    s.options.first = !!state.options.first;
    s.options.second = !!state.options.second;
    s.explored = !!state.explored;
    return s;
  }

  /* UpkeepParallelogram(target, p, q, r): target = r + p - q. */
  function upkeep(target, p, q, r) {
    return add(r, sub(p, q));
  }

  /**
   * The dragged corner moves to p; the corner two steps later is recomputed
   * exactly as mouseDragged() does. Nothing else changes.
   */
  function move(state, name, p) {
    if (BASE.indexOf(name) < 0 || !finite(p)) return state;
    const q = clampPoint(p);
    const next = Object.assign({}, state);
    for (const key of BASE) next[key] = point(state[key].x, state[key].y);
    next[name] = q;
    /* mouseDragged() passes (dragged, next, next, opposite) in cyclic order:
     * A,B,C,D / B,C,D,A / C,D,A,B / D,A,B,C.  The target is the last one. */
    const changed = MOVED[name];
    const targetIndex = BASE.indexOf(changed);
    next[changed] = upkeep(next[changed], next[name],
      next[BASE[(targetIndex + 2) % 4]], next[BASE[(targetIndex + 3) % 4]]);
    next.explored = true;
    return next;
  }

  /*
   * The four cases above spelled out, so the index arithmetic in move() can
   * be checked against the applet's four explicit calls:
   *   A: D = C + A - B    B: A = D + B - C
   *   C: B = A + C - D    D: C = B + D - A
   */
  function opposite(name, s) {
    if (name === "A") return add(s.C, sub(s.A, s.B));
    if (name === "B") return add(s.D, sub(s.B, s.C));
    if (name === "C") return add(s.A, sub(s.C, s.D));
    if (name === "D") return add(s.B, sub(s.D, s.A));
    return null;
  }

  /* Presentation only: keep the dragged corner and its opposite on screen. */
  function clampDrag(state, name, p) {
    if (BASE.indexOf(name) < 0 || !finite(p)) return clampPoint(p);
    const q = clampPoint(p);
    const other = opposite(name, state);
    /* other = dragged + k, so keeping other inside shifts the allowed
     * interval for dragged by -k = dragged - other. */
    const shift = point(state[name].x - other.x, state[name].y - other.y);
    const minX = VIEW.x + PAD + shift.x, maxX = VIEW.x + VIEW.width - PAD + shift.x;
    const minY = VIEW.y + PAD + shift.y, maxY = VIEW.y + VIEW.height - PAD + shift.y;
    return point(clamp(q.x, minX, maxX), clamp(q.y, minY, maxY));
  }

  function setOption(state, key, value) {
    if (OPTION_KEYS.indexOf(key) < 0) return state;
    const next = Object.assign({}, state, { options: Object.assign({}, state.options) });
    next.options[key] = !!value;
    next.explored = true;
    return next;
  }

  const scaleOf = (s) => Math.max(1, ...BASE.map((k) => dist(point(0, 0), s[k])));

  function parallelogram(pts) {
    const scale = Math.max(1, ...pts.map((p) => dist(point(0, 0), p)));
    return dist(add(pts[0], pts[2]), add(pts[1], pts[3])) <= 1e-7 * scale;
  }

  /** Draw(): both rounds of equilateral tips and the two outline quadrilaterals. */
  function geometry(state) {
    const X = rotate(state.A, state.B, ANGLE, -1);
    const Y = rotate(state.B, state.C, ANGLE, -1);
    const Z = rotate(state.C, state.D, ANGLE, -1);
    const W = rotate(state.D, state.A, ANGLE, -1);
    const P = rotate(X, Y, ANGLE, 1);
    const Q = rotate(Y, Z, ANGLE, 1);
    const R = rotate(Z, W, ANGLE, 1);
    const S = rotate(W, X, ANGLE, 1);
    const tol = 1e-7 * scaleOf(state);
    const coincide = dist(P, state.D) <= tol && dist(Q, state.A) <= tol
      && dist(R, state.B) <= tol && dist(S, state.C) <= tol;
    return {
      X: X, Y: Y, Z: Z, W: W, P: P, Q: Q, R: R, S: S,
      middleParallelogram: parallelogram([X, Y, Z, W]),
      lastParallelogram: parallelogram([P, Q, R, S]),
      coincide: coincide,
    };
  }

  /** A plain-English line for #status; the applet itself has no messages. */
  function describe(state) {
    const g = geometry(state);
    const middle = g.middleParallelogram
      ? "X, Y, Z, W make a parallelogram" : "X, Y, Z, W do not line up as a parallelogram";
    const last = g.coincide
      ? "P, Q, R, S sit on D, A, B, C — the second parallelogram is the first one again"
      : (g.lastParallelogram
        ? "P, Q, R, S make a parallelogram of their own"
        : "P, Q, R, S do not line up as a parallelogram");
    return middle + "; " + last + ".";
  }

  /* A demonstration has no winning or losing move. */
  function result(state) {
    return null;
  }

  return {
    VIEW: VIEW, PAD: PAD, ANGLE: ANGLE,
    BASE: BASE, MID: MID, LAST: LAST, OPTION_KEYS: OPTION_KEYS, MOVED: MOVED,
    point: point, add: add, sub: sub, dist: dist, clamp: clamp, clampPoint: clampPoint,
    rotate: rotate, startPositions: startPositions, start: start, reset: reset,
    move: move, opposite: opposite, clampDrag: clampDrag, setOption: setOption,
    geometry: geometry, parallelogram: parallelogram, describe: describe, result: result,
  };
})();
