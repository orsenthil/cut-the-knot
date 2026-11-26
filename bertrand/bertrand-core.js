"use strict";

/*
 * Bertrand's Paradox, from Alexander Bogomolny's applet bertrand.
 *
 * The question on the page: pick a chord of a circle at random; what is the
 * chance it is longer than a side of an inscribed equilateral triangle? With
 * radius 1 that side is sqrt(3) (the page's bare "3" is a lost square-root
 * image; the applet compares with Math.sqrt(3)). The page gives three answers
 * - 1/3, 1/4, 1/2 - because "at random" can mean three different things.
 *
 * The applet's four samples (its SHOULDFIX parameter, 0..3) are:
 *   0 two independent random ends on the circumference       -> 1/3
 *   1 one end fixed at (1,0), the other random               -> 1/3
 *   2 midpoint in polar coordinates: radius and angle random -> 1/2
 *   3 midpoint in Cartesian coordinates: x,y uniform in the
 *     circumscribed square, points outside the disc rejected -> 1/4
 * A midpoint m determines the chord perpendicular to Om, of length
 * 2*sqrt(1-|m|^2); it is long exactly when |m| < 1/2. That is the one idea
 * the drawing and the counting share.
 *
 * This is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BertrandCore, so the page loads it with a plain
 * <script> and porting/check-bertrand.mjs loads it in Node. All positions are
 * plain data in unit-circle coordinates; functions return new state.
 */
const BertrandCore = (() => {
  const SIDE = Math.sqrt(3);   // applet: m_TriangleSide = Math.sqrt(3)
  const BINS = 180;            // applet: m_N, for its 390x300 canvas
  const PER_UNIT = BINS / 2;   // applet: length * m_N/2 gives the bin
  const CENTER_EPS = 1e-7;     // applet: reject midpoints this close to O
  const TRAIL = 36;            // how many past chords the illustration keeps

  const MODES = [
    { id: 0, label: "Two random ends", theory: 1 / 3, text: "1/3", key: "ends" },
    { id: 1, label: "One fixed end", theory: 1 / 3, text: "1/3", key: "fixed" },
    { id: 2, label: "Random radius", theory: 1 / 2, text: "1/2", key: "radius" },
    { id: 3, label: "Random spot", theory: 1 / 4, text: "1/4", key: "area" },
  ];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const asMode = (m) => (Number.isInteger(m) && m >= 0 && m < MODES.length ? m : 0);

  function makeChord(p1, p2) {
    return {
      p1: { x: p1.x, y: p1.y },
      p2: { x: p2.x, y: p2.y },
      midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      length: dist(p1, p2),
    };
  }
  const isLong = (chord) => chord.length > SIDE;

  /** Project onto the circumference; a point at O has no unique direction. */
  function snapToCircle(p) {
    const d = Math.hypot(p.x, p.y);
    if (!Number.isFinite(d) || d < CENTER_EPS) return { x: 1, y: 0 };
    return { x: p.x / d, y: p.y / d };
  }

  /** Keep a hand-dragged midpoint inside the disc and away from the centre. */
  function snapToDisc(p) {
    const d = Math.hypot(p.x, p.y);
    if (!Number.isFinite(d)) return { x: 0.5, y: 0 };
    const floor = Math.sqrt(CENTER_EPS);
    if (d < floor) return { x: floor, y: 0 };
    if (d > 1) return { x: p.x / d, y: p.y / d };
    return { x: p.x, y: p.y };
  }

  /** The chord determined by midpoint m: perpendicular to Om, half-length
   *  sqrt(1-|m|^2). These are the applet's own endpoint formulas. */
  function chordFromMidpoint(m) {
    const d2 = m.x * m.x + m.y * m.y;
    if (!Number.isFinite(d2) || d2 > 1 || d2 < CENTER_EPS) return null;
    const half = Math.sqrt((1 - d2) / d2);
    return makeChord(
      { x: m.x - half * m.y, y: m.y + half * m.x },
      { x: m.x + half * m.y, y: m.y - half * m.x },
    );
  }

  function start(options) {
    const o = options || {};
    const chord = o.chord
      ? makeChord(o.chord.p1, o.chord.p2)
      : makeChord(
          snapToCircle({ x: Math.cos(2.45), y: Math.sin(2.45) }),
          snapToCircle({ x: Math.cos(0.35), y: Math.sin(0.35) }),
        );
    return {
      mode: asMode(o.mode), chord,
      total: 0, favorable: 0, bins: new Array(BINS).fill(0),
      rejected: 0, trail: [],
    };
  }

  function modeInfo(mode) { return MODES[asMode(mode)]; }

  /** Changing the option resets the counts, as opening a fresh applet does. */
  function withMode(state, mode) {
    const m = asMode(mode);
    if (m === state.mode) return state;
    return { ...start({ mode: m }), chord: state.chord, trail: state.trail };
  }

  /**
   * One trial, transcribed from bertrandcanvas.DropLine. `random` stands for
   * Math.random(). Mode 1 draws an angle it never uses, just like the applet;
   * both rejections in modes 2 and 3 return null (the applet records nothing).
   */
  function sample(mode, random) {
    const u = random || Math.random;
    const which = asMode(mode);
    if (which === 0) {
      const a = 2 * Math.PI * u(), b = 2 * Math.PI * u();
      return makeChord({ x: Math.cos(a), y: Math.sin(a) }, { x: Math.cos(b), y: Math.sin(b) });
    }
    if (which === 1) {
      u(); // Math.random()*2*PI, stored and discarded by DropLine
      const b = 2 * Math.PI * u();
      return makeChord({ x: 1, y: 0 }, { x: Math.cos(b), y: Math.sin(b) });
    }
    if (which === 2) {
      const radius = u();                 // uniform on [0,1], not uniform area
      const angle = 2 * Math.PI * u();
      const mx = radius * Math.cos(angle), my = radius * Math.sin(angle);
      const d2 = mx * mx + my * my;
      if (d2 < CENTER_EPS) return null;
      const half = Math.sqrt((1 - d2) / d2);
      return makeChord(
        { x: mx - half * my, y: my + half * mx },
        { x: mx + half * my, y: my - half * mx },
      );
    }
    if (which === 3) {
      const mx = 2 * u() - 1, my = 2 * u() - 1;
      const d2 = mx * mx + my * my;
      if (d2 > 1 || d2 < CENTER_EPS) return null;
      const half = Math.sqrt((1 - d2) / d2);
      return makeChord(
        { x: mx - half * my, y: my + half * mx },
        { x: mx + half * my, y: my - half * mx },
      );
    }
    return null;
  }

  /** Applet RecordTrial: one more trial, one more bin, one more short/long. */
  function record(state, chord) {
    const bins = state.bins.slice();
    const bin = Math.min(Math.floor(chord.length * PER_UNIT), BINS - 1);
    bins[bin] += 1;
    const isFavorite = isLong(chord);
    return {
      ...state, bins, chord,
      total: state.total + 1,
      favorable: state.favorable + (isFavorite ? 1 : 0),
      trail: state.trail.concat([{
        p1: chord.p1, p2: chord.p2, long: isFavorite,
      }]).slice(-TRAIL),
    };
  }

  function draw(state, random) {
    const chord = sample(state.mode, random);
    if (!chord) return { ...state, rejected: state.rejected + 1 };
    return record(state, chord);
  }

  function runBatch(state, count, random) {
    let s = state;
    for (let i = 0; i < count; i++) s = draw(s, random);
    return s;
  }

  /** Drag A or B around the circle, or its midpoint inside it. Not a trial. */
  function withPoint(state, name, p) {
    if (name === "A") return { ...state, chord: makeChord(snapToCircle(p), state.chord.p2) };
    if (name === "B") return { ...state, chord: makeChord(state.chord.p1, snapToCircle(p)) };
    if (name === "M") {
      const chord = chordFromMidpoint(snapToDisc(p));
      return chord ? { ...state, chord } : state;
    }
    return state;
  }

  /** The applet's cumulative length graph, with its red sqrt(3) marker. */
  function cdf(state) {
    const values = [];
    let running = 0;
    for (let i = 0; i < BINS; i++) {
      running += state.bins[i];
      values.push(state.total ? running / state.total : 0);
    }
    return { values, cutoff: Math.floor(BINS * SIDE / 2) };
  }

  const estimate = (state) => (state.total ? state.favorable / state.total : null);
  const result = () => null; // an illustration has no win and no loss

  return {
    SIDE, BINS, PER_UNIT, CENTER_EPS, MODES,
    start, modeInfo, withMode, makeChord, isLong, snapToCircle, snapToDisc,
    chordFromMidpoint, sample, record, draw, runBatch, withPoint, cdf,
    estimate, result,
  };
})();
