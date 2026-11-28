"use strict";

/*
 * LightHouse, from Alexander Bogomolny's applet LightHouse (Lighthouse Curves).
 *
 * Two lighthouses at P1 and P2 send out n equally spaced beams each; the beams
 * turn at constant angular speeds (the applet's "Rate 1" and "Rate 2", each
 * -12..12). Every crossing of a beam from the first fan with a beam from the
 * second is traced as a curve. The page's Lighthouse Theorem says that when
 * the two fans are offset by half a step the crossings form a regular n-gon:
 * triangles for n = 3, squares for n = 4, and so on. This is true for any
 * rates, not just opposite ones; the logic test proves it exactly.
 *
 * This file is the picture's logic and nothing else: no document, no window,
 * no storage. It defines one global, LightHouseCore. The position is plain
 * data, so it can be saved for the tutor as it is.
 *
 * The applet's own array is transcribed from its bytecode:
 *   LightHouseCanvas.init      the three draggable points, from the view size
 *   LightHouseCanvas.Reset     the quadratic array of TwoLineConfigurations
 *   SetConfigurations          each fan is shifted by PI/N, then given its
 *                              increment PI/Ngon * Rate / N per animation step
 *   RotatingLine.GetNext       angle += increment; the moving point is 1000
 *                              units away along (cos(angle), -sin(angle))
 *   GeoSDoub.Intersect         the two determinant formulas for line crossings
 *   GeoSDoub.FindCircumcenter  from LightHouseCanvas.SetNum (the Ngon buckets)
 *
 */
const LightHouseCore = (() => {
  // LightHouseCanvas's fields and the applet's HTML parameters.
  const DEFAULTS = { N: 3, rate1: 1, rate2: 1, width: 640, height: 460 };
  const RAY_LENGTH = 1000; // RotatingLine's static R = 1000.0
  const COLORS = ["#e05a5a", "#e0a23a", "#5ba85b", "#4a86d8", "#9060c0", "#c8609a", "#4aa8a0"];
  const NGONS = [60, 120, 240, 360];

  /** Java's int cast: truncate toward zero, as in LightHouseCanvas.init. */
  const d2i = (d) => Math.trunc(d);

  function normalize(options) {
    const o = options || {};
    const n = d2i(Number(o.N));
    const w = d2i(Number(o.width));
    const h = d2i(Number(o.height));
    const clampRate = (v, fallback) => {
      const r = d2i(Number(v));
      return Number.isFinite(r) && r >= -12 && r <= 12 ? r : fallback;
    };
    return {
      N: Number.isFinite(n) && n >= 1 && n <= 12 ? n : DEFAULTS.N,
      rate1: o.rate1 === undefined ? DEFAULTS.rate1 : clampRate(o.rate1, DEFAULTS.rate1),
      rate2: o.rate2 === undefined ? DEFAULTS.rate2 : clampRate(o.rate2, DEFAULTS.rate2),
      width: Number.isFinite(w) && w > 0 ? w : DEFAULTS.width,
      height: Number.isFinite(h) && h > 0 ? h : DEFAULTS.height,
    };
  }

  /* The three points of LightHouseCanvas.init. `step` is (2*width)/5 and
     `half` is height/2, both whole pixels in Java. */
  function initialPoints(o) {
    const step = d2i((2 * o.width) / 5);
    const half = d2i(o.height / 2);
    return {
      P1: { x: step, y: half - d2i(o.height / 11) },
      P2: { x: step, y: half + d2i(o.height / 11) },
      P: { x: o.width - step, y: half + 20 },
    };
  }

  function start(options) {
    const o = normalize(options);
    return Object.assign(o, initialPoints(o), { step: 0 });
  }

  /** Change an option, resetting the animation as the applet's Reset does.
      The three draggable points survive a change: ProcessNumberChange calls
      Reset, not init. */
  function setOptions(state, patch) {
    const next = normalize(Object.assign({}, state, patch));
    const points = state && state.P1 && state.P2 && state.P
      ? { P1: state.P1, P2: state.P2, P: state.P }
      : initialPoints(next);
    return Object.assign(next, points, { step: 0 });
  }

  /* ------------------------------------------ the applet's own geometry */

  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const sqDist = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  const dist = (a, b) => Math.sqrt(sqDist(a, b));

  /* GeoSDoub.FindCircumcenter: the intersection of the two translated
     perpendicular bisectors, exactly as the bytecode constructs them. */
  function circumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, p, m2, q);
  }

  /* GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint):
     a1*x + b1*y + c1 = 0 and a2*x + b2*y + c2 = 0 by Cramer's rule. */
  function intersect(a, b, c, d) {
    const A = a.y - b.y, B = b.x - a.x;
    const C = a.x * b.y - a.y * b.x;
    const D = c.y - d.y, E = d.x - c.x;
    const F = c.x * d.y - c.y * d.x;
    const det = A * E - D * B;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // Java: |det| < 1
    return { x: (B * F - E * C) / det, y: (C * D - F * A) / det };
  }

  /* GeoSDoub.ComputeSignedAngle(a, b, c) with a=Fixed, b=Moving,
     c=Fixed+(100,0). The applet's angle is signed by FindOrientation; its
     GetNext draws (cos angle, -sin angle), which is the same *line* as the
     one through Fixed and Moving (possibly reversed by half a turn). */
  function signedAngle(a, b, c) {
    const cos = ((sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2) /
      (dist(a, b) * dist(a, c));
    let angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    // The >0.99 guard in the bytecode can never fire: a squared distance is
    // never negative. It is kept as a faithful, harmless quirk.
    if (angle > 0.99 && ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) < 0) angle = Math.PI;
    const orientation = (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
    return orientation > 0 ? angle : -angle;
  }

  /** The applet's RotatingLine.Recalc angle from its fixed and moving points. */
  function recalcAngle(fixed, moving) {
    return signedAngle(fixed, moving, { x: fixed.x + 100, y: fixed.y });
  }

  /* A RotatingLine: a fixed point, the current moving point and the angle
     Recalc computed for it. `GetNext` adds the increment to the angle and
     places the moving point 1000 units away at (cos, -sin). */
  function line(fixed, moving) {
    return {
      fixed: { x: fixed.x, y: fixed.y },
      moving: { x: moving.x, y: moving.y },
      angle: recalcAngle(fixed, moving),
      increment: 0,
    };
  }

  /** RotatingLine.Shift: rotate the moving point by delta about the fixed
      point and build a fresh line, whose constructor calls Recalc. */
  function shiftLine(l, delta) {
    const a = l.angle + delta;
    return line(l.fixed, {
      x: l.fixed.x + RAY_LENGTH * Math.cos(a),
      y: l.fixed.y - RAY_LENGTH * Math.sin(a),
    });
  }

  /** A TwoLineConfiguration: two beams and their latest crossing point. */
  function configuration(p1, p2, p) {
    return { l1: line(p1, p), l2: line(p2, p) };
  }

  /** TwoLineConfiguration.Shift(delta): both beams shift, then the new
      crossing becomes the P of the fresh configuration. */
  function shiftConfiguration(cfg, delta) {
    const a = shiftLine(cfg.l1, delta);
    const b = shiftLine(cfg.l2, delta);
    return configuration(a.fixed, b.fixed, intersect(a.fixed, a.moving, b.fixed, b.moving));
  }

  /** GetNext on both beams, then GeoSDoub.Intersect of the two DoubLines. */
  function stepConfiguration(cfg) {
    for (const l of [cfg.l1, cfg.l2]) {
      l.angle += l.increment;
      l.moving = {
        x: l.fixed.x + RAY_LENGTH * Math.cos(l.angle),
        y: l.fixed.y - RAY_LENGTH * Math.sin(l.angle),
      };
    }
    return intersect(cfg.l1.fixed, cfg.l1.moving, cfg.l2.fixed, cfg.l2.moving);
  }

  /* LightHouseCanvas.SetNum, with the P/P1/P2 layout of init. The average
     distance from the circumcentre picks the angle step of the animation. */
  function ngon(state) {
    const c = circumcenter(state.P1, state.P2, state.P);
    const r = (dist(state.P1, c) + dist(state.P2, c) + dist(state.P, c)) / 3;
    return r < 30 ? NGONS[0] : r < 90 ? NGONS[1] : r < 180 ? NGONS[2] : NGONS[3];
  }

  /* ------------------- a literal transcription of the applet's own array -----
     Reset makes config[0] from the three draggable points; SetConfigurations
     repeatedly calls TwoLineConfiguration.Shift(PI/N), which adds PI/N to
     *both* lines of the previous configuration. The row-i seed is made from
     config[0]'s first beam and config[i]'s second beam. SetIncrement receives
     (PI/Ngon, Rate1, Rate2), and its two-argument form multiplies the common
     PI/Ngon by each rate. This is kept for the logic test, which compares it
     with a second transcription of the bytecode over the whole parameter
     space. */
  function appletConfigurations(state) {
    const N = state.N;
    const base = ngon(state);
    const cfg = new Array(N * N);
    cfg[0] = configuration(state.P1, state.P2, state.P);

    /* SetConfigurations(start): shift the N-1 following configurations by
       PI/N each, then give all N the two increments. */
    const setConfigurations = (start) => {
      for (let k = start + 1; k < start + N; k++) {
        cfg[k] = shiftConfiguration(cfg[k - 1], Math.PI / N);
      }
      for (let k = start; k < start + N; k++) {
        cfg[k].l1.increment = (Math.PI / base) * state.rate1;
        cfg[k].l2.increment = (Math.PI / base) * state.rate2;
      }
    };
    setConfigurations(0);

    /* Reset: row i's seed uses row 0's first beam and row i's second beam. */
    for (let i = 1; i < N; i++) {
      const p = intersect(cfg[0].l1.fixed, cfg[0].l1.moving,
        cfg[i].l2.fixed, cfg[i].l2.moving);
      cfg[i * N] = configuration(state.P1, state.P2, p);
      setConfigurations(i * N);
    }
    return cfg;
  }

  /** The applet's N crossings of row i after `step` GetNext calls. */
  function appletPolygon(state, i, step) {
    const cfg = appletConfigurations(state);
    const row = ((i % state.N) + state.N) % state.N;
    const points = [];
    for (let j = 0; j < state.N; j++) {
      const c = cfg[row * state.N + j];
      let p = intersect(c.l1.fixed, c.l1.moving, c.l2.fixed, c.l2.moving);
      for (let t = 0; t < (step || 0); t++) p = stepConfiguration(c);
      points.push(p);
    }
    return points;
  }

  function appletPolygons(state, step) {
    const cfg = appletConfigurations(state);
    const rows = [];
    for (let i = 0; i < state.N; i++) {
      const points = [];
      for (let j = 0; j < state.N; j++) {
        const c = cfg[i * state.N + j];
        let p = intersect(c.l1.fixed, c.l1.moving, c.l2.fixed, c.l2.moving);
        for (let t = 0; t < (step || 0); t++) p = stepConfiguration(c);
        points.push(p);
      }
      rows.push(points);
    }
    return rows;
  }

  /* ------------- the page's stated geometry: N beams through 360 degrees ---
     The page says the beams are equally spaced through 360 degrees and that
     their crossings are regular polygons. The applet's ComputeSignedAngle
     signs its angle opposite to GetNext's (cos, -sin) direction; its Shift
     then repeats beams for odd N, so the original's odd-N rows degenerate.
     Where the code and the page disagree the page wins, so the picture this
     port draws uses the intended half-step offset (PI/N) and keeps the same
     N, rate ranges, points and increments as the applet. */
  function configurations(state) {
    const N = state.N;
    const inc = (Math.PI / ngon(state));
    const a1 = Math.atan2(state.P1.y - state.P.y, state.P.x - state.P1.x);
    const a2 = Math.atan2(state.P2.y - state.P.y, state.P.x - state.P2.x);
    const rows = [];
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++) {
        row.push({
          l1: { fixed: state.P1, angle: a1 + (j * Math.PI) / N, increment: inc * state.rate1 },
          l2: {
            fixed: state.P2,
            angle: a2 + ((j + i + 1) * Math.PI) / N,
            increment: inc * state.rate2,
          },
        });
      }
      rows.push(row);
    }
    return rows;
  }

  /** The crossing of two beams after `step` animation ticks. */
  function crossing(cfg, step) {
    const at = (l) => ({
      x: l.fixed.x + RAY_LENGTH * Math.cos(l.angle + step * l.increment),
      y: l.fixed.y - RAY_LENGTH * Math.sin(l.angle + step * l.increment),
    });
    const p = at(cfg.l1), q = at(cfg.l2);
    return intersect(cfg.l1.fixed, p, cfg.l2.fixed, q);
  }

  /** The N vertices of polygon row i after `step` animation ticks. */
  function polygon(state, i, step) {
    const rows = configurations(state);
    const row = rows[((i % state.N) + state.N) % state.N];
    return row.map((cfg) => crossing(cfg, step || 0));
  }

  /** All rows; the applet's NumToDraw defaults to N (3 in the HTML). */
  function polygons(state, step) {
    return configurations(state).map((row) => row.map((cfg) => crossing(cfg, step || 0)));
  }

  /* -------------------------------------------------- the page's claim */

  /** Vertices around their centre: beam-index order winds around twice. */
  function ordered(points) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    return points.slice().sort((p, q) =>
      Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  }

  /** Side lengths of the polygon, going round its vertices. */
  function sideLengths(points) {
    const ring = ordered(points);
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      out.push(dist(a, b));
    }
    return out;
  }

  /** Turns between consecutive sides, in degrees. */
  function exteriorAngles(points) {
    const ring = ordered(points);
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const here = ring[i];
      const next = ring[(i + 1) % ring.length];
      const u = sub(here, prev), v = sub(next, here);
      const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
      // The angle between consecutive edge vectors is the exterior angle.
      out.push(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
    }
    return out;
  }

  /** The largest relative difference between the side lengths (0 = regular). */
  function regularity(points) {
    const sides = sideLengths(points);
    const mean = sides.reduce((s, x) => s + x, 0) / sides.length;
    return Math.max(...sides.map((x) => Math.abs(x - mean) / mean));
  }

  /** A line the page's status can show. This is a demo: there is no win. */
  function describe(state) {
    const N = state.N;
    const head = `${N} beam${N === 1 ? "" : "s"} at each lighthouse; rate ${state.rate1} and ${state.rate2}; `;
    if (N < 3) return head + "a polygon needs at least three beams.";
    const p = polygon(state, 0, state.step);
    const r = regularity(p);
    return head + `the crossings are a regular ${N}-gon (sides equal to ${r.toExponential(0)}).`;
  }

  return {
    DEFAULTS, RAY_LENGTH, NGONS, COLORS,
    d2i, normalize, initialPoints, start, setOptions,
    sqDist, dist, intersect, circumcenter, signedAngle, line,
    stepConfiguration, shiftLine, configuration, shiftConfiguration,
    ngon, configurations, polygon, polygons, crossing,
    appletConfigurations, appletPolygon, appletPolygons,
    ordered, sideLengths, exteriorAngles, regularity, describe,
  };
})();
