"use strict";

/*
 * Cycloids — the logic behind Alexander Bogomolny's applet "cycloids"
 * (the manifest's page, cut-the-knot.org/exchange/cycloids.shtml, is only a
 * reader's question about what cycloids are and does not embed the applet, so
 * the rules come from the applet's own code).
 *
 * A disc rolls and spins. Marks fixed to the disc (up to 50, added by clicking)
 * leave their trails. Three ways of rolling, chosen by the buttons r, h and e:
 *   regular     the disc of radius r rolls along a line; its marks trace
 *               cycloids (a mark on the rim), curtate cycloids (inside) and
 *               prolate ones with loops (outside);
 *   hypocycloid the disc rolls round the inside of a fixed circle of radius R;
 *   epicycloid  it rolls round the outside.
 * The ratio R/r (hypo and epi only; the applet's "R/r" spinner) is a whole
 * number: at least 1 for the epicycloid (R = r gives the cardioid) and at least
 * 2 for the hypocycloid (R = r would make the disc fill the circle; 2 gives a
 * straight line, 3 the deltoid, 4 the astroid). The "Roll/Rotate" control V
 * scales the disc's own spin against true rolling: V = 1 rolls without slipping,
 * V = 2 spins twice as fast, V = -2 half as fast (the factor is V if positive,
 * 1/|V| if negative), V = 0 stops it spinning. Each step moves the disc 2 pixels
 * along the line, or 2 degrees round the circle (Delta = 2); the applet does one
 * step every 50 ms.
 *
 * Two methods give each position, as in the applet: the "Formula" checkbox
 * computes a mark's place directly from the time, and the other way rotates the
 * marks a little at every step (the applet's updateCC). The logic test shows they
 * agree. A mark is remembered by its distance d from the disc's centre and its
 * angle there (FindAngle).
 *
 * No document, no window, no storage. The position is plain data.
 */
const CycloidsCore = (() => {
  const KINDS = ["regular", "hypo", "epi"];
  const MAX_POINTS = 50; // m_MaxPoints
  const DELTA = 2; // m_Delta
  const TICK_MS = 50;
  const START_RADIUS = 30; // m_r for the regular cycloid
  const FIXED_RADIUS = 100; // this port's R for the circle the disc rolls round
  const MARGIN = 10; // m_Margin
  const START_RATIO = 2; // the applet's text box
  const MIN_SPEED = -9, MAX_SPEED = 9; // this port's limits on V (the applet had none)
  const MAX_RATIO = 12;
  const W = 390, H = 350; // the applet's size ("390 will do", "350 will do")

  /** The disc's own spin relative to true rolling: V if positive, 1/|V| if negative, none at 0. */
  const spinFactor = (v) => (v === 0 ? 0 : v > 0 ? v : 1 / Math.abs(v));

  const minRatio = (kind) => (kind === "hypo" ? 2 : 1);

  /**
   * The disc's radius: r for the regular cycloid, R / ratio round a circle. The applet cuts R / ratio
   * down to whole pixels, so for a ratio that does not divide R its curves do not quite close; this port
   * keeps the exact value.
   */
  const discRadius = (state) => (state.kind === "regular" ? state.r : FIXED_RADIUS / state.ratio);

  /** A new position: a regular cycloid, V = 1, no marks, time 0. */
  function start(options) {
    const o = options || {};
    const kind = KINDS.includes(o.kind) ? o.kind : "regular";
    const ratio = Number.isInteger(o.ratio) ? Math.max(minRatio(kind), Math.min(MAX_RATIO, o.ratio)) : Math.max(START_RATIO, minRatio(kind));
    return {
      kind, ratio,
      r: Number.isInteger(o.r) ? Math.max(5, Math.min(60, o.r)) : START_RADIUS,
      speed: Number.isInteger(o.speed) ? Math.max(MIN_SPEED, Math.min(MAX_SPEED, o.speed)) : 1,
      formula: o.formula === true, curvesOnly: o.curvesOnly === true,
      marks: [], time: 0, moves: 0, explored: false,
    };
  }

  /* ------------------------------------------------------------ the geometry */

  /** The disc's centre at time t (a step count), in pixels, y down. */
  function centreAt(state, t) {
    const r = discRadius(state);
    if (state.kind === "regular") return { x: MARGIN + r + DELTA * t, y: H - MARGIN - r };
    const sign = state.kind === "epi" ? 1 : -1;
    const psi = ((DELTA * t) * Math.PI) / 180 - Math.PI / 2; // starts at the top
    const dist = FIXED_RADIUS + sign * r;
    return { x: W / 2 + dist * Math.cos(psi), y: H / 2 + dist * Math.sin(psi) };
  }

  /** Where the marks' angle (about the disc centre) is at time t, for a mark added at time t0 at angle phi. */
  function spinAngle(state, t, t0, phi) {
    const f = spinFactor(state.speed);
    const r = discRadius(state);
    const steps = t - t0;
    if (state.kind === "regular") return phi + (DELTA * steps * f) / r; // the disc turns clockwise (y down)
    const sign = state.kind === "epi" ? 1 : -1;
    // the orbit carries the mark round by Delta degrees a step; the disc's own spin adds
    // sign * Delta * (R / r) * f degrees a step (true rolling is f = 1)
    return phi + ((DELTA * steps * Math.PI) / 180) * (1 + sign * (FIXED_RADIUS / r) * f);
  }

  /** The place of a mark by the closed form: the applet's "Formula" mode. */
  function markAt(state, mark, t) {
    const c = centreAt(state, t);
    const a = spinAngle(state, t, mark.t0, mark.angle);
    if (state.kind === "hypo") return { x: c.x + mark.dist * Math.cos(a), y: c.y + mark.dist * Math.sin(a) };
    return { x: c.x + mark.dist * Math.cos(a), y: c.y + mark.dist * Math.sin(a) };
  }

  /**
   * The same places by the applet's other method: from time 0, each step rotate the mark about the
   * disc's centre by the disc's own spin, then (for a circle) rotate the centre and mark about the
   * fixed centre, or slide both along (for the line).
   */
  function markIncremental(state, mark, t) {
    const f = spinFactor(state.speed);
    const r = discRadius(state);
    // the mark as it was when added: at time t0, relative to the disc's centre
    const c0 = centreAt(state, mark.t0);
    let x = c0.x + mark.dist * Math.cos(mark.angle), y = c0.y + mark.dist * Math.sin(mark.angle);
    let cx = c0.x, cy = c0.y;
    const dpsi = (DELTA * Math.PI) / 180;
    for (let step = mark.t0; step < t; step++) {
      if (state.kind === "regular") {
        const a = (DELTA * f) / r; // the spin about the centre
        const dx = x - cx, dy = y - cy;
        x = cx + dx * Math.cos(a) - dy * Math.sin(a);
        y = cy + dx * Math.sin(a) + dy * Math.cos(a);
        x += DELTA; cx += DELTA;
      } else {
        const sign = state.kind === "epi" ? 1 : -1;
        const a = sign * dpsi * (FIXED_RADIUS / r) * f; // the disc's own spin about its centre
        let dx = x - cx, dy = y - cy;
        x = cx + dx * Math.cos(a) - dy * Math.sin(a);
        y = cy + dx * Math.sin(a) + dy * Math.cos(a);
        // then the whole disc turns about the fixed centre
        const ox = W / 2, oy = H / 2;
        for (const p of [0, 1]) {
          const px = p ? x : cx, py = p ? y : cy;
          const rx = px - ox, ry = py - oy;
          const nx = ox + rx * Math.cos(dpsi) - ry * Math.sin(dpsi), ny = oy + rx * Math.sin(dpsi) + ry * Math.cos(dpsi);
          if (p) { x = nx; y = ny; } else { cx = nx; cy = ny; }
        }
      }
    }
    return { x, y };
  }

  /** The mark's angle as the applet's FindAngle gives it: asin and acos picked by quadrant. */
  function findAngle(dx, dy, dist) {
    const s = Math.asin(dy / dist), c = Math.acos(dx / dist);
    return s >= 0 ? c : s < 0 ? -c : 0;
  }

  /** The applet's InitPoint: a mark where the pointer pressed, kept as distance and angle about the disc's centre. */
  function addMark(state, x, y) {
    if (state.marks.length >= MAX_POINTS) return null;
    const c = centreAt(state, state.time);
    const dx = x - c.x, dy = y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return null; // too close to the centre: the applet treats that as a drag of the disc
    return { ...state, marks: [...state.marks, { dist, angle: findAngle(dx, dy, dist), t0: state.time, id: state.marks.length }] };
  }

  /** The trail of a mark from its birth until time t, one point per step. */
  function trail(state, mark, t) {
    const out = [];
    for (let k = mark.t0; k <= t; k++) out.push(markAt(state, mark, k));
    return out;
  }

  /* ------------------------------------------------------------- the moves */

  /** The moves: start rolling a step, add a mark, change kind, ratio, speed, the two ticks, reset. */
  function legalMoves() {
    return [
      { type: "step" }, { type: "mark", x: 0, y: 0 }, { type: "kind", value: "regular" }, { type: "ratio", dir: 1 },
      { type: "speed", dir: 1 }, { type: "formula", value: true }, { type: "curves", value: true }, { type: "radius", value: START_RADIUS }, { type: "reset" },
    ];
  }

  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "step") {
      const n = Number.isInteger(m.count) && m.count > 0 ? m.count : 1;
      next = { ...state, time: state.time + n };
    } else if (m.type === "mark") {
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      next = addMark(state, Number(m.x), Number(m.y));
    } else if (m.type === "kind") {
      if (!KINDS.includes(m.value)) return null;
      // NewOne: a new disc of that kind, no marks; hypocycloids start at ratio 2 (clickedMHyper)
      next = { ...start({ kind: m.value, ratio: state.ratio, r: state.r, speed: state.speed, formula: state.formula, curvesOnly: state.curvesOnly }) };
    } else if (m.type === "ratio") {
      if (state.kind === "regular") return null; // the ratio buttons are disabled for the regular cycloid
      const v = m.dir !== undefined ? state.ratio + (m.dir > 0 ? 1 : -1) : Math.trunc(Number(m.value));
      if (!Number.isFinite(v) || v < minRatio(state.kind) || v > MAX_RATIO) return null;
      next = { ...start({ kind: state.kind, ratio: v, r: state.r, speed: state.speed, formula: state.formula, curvesOnly: state.curvesOnly }) };
    } else if (m.type === "speed") {
      const v = m.dir !== undefined ? state.speed + (m.dir > 0 ? 1 : -1) : Math.trunc(Number(m.value));
      if (!Number.isFinite(v) || v < MIN_SPEED || v > MAX_SPEED) return null;
      next = { ...state, speed: v };
    } else if (m.type === "formula" || m.type === "curves") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, [m.type === "formula" ? "formula" : "curvesOnly"]: m.value };
    } else if (m.type === "radius") {
      if (state.kind !== "regular" || !Number.isInteger(m.value) || m.value < 5 || m.value > 60) return null;
      next = { ...state, r: m.value, marks: [], time: 0 };
    } else if (m.type === "reset") {
      return { ...state, marks: [], time: 0, moves: 0, explored: false };
    }
    if (!next) return null;
    return { ...next, moves: state.moves + 1, explored: true };
  }

  /** A demo: nothing to win; "done" once a mark has drawn a trail (a mark exists and the disc has moved). */
  function result(state) {
    return state.marks.length > 0 && state.time - Math.min(...state.marks.map((k) => k.t0)) >= 30 ? "done" : null;
  }

  /** The text of the speed box: the applet shows V, or "1/" with the divisor for the slow side. */
  const speedText = (v) => (v < 0 ? "1/" + Math.abs(v) : String(v));

  return {
    KINDS, MAX_POINTS, DELTA, TICK_MS, START_RADIUS, FIXED_RADIUS, MARGIN, START_RATIO, MIN_SPEED, MAX_SPEED, MAX_RATIO, W, H,
    start, centreAt, markAt, markIncremental, trail, addMark, findAngle, spinFactor, discRadius, minRatio, legalMoves, move, result, speedText,
  };
})();
