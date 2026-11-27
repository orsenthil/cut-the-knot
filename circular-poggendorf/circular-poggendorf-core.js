"use strict";

/*
 * CircularPoggendorf — Alexander Bogomolny's Circular Poggendorff illusion
 * (cut-the-knot.org/Curriculum/Geometry/CircularPoggendorf.shtml).
 *
 * The page's exact claim: "The parallel lines that obscure parts of a circle
 * break the circle off so that its pieces do not appear to fit together."
 * The geometric substrate is plain: the applet draws ONE circle, then paints a
 * background-coloured strip over it and outlines that strip. The strip has two
 * parallel vertical edges, x = X0 and x = X0 + Width, so the visible arcs are
 * pieces of a single circle of radius Radius centred on the canvas. Their cut
 * ends lie on those two lines, symmetric about the horizontal centre line.
 * Mathematically the pieces do fit — put the strip back and the circle is whole
 * again. That they "do not appear to fit" is a claim about perception, which
 * this code cannot and does not compute; it is the illusion itself.
 *
 * This is the logic and nothing else: no document, no window, no storage. One
 * global, CircularPoggendorfCore, loaded by a plain <script> in the page and by
 * porting/check-circular-poggendorf.mjs in Node. The position is plain data;
 * every function takes a position and returns a new one.
 */
const CircularPoggendorfCore = (() => {
  /** The drawing board in user units (a sample canvas of the 420x400 applet). */
  const VIEW = { width: 420, height: 300 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };

  /** The page's <param> values, and the canvas's integer halves of them. */
  const PAGE_PARAMS = { fcolor: "000000", bcolor: "ffffff", BarWidth: 100, Radius: 250, X0: 200 };

  /**
   * CircularPoggendorfPanel: Scrollbar(0, V/2, 1, 2*V) for each of the three
   * parameters. The scrollbar starts at half the page's value and runs from 1
   * to twice it. With the page above: radius 1..500 (start 125), bar width
   * 1..200 (start 50), X0 1..400 (start 100).
   */
  const LIMITS = {
    radius: [1, 500],
    barWidth: [1, 200],
    x0: [1, 400],
  };

  /** The position a fresh page opens with: the three scrollbar starting values. */
  const START = { radius: 125, barWidth: 50, x0: 100 };

  /** Radius handle sits on the circle at -45 degrees, clear of the default bar. */
  const HANDLE_ANGLE = -Math.PI / 4;
  const EDGE_HANDLE_Y = 14;
  /** The largest circle a handle can reach while staying wholly on the board. */
  const DRAG_MAX_RADIUS = Math.min(CENTER.x, CENTER.y) - 5;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v) => typeof v === "number" && Number.isFinite(v);

  /** Java's `Integer.parseInt(s) / 2` on an int: truncation toward zero. */
  function halfParam(value, fallback) {
    const n = parseInt(value, 10);
    return finite(n) ? Math.trunc(n / 2) : fallback;
  }

  /** Translate the applet's raw <param>s into the canvas's three int fields. */
  function fromPageParams(params) {
    const p = params || {};
    return {
      radius: halfParam(p.Radius, 200),
      barWidth: halfParam(p.BarWidth, 200),
      x0: halfParam(p.X0, 200),
    };
  }

  /** Scrollbar value, minimum and maximum for one page parameter. */
  function scrollbar(name, pageValue) {
    const v = parseInt(pageValue, 10);
    const n = finite(v) ? v : 200;
    return { value: Math.trunc(n / 2), min: 1, max: 2 * n };
  }

  function clampParam(name, value) {
    const lim = LIMITS[name];
    if (!lim || !finite(Number(value))) return null;
    return clamp(Math.trunc(Number(value)), lim[0], lim[1]);
  }

  /** A new position; a missing or bad option keeps the applet's starting value. */
  function start(options) {
    const o = options || {};
    const state = { ...START, reveal: false, touches: 0 };
    for (const name of ["radius", "barWidth", "x0"]) {
      if (o[name] !== undefined) {
        const v = clampParam(name, o[name]);
        if (v !== null) state[name] = v;
      }
    }
    if (o.reveal !== undefined) state.reveal = Boolean(o.reveal);
    return state;
  }

  /** One parameter changes; the old position is not touched. */
  function setParam(state, name, value) {
    const v = clampParam(name, value);
    if (v === null || !(name in state)) return state;
    return { ...state, [name]: v, touches: state.touches + 1 };
  }

  function setReveal(state, on) {
    return { ...state, reveal: Boolean(on), touches: state.touches + 1 };
  }

  /** An illustration has no win and no loss: this is always null. */
  function result() {
    return null;
  }

  const pointOnCircle = (center, radius, angle) => ({
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The handle for the radius, sitting on the circle at a fixed angle. */
  function radiusHandle(state) {
    return pointOnCircle(CENTER, state.radius, HANDLE_ANGLE);
  }

  /** The two handles on the bar's parallel edges, both near the top. */
  function edgeHandles(state) {
    return [
      { name: "x0", point: { x: state.x0, y: EDGE_HANDLE_Y } },
      { name: "barWidth", point: { x: state.x0 + state.barWidth, y: EDGE_HANDLE_Y } },
    ];
  }

  /** Drag a point on the circle: its distance from the centre, kept on board. */
  function radiusFromPoint(p) {
    return clamp(Math.round(dist(p, CENTER)), LIMITS.radius[0], DRAG_MAX_RADIUS);
  }

  /** Clamp a dragged radius point back onto the circle at the fixed angle. */
  function clampRadiusHandle(p) {
    return radiusHandle({ radius: radiusFromPoint(p) });
  }

  /** Clamp a dragged bar-edge point, keeping the whole bar inside the board. */
  function clampEdgeHandle(state, name, p) {
    const margin = 12;
    const right = VIEW.width - margin;
    if (name === "x0") {
      const x = clamp(Math.round(p.x), LIMITS.x0[0] - 1, right - state.barWidth);
      return { x: x, y: EDGE_HANDLE_Y };
    }
    const hi = Math.min(LIMITS.barWidth[1], right - state.x0);
    const w = clamp(Math.round(p.x - state.x0), LIMITS.barWidth[0], hi);
    return { x: state.x0 + w, y: EDGE_HANDLE_Y };
  }

  /** Parameter change caused by a dragged handle; null for an unknown handle. */
  function paramFromHandle(state, name, p) {
    if (name === "radius") return { name: "radius", value: radiusFromPoint(p) };
    if (name === "x0") return { name: "x0", value: clamp(Math.round(p.x), 0, VIEW.width - state.barWidth - 12) };
    if (name === "barWidth") {
      return { name: "barWidth", value: clamp(Math.round(p.x - state.x0), 1, Math.min(200, VIEW.width - state.x0 - 12)) };
    }
    return null;
  }

  /**
   * The picture exactly as CircularPoggendorfCanvas.Draw(g) makes it.
   *   drawOval(W/2-r, H/2-r, 2*r, 2*r)          (foreground: the circle)
   *   fillRect(X0, 0, Width, H-1)               (background: erase the strip)
   *   drawRect(X0, 0, Width, H-1)               (foreground: the two edges)
   */
  function geometry(state) {
    const r = state.radius, w = state.barWidth, x0 = state.x0;
    const leftX = x0, rightX = x0 + w;
    return {
      center: { ...CENTER },
      radius: r,
      // drawOval's four arguments.
      oval: { x: CENTER.x - r, y: CENTER.y - r, width: 2 * r, height: 2 * r },
      // fillRect/drawRect's four arguments (the bar spans the full canvas height).
      bar: { x: leftX, y: 0, width: w, height: VIEW.height - 1 },
      edges: [
        { name: "left", x: leftX, y1: 0, y2: VIEW.height - 1 },
        { name: "right", x: rightX, y1: 0, y2: VIEW.height - 1 },
      ],
      leftX: leftX,
      rightX: rightX,
      // Strip the circle completely only when its x-range covers the circle's.
      hidesWholeCircle: leftX <= CENTER.x - r && rightX >= CENTER.x + r,
      // No overlap at all: both edges are outside the circle on the same side.
      missesCircle: rightX <= CENTER.x - r || leftX >= CENTER.x + r,
      fits: true, // the visible arcs are pieces of ONE circle; see the claims below
    };
  }

  /** Is p inside the strip that the applet paints over the circle? */
  function inStrip(state, p) {
    return p.x >= state.x0 && p.x <= state.x0 + state.barWidth;
  }

  /** Is p on the (complete, unbroken) circle? */
  function onCircle(state, p, tolerance) {
    return Math.abs(dist(p, CENTER) - state.radius) <= (tolerance === undefined ? 1e-9 : tolerance);
  }

  /** Where one vertical edge crosses the circle: 0, 1 or 2 points. */
  function edgeCuts(state, x) {
    const dx = x - CENTER.x;
    if (Math.abs(dx) > state.radius) return [];
    const dy = Math.sqrt(Math.max(0, state.radius * state.radius - dx * dx));
    if (dy < 1e-9) return [{ x: x, y: CENTER.y }];
    return [{ x: x, y: CENTER.y - dy }, { x: x, y: CENTER.y + dy }];
  }

  /** The four (or fewer) ends where the hidden arc meets the two edges. */
  function cuts(state) {
    return geometry(state).edges.flatMap((e) =>
      edgeCuts(state, e.x).map((p) => ({ edge: e.name, x: p.x, y: p.y })));
  }

  /** N equally spaced points of the whole circle and which of them show. */
  function samples(state, n) {
    const count = n === undefined ? 360 : Math.max(3, Math.trunc(n));
    const out = [];
    for (let i = 0; i < count; i++) {
      const p = pointOnCircle(CENTER, state.radius, (2 * Math.PI * i) / count);
      out.push({ point: p, visible: !inStrip(state, p) });
    }
    return out;
  }

  /**
   * The page's claim, split into what geometry can check and what it cannot.
   * `piecesFit` is the substrate: every sampled point — visible or hidden — is
   * on the same circle. `seemMisaligned` is null: it is a statement about how
   * the picture is seen, not about its coordinates.
   */
  function claims(state) {
    const g = geometry(state);
    const edgesParallel = g.edges[0].x !== g.edges[1].x &&
      g.edges[0].y1 === g.edges[1].y1 && g.edges[0].y2 === g.edges[1].y2;
    const pts = cuts(state);
    const cutsOnCircle = pts.every((p) => onCircle(state, p));
    const cutsOnEdges = pts.every((p) => p.x === g.leftX || p.x === g.rightX);
    const cutsSymmetric = g.edges.every((e) => {
      const cs = edgeCuts(state, e.x);
      return cs.length !== 2 || Math.abs(cs[0].y + cs[1].y - 2 * CENTER.y) < 1e-9;
    });
    const sample = samples(state, 720);
    const piecesFit = sample.every((s) => onCircle(state, s.point)) &&
      sample.every((s) => !s.visible || !inStrip(state, s.point)) &&
      sample.some((s) => s.visible) === !g.hidesWholeCircle;
    return {
      edgesParallel: edgesParallel,
      cutsOnCircle: cutsOnCircle,
      cutsOnEdges: cutsOnEdges,
      cutsSymmetric: cutsSymmetric,
      piecesFit: piecesFit,
      seemMisaligned: null, // perception: the page says "do not appear to fit"
      pageClaim: "The parallel lines that obscure parts of a circle break the circle off " +
        "so that its pieces do not appear to fit together.",
    };
  }

  return {
    VIEW, CENTER, PAGE_PARAMS, LIMITS, START, HANDLE_ANGLE, EDGE_HANDLE_Y, DRAG_MAX_RADIUS,
    clamp, halfParam, fromPageParams, scrollbar, clampParam,
    start, setParam, setReveal, result,
    dist, pointOnCircle, radiusHandle, edgeHandles, radiusFromPoint,
    clampRadiusHandle, clampEdgeHandle, paramFromHandle,
    geometry, inStrip, onCircle, edgeCuts, cuts, samples, claims,
  };
})();
