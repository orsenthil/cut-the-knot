"use strict";

/*
 * Equichordal, from Alexander Bogomolny's applet Equichordal and the article
 * "Equichordal Points: Just Do It" (cut-the-knot.org/Generalization/
 * Equichordal.shtml). The page asks whether a closed convex curve can have an
 * equichordal point other than a circle's centre, and answers yes: take any
 * r(t) with r(t) + r(t + pi) constant, for instance r(t) = 2 + sin(t).
 *
 * The applet draws r(t) = Scale * (Shift + sin(Frequency*t)^Power) about a
 * fixed centre, with Frequency and Power odd positive integers, and keeps a
 * chord of fixed length through the centre: when you drag one end, the other
 * is put on the opposite ray at the same total distance. Scale =
 * trunc(min(w,h)/5)/Shift, so the chord length is always 2*trunc(min/5),
 * independent of the three knobs. This file is just that logic: no document,
 * no window, no storage. It defines one global, EquichordalCore, and the
 * position is plain data so the page can hand it to the tutor.
 */

const EquichordalCore = (() => {
  // The applet's own canvas on the archived page: <APPLET WIDTH=640 HEIGHT=460>.
  const WIDTH = 640;
  const HEIGHT = 460;

  // EquichordalCanvas.Reset: NumberSelector(x=10, y..., w=w-20, h=14),
  // name width 56, then UpdateParameters and the circle at (w/2, 2*h/5).
  const SELECTOR_X = 10 + 56;          // NumberSelector.GetX()
  const SELECTOR_W = WIDTH - 20 - 56;  // NumberSelector.GetW() = 564
  const SELECTOR_EDGE = 10 + (WIDTH - 20); // right edge used by Inside()
  const CENTER = {
    x: Math.trunc(WIDTH / 2),
    y: Math.trunc((HEIGHT * 2) / 5),
  };
  const MARK_RADIUS = 3; // DoubCircle(..., 3) drawn at the centre

  // Reset + UpdateParameters: selector divisions, linear transform, defaults.
  const SELECTORS = {
    power: { divisions: 30, scale: 2, offset: 1, min: 1, max: 61, step: 2 },
    shift: { divisions: 100, scale: 0.1, offset: 1, min: 1, max: 11, step: 0.1 },
    freq: { divisions: 40, scale: 2, offset: 1, min: 1, max: 81, step: 2 },
  };
  const DEFAULTS = { power: 1, shift: 2, freq: 1, standard: false };

  /*
   * NumberSelector.SetValue -> Math.round(GetX + GetW*u/divisions) followed by
   * InternalValue (clamp m_L into the rectangle, interpolate, clamp to the
   * divisions) and DoubleValue. Keeping the pixel step matters: on a 640-wide
   * canvas a requested Shift of 2.0 comes back as 1.99, as in the applet.
   */
  function snapSelector(value, spec) {
    const u = Number.isFinite(value) ? (value - spec.offset) / spec.scale : 0;
    const l = Math.round(SELECTOR_X + (SELECTOR_W * u) / spec.divisions);
    const inside = Math.max(SELECTOR_X, Math.min(SELECTOR_EDGE, l));
    let internal = (spec.divisions * (inside - SELECTOR_X)) / SELECTOR_W;
    internal = Math.max(0, Math.min(spec.divisions, internal));
    return spec.offset + internal * spec.scale;
  }

  /** IntValue() for Power/Frequency, DoubleValue() for Shift. */
  function snapped(kind, value) {
    const spec = SELECTORS[kind];
    if (!spec) return value;
    const v = snapSelector(value, spec);
    // NumberSelector.IntValue() = Math.round(DoubleValue()).
    return kind === "shift" ? v : Math.round(v);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /** The three selector values and the checkbox, each snapped as the applet does. */
  function options(o) {
    const src = o || {};
    const pick = (kind) =>
      src[kind] === undefined ? DEFAULTS[kind] : src[kind];
    return {
      power: clamp(snapped("power", pick("power")), SELECTORS.power.min, SELECTORS.power.max),
      shift: clamp(snapped("shift", pick("shift")), SELECTORS.shift.min, SELECTORS.shift.max),
      freq: clamp(snapped("freq", pick("freq")), SELECTORS.freq.min, SELECTORS.freq.max),
      standard: src.standard === undefined ? DEFAULTS.standard : !!src.standard,
    };
  }

  /** Scale and chord length from UpdateParameters, for one set of values. */
  function parameters(p) {
    const scale = Math.trunc(Math.min(WIDTH, HEIGHT) / 5) / p.shift;
    return {
      scale: scale,
      segLen: scale * p.shift * 2, // SegLen = Scale*Shift*2
      n: 100 * p.freq,             // N = 100*Freq, used by DrawStandard
    };
  }

  /** EquichordalCanvas.g(t): the radius in board units. */
  function radiusAt(p, t) {
    const par = parameters(p);
    return par.scale * (p.shift + Math.pow(Math.sin(p.freq * t), p.power));
  }

  /** The page's own polar formula, with an independent Radius. */
  function polarRadius(shift, radius, freq, power, t) {
    return shift + radius * Math.pow(Math.sin(freq * t), power);
  }

  /** EquichordalCanvas.GetX/GetY: Java's d2i truncates towards zero. */
  function curvePoint(p, t) {
    const r = radiusAt(p, t);
    return {
      x: Math.trunc(CENTER.x + r * Math.cos(t)),
      y: Math.trunc(CENTER.y + r * Math.sin(t)),
    };
  }

  /** DrawStandard: i = 0..N, t = 2*pi*i/N, joined in order. */
  function standardPoints(p) {
    const n = parameters(p).n;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(curvePoint(p, (2 * Math.PI * i) / n));
    return pts;
  }

  /** The position a new game (Reset) starts from: curve points at t=0 and pi. */
  function start(o) {
    const p = options(o);
    const a = curvePoint(p, 0);
    const b = curvePoint(p, Math.PI);
    return {
      power: p.power,
      shift: p.shift,
      freq: p.freq,
      standard: p.standard,
      A: a,
      B: b,
      traceA: [a],
      traceB: [b],
      dragged: null,
    };
  }

  /** Changing a NumberSelector does not reset the chord: the applet keeps A and B. */
  function withOptions(state, o) {
    const p = options({
      power: o && o.power !== undefined ? o.power : state.power,
      shift: o && o.shift !== undefined ? o.shift : state.shift,
      freq: o && o.freq !== undefined ? o.freq : state.freq,
      standard: o && o.standard !== undefined ? o.standard : state.standard,
    });
    return Object.assign({}, state, p);
  }

  /** Everything the page draws and reports, derived from the position. */
  function geometry(state) {
    const p = options(state);
    const par = parameters(p);
    return {
      center: { x: CENTER.x, y: CENTER.y },
      markRadius: MARK_RADIUS,
      scale: par.scale,
      segLen: par.segLen,
      n: par.n,
      A: state.A,
      B: state.B,
      chord: Math.hypot(state.B.x - state.A.x, state.B.y - state.A.y),
      radius0: radiusAt(p, 0),
    };
  }

  /** EquichordalCanvas.GetSecondPoint: the other end of a chord through O. */
  function secondPoint(state, moved, other) {
    const dx = CENTER.x - moved.x;
    const dy = CENTER.y - moved.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.1) return { x: other.x, y: other.y }; // the bytecode's guard
    const len = parameters(options(state)).segLen;
    return {
      x: moved.x + (dx * len) / d,
      y: moved.y + (dy * len) / d,
    };
  }

  /** Drag one end (A or B). The other end follows; the input state is untouched. */
  function drag(state, name, point) {
    if (name !== "A" && name !== "B") return state;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return state;
    const moved = { x: point.x, y: point.y };
    const otherName = name === "A" ? "B" : "A";
    const other = secondPoint(state, moved, state[otherName]);
    const next = Object.assign({}, state, {
      [name]: moved,
      [otherName]: other,
      dragged: name,
      traceA: state.traceA,
      traceB: state.traceB,
    });
    const key = name === "A" ? "traceA" : "traceB";
    next[key] = state[key].concat([moved]); // TracePoint.SetPoint appends every time
    return next;
  }

  /** The handles a player can move, for callers that ask for legal moves. */
  function legalMoves() {
    return ["A", "B"];
  }

  function move(state, m) {
    if (!m) return state;
    return drag(state, m.name, m.point);
  }

  /** A demo: there is no win, loss or finish. */
  function result() {
    return null;
  }

  /** A compact, JSON-safe summary for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    return {
      power: state.power,
      shift: round(state.shift),
      freq: state.freq,
      standard: state.standard,
      center: g.center,
      A: { x: round(state.A.x), y: round(state.A.y) },
      B: { x: round(state.B.x), y: round(state.B.y) },
      chord: round(g.chord),
      segLen: round(g.segLen),
      scale: round(g.scale),
    };
  }

  return {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    CENTER: CENTER,
    MARK_RADIUS: MARK_RADIUS,
    SELECTOR_X: SELECTOR_X,
    SELECTOR_W: SELECTOR_W,
    SELECTORS: SELECTORS,
    DEFAULTS: DEFAULTS,
    snapSelector: snapSelector,
    snapped: snapped,
    options: options,
    parameters: parameters,
    radiusAt: radiusAt,
    polarRadius: polarRadius,
    curvePoint: curvePoint,
    standardPoints: standardPoints,
    start: start,
    withOptions: withOptions,
    geometry: geometry,
    secondPoint: secondPoint,
    drag: drag,
    legalMoves: legalMoves,
    move: move,
    result: result,
    position: position,
  };
})();
