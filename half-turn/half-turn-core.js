"use strict";

/*
 * Half Turn, from Alexander Bogomolny's Java applet HalfTurn.
 *
 * One half turn about O sends P to 2O - P: O is the midpoint of PP'. The applet
 * chains such flips about draggable centers O_1 ... O_N, starting from the
 * arrow AB. Its own Compute() reflects the End first, then the Start, and puts
 * the reflected Start first in the new segment; that order is kept here.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, HalfTurnCore, so the page loads it with a
 * plain <script> and porting/check-half-turn.mjs loads it in Node. Positions
 * are plain numbers and objects; every function returns a new state.
 */
const HalfTurnCore = (() => {
  // The applet's own choices: spinner 3 (1..10), arrow A + (30, 40), and
  // centers dropped at random into the middle sixth of each board direction.
  const N_MIN = 1;
  const N_MAX = 10;
  const N_DEFAULT = 3;
  const WIDTH = 460;
  const HEIGHT = 360;
  const ARROW_DX = 30;
  const ARROW_DY = 40;
  const SPREAD = 6;
  const EDGE = 12; // keep handles on the board in this SVG presentation

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The applet's Math.random() replaced by a seeded xorshift, for repeatable pictures. */
  function nextRandom(state) {
    let s = (state >>> 0) || 1;
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return { value: s / 4294967296, state: s >>> 0 };
  }

  /** DefinePoints(n): one center at W/2 + (2r-1)W/6, H/2 + (2r-1)H/6. */
  function randomCenters(count, seedState) {
    let s = seedState;
    const centers = [];
    for (let i = 0; i < count; i++) {
      const rx = nextRandom(s);
      s = rx.state;
      const ry = nextRandom(s);
      s = ry.state;
      centers.push({
        x: WIDTH / 2 + (2 * rx.value - 1) * (WIDTH / SPREAD),
        y: HEIGHT / 2 + (2 * ry.value - 1) * (HEIGHT / SPREAD),
      });
    }
    return { centers, state: s };
  }

  const inside = (p) => ({
    x: clamp(Number(p.x), EDGE, WIDTH - EDGE),
    y: clamp(Number(p.y), EDGE, HEIGHT - EDGE),
  });

  /** The position a new game starts from. */
  function start(options = {}) {
    const n = clamp(Math.round(options.n === undefined ? N_DEFAULT : Number(options.n)), N_MIN, N_MAX);
    const seed = (options.seed === undefined ? 7 : Number(options.seed) >>> 0) || 1;
    const made = randomCenters(n, seed);
    const a = { x: WIDTH / 2, y: Math.floor(HEIGHT / 3) };
    const b = { x: a.x + ARROW_DX, y: a.y + ARROW_DY };
    return {
      n,
      seed,
      a,
      b,
      centers: made.centers,
      rngState: made.state,
      showNames: false,
      showStatement: false,
      moves: 0,
    };
  }

  /** ReflectInPoint from the applet: (2*o.x - p.x, 2*o.y - p.y). */
  function reflect(p, o) {
    return { x: 2 * o.x - p.x, y: 2 * o.y - p.y };
  }

  /** The moves allowed from a position (for the record and for the tutor). */
  function legalMoves(state) {
    const moves = [{ type: "reset" }, { type: "newCenters" }];
    for (let i = 0; i < state.centers.length; i++) {
      moves.push({ type: "point", which: "center", index: i, point: state.centers[i] });
    }
    moves.push({ type: "point", which: "a", point: state.a });
    moves.push({ type: "point", which: "b", point: state.b });
    for (let n = N_MIN; n <= N_MAX; n++) moves.push({ type: "option", key: "n", value: n });
    for (const key of ["showNames", "showStatement"]) {
      moves.push({ type: "option", key, value: !state[key] });
    }
    return moves;
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!m || typeof m !== "object") return null;
    const more = { moves: state.moves + 1 };
    if (m.type === "point") {
      if (!m.point || !Number.isFinite(Number(m.point.x)) || !Number.isFinite(Number(m.point.y))) return null;
      const p = inside(m.point);
      if (m.which === "a" || m.which === "b") return Object.assign({}, state, { [m.which]: p }, more);
      if (m.which === "center" && Number.isInteger(m.index) &&
          m.index >= 0 && m.index < state.centers.length) {
        const centers = state.centers.slice();
        centers[m.index] = p;
        return Object.assign({}, state, { centers }, more);
      }
      return null;
    }
    if (m.type === "option") {
      if (m.key === "n") {
        const value = Number(m.value);
        if (!Number.isFinite(value)) return null;
        const n = clamp(Math.round(value), N_MIN, N_MAX);
        // SetN calls DefinePoints(N), which only ever adds centers: lowering
        // the spinner keeps the old ones in the vector but uses just the first N.
        let centers = state.centers.slice();
        let rngState = state.rngState;
        if (n > centers.length) {
          const made = randomCenters(n - centers.length, rngState);
          centers = centers.concat(made.centers);
          rngState = made.state;
        }
        return Object.assign({}, state, { n, centers, rngState }, more);
      }
      if (m.key === "showNames" || m.key === "showStatement") {
        return Object.assign({}, state, { [m.key]: Boolean(m.value) }, more);
      }
      return null;
    }
    if (m.type === "reset") return Object.assign(start({ n: state.n, seed: state.seed }), more);
    if (m.type === "newCenters") {
      const seed = (state.seed + 1) >>> 0 || 1;
      const made = randomCenters(state.centers.length, seed);
      return Object.assign({}, state, { seed, centers: made.centers, rngState: made.state }, more);
    }
    return null;
  }

  /** The applet's Compute(): the original arrow followed by one copy per center. */
  function compute(state) {
    const segments = [{ start: Object.assign({}, state.a), end: Object.assign({}, state.b) }];
    for (let i = 0; i < state.n; i++) {
      const o = state.centers[i];
      const previous = segments[i];
      // The Java code reflects End first and Start second, then constructs the
      // new MoveableVector as (reflected Start, reflected End).
      const end = reflect(previous.end, o);
      const startPoint = reflect(previous.start, o);
      segments.push({ start: startPoint, end });
    }
    return {
      segments,
      aPoints: segments.map((s) => s.start),
      bPoints: segments.map((s) => s.end),
      centers: state.centers.slice(0, state.n),
    };
  }

  /**
   * The whole chain as one map p -> sign*p + t. Composing 2O - p with
   * sign*p + t gives -sign*p + (2O - t), so even n is a translation and odd n
   * is a half turn about t/2.
   */
  function composition(state) {
    let sign = 1;
    let tx = 0;
    let ty = 0;
    for (let i = 0; i < state.n; i++) {
      const o = state.centers[i];
      sign = -sign;
      tx = 2 * o.x - tx;
      ty = 2 * o.y - ty;
    }
    const t = { x: tx, y: ty };
    return { sign, t, center: sign < 0 ? { x: tx / 2, y: ty / 2 } : null };
  }

  /** Where any point lands after all the half turns. */
  function image(state, p) {
    const c = composition(state);
    return { x: c.sign * p.x + c.t.x, y: c.sign * p.y + c.t.y };
  }

  /** A demonstration: no win, no loss and no end, in any configuration. */
  function result() {
    return null;
  }

  return {
    N_MIN, N_MAX, N_DEFAULT, WIDTH, HEIGHT, SPREAD, ARROW_DX, ARROW_DY,
    start, legalMoves, move, reflect, compute, composition, image, result,
    nextRandom, randomCenters,
  };
})();
